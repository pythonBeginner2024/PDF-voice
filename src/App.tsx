import React, { useState, useEffect, useRef } from 'react';
import {
  Navbar,
  ActiveTab,
} from './components/Navbar';
import { PdfUploader } from './components/PdfUploader';
import { PdfAnalysisView } from './components/PdfAnalysisView';
import { SegmentationView } from './components/SegmentationView';
import { ConversionView } from './components/ConversionView';
import { AudioPlayer } from './components/AudioPlayer';
import { SettingsView } from './components/SettingsView';
import { ProjectLibraryView } from './components/ProjectLibraryView';
import { HelpAndPrivacyView } from './components/HelpAndPrivacyView';

import {
  PdfDocumentInfo,
  ProjectData,
  AudioSegment,
  Chapter,
  SegmentationMode,
  TtsSettings,
} from './types';
import {
  loadSettings,
  saveSettings,
  getAllProjects,
  saveProject,
  deleteProject,
  clearAllLocalData,
  getSegmentAudio,
} from './storage/db';
import { ConversionQueue } from './jobs/conversionQueue';
import { DEFAULT_MODEL_ID, DEFAULT_VOICE_ID, TTS_CONSTRAINTS } from './config/tts';
import {
  KeyRound,
  AlertCircle,
  Headphones,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export type ConverterStep = 'upload' | 'analysis' | 'segmentation' | 'conversion';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('converter');
  const [converterStep, setConverterStep] = useState<ConverterStep>('upload');

  // User Settings & API Key
  const [settings, setSettings] = useState<TtsSettings>(() => loadSettings());

  // PDF & Project State
  const [currentPdfInfo, setCurrentPdfInfo] = useState<PdfDocumentInfo | null>(null);
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [savedProjects, setSavedProjects] = useState<ProjectData[]>([]);

  // Queue State
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [isQueuePaused, setIsQueuePaused] = useState(false);
  const queueRef = useRef<ConversionQueue | null>(null);

  // Audio Player State
  const [activePlayingSegment, setActivePlayingSegment] = useState<AudioSegment | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);

  // Load saved projects on mount
  useEffect(() => {
    refreshProjectsList();
  }, []);

  const refreshProjectsList = async () => {
    try {
      const list = await getAllProjects();
      setSavedProjects(list);
    } catch (e) {
      console.warn('Erreur lors du chargement des projets sauvegardés:', e);
    }
  };

  // Update Settings handler
  const handleSaveSettings = (updated: Partial<TtsSettings>) => {
    const next = { ...settings, ...updated };
    setSettings(next);
    saveSettings(updated);

    if (queueRef.current && updated.apiKey !== undefined) {
      queueRef.current.updateApiKey(updated.apiKey);
    }
  };

  // Step 1: PDF Extracted
  const handleDocumentExtracted = (pdfInfo: PdfDocumentInfo) => {
    setCurrentPdfInfo(pdfInfo);
    setGlobalError(null);
    setConverterStep('analysis');
  };

  // Step 2: Proceed from Analysis to Segmentation
  const handleProceedToSegmentation = () => {
    setConverterStep('segmentation');
  };

  // Step 3: Start Conversion
  const handleStartConversion = async (config: {
    mode: SegmentationMode;
    chapters: Chapter[];
    segments: AudioSegment[];
    voice: string;
    model: string;
    chunkSize: number;
  }) => {
    if (!settings.apiKey.trim()) {
      setShowApiKeyPrompt(true);
      return;
    }

    if (!currentPdfInfo) return;

    // Create new ProjectData
    const newProject: ProjectData = {
      id: currentPdfInfo.id,
      title: currentPdfInfo.name.replace(/\.pdf$/i, ''),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pdfInfo: currentPdfInfo,
      mode: config.mode,
      targetChunkChars: config.chunkSize,
      selectedVoice: config.voice,
      selectedModel: config.model,
      styleInstruction: settings.styleInstruction,
      segments: config.segments,
      chapters: config.chapters,
      isCompleted: false,
    };

    setCurrentProject(newProject);
    await saveProject(newProject);
    await refreshProjectsList();

    setConverterStep('conversion');

    // Initialize queue
    startConversionQueue(newProject);
  };

  const startConversionQueue = (project: ProjectData) => {
    if (queueRef.current) {
      queueRef.current.pause();
    }

    const queue = new ConversionQueue(project, settings.apiKey, {
      onSegmentUpdate: (updatedSeg) => {
        setCurrentProject((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            segments: prev.segments.map((s) => (s.id === updatedSeg.id ? updatedSeg : s)),
          };
        });
      },
      onProjectUpdate: (updatedProj) => {
        setCurrentProject({ ...updatedProj });
        setIsQueueRunning(queue.getStatus().isRunning);
        setIsQueuePaused(queue.getStatus().isPaused);
        refreshProjectsList();
      },
      onQueueFinished: () => {
        setIsQueueRunning(false);
        setIsQueuePaused(false);
        refreshProjectsList();
      },
      onError: (seg, err) => {
        console.warn(`Erreur sur le segment ${seg.title}:`, err);
      },
    });

    queueRef.current = queue;
    queue.start();
    setIsQueueRunning(true);
    setIsQueuePaused(false);
  };

  const handlePauseQueue = () => {
    if (queueRef.current) {
      queueRef.current.pause();
      setIsQueuePaused(true);
      setIsQueueRunning(false);
    }
  };

  const handleResumeQueue = () => {
    if (!settings.apiKey.trim()) {
      setShowApiKeyPrompt(true);
      return;
    }
    if (queueRef.current) {
      queueRef.current.updateApiKey(settings.apiKey);
      queueRef.current.start();
      setIsQueueRunning(true);
      setIsQueuePaused(false);
    } else if (currentProject) {
      startConversionQueue(currentProject);
    }
  };

  const handleRetryFailed = () => {
    if (!settings.apiKey.trim()) {
      setShowApiKeyPrompt(true);
      return;
    }
    if (queueRef.current) {
      queueRef.current.updateApiKey(settings.apiKey);
      queueRef.current.retryFailed();
      setIsQueueRunning(true);
      setIsQueuePaused(false);
    }
  };

  const handleRetrySingle = (segmentId: string) => {
    if (!settings.apiKey.trim()) {
      setShowApiKeyPrompt(true);
      return;
    }
    if (queueRef.current) {
      queueRef.current.updateApiKey(settings.apiKey);
      queueRef.current.retrySingleSegment(segmentId);
      setIsQueueRunning(true);
      setIsQueuePaused(false);
    }
  };

  // Resume or open project from Library
  const handleOpenProject = async (projectId: string) => {
    const found = savedProjects.find((p) => p.id === projectId);
    if (!found) return;

    setCurrentProject(found);
    setCurrentPdfInfo(found.pdfInfo);
    setActiveTab('converter');
    setConverterStep('conversion');

    // Rehydrate audio blobs from IndexedDB into memory if needed
    for (const seg of found.segments) {
      if (seg.status === 'completed' && !seg.audioUrl) {
        const blob = await getSegmentAudio(seg.id);
        if (blob) {
          seg.audioBlob = blob;
          seg.audioUrl = URL.createObjectURL(blob);
        }
      }
    }

    setCurrentProject({ ...found });
  };

  // Delete project from library
  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId);
    if (currentProject?.id === projectId) {
      if (queueRef.current) queueRef.current.pause();
      setCurrentProject(null);
      setCurrentPdfInfo(null);
      setConverterStep('upload');
      setActivePlayingSegment(null);
    }
    await refreshProjectsList();
  };

  // Clear all local database
  const handleClearAllData = async () => {
    if (queueRef.current) queueRef.current.pause();
    await clearAllLocalData();
    setCurrentProject(null);
    setCurrentPdfInfo(null);
    setConverterStep('upload');
    setActivePlayingSegment(null);
    await refreshProjectsList();
  };

  // Reset converter back to upload step
  const handleResetConverter = () => {
    if (
      currentProject &&
      isQueueRunning &&
      !confirm('Une conversion est en cours. Voulez-vous vraiment revenir à l\'importation ?')
    ) {
      return;
    }
    if (queueRef.current) queueRef.current.pause();
    setCurrentPdfInfo(null);
    setCurrentProject(null);
    setConverterStep('upload');
    setGlobalError(null);
  };

  // Audio player navigation
  const currentSegments = currentProject?.segments.filter((s) => s.selected && s.status === 'completed') || [];
  const currentPlayingIndex = activePlayingSegment
    ? currentSegments.findIndex((s) => s.id === activePlayingSegment.id)
    : -1;

  const handleNextSegment = () => {
    if (currentPlayingIndex >= 0 && currentPlayingIndex < currentSegments.length - 1) {
      setActivePlayingSegment(currentSegments[currentPlayingIndex + 1]);
    }
  };

  const handlePrevSegment = () => {
    if (currentPlayingIndex > 0) {
      setActivePlayingSegment(currentSegments[currentPlayingIndex - 1]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasApiKey={Boolean(settings.apiKey.trim())}
        savedProjectsCount={savedProjects.length}
        currentProjectTitle={currentProject?.title}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-28">
        {/* Global Error Banner */}
        {globalError && (
          <div className="max-w-4xl mx-auto px-4 pt-4">
            <div className="p-4 bg-rose-950/50 border border-rose-500/40 rounded-2xl flex items-center justify-between text-rose-300 text-sm">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{globalError}</span>
              </div>
              <button
                onClick={() => setGlobalError(null)}
                className="text-xs text-rose-400 hover:text-white font-medium ml-3 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {/* Missing API Key Warning Callout (shown if user hasn't configured key yet) */}
        {!settings.apiKey.trim() && activeTab === 'converter' && converterStep === 'upload' && (
          <div className="max-w-4xl mx-auto px-4 pt-6">
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Clé API Google Gemini requise</h3>
                  <p className="text-xs text-slate-400">
                    Pour générer les fichiers audio, vous devez renseigner votre clé personnelle gratuite dans les paramètres.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('settings')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-xl transition-colors shrink-0 shadow-md shadow-amber-600/20 cursor-pointer"
              >
                Configurer ma clé
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: CONVERTER */}
        {activeTab === 'converter' && (
          <div className="max-w-6xl mx-auto px-4 py-8">
            {converterStep === 'upload' && (
              <div className="max-w-3xl mx-auto space-y-8">
                {/* Hero section */}
                <div className="text-center space-y-3 pt-4 sm:pt-8">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-semibold">
                    <Headphones className="w-3.5 h-3.5" />
                    <span>Synthèse Vocale Neuronale Gemini</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                    Transformez vos PDF en livres audio haute fidélité
                  </h1>
                  <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                    Importez votre document, découpez-le intelligemment en chapitres ou portions, et écoutez ou téléchargez vos fichiers audio WAV &amp; ZIP sans aucun abonnement.
                  </p>
                </div>

                {/* Upload Card */}
                <PdfUploader
                  onDocumentExtracted={handleDocumentExtracted}
                  onError={(err) => setGlobalError(err)}
                />

                {/* Feature highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-center space-y-1.5">
                    <div className="text-indigo-400 font-semibold text-sm">1. Extraction locale</div>
                    <p className="text-xs text-slate-400">
                      Le PDF est analysé directement dans votre navigateur via PDF.js.
                    </p>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-center space-y-1.5">
                    <div className="text-sky-400 font-semibold text-sm">2. Voix naturelles</div>
                    <p className="text-xs text-slate-400">
                      Modèles Gemini TTS (Kore, Puck, Fenrir...) pour un rendu expressif et fluide.
                    </p>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-center space-y-1.5">
                    <div className="text-emerald-400 font-semibold text-sm">3. Reprise &amp; Export ZIP</div>
                    <p className="text-xs text-slate-400">
                      Progression sauvegardée dans IndexedDB, téléchargement WAV unifié ou en archive ZIP.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {converterStep === 'analysis' && currentPdfInfo && (
              <PdfAnalysisView
                pdfInfo={currentPdfInfo}
                onProceedToSegmentation={handleProceedToSegmentation}
                onReset={handleResetConverter}
              />
            )}

            {converterStep === 'segmentation' && currentPdfInfo && (
              <SegmentationView
                pdfInfo={currentPdfInfo}
                settings={settings}
                onStartConversion={handleStartConversion}
                onBackToAnalysis={() => setConverterStep('analysis')}
              />
            )}

            {converterStep === 'conversion' && currentProject && (
              <ConversionView
                project={currentProject}
                isQueueRunning={isQueueRunning}
                isQueuePaused={isQueuePaused}
                onPause={handlePauseQueue}
                onResume={handleResumeQueue}
                onRetryFailed={handleRetryFailed}
                onRetrySingle={handleRetrySingle}
                onPlaySegment={(seg) => setActivePlayingSegment(seg)}
                activeSegmentId={activePlayingSegment?.id}
                isPlaying={Boolean(activePlayingSegment)}
              />
            )}
          </div>
        )}

        {/* TAB 2: LIBRARY */}
        {activeTab === 'library' && (
          <ProjectLibraryView
            projects={savedProjects}
            onOpenProject={handleOpenProject}
            onDeleteProject={handleDeleteProject}
            onClearAllData={handleClearAllData}
          />
        )}

        {/* TAB 3: SETTINGS */}
        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onKeyValidated={() => {
              if (showApiKeyPrompt) setShowApiKeyPrompt(false);
            }}
          />
        )}

        {/* TAB 4: HELP & PRIVACY */}
        {activeTab === 'help' && <HelpAndPrivacyView />}
      </main>

      {/* Floating API Key Missing Modal */}
      {showApiKeyPrompt && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Clé API requise pour la synthèse</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Pour lancer la génération vocale, vous devez renseigner votre clé API Google Gemini personnelle. Elle restera sur cet appareil et ne sera jamais partagée.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => {
                  setShowApiKeyPrompt(false);
                  setActiveTab('settings');
                }}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer"
              >
                Ouvrir les paramètres
              </button>
              <button
                onClick={() => setShowApiKeyPrompt(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Docked Audio Player */}
      <AudioPlayer
        segment={activePlayingSegment}
        projectTitle={currentProject?.title || 'Livre Audio'}
        onNextSegment={handleNextSegment}
        onPrevSegment={handlePrevSegment}
        hasNext={currentPlayingIndex < currentSegments.length - 1}
        hasPrev={currentPlayingIndex > 0}
        onClose={() => setActivePlayingSegment(null)}
      />
    </div>
  );
}
