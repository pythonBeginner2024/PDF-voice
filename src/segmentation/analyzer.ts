import { PdfDocumentInfo, Chapter, AudioSegment, SegmentationMode } from '../types';
import { TTS_CONSTRAINTS } from '../config/tts';

/**
 * Common regex patterns to detect chapter and section headers in French & English books.
 */
const CHAPTER_REGEXES = [
  /^(?:chapitre|chapter)\s+([0-9]+|[ivxlcdm]+)(?:\s*[:.\-–—]\s*(.*))?$/i,
  /^(?:partie|part)\s+([0-9]+|[ivxlcdm]+)(?:\s*[:.\-–—]\s*(.*))?$/i,
  /^(?:livre|book)\s+([0-9]+|[ivxlcdm]+)(?:\s*[:.\-–—]\s*(.*))?$/i,
  /^(?:acte|act)\s+([0-9]+|[ivxlcdm]+)(?:\s*[:.\-–—]\s*(.*))?$/i,
  /^(prologue|épilogue|epilogue|introduction|conclusion|préface|preface|avant-propos|postface)(?:\s*[:.\-–—]\s*(.*))?$/i,
  /^([ivxlcdm]+)\.\s+([A-ZÀ-ÖØ-ß].*)$/i,
  /^([0-9]{1,2})\.\s+([A-ZÀ-ÖØ-ß].*)$/,
];

export interface DetectedHeading {
  title: string;
  pageNumber: number;
  lineIndex: number;
}

/**
 * Scans all pages to find headings and chapter boundaries.
 */
export function detectHeadings(pdfInfo: PdfDocumentInfo): DetectedHeading[] {
  const headings: DetectedHeading[] = [];

  for (const page of pdfInfo.pages) {
    if (page.isEmpty) continue;

    const lines = page.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.length > 90) continue; // Skip lines that are too long to be headings

      for (const regex of CHAPTER_REGEXES) {
        const match = line.match(regex);
        if (match) {
          headings.push({
            title: line,
            pageNumber: page.pageNumber,
            lineIndex: i,
          });
          break;
        }
      }
    }
  }

  return headings;
}

/**
 * Splits a long text into sub-chunks of approximately `targetChars` (default ~900 chars),
 * respecting sentence boundaries (. ! ? \n\n) and never splitting words.
 */
export function chunkTextBySentence(text: string, targetChars: number = TTS_CONSTRAINTS.DEFAULT_CHUNK_CHARS): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= targetChars * 1.25) {
    return [clean];
  }

  // Regex to split on French sentence boundaries: ., !, ?, followed by space or newline or quote
  const sentenceRegex = /([^.!?\n]+[.!?]+(?:['"»\s]+|$)|[^\n]+\n+)/g;
  const rawSentences: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = sentenceRegex.exec(clean)) !== null) {
    const s = match[0].trim();
    if (s) rawSentences.push(s);
  }

  if (rawSentences.length === 0) {
    rawSentences.push(clean);
  }

  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of rawSentences) {
    // If a single sentence is exceptionally long, split it by comma or spaces
    if (sentence.length > targetChars * 1.5) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      const words = sentence.split(/\s+/);
      let wordSubChunk = '';
      for (const w of words) {
        if ((wordSubChunk + ' ' + w).length > targetChars) {
          if (wordSubChunk.trim()) chunks.push(wordSubChunk.trim());
          wordSubChunk = w;
        } else {
          wordSubChunk = wordSubChunk ? `${wordSubChunk} ${w}` : w;
        }
      }
      if (wordSubChunk.trim()) currentChunk = wordSubChunk.trim();
      continue;
    }

    if ((currentChunk + ' ' + sentence).length > targetChars && currentChunk.length >= targetChars * 0.4) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Analyzes the document and builds chapters and segments based on the selected mode.
 */
