import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Archive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Volume2,
  Clock,
  FileAudio,
  Layers,
  Sparkles,
} from 'lucide-react';
import { AudioSegment, ProjectData } from '../types';
import { concatenateWavBuffers, triggerDownload, sanitizeFilename, formatDuration } from '../audio/wavHelper';
import { exportProjectToZip, ZipExportProgress } from '../export/zipExporter';
import { getSegmentAudio } from '../storage/db';

interface ConversionViewProps {
  project: ProjectData;
  isQueueRunning: boolean;
  isQueuePaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onRetryFailed: () => void;
  onRetrySingle: (segmentId: string) => void;
  onPlaySegment: (segment: AudioSegment) => void;
  activeSegmentId?: string;
  isPlaying?: boolean;
}

export const ConversionView: React.FC<ConversionViewProps> = ({
  project,
  isQueueRunning,
  isQueuePaused,
  onPause,
  onResume,
  onRetryFailed,
  onRetrySingle,
  onPlaySegment,
  activeSegmentId,
  isPlaying,
}) => {
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<ZipExportProgress | null>(null);
  const [isAssemblingFullAudio, setIsAssemblingFullAudio] = useState(false);
  const [assemblyError, setAssemblyError] = useState<string | null>(null);

  const selectedSegments = project.segments.filter((s) => s.selected);
  const completedSegments = selectedSegments.filter((s) => s.status === 'completed');
  const failedSegments = selectedSegments.filter((s) => s.status === 'failed');
  const pendingSegments = selectedSegments.filter(
    (s) => s.status === 'pending' || s.status === 'paused'
  );
  const processingSegment = selectedSegments.find((s) => s.status === 'processing');

  const totalSelected = selectedSegments.length;
  const progressPercent =
    totalSelected > 0 ? Math.round((completedSegments.length / totalSelected) * 100) : 0;

  // Calculate total audio duration generated so far
  const totalAudioDurationSec = completedSegments.reduce(
    (acc, s) => acc + (s.audioDurationSeconds || 0),
    0
  );

  // Download a single segment
  const handleDownloadSegment = async (seg: AudioSegment) => {
    let blob = seg.audioBlob;
    if (!blob) {
      blob = (await getSegmentAudio(seg.id)) || undefined;
    }
    if (blob) {
      const filename = `${sanitizeFilename(project.title)}_${sanitizeFilename(seg.title)}.wav`;
      triggerDownload(blob, filename);
    }
  };

  // Export ZIP
  const handleExportZip = async () => {
    if (completedSegments.length === 0) return;
    setIsExportingZip(true);
    setZipProgress(null);

    try {
      await exportProjectToZip(project, (p) => {
        setZipProgress(p);
      });
    } catch (err: unknown) {
      alert((err as Error)?.message || 'Erreur lors de la génération du ZIP');
    } finally {
      setIsExportingZip(false);
      setZipProgress(null);
    }
  };

  // Concatenate and download full book WAV
  const handleDownloadFullAudio = async () => {
    if (completedSegments.length === 0) return;
    setIsAssemblingFullAudio(true);
    setAssemblyError(null);

    try {
      const buffers: ArrayBuffer[] = [];
      for (const seg of completedSegments) {
        let blob = seg.audioBlob;
        if (!blob) {
          blob = (await getSegmentAudio(seg.id)) || undefined;
        }
        if (blob) {
          const buf = await blob.arrayBuffer();
          buffers.push(buf);
        }
      }

      if (buffers.length === 0) {
        throw new Error('Aucun fichier audio disponible pour l\'assemblage.');
      }

      const unifiedBlob = concatenateWavBuffers(buffers);
      const filename = `${sanitizeFilename(project.title)}_Audiobook_Complet.wav`;
      triggerDownload(unifiedBlob, filename);
    } catch (err: unknown) {
      setAssemblyError((err as Error)?.message || 'Erreur lors de l\'assemblage audio');
    } finally {
      setIsAssemblingFullAudio(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                progressPercent === 100
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : isQueuePaused
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
              }`}
            >
              {progressPercent === 100
                ? 'Conversion terminée'
                : isQueuePaused
                ? 'En pause'
                : 'Synthèse en cours'}
            </span>
            <span className="text-xs text-slate-400">
              Voix : <strong className="text-white">{project.selectedVoice}</strong>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mt-1 truncate">
            {project.title}
          </h2>
        </div>

        {/* Action buttons (Pause/Resume, Retry) */}
        <div className="flex flex-wrap items-center gap-2">
          {failedSegments.length > 0 && (
            <button
              onClick={onRetryFailed}
              className="flex items-center space-x-1.5 px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réessayer les échecs ({failedSegments.length})</span>
            </button>
          )}

          {isQueueRunning && !isQueuePaused ? (
            <button
              onClick={onPause}
              className="flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-xl shadow-lg shadow-amber-600/20 transition-colors cursor-pointer"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>Mettre en pause</span>
            </button>
          ) : progressPercent < 100 ? (
            <button
              onClick={onResume}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Reprendre</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Global Progress Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-white">Progression générale</span>
            <span className="font-mono text-indigo-400 font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressPercent === 100
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-indigo-500 to-sky-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
          <div className="text-center sm:text-left">
            <div className="text-xs text-slate-400">Segments terminés</div>
            <div className="text-lg font-bold text-emerald-400">
              {completedSegments.length} / {totalSelected}
            </div>
          </div>

          <div className="text-center sm:text-left">
            <div className="text-xs text-slate-400">Audio produit</div>
            <div className="text-lg font-bold text-white">
              {formatDuration(totalAudioDurationSec)}
            </div>
          </div>

          <div className="text-center sm:text-left">
            <div className="text-xs text-slate-400">En attente</div>
            <div className="text-lg font-bold text-slate-300">
              {pendingSegments.length}
            </div>
          </div>

          <div className="text-center sm:text-left">
            <div className="text-xs text-slate-400">Échecs</div>
            <div className={`text-lg font-bold ${failedSegments.length > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
              {failedSegments.length}
            </div>
          </div>
        </div>

        {/* Global Download Actions (when at least 1 segment is completed) */}
        {completedSegments.length > 0 && (
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportZip}
              disabled={isExportingZip}
              className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium transition-colors border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              {isExportingZip ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>
                    {zipProgress ? `${zipProgress.percent}% - ${zipProgress.fileName}` : 'Création du ZIP...'}
                  </span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 text-indigo-400" />
                  <span>Télécharger tous les fichiers (ZIP)</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadFullAudio}
              disabled={isAssemblingFullAudio}
              className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              title="Concatène tous les segments WAV en un seul grand fichier audio complet"
            >
              {isAssemblingFullAudio ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Assemblage WAV sans rupture...</span>
                </>
              ) : (
                <>
                  <FileAudio className="w-4 h-4 text-indigo-400" />
                  <span>Télécharger l'audio complet (.WAV unique)</span>
                </>
              )}
            </button>
          </div>
        )}

        {assemblyError && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {assemblyError}
          </div>
        )}
      </div>

      {/* Segments Realtime Queue List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex justify-between items-center">
          <h3 className="font-semibold text-sm text-white">Détail des segments ({selectedSegments.length})</h3>
          <span className="text-xs text-slate-400">
            {completedSegments.length === totalSelected
              ? 'Tous les segments sont convertis'
              : processingSegment
              ? `Synthèse de la portion #${processingSegment.order}...`
              : 'En attente'}
          </span>
        </div>

        <div className="divide-y divide-slate-800/60 max-h-[460px] overflow-y-auto">
          {selectedSegments.map((seg) => {
            const isCurrentPlaying = activeSegmentId === seg.id;
            const hasAudio = seg.status === 'completed' && (seg.audioBlob || seg.audioUrl);

            return (
              <div
                key={seg.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  seg.status === 'processing'
                    ? 'bg-indigo-950/20'
                    : isCurrentPlaying
                    ? 'bg-indigo-600/10'
                    : 'hover:bg-slate-850'
                }`}
              >
                {/* Left: Info */}
                <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0">
                  <div className="mt-0.5 sm:mt-0 shrink-0">
                    {seg.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : seg.status === 'processing' ? (
                      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                    ) : seg.status === 'failed' ? (
                      <AlertCircle className="w-5 h-5 text-rose-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-slate-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs text-slate-500">
                        #{seg.order.toString().padStart(2, '0')}
                      </span>
                      <span className="font-medium text-sm text-white truncate">
                        {seg.title}
                      </span>
                      {seg.audioDurationSeconds && (
                        <span className="text-[11px] font-mono text-emerald-400/90 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                          {formatDuration(seg.audioDurationSeconds)}
                        </span>
                      )}
                    </div>

                    {seg.status === 'failed' && seg.errorMessage ? (
                      <p className="text-xs text-rose-300 mt-1 font-sans">
                        {seg.errorMessage}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5 italic">
                        "{seg.text.slice(0, 90)}..."
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
                  {seg.status === 'completed' && (
                    <>
                      <button
                        onClick={() => onPlaySegment(seg)}
                        className={`p-2 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                          isCurrentPlaying && isPlaying
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                        title="Écouter ce segment"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                          {isCurrentPlaying && isPlaying ? 'En lecture' : 'Écouter'}
                        </span>
                      </button>

                      <button
                        onClick={() => handleDownloadSegment(seg)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Télécharger ce fichier WAV"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {seg.status === 'failed' && (
                    <button
                      onClick={() => onRetrySingle(seg.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs flex items-center space-x-1 transition-colors cursor-pointer"
                      title="Réessayer ce segment"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Réessayer</span>
                    </button>
                  )}

                  {seg.status === 'processing' && (
                    <span className="text-xs text-indigo-400 animate-pulse font-medium">
                      Génération audio...
                    </span>
                  )}

                  {seg.status === 'pending' && (
                    <span className="text-xs text-slate-500">En attente</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
