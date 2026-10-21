import { VoiceOption, ModelOption } from '../types';

export const GEMINI_TTS_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.8-flash-lite-tts',
    name: 'Gemini 3.8 Flash Lite TTS',
    description: 'Modèle haute performance, ultra-rapide et économique. Idéal pour la lecture de livres entiers.',
    isDefault: true,
    badge: 'Recommandé',
  },
  {
    id: 'gemini-3.8-flash-tts',
    name: 'Gemini 3.8 Flash TTS',
    description: 'Modèle haute fidélité pour intonations expressives et nuances narratives poussées.',
    badge: 'Expressif',
  },
];

export const DEFAULT_MODEL_ID = 'gemini-3.8-flash-lite-tts';

// Prebuilt voices officially supported by Gemini TTS
export const GEMINI_VOICES: VoiceOption[] = [
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'female',
    description: 'Voix féminine claire, posée et articulée. Idéale pour les romans et essais.',
    recommended: true,
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'male',
    description: 'Voix masculine vive, chaleureuse et naturelle. Très agréable sur la durée.',
    recommended: true,
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'male',
    description: 'Voix masculine profonde, grave et posée. Parfaite pour les récits captivants.',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    gender: 'female',
    description: 'Voix féminine douce, fluide et apaisante.',
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'male',
    description: 'Voix masculine sobre, autoritaire et claire pour ouvrages scientifiques.',
  },
  {
    id: 'Aoede',
    name: 'Aoede',
    gender: 'female',
    description: 'Voix féminine mélodieuse et expressive.',
  },
];

export const DEFAULT_VOICE_ID = 'Kore';

export const TTS_CONSTRAINTS = {
  // Safe chunk limits (Gemini TTS accepts up to a few thousand characters per call,
  // but chunks of 600-1200 characters provide optimal recovery, progress tracking and responsiveness)
  MIN_CHUNK_CHARS: 200,
  DEFAULT_CHUNK_CHARS: 900,
  MAX_CHUNK_CHARS: 2500,
  
  // Rate limits and concurrency
  DEFAULT_CONCURRENCY: 1, // Sequential by default to respect Gemini rate limits on free tier
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY_MS: 2000,
  BACKOFF_FACTOR: 2,
  
  // Standard Sample Rate for Gemini Unary TTS output
  SAMPLE_RATE: 24000,
  CHANNELS: 1, // Mono
  BIT_DEPTH: 16,
};

export const SHORT_TEST_PROMPT = 'Bonjour, je suis la voix de synthèse configurée pour la lecture de votre livre audio.';
