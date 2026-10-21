import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PdfDocumentInfo, PdfPage } from '../types';

// Set up worker for Vite bundle
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ExtractionProgress {
  currentPage: number;
  totalPages: number;
  percent: number;
}

/**
 * Extracts and analyzes text from an uploaded PDF file or ArrayBuffer.
 */
export async function extractTextFromPdf(
  fileOrBuffer: File | ArrayBuffer,
  fileName?: string,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<PdfDocumentInfo> {
  let arrayBuffer: ArrayBuffer;
  let name = fileName || 'document.pdf';
  let sizeBytes = 0;

  if (fileOrBuffer instanceof File) {
    name = fileOrBuffer.name;
    sizeBytes = fileOrBuffer.size;
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
    sizeBytes = arrayBuffer.byteLength;
  }

  // Load the PDF document
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  const pages: PdfPage[] = [];
  let totalChars = 0;
  let totalWords = 0;
  let emptyPageCount = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Reconstruct lines and text tokens cleanly
    let pageText = '';
    let lastY: number | null = null;

    for (const item of textContent.items) {
      if ('str' in item) {
        const textItem = item as { str: string; transform: number[] };
        const currentY = textItem.transform[5];

        if (lastY !== null && Math.abs(currentY - lastY) > 5) {
          // Significant vertical shift -> new line
          pageText += '\n';
        } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
          pageText += ' ';
        }

        pageText += textItem.str;
        lastY = currentY;
      }
    }

    // Clean whitespace and normalize hyphens
    const cleanedText = cleanExtractedText(pageText);
    const charCount = cleanedText.length;
    const words = cleanedText.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const isEmpty = charCount < 20;

    if (isEmpty) {
      emptyPageCount++;
    }

    totalChars += charCount;
    totalWords += wordCount;

    pages.push({
      pageNumber: pageNum,
      text: cleanedText,
      charCount,
      wordCount,
      isEmpty,
    });

    if (onProgress) {
      onProgress({
        currentPage: pageNum,
        totalPages,
        percent: Math.round((pageNum / totalPages) * 100),
      });
    }
  }

  // Heuristic for scanned documents:
  // If more than 75% of pages have less than 20 characters and total pages >= 2
  const isLikelyScanned = totalPages > 1 && emptyPageCount / totalPages >= 0.75;

  return {
    id: `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    sizeBytes,
    totalPages,
    pages,
    totalChars,
    totalWords,
    isLikelyScanned,
    emptyPageCount,
    extractedAt: Date.now(),
  };
}

/**
 * Normalizes text extracted from PDF:
 * - joins hyphenated words split across lines (e.g., 'transfor- mation' or 're-\ncherche')
 * - cleans extra repeated whitespace while keeping paragraph breaks
 */
export function cleanExtractedText(raw: string): string {
  if (!raw) return '';

  return (
    raw
      // Normalize Unicode line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Join words split by hyphen at end of line (e.g. 'compor-\ntement' -> 'comportement')
      .replace(/(\b\w+)-\s*\n\s*(\w+\b)/g, '$1$2')
      // Replace multiple blank lines with two newlines
      .replace(/\n{3,}/g, '\n\n')
      // Replace non-breaking spaces and tabs with normal space
      .replace(/[\t\u00A0\u2000-\u200B]/g, ' ')
      // Replace multiple spaces with a single space
      .replace(/[ ]{2,}/g, ' ')
      .trim()
  );
}

/**
 * Estimates reading time in minutes based on ~150 words per minute (standard French audiobook pace).
 */
export function estimateReadingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 150));
}
