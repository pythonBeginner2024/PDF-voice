import { ProjectData, TtsSettings } from '../types';
import { DEFAULT_MODEL_ID, DEFAULT_VOICE_ID, TTS_CONSTRAINTS } from '../config/tts';

const DB_NAME = 'pdf_to_audio_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_AUDIO = 'audio_blobs';

const LOCAL_STORAGE_SETTINGS_KEY = 'pdf_to_audio_settings';
const LOCAL_STORAGE_KEY_SECRET = 'pdf_to_audio_api_key';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB n\'est pas disponible dans cet environnement'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO); // Key is segmentId: string, Value is Blob or ArrayBuffer
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

// =================== Projects CRUD ===================

export async function saveProject(project: ProjectData): Promise<void> {
  const db = await getDb();
  // Strip transient audioBlob and audioUrl from segments metadata to keep project metadata lightweight
  const sanitizedProject: ProjectData = {
    ...project,
    updatedAt: Date.now(),
    segments: project.segments.map((seg) => ({
      ...seg,
      audioBlob: undefined,
      audioUrl: undefined,
    })),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.put(sanitizedProject);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getProject(id: string): Promise<ProjectData | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.get(id);

    req.onsuccess = () => {
      const project = req.result as ProjectData | undefined;
      resolve(project || null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getAllProjects(): Promise<ProjectData[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.getAll();

    req.onsuccess = () => {
      const projects = (req.result as ProjectData[]) || [];
      // Sort newest first
      projects.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(projects);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  const project = await getProject(id);
  
  if (project) {
    // Delete all associated audio blobs
    for (const seg of project.segments) {
      await deleteSegmentAudio(seg.id).catch(() => {});
    }
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// =================== Audio Blobs Storage ===================

export async function saveSegmentAudio(segmentId: string, audioBlob: Blob): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, 'readwrite');
    const store = tx.objectStore(STORE_AUDIO);
    const req = store.put(audioBlob, segmentId);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getSegmentAudio(segmentId: string): Promise<Blob | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, 'readonly');
    const store = tx.objectStore(STORE_AUDIO);
    const req = store.get(segmentId);

    req.onsuccess = () => {
      const blob = req.result as Blob | undefined;
      resolve(blob || null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSegmentAudio(segmentId: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, 'readwrite');
    const store = tx.objectStore(STORE_AUDIO);
    const req = store.delete(segmentId);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllLocalData(): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS, STORE_AUDIO], 'readwrite');
    tx.objectStore(STORE_PROJECTS).clear();
    tx.objectStore(STORE_AUDIO).clear();

    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// =================== Settings & API Key Storage ===================

export function loadSettings(): TtsSettings {
  const defaults: TtsSettings = {
    apiKey: '',
    persistApiKey: false,
    selectedModel: DEFAULT_MODEL_ID,
    selectedVoice: DEFAULT_VOICE_ID,
    targetChunkChars: TTS_CONSTRAINTS.DEFAULT_CHUNK_CHARS,
    styleInstruction: 'Lecture claire, posée et naturelle pour un livre audio captivant.',
    concurrencyLimit: TTS_CONSTRAINTS.DEFAULT_CONCURRENCY,
  };

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      defaults.selectedModel = parsed.selectedModel || defaults.selectedModel;
      defaults.selectedVoice = parsed.selectedVoice || defaults.selectedVoice;
      defaults.targetChunkChars = parsed.targetChunkChars || defaults.targetChunkChars;
      defaults.styleInstruction = parsed.styleInstruction ?? defaults.styleInstruction;
      defaults.concurrencyLimit = parsed.concurrencyLimit || defaults.concurrencyLimit;
      defaults.persistApiKey = Boolean(parsed.persistApiKey);
    }

    if (defaults.persistApiKey) {
      const savedKey = localStorage.getItem(LOCAL_STORAGE_KEY_SECRET);
      if (savedKey) {
        defaults.apiKey = savedKey;
      }
    }
  } catch (e) {
    console.warn('Impossible de charger les paramètres locaux:', e);
  }

  return defaults;
}

export function saveSettings(settings: Partial<TtsSettings>): void {
  try {
    const current = loadSettings();
    const updated = { ...current, ...settings };

    const toStore = {
      selectedModel: updated.selectedModel,
      selectedVoice: updated.selectedVoice,
      targetChunkChars: updated.targetChunkChars,
      styleInstruction: updated.styleInstruction,
      concurrencyLimit: updated.concurrencyLimit,
      persistApiKey: updated.persistApiKey,
    };

    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(toStore));

    if (updated.persistApiKey && updated.apiKey) {
      localStorage.setItem(LOCAL_STORAGE_KEY_SECRET, updated.apiKey);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY_SECRET);
    }
  } catch (e) {
    console.warn('Impossible de sauvegarder les paramètres:', e);
  }
}

export function removeStoredApiKey(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY_SECRET);
    const settings = loadSettings();
    settings.persistApiKey = false;
    settings.apiKey = '';
    saveSettings(settings);
  } catch (e) {
    console.warn('Erreur lors de la suppression de la clé locale:', e);
  }
}
