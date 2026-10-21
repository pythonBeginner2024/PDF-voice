import { AudioSegment, ProjectData } from '../types';
import { generateSpeechAudio } from '../tts/geminiTtsClient';
import { saveSegmentAudio, saveProject } from '../storage/db';
import { TTS_CONSTRAINTS } from '../config/tts';

export interface QueueCallbacks {
  onSegmentUpdate: (segment: AudioSegment) => void;
  onProjectUpdate: (project: ProjectData) => void;
  onQueueFinished: () => void;
  onError: (segment: AudioSegment, error: Error) => void;
}

export class ConversionQueue {
  private project: ProjectData;
  private apiKey: string;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private callbacks: QueueCallbacks;
  private activeCount: number = 0;
  private abortController: AbortController | null = null;

  constructor(project: ProjectData, apiKey: string, callbacks: QueueCallbacks) {
    this.project = project;
    this.apiKey = apiKey;
    this.callbacks = callbacks;
  }

  public updateApiKey(key: string): void {
    this.apiKey = key;
  }

  public updateProject(project: ProjectData): void {
    this.project = project;
  }

  public start(): void {
    if (this.isRunning && !this.isPaused) return;

    this.isRunning = true;
    this.isPaused = false;
    this.abortController = new AbortController();
    this.processNext();
  }

  public pause(): void {
    this.isPaused = true;
    this.isRunning = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    // Mark any currently processing items back to paused/pending
    this.project.segments = this.project.segments.map((s) => {
      if (s.status === 'processing') {
        return { ...s, status: 'paused', progress: 0 };
      }
      return s;
    });
    this.callbacks.onProjectUpdate(this.project);
    saveProject(this.project).catch(console.warn);
  }

  public retryFailed(): void {
    this.project.segments = this.project.segments.map((s) => {
      if (s.status === 'failed') {
        return {
          ...s,
          status: 'pending',
          attempts: 0,
          errorMessage: undefined,
          progress: 0,
        };
      }
      return s;
    });

    this.callbacks.onProjectUpdate(this.project);
    saveProject(this.project).catch(console.warn);

    this.start();
  }

  public retrySingleSegment(segmentId: string): void {
    const seg = this.project.segments.find((s) => s.id === segmentId);
    if (seg) {
      seg.status = 'pending';
      seg.attempts = 0;
      seg.errorMessage = undefined;
      seg.progress = 0;
      this.callbacks.onSegmentUpdate({ ...seg });
      this.callbacks.onProjectUpdate(this.project);
      saveProject(this.project).catch(console.warn);

      if (!this.isRunning) {
        this.start();
      }
    }
  }

  private async processNext(): Promise<void> {
    if (!this.isRunning || this.isPaused) return;

    const concurrency = Math.max(1, this.project.targetChunkChars > 1500 ? 1 : 1); // 1 is safest for Gemini Free Tier TPM/RPM

    if (this.activeCount >= concurrency) return;

    // Find next pending or paused segment that is selected
    const nextSegment = this.project.segments.find(
      (s) => s.selected && (s.status === 'pending' || s.status === 'paused')
    );

    if (!nextSegment) {
      if (this.activeCount === 0) {
        // Everything completed or failed
        this.isRunning = false;
        const allCompleted = this.project.segments
          .filter((s) => s.selected)
          .every((s) => s.status === 'completed');
        this.project.isCompleted = allCompleted;
        this.callbacks.onProjectUpdate(this.project);
        saveProject(this.project).catch(console.warn);
        this.callbacks.onQueueFinished();
      }
      return;
    }

    this.activeCount++;
    this.convertSegment(nextSegment)
      .finally(() => {
        this.activeCount--;
        if (this.isRunning && !this.isPaused) {
          this.processNext();
        }
      });

    // If concurrency > 1, schedule another slot
    if (concurrency > 1 && this.activeCount < concurrency) {
      this.processNext();
    }
  }

  private async convertSegment(segment: AudioSegment): Promise<void> {
    segment.status = 'processing';
    segment.progress = 20;
    segment.attempts += 1;
    this.callbacks.onSegmentUpdate({ ...segment });

    let delayMs = TTS_CONSTRAINTS.INITIAL_RETRY_DELAY_MS;
    let attempt = 0;
    let success = false;
    let lastError: Error | null = null;

    while (attempt < TTS_CONSTRAINTS.MAX_RETRIES && !success && !this.isPaused) {
      try {
        segment.progress = 30 + attempt * 15;
        this.callbacks.onSegmentUpdate({ ...segment });

        const result = await generateSpeechAudio({
          text: segment.text,
          apiKey: this.apiKey,
          model: this.project.selectedModel,
          voice: this.project.selectedVoice,
          styleInstruction: this.project.styleInstruction,
        });

        const audioBlob = new Blob([result.audioBuffer], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Save blob in IndexedDB
        await saveSegmentAudio(segment.id, audioBlob);

        segment.status = 'completed';
        segment.progress = 100;
        segment.audioBlob = audioBlob;
        segment.audioUrl = audioUrl;
        segment.audioDurationSeconds = result.durationSeconds;
        segment.audioSizeBytes = audioBlob.size;
        segment.errorMessage = undefined;

        success = true;
        this.callbacks.onSegmentUpdate({ ...segment });
        this.callbacks.onProjectUpdate(this.project);
        await saveProject(this.project);

        // Small respectful delay (400ms) between calls to prevent rate spikes
        await new Promise((r) => setTimeout(r, 400));
        return;
      } catch (err: unknown) {
        lastError = err as Error;
        const msg = lastError?.message || 'Erreur inconnue';
        attempt++;

        // If rate limited or quota exceeded, wait with exponential backoff
        const isRateLimit = msg.includes('429') || msg.includes('QUOTA');
        if (isRateLimit && attempt < TTS_CONSTRAINTS.MAX_RETRIES) {
          segment.errorMessage = `Quota temporairement saturé. Nouvelle tentative dans ${Math.round(delayMs / 1000)}s...`;
          this.callbacks.onSegmentUpdate({ ...segment });
          await new Promise((r) => setTimeout(r, delayMs));
          delayMs *= TTS_CONSTRAINTS.BACKOFF_FACTOR;
        } else if (attempt < TTS_CONSTRAINTS.MAX_RETRIES) {
          segment.errorMessage = `Erreur réseau. Nouvelle tentative (${attempt}/${TTS_CONSTRAINTS.MAX_RETRIES})...`;
          this.callbacks.onSegmentUpdate({ ...segment });
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    if (!success) {
      segment.status = 'failed';
      segment.progress = 0;
      segment.errorMessage = lastError?.message || 'Échec de la synthèse audio';
      this.callbacks.onSegmentUpdate({ ...segment });
      this.callbacks.onProjectUpdate(this.project);
      this.callbacks.onError(segment, lastError || new Error(segment.errorMessage));
      await saveProject(this.project);
    }
  }

  public getStatus(): { isRunning: boolean; isPaused: boolean; activeCount: number } {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      activeCount: this.activeCount,
    };
  }
}
