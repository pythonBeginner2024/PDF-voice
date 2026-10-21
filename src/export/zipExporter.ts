import JSZip from 'jszip';
import { ProjectData } from '../types';
import { getSegmentAudio } from '../storage/db';
import { sanitizeFilename, triggerDownload, formatDuration } from '../audio/wavHelper';

export interface ZipExportProgress {
  currentFile: number;
  totalFiles: number;
  fileName: string;
  percent: number;
}

/**
 * Creates and downloads a ZIP archive containing all converted audio segments
 * and a summary text file.
 */
export async function exportProjectToZip(
  project: ProjectData,
  onProgress?: (progress: ZipExportProgress) => void
): Promise<void> {
  const zip = new JSZip();
  const safeProjectTitle = sanitizeFilename(project.title || project.pdfInfo.name || 'Livre_Audio');

  // Filter completed segments with audio
  const completedSegments = project.segments.filter(
    (seg) => seg.status === 'completed'
  );

  if (completedSegments.length === 0) {
    throw new Error('Aucun segment audio terminé disponible pour l\'exportation ZIP.');
  }

  // Summary file content
  let summaryText = `=================================================\n`;
  summaryText += `  LIVRE AUDIO : ${project.title}\n`;
  summaryText += `=================================================\n\n`;
  summaryText += `Document source : ${project.pdfInfo.name}\n`;
  summaryText += `Pages analysées : ${project.pdfInfo.totalPages}\n`;
  summaryText += `Modèle TTS : ${project.selectedModel}\n`;
  summaryText += `Voix utilisée : ${project.selectedVoice}\n`;
  summaryText += `Date de création : ${new Date(project.createdAt).toLocaleDateString('fr-FR')}\n`;
  summaryText += `Segments convertis : ${completedSegments.length} / ${project.segments.length}\n\n`;
  summaryText += `TABLE DES MATIÈRES / FICHIERS :\n`;
  summaryText += `-------------------------------------------------\n`;

  let totalDurationSec = 0;

  for (let i = 0; i < completedSegments.length; i++) {
    const seg = completedSegments[i];
    const segIndex = (i + 1).toString().padStart(3, '0');
    const segSafeTitle = sanitizeFilename(seg.title || `Partie_${segIndex}`);
    const audioFilename = `${safeProjectTitle}_${segIndex}_${segSafeTitle}.wav`;

    if (onProgress) {
      onProgress({
        currentFile: i + 1,
        totalFiles: completedSegments.length,
        fileName: audioFilename,
        percent: Math.round(((i + 1) / completedSegments.length) * 80), // first 80% is gathering
      });
    }

    // Retrieve audio blob
    let blob = seg.audioBlob;
    if (!blob) {
      blob = await getSegmentAudio(seg.id) || undefined;
    }

    if (blob) {
      const buffer = await blob.arrayBuffer();
      zip.file(audioFilename, buffer);

      const dur = seg.audioDurationSeconds || 0;
      totalDurationSec += dur;
      summaryText += `${segIndex}. ${seg.title} [${formatDuration(dur)}]\n`;
    }
  }

  summaryText += `-------------------------------------------------\n`;
  summaryText += `DURÉE TOTALE APPROXIMATIVE : ${formatDuration(totalDurationSec)}\n`;
  summaryText += `Généré avec PDF to Audio (Gemini TTS)\n`;

  zip.file('Sommaire.txt', summaryText);

  // Generate zip file
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'STORE', // Audio WAV is already uncompressed, STORE is fast and avoids browser freeze
    },
    (metadata) => {
      if (onProgress) {
        onProgress({
          currentFile: completedSegments.length,
          totalFiles: completedSegments.length,
          fileName: 'Compression de l\'archive...',
          percent: 80 + Math.round(metadata.percent * 0.2),
        });
      }
    }
  );

  const zipName = `${safeProjectTitle}_Audiobook.zip`;
  triggerDownload(zipBlob, zipName);
}
