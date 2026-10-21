/**
 * Audio & WAV Helper utilities
 * Implements proper WAV header parsing, generation, and multi-segment PCM concatenation.
 */

export interface WavMetadata {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataLength: number;
  durationSeconds: number;
}

/**
 * Parses a WAV file buffer and extracts its format header & PCM data offset.
 */
export function parseWavHeader(buffer: ArrayBuffer): WavMetadata {
  if (buffer.byteLength < 44) {
    throw new Error('Données audio trop courtes pour un fichier WAV valide (< 44 octets).');
  }

  const dataView = new DataView(buffer);
  
  // Check "RIFF"
  const riff = String.fromCharCode(
    dataView.getUint8(0),
    dataView.getUint8(1),
    dataView.getUint8(2),
    dataView.getUint8(3)
  );
  if (riff !== 'RIFF') {
    throw new Error(`En-tête RIFF invalide (trouvé: ${riff})`);
  }

  // Check "WAVE"
  const wave = String.fromCharCode(
    dataView.getUint8(8),
    dataView.getUint8(9),
    dataView.getUint8(10),
    dataView.getUint8(11)
  );
  if (wave !== 'WAVE') {
    throw new Error(`En-tête WAVE invalide (trouvé: ${wave})`);
  }

  // Find "fmt " and "data" chunks (robust chunk walker rather than assuming fixed offsets)
  let offset = 12;
  let numChannels = 1;
  let sampleRate = 24000;
  let bitsPerSample = 16;
  let dataOffset = 0;
  let dataLength = 0;

  while (offset + 8 <= buffer.byteLength) {
    const chunkId = String.fromCharCode(
      dataView.getUint8(offset),
      dataView.getUint8(offset + 1),
      dataView.getUint8(offset + 2),
      dataView.getUint8(offset + 3)
    );
    const chunkSize = dataView.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      // Audio format (1 = PCM)
      numChannels = dataView.getUint16(offset + 10, true);
      sampleRate = dataView.getUint32(offset + 12, true);
      bitsPerSample = dataView.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      // Some encoders write 0 or 0xFFFFFFFF, if so bound by remaining buffer
      dataLength = Math.min(chunkSize, buffer.byteLength - dataOffset);
      break;
    }

    offset += 8 + chunkSize;
  }

  if (dataOffset === 0) {
    // Fallback standard 44-byte WAV header
    dataOffset = 44;
    dataLength = Math.max(0, buffer.byteLength - 44);
  }

  const bytesPerSecond = sampleRate * numChannels * (bitsPerSample / 8);
  const durationSeconds = bytesPerSecond > 0 ? dataLength / bytesPerSecond : 0;

  return {
    sampleRate,
    numChannels,
    bitsPerSample,
    dataOffset,
    dataLength,
    durationSeconds,
  };
}

/**
 * Creates a standard 44-byte WAV header for raw PCM data.
 */
export function createWavHeader(
  dataLength: number,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true); // ChunkSize: 4 + (8 + SubChunk1Size) + (8 + SubChunk2Size)
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size: 16 for PCM
  view.setUint16(20, 1, true); // AudioFormat: 1 for PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  return new Uint8Array(header);
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Concatenates multiple WAV file buffers into a single, seamless WAV Blob.
 * Validates audio parameters compatibility and updates chunk sizes.
 */
export function concatenateWavBuffers(wavBuffers: ArrayBuffer[]): Blob {
  if (wavBuffers.length === 0) {
    throw new Error('Aucun segment audio fourni pour la concaténation.');
  }

  if (wavBuffers.length === 1) {
    return new Blob([wavBuffers[0]], { type: 'audio/wav' });
  }

  const parsedHeaders = wavBuffers.map((b, i) => {
    try {
      return parseWavHeader(b);
    } catch (e) {
      throw new Error(`Erreur d'analyse sur le segment ${i + 1}: ${(e as Error).message}`);
    }
  });

  const baseHeader = parsedHeaders[0];

  // Verify compatibility across all segments
  for (let i = 1; i < parsedHeaders.length; i++) {
    const h = parsedHeaders[i];
    if (
      h.sampleRate !== baseHeader.sampleRate ||
      h.numChannels !== baseHeader.numChannels ||
      h.bitsPerSample !== baseHeader.bitsPerSample
    ) {
      console.warn(
        `Différence de paramètres audio détectée au segment ${i + 1} (base: ${baseHeader.sampleRate}Hz, ${baseHeader.numChannels}ch ; courant: ${h.sampleRate}Hz, ${h.numChannels}ch). Assemblage avec précaution.`
      );
    }
  }

  // Calculate total raw PCM length
  let totalDataLength = 0;
  for (let i = 0; i < wavBuffers.length; i++) {
    totalDataLength += parsedHeaders[i].dataLength;
  }

  // Create unified WAV header
  const headerBytes = createWavHeader(
    totalDataLength,
    baseHeader.sampleRate,
    baseHeader.numChannels,
    baseHeader.bitsPerSample
  );

  // Construct final buffer
  const finalBuffer = new Uint8Array(44 + totalDataLength);
  finalBuffer.set(headerBytes, 0);

  let currentOffset = 44;
  for (let i = 0; i < wavBuffers.length; i++) {
    const h = parsedHeaders[i];
    const pcmChunk = new Uint8Array(wavBuffers[i], h.dataOffset, h.dataLength);
    finalBuffer.set(pcmChunk, currentOffset);
    currentOffset += h.dataLength;
  }

  return new Blob([finalBuffer], { type: 'audio/wav' });
}

/**
 * Converts a base64 encoded audio string into an ArrayBuffer.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Strip possible data URI prefix if present
  const cleanBase64 = base64.replace(/^data:audio\/\w+;base64,/, '');
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Formats seconds into MM:SS or HH:MM:SS.
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const paddedMins = mins.toString().padStart(2, '0');
  const paddedSecs = secs.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${paddedMins}:${paddedSecs}`;
  }
  return `${paddedMins}:${paddedSecs}`;
}

/**
 * Sanitizes a string for use in filenames.
 */
export function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-zA-Z0-9_\-.]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60);
}

/**
 * Triggers a browser download for a Blob.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
