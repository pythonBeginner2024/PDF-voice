import React, { useState } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ExternalLink,
  Volume2,
  Sparkles,
  ShieldAlert,
  Loader2,
  Sliders,
  HelpCircle,
} from 'lucide-react';
import { TtsSettings, VoiceOption, ModelOption } from '../types';
import { GEMINI_TTS_MODELS, GEMINI_VOICES, TTS_CONSTRAINTS } from '../config/tts';
import { validateApiKey, testVoiceSample, ApiValidationResult } from '../tts/geminiTtsClient';
import { removeStoredApiKey } from '../storage/db';

interface SettingsViewProps {
  settings: TtsSettings;
  onSaveSettings: (newSettings: Partial<TtsSettings>) => void;
  onKeyValidated?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onKeyValidated,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState(settings.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [persistKey, setPersistKey] = useState(settings.persistApiKey);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ApiValidationResult | null>(null);

  const [selectedModel, setSelectedModel] = useState(settings.selectedModel);
  const [selectedVoice, setSelectedVoice] = useState(settings.selectedVoice);
  const [targetChunkChars, setTargetChunkChars] = useState(settings.targetChunkChars);
  const [styleInstruction, setStyleInstruction] = useState(settings.styleInstruction);

  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Validate API key
  const handleValidateKey = async () => {
    if (!apiKeyInput.trim()) {
      setValidationResult({
        valid: false,
        message: 'Veuillez renseigner une clé API Google Gemini avant de tester.',
        errorType: 'AUTH_ERROR',
      });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    const result = await validateApiKey(apiKeyInput.trim(), selectedModel);
    setIsValidating(false);
    setValidationResult(result);

    if (result.valid) {
      // Save valid key
      onSaveSettings({
        apiKey: apiKeyInput.trim(),
        persistApiKey: persistKey,
      });
      if (onKeyValidated) onKeyValidated();
    }
  };

  const handlePersistToggle = (checked: boolean) => {
    setPersistKey(checked);
    onSaveSettings({
      persistApiKey: checked,
      apiKey: checked ? apiKeyInput.trim() : settings.apiKey,
    });
  };

  const handleDeleteKey = () => {
    if (confirm('Voulez-vous vraiment supprimer la clé API enregistrée de cet appareil ?')) {
      removeStoredApiKey();
      setApiKeyInput('');
      setPersistKey(false);
      setValidationResult(null);
      onSaveSettings({ apiKey: '', persistApiKey: false });
    }
  };

  const handleSavePreferences = () => {
    onSaveSettings({
      apiKey: apiKeyInput.trim(),
      persistApiKey: persistKey,
      selectedModel,
      selectedVoice,
      targetChunkChars,
      styleInstruction,
    });
  };

  const handleTestVoice = async (voice: VoiceOption) => {
    if (!apiKeyInput.trim()) {
      setTestError('Veuillez configurer et valider votre clé API pour écouter un aperçu de la voix.');
      return;
    }

    setTestingVoiceId(voice.id);
    setTestError(null);

    try {
      const result = await testVoiceSample(voice.id, apiKeyInput.trim(), selectedModel);
      const blob = new Blob([result.audioBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      setTestAudioUrl(url);

      // Play test sample
      const audio = new Audio(url);
      audio.play().catch(console.warn);
    } catch (err: unknown) {
      setTestError((err as Error).message || 'Échec du test de voix');
    } finally {
      setTestingVoiceId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Paramètres & Clé API</h1>
        <p className="text-slate-400 mt-1 text-sm sm:text-base">
          Configurez votre accès personnel à l'API Gemini TTS, choisissez votre voix favorite et réglez les paramètres de synthèse.
        </p>
      </div>

      {/* SECTION 1: Clé API Personnelle */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Clé API Google Gemini</h2>
            <p className="text-xs text-slate-400">
              Chaque utilisateur utilise sa propre clé pour bénéficier des quotas gratuits ou payants de son compte.
            </p>
          </div>
        </div>

        {/* Input & actions */}
        <div className="space-y-4">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                setValidationResult(null);
              }}
              placeholder="AIzaSy..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3.5 pr-24 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-colors"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title={showKey ? 'Masquer la clé' : 'Afficher la clé'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {apiKeyInput && (
                <button
                  type="button"
                  onClick={handleDeleteKey}
                  className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition-colors"
                  title="Supprimer la clé"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Validation Feedback Message */}
          {validationResult && (
            <div
              className={`p-4 rounded-xl border text-sm flex items-start space-x-3 ${
                validationResult.valid
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}
            >
              {validationResult.valid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-medium">{validationResult.message}</p>
                {validationResult.errorType === 'QUOTA_ERROR' && (
                  <p className="text-xs text-rose-300/80">
                    Astuce : Attendez quelques minutes pour la réinitialisation de votre quota d'appels par minute (RPM) sur Google AI Studio.
                  </p>
                )}
                {validationResult.errorType === 'AUTH_ERROR' && (
                  <p className="text-xs text-rose-300/80">
                    Vérifiez que votre clé commence bien par AIza et qu'elle n'a pas été restreinte ou révoquée sur la console GCP.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Checkbox persist API key */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={persistKey}
                onChange={(e) => handlePersistToggle(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-sm font-medium text-slate-200">
                Enregistrer cette clé sur cet appareil (navigateur local)
              </span>
            </label>

            <div className="flex items-start space-x-2 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p>
                <strong>Avertissement de sécurité :</strong> L'enregistrement stocke la clé dans le stockage local (localStorage) de votre navigateur. La clé ne quitte jamais votre appareil et n'est transmise à aucun serveur tiers, mais toute extension ou script ayant accès à ce navigateur pourrait y accéder. Ne cochez pas cette option sur un ordinateur public partagé.
              </p>
            </div>
          </div>

          {/* Validation & Save buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleValidateKey}
              disabled={isValidating || !apiKeyInput.trim()}
              className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-colors shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Vérification auprès de Google...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tester et valider la clé</span>
                </>
              )}
            </button>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium rounded-xl transition-colors"
            >
              <span>Obtenir une clé gratuite sur Google AI Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* SECTION 2: Choix du Modèle & Voix TTS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Moteur de Synthèse Vocale</h2>
            <p className="text-xs text-slate-400">
              Modèles officiels Gemini TTS et voix neuronales françaises optimisées.
            </p>
          </div>
        </div>

        {/* Models Radio Grid */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-300">Modèle Gemini TTS :</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GEMINI_TTS_MODELS.map((m) => (
              <div
                key={m.id}
                onClick={() => {
                  setSelectedModel(m.id);
                  onSaveSettings({ selectedModel: m.id });
                }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedModel === m.id
                    ? 'bg-indigo-600/15 border-indigo-500/60 ring-1 ring-indigo-500/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-white">{m.name}</span>
                  {m.badge && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                      {m.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{m.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Voices Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-300">Voix du narrateur :</label>
            <span className="text-xs text-slate-400">
              Voix active : <strong className="text-indigo-400">{selectedVoice}</strong>
            </span>
          </div>

          {testError && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {testError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {GEMINI_VOICES.map((v) => {
              const isSelected = selectedVoice === v.id;
              const isTesting = testingVoiceId === v.id;

              return (
                <div
                  key={v.id}
                  onClick={() => {
                    setSelectedVoice(v.id);
                    onSaveSettings({ selectedVoice: v.id });
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/40'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-sm text-white">{v.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {v.gender === 'female' ? 'Féminin' : 'Masculin'}
                        </span>
                      </div>
                      {v.recommended && (
                        <span className="text-[10px] text-emerald-400 font-medium">Recommandée</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-3">{v.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTestVoice(v);
                    }}
                    disabled={isTesting}
                    className="w-full mt-2 py-1.5 px-2.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span>Synthèse...</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Écouter extrait (3s)</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Style & Chunk Settings */}
        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-slate-300">
                Taille cible des portions de découpage :
              </label>
              <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                ~{targetChunkChars} caractères (~{Math.round(targetChunkChars / 5)} mots)
              </span>
            </div>
            <input
              type="range"
              min={TTS_CONSTRAINTS.MIN_CHUNK_CHARS}
              max={TTS_CONSTRAINTS.MAX_CHUNK_CHARS}
              step={50}
              value={targetChunkChars}
              onChange={(e) => {
                const val = Number(e.target.value);
                setTargetChunkChars(val);
                onSaveSettings({ targetChunkChars: val });
              }}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <p className="text-xs text-slate-400">
              Des portions d'environ 800 à 1000 caractères assurent des segments de 40 à 60 secondes, offrant une grande résilience face aux interruptions réseau.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Consigne de style audio (Speech Metadata Style) :
            </label>
            <input
              type="text"
              value={styleInstruction}
              onChange={(e) => {
                setStyleInstruction(e.target.value);
                onSaveSettings({ styleInstruction: e.target.value });
              }}
              placeholder="Ex: Ton posé, captivant et chaleureux pour un roman."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