export function buildSegmentation(
  pdfInfo: PdfDocumentInfo,
  mode: SegmentationMode,
  targetChars: number = TTS_CONSTRAINTS.DEFAULT_CHUNK_CHARS
): { chapters: Chapter[]; segments: AudioSegment[] } {
  const projectId = pdfInfo.id;

  if (mode === 'full') {
    // Mode A: Full text
    const fullText = pdfInfo.pages.map((p) => p.text).filter(Boolean).join('\n\n');
    const chunks = chunkTextBySentence(fullText, targetChars);

    const segments: AudioSegment[] = chunks.map((chunk, idx) => ({
      id: `${projectId}_seg_${idx + 1}`,
      projectId,
      order: idx + 1,
      title: chunks.length === 1 ? 'Texte intégral' : `Partie ${idx + 1} / ${chunks.length}`,
      text: chunk,
      charCount: chunk.length,
      startPage: 1,
      endPage: pdfInfo.totalPages,
      selected: true,
      status: 'pending',
      progress: 0,
      attempts: 0,
    }));

    const chapter: Chapter = {
      index: 1,
      title: 'Document complet',
      startPage: 1,
      endPage: pdfInfo.totalPages,
      text: fullText,
      charCount: fullText.length,
      wordCount: fullText.split(/\s+/).filter(Boolean).length,
      selected: true,
      segments,
    };

    return { chapters: [chapter], segments };
  }

  if (mode === 'chapters') {
    // Mode B: Detected chapters
    const headings = detectHeadings(pdfInfo);

    if (headings.length >= 2) {
      const chapters: Chapter[] = [];
      const allSegments: AudioSegment[] = [];
      let globalSegOrder = 1;

      for (let i = 0; i < headings.length; i++) {
        const currentHeading = headings[i];
        const nextHeading = headings[i + 1];

        const startPage = currentHeading.pageNumber;
        const endPage = nextHeading ? nextHeading.pageNumber : pdfInfo.totalPages;

        // Gather text for this chapter
        const chapterPages = pdfInfo.pages.filter(
          (p) => p.pageNumber >= startPage && p.pageNumber <= endPage
        );
        let chapterText = chapterPages.map((p) => p.text).join('\n\n');

        // If next chapter starts on same page, split text accurately if needed
        const subChunks = chunkTextBySentence(chapterText, targetChars);
        const chapterSegments: AudioSegment[] = subChunks.map((chunk, subIdx) => {
          const seg: AudioSegment = {
            id: `${projectId}_ch${i + 1}_seg${subIdx + 1}`,
            projectId,
            order: globalSegOrder++,
            title: subChunks.length > 1
              ? `${currentHeading.title} (Partie ${subIdx + 1}/${subChunks.length})`
              : currentHeading.title,
            chapterIndex: i + 1,
            chapterTitle: currentHeading.title,
            text: chunk,
            charCount: chunk.length,
            startPage,
            endPage,
            selected: true,
            status: 'pending',
            progress: 0,
            attempts: 0,
          };
          allSegments.push(seg);
          return seg;
        });

        chapters.push({
          index: i + 1,
          title: currentHeading.title,
          startPage,
          endPage,
          text: chapterText,
          charCount: chapterText.length,
          wordCount: chapterText.split(/\s+/).filter(Boolean).length,
          selected: true,
          segments: chapterSegments,
        });
      }

      return { chapters, segments: allSegments };
    }
    // Fallback to automatic portions if insufficient headings found
  }

  // Mode C: Portions automatiques (or fallback for Mode B when no clear chapters)
  const fullText = pdfInfo.pages.map((p) => p.text).filter(Boolean).join('\n\n');
  const chunks = chunkTextBySentence(fullText, targetChars);

  const segments: AudioSegment[] = chunks.map((chunk, idx) => ({
    id: `${projectId}_portion_${idx + 1}`,
    projectId,
    order: idx + 1,
    title: `Portion ${idx + 1} / ${chunks.length}`,
    text: chunk,
    charCount: chunk.length,
    selected: true,
    status: 'pending',
    progress: 0,
    attempts: 0,
  }));

  const chapter: Chapter = {
    index: 1,
    title: `Ensemble des portions (${chunks.length})`,
    startPage: 1,
    endPage: pdfInfo.totalPages,
    text: fullText,
    charCount: fullText.length,
    wordCount: fullText.split(/\s+/).filter(Boolean).length,
    selected: true,
    segments,
  };

  return { chapters: [chapter], segments };
}
