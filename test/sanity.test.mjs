import assert from 'node:assert';
import { chunkTextBySentence } from '../src/segmentation/analyzer.ts';
import { createWavHeader, parseWavHeader, concatenateWavBuffers } from '../src/audio/wavHelper.ts';

console.log('🧪 Lancement des tests unitaires de PDF to Audio...');

// 1. Test du découpage de texte aux frontières de phrases en français
{
  const text = "Ceci est une première phrase d'introduction. Voici la deuxième phrase, riche en détails et en vocabulaire français ! Enfin, voici la troisième phrase qui conclut ce paragraphe ?";
  const chunks = chunkTextBySentence(text, 80);
  assert(chunks.length >= 2, 'Le texte doit être découpé en plusieurs portions');
  assert(chunks.join(' ').includes("première phrase d'introduction"), 'Les apostrophes et accents doivent être préservés');
  console.log('  ✅ Test segmentation phrases & accents : Succès');
}

// 2. Test de génération d'en-tête WAV et parsing
{
  const pcmLength = 48000; // 1 seconde de PCM 24kHz 16-bit mono
  const headerBytes = createWavHeader(pcmLength, 24000, 1, 16);
  assert.strictEqual(headerBytes.length, 44, "L'en-tête WAV doit mesurer exactement 44 octets");

  // Création d'un WAV complet simulé
  const fullWav = new Uint8Array(44 + pcmLength);
  fullWav.set(headerBytes, 0);

  const parsed = parseWavHeader(fullWav.buffer);
  assert.strictEqual(parsed.sampleRate, 24000, "Le taux d'échantillonnage doit être 24000 Hz");
  assert.strictEqual(parsed.numChannels, 1, 'Le nombre de canaux doit être 1 (mono)');
  assert.strictEqual(parsed.bitsPerSample, 16, 'La profondeur de bits doit être 16 bits');
  assert.strictEqual(parsed.dataLength, pcmLength, 'La taille de données data doit correspondre au PCM');
  assert.strictEqual(parsed.durationSeconds, 1, 'La durée calculée doit être de 1 seconde');
  console.log('  ✅ Test génération et parsing WAV 24kHz : Succès');
}

// 3. Test de concaténation de multiples segments WAV
{
  const pcm1 = new Uint8Array(24000); // 0.5s
  const pcm2 = new Uint8Array(48000); // 1.0s

  const h1 = createWavHeader(pcm1.length, 24000, 1, 16);
  const w1 = new Uint8Array(44 + pcm1.length);
  w1.set(h1, 0);
  w1.set(pcm1, 44);

  const h2 = createWavHeader(pcm2.length, 24000, 1, 16);
  const w2 = new Uint8Array(44 + pcm2.length);
  w2.set(h2, 0);
  w2.set(pcm2, 44);

  const blob = concatenateWavBuffers([w1.buffer, w2.buffer]);
  assert.strictEqual(blob.size, 44 + pcm1.length + pcm2.length, "La taille du WAV assemblé doit être 44 octets d'en-tête + somme des PCM");
  console.log('  ✅ Test assemblage multi-segments WAV : Succès');
}

console.log('🎉 Tous les tests unitaires ont réussi !');
