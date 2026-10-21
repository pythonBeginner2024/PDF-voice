import React, { useState, useEffect } from 'react';
import {
  Scissors,
  Bookmark,
  Layers,
  Sparkles,
  CheckSquare,
  Square,
  Play,
  Volume2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  PdfDocumentInfo,
  Chapter,
  AudioSegment,
  SegmentationMode,
  TtsSettings,
} from '../types';
import { buildSegmentation } from '../segmentation/analyzer';
import { GEMINI_VOICES, DEFAULT_VOICE_ID } from '../config/tts';
import { formatDuration } from '../audio/wavHelper';
import { estimateReadingMinutes } from '../pdf/extractor';

interface SegmentationViewProps {
  pdfInfo: PdfDocumentInfo;
  settings: TtsSettings;
  onStartConversion: (config: {
    mode: SegmentationMode;
    chapters: Chapter[];
    segments: AudioSegment[];
    voice: string;
    model: string;
    chunkSize: number;
  }) => void;
  onBackToAnalysis: () => void;
}

export const SegmentationView: React.FC<SegmentationViewProps> = ({
  pdfInfo,
  settings,
  onStartConversion,
  onBackToAnalysis,
}) => {
  const [mode, setMode] = useState<SegmentationMode>('chunks');
  const [chunkSize, setChunkSize] = useState<number>(settings.targetChunkChars || 900);
  const [selectedVoice, setSelectedVoice] = useState<string>(settings.selectedVoice || DEFAULT_VOICE_ID);
  
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [segments, setSegments] = useState<AudioSegment[]>([]);
  const [expandedChapterIndex, setExpandedChapterIndex] = useState<number | null>(null);

  // Editable segment/chapter title states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState<string>('');

  // Re-run segmentation whenever mode or chunkSize changes
  useEffect(() => {
    const res = buildSegmentation(pdfInfo, mode, chunkSize);
    setChapters(res.chapters);
    setSegments(res.segments);
  }, [pdfInfo, mode, chunkSize]);

  // Toggle single segment selection
  const handleToggleSegment = (id: string) => {
    setSegments((prev) =>
      prev.map((seg) => (seg.id === id ? { ...seg, selected: !seg.selected } : seg))
    );
  };

  // Toggle whole chapter selection
  const handleToggleChapter = (chapterIndex: number) => {
    setChapters((prev) =>
      prev.map((chap) => {
        if (chap.index === chapterIndex) {
          const nextSelected = !chap.selected;
          // Also toggle all its segments
          setSegments((prevSegs) =>
            prevSegs.map((s) =>
              s.chapterIndex === chapterIndex ? { ...s, selected: nextSelected } : s
            )
          );
          return { ...chap, selected: nextSelected };
        }
        return chap;
      })
    );
  };

  // Toggle all
  const handleSelectAll = (select: boolean) => {
    setSegments((prev) => prev.map((s) => ({ ...s, selected: select })));
    setChapters((prev) => prev.map((c) => ({ ...c, selected: select })));
  };

  // Save edited title
  const handleSaveTitle = (id: string) => {
    if (tempTitle.trim()) {
      setSegments((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: tempTitle.trim() } : s))
      );
      setChapters((prev) =>
        prev.map((c) => (c.title === id ? { ...c, title: tempTitle.trim() } : c))
      );
    }
    setEditingId(null);
  };

  const selectedSegments = segments.filter((s) => s.selected);
  const totalSelectedChars = selectedSegments.reduce((acc, s) => acc + s.charCount, 0);
  const totalSelectedWords = Math.round(totalSelectedChars / 5);
  const estMinutes = estimateReadingMinutes(totalSelectedWords);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBackToAnalysis}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 mb-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retour à l'analyse du document</span>
          </button>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Structure & Découpage Audio
          </h2>
          <p className="text-sm text-slate-400">
            Choisissez la méthode de découpage et vérifiez les portions avant la synthèse vocale.
          </p>
        </div>

        {/* Start button */}
        <button
          onClick={() => {
            if (selectedSegments.length === 0) {
              alert('Veuillez sélectionner au moins un segment pour lancer la synthèse vocale.');
              return;
            }
            onStartConversion({
              mode,
              chapters,
              segments,
              voice: selectedVoice,
              model: settings.selectedModel,
              chunkSize,
            });
          }}
          disabled={selectedSegments.length === 0}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Lancer la synthèse vocale ({selectedSegments.length})</span>
        </button>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setMode('chunks')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            mode === 'chunks'
              ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/40 text-white'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center space-x-2 mb-1.5">
            <Scissors className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-sm">Mode C — Portions automatiques</span>
          </div>
          <p className="text-xs text-slate-400">
            Découpe intelligente aux frontières de phrases (~{chunkSize} car.). Idéal pour les gros livres.
          </p>
        </button>

        <button
          onClick={() => setMode('chapters')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            mode === 'chapters'
              ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/40 text-white'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center space-x-2 mb-1.5">
            <Bookmark className="w-4 h-4 text-sky-400" />
            <span className="font-semibold text-sm">Mode B — Par chapitres</span>
          </div>
          <p className="text-xs text-slate-400">
            Détection automatique des titres ("Chapitre 1", etc.) avec sélection indépendante.
          </p>
        </button>

        <button
          onClick={() => setMode('full')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            mode === 'full'
              ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/40 text-white'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center space-x-2 mb-1.5">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm">Mode A — Document complet</span>
          </div>
          <p className="text-xs text-slate-400">
            Convertit l'intégralité du texte en une suite ordonnée continue.
          </p>
        </button>
      </div>

      {/* Configuration bar: voice & chunk size */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Voice selector */}
        <div className="flex items-center space-x-3">
          <Volume2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <div className="flex items-center space-x-2">
            <label className="text-xs font-medium text-slate-300">Voix de narration :</label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500"
            >
              {GEMINI_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.gender === 'female' ? 'Féminin' : 'Masculin'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chunk size slider (if in Mode C or chapters) */}
        <div className="flex items-center space-x-3">
          <label className="text-xs font-medium text-slate-300 shrink-0">
            Taille de découpe :
          </label>
          <input
            type="range"
            min={400}
            max={1800}
            step={100}
            value={chunkSize}
            onChange={(e) => setChunkSize(Number(e.target.value))}
            className="w-32 accent-indigo-500 cursor-pointer"
          />
          <span className="text-xs font-mono text-indigo-400">
            ~{chunkSize} car.
          </span>
        </div>

        {/* Global selection buttons */}
        <div className="flex items-center space-x-2 border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-4">
          <button
            onClick={() => handleSelectAll(true)}
            className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Tout cocher</span>
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => handleSelectAll(false)}
            className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Tout décocher</span>
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex items-center space-x-4">
          <span>
            Segments sélectionnés : <strong className="text-indigo-400">{selectedSegments.length}</strong> / {segments.length}
          </span>
          <span>
            Volume : <strong className="text-white">{totalSelectedChars.toLocaleString('fr-FR')}</strong> car. (~{totalSelectedWords} mots)
          </span>
        </div>
        <div>
          Durée audio estimée : <strong className="text-emerald-400">~{formatDuration(estMinutes * 60)}</strong>
        </div>
      </div>

      {/* Segments / Chapters List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl divide-y divide-slate-800/60">
        {mode === 'chapters' && chapters.length > 0 ? (
          // Mode Chapters: display accordion by chapter
          chapters.map((chapter) => {
            const isExpanded = expandedChapterIndex === chapter.index;
            const chapterSegs = segments.filter((s) => s.chapterIndex === chapter.index);
            const allSegsSelected = chapterSegs.every((s) => s.selected);

            return (
              <div key={chapter.index} className="bg-slate-900/40">
                <div className="p-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={allSegsSelected}
                      onChange={() => handleToggleChapter(chapter.index)}
                      className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-700 focus:ring-indigo-500 cursor-pointer"
                    />
                    <button
                      onClick={() => setExpandedChapterIndex(isExpanded ? null : chapter.index)}
                      className="flex items-center space-x-2 text-left cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="font-semibold text-sm text-white">
                        {chapter.title}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-3 text-xs text-slate-400">
                    <span>{chapterSegs.length} portion{chapterSegs.length > 1 ? 's' : ''}</span>
                    <span className="hidden sm:inline">({chapter.charCount} car.)</span>
                  </div>
                </div>

                {/* Expanded Segments inside chapter */}
                {isExpanded && (
                  <div className="bg-slate-950/60 p-3 space-y-2 pl-10 border-t border-slate-800/40">
                    {chapterSegs.map((seg) => (
                      <div
                        key={seg.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0 mr-3">
                          <input
                            type="checkbox"
                            checked={seg.selected}
                            onChange={() => handleToggleSegment(seg.id)}
                            className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-950 border-slate-700 cursor-pointer"
                          />
                          <span className="text-slate-300 truncate">{seg.title}</span>
                        </div>
                        <span className="text-slate-500 font-mono text-[11px] shrink-0">
                          {seg.charCount} car.
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          // Mode C (Portions) or Mode A (Full): Flat list with rename & preview
          <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-800/60">
            {segments.map((seg, idx) => {
              const isEditing = editingId === seg.id;

              return (
                <div
                  key={seg.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    seg.selected ? 'bg-slate-900/60 hover:bg-slate-850' : 'bg-slate-950/40 opacity-60'
                  }`}
                >
                  <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={seg.selected}
                      onChange={() => handleToggleSegment(seg.id)}
                      className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-700 focus:ring-indigo-500 cursor-pointer mt-1 sm:mt-0"
                    />

                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            className="bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveTitle(seg.id)}
                            className="p-1 text-emerald-400 hover:text-emerald-300"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono text-slate-500">
                            #{(idx + 1).toString().padStart(2, '0')}
                          </span>
                          <span className="font-medium text-sm text-slate-200 truncate">
                            {seg.title}
                          </span>
                          <button
                            onClick={() => {
                              setEditingId(seg.id);
                              setTempTitle(seg.title);
                            }}
                            className="text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer"
                            title="Renommer cette portion"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5 italic">
                        "{seg.text.slice(0, 110)}..."
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 self-end sm:self-auto text-xs text-slate-400 shrink-0">
                    <span className="font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
                      {seg.charCount} car.
                    </span>
                    <span className="text-slate-500">
                      ~{Math.round((seg.charCount / 5) / 2.5)}s
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
