export type SegmentationMode = 'full' | 'chapters' | 'chunks';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'paused';

export interface PdfPage {
  pageNumber: number;
  text: string;
  charCount: number;
  wordCount: number;
  isEmpty: boolean;
}

export interface PdfDocumentInfo {
  id: string;
  name: string;
  sizeBytes: number;
  totalPages: number;
  pages: PdfPage[];
  totalChars: number;
  totalWords: number;
  isLikelyScanned: boolean;
  emptyPageCount: number;
  extractedAt: number;
}

export interface AudioSegment {
  id: string;
  projectId: string;
  order: number;
  title: string;
  chapterIndex?: number;
  chapterTitle?: string;
  text: string;
  charCount: number;
  startPage?: number;
  endPage?: number;
  selected: boolean;
  
  // Conversion state
  status: TaskStatus;
  progress: number; // 0 - 100
  attempts: number;
  errorMessage?: string;
  
  // Audio result
  audioBlob?: Blob;
  audioUrl?: string;
  audioDurationSeconds?: number;
  audioSizeBytes?: number;
}

export interface Chapter {
  index: number;
  title: string;
  startPage: number;
  endPage: number;
  text: string;
  charCount: number;
  wordCount: number;
  selected: boolean;
  segments: AudioSegment[];
}

export interface ProjectData {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pdfInfo: PdfDocumentInfo;
  mode: SegmentationMode;
  targetChunkChars: number;
  selectedVoice: string;
  selectedModel: string;
  styleInstruction?: string;
  segments: AudioSegment[];
  chapters: Chapter[];
  isCompleted: boolean;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male';
  description: string;
  recommended?: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  badge?: string;
}

export interface TtsSettings {
  apiKey: string;
  persistApiKey: boolean;
  selectedModel: string;
  selectedVoice: string;
  targetChunkChars: number;
  styleInstruction: string;
  concurrencyLimit: number;
}

export interface ConversionStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalAudioSeconds: number;
  percent: number;
}
