import { base64ToArrayBuffer, parseWavHeader } from '../audio/wavHelper';
import { DEFAULT_MODEL_ID, DEFAULT_VOICE_ID, SHORT_TEST_PROMPT } from '../config/tts';

export interface GenerateSpeechOptions {
  text: string;
  apiKey: string;
  model?: string;
  voice?: string;
  styleInstruction?: string;
}

export interface SpeechResult {
  audioBuffer: ArrayBuffer;
  durationSeconds: number;
  sampleRate: number;
}

export interface ApiValidationResult {
  valid: boolean;
  message: string;
  statusCode?: number;
  errorType?: 'AUTH_ERROR' | 'QUOTA_ERROR' | 'NETWORK_ERROR' | 'MODEL_ERROR' | 'UNKNOWN';
}

const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Validates a Gemini API key using a minimal test request.
 */
export async function validateApiKey(apiKey: string, model: string = DEFAULT_MODEL_ID): Promise<ApiValidationResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return {
      valid: false,
      message: 'Veuillez saisir votre clé API Google Gemini.',
      errorType: 'AUTH_ERROR',
    };
  }

  // Check basic shape (Google API keys usually start with AIzaSy)
  if (!trimmed.startsWith('AIza')) {
    return {
      valid: false,
      message: 'La clé ne semble pas être une clé API Google valide (commence généralement par "AIza...").',
      errorType: 'AUTH_ERROR',
    };
  }

  const url = `${GEMINI_API_ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(trimmed)}`;

  // Send a minimal prompt to verify authentication and quota
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Bonjour' }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 5,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return {
        valid: true,
        message: 'Clé API validée avec succès ! Accès confirmé.',
        statusCode: res.status,
      };
    }

    const errorJson = await res.json().catch(() => null);
    const serverMessage = errorJson?.error?.message || res.statusText;

    if (res.status === 401 || res.status === 403) {
      return {
        valid: false,
        statusCode: res.status,
        message: `Clé API refusée (${res.status}) : ${serverMessage || 'Clé non reconnue ou droits insuffisants.'}`,
        errorType: 'AUTH_ERROR',
      };
    }

    if (res.status === 429) {
      return {
        valid: false,
        statusCode: res.status,
        message: 'Quota de requêtes dépassé (429) : Trop de requêtes sur votre compte Google AI Studio.',
        errorType: 'QUOTA_ERROR',
      };
    }

    if (res.status === 404) {
      return {
        valid: false,
        statusCode: res.status,
        message: `Modèle "${model}" introuvable ou non activé pour cette clé.`,
        errorType: 'MODEL_ERROR',
      };
    }

    return {
      valid: false,
      statusCode: res.status,
      message: `Erreur ${res.status}: ${serverMessage}`,
      errorType: 'UNKNOWN',
    };
  } catch (err: unknown) {
    const message = (err as Error)?.message || 'Erreur inconnue';
    return {
      valid: false,
      message: `Impossible de contacter l'API Gemini (${message}). Vérifiez votre connexion Internet.`,
      errorType: 'NETWORK_ERROR',
    };
  }
}

/**
 * Calls Gemini TTS API to synthesize text into WAV audio.
 */
export async function generateSpeechAudio(options: GenerateSpeechOptions): Promise<SpeechResult> {
  const {
    text,
    apiKey,
    model = DEFAULT_MODEL_ID,
    voice = DEFAULT_VOICE_ID,
    styleInstruction,
  } = options;

  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error('Le texte à synthétiser est vide.');
  }

  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error('Clé API Gemini manquante. Veuillez la configurer dans les paramètres.');
  }

  const url = `${GEMINI_API_ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(trimmedKey)}`;

  // Construct official Gemini TTS payload
  const speechPart: { text: string; speechMetadata?: { style?: string } } = {
    text: trimmedText,
  };

  if (styleInstruction && styleInstruction.trim()) {
    speechPart.speechMetadata = {
      style: styleInstruction.trim(),
    };
  }

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [speechPart],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice,
          },
        },
      },
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const apiError = errorData?.error?.message || response.statusText;

    if (response.status === 429) {
      throw new Error(`[QUOTA_DEPASSE] Quota Gemini dépassé (429) : ${apiError}`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(`[CLE_INVALIDE] Clé API invalide ou non autorisée (${response.status}) : ${apiError}`);
    }
    if (response.status === 404) {
      throw new Error(`[MODELE_INDISPONIBLE] Modèle TTS "${model}" non disponible sur votre compte.`);
    }
    throw new Error(`Erreur Gemini (${response.status}) : ${apiError}`);
  }

  const result = await response.json();
  const candidate = result.candidates?.[0];
  const firstPart = candidate?.content?.parts?.[0];

  const base64Data = firstPart?.inlineData?.data;
  if (!base64Data) {
    // Check if safety blocked or refusal occurred
    const finishReason = candidate?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      throw new Error(`Génération interrompue par Gemini (Raison: ${finishReason}).`);
    }
    throw new Error('Aucune donnée audio retournée par Gemini dans la réponse.');
  }

  // Convert Base64 string to ArrayBuffer (Gemini Unary returns full 24kHz mono 16-bit WAV)
  const audioBuffer = base64ToArrayBuffer(base64Data);

  // Validate WAV structure and calculate duration
  const header = parseWavHeader(audioBuffer);

  return {
    audioBuffer,
    durationSeconds: header.durationSeconds,
    sampleRate: header.sampleRate,
  };
}

/**
 * Generates a short 3-second audio preview of a chosen voice.
 */
export async function testVoiceSample(
  voiceName: string,
  apiKey: string,
  model: string = DEFAULT_MODEL_ID
): Promise<SpeechResult> {
  return generateSpeechAudio({
    text: SHORT_TEST_PROMPT,
    apiKey,
    model,
    voice: voiceName,
    styleInstruction: 'Ton chaleureux, posé et naturel.',
  });
}
