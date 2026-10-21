import React, { useState } from 'react';
import {
  FileText,
  Clock,
  Layers,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Search,
  CheckCircle,
  BookOpen,
} from 'lucide-react';
import { PdfDocumentInfo } from '../types';
import { estimateReadingMinutes } from '../pdf/extractor';
import { formatDuration } from '../audio/wavHelper';

interface PdfAnalysisViewProps {
  pdfInfo: PdfDocumentInfo;
  onProceedToSegmentation: () => void;
  onReset: () => void;
}

export const PdfAnalysisView: React.FC<PdfAnalysisViewProps> = ({
  pdfInfo,
  onProceedToSegmentation,
  onReset,
}) => {
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const estMinutes = estimateReadingMinutes(pdfInfo.totalWords);
  const estSeconds = estMinutes * 60;

  const filteredPages = pdfInfo.pages.filter((page) => {
    if (!searchQuery) return true;
    return page.text.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const currentPage = pdfInfo.pages[selectedPageIndex] || pdfInfo.pages[0];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Analyse terminée
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {(pdfInfo.sizeBytes / (1024 * 1024)).toFixed(2)} Mo
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mt-1 truncate">
            {pdfInfo.name}
          </h2>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onReset}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Changer de PDF</span>
          </button>
          <button
            onClick={onProceedToSegmentation}
            className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <span>Découpage & Synthèse</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scanned PDF warning alert */}
      {pdfInfo.isLikelyScanned && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-5 flex items-start space-x-4">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-300">
              Attention : Document scanné sans texte sélectionnable
            </h4>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              La quasi-totalité des pages ({pdfInfo.emptyPageCount} sur {pdfInfo.totalPages}) ne contient aucun texte vectoriel exploitable. Cette version de l'application n'intègre pas de module OCR (reconnaissance optique de caractères). Pour convertir ce document, veillez à utiliser un PDF contenant du texte numérique sélectionnable.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center space-x-2 text-slate-400 mb-1">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-medium">Pages</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            {pdfInfo.totalPages}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {pdfInfo.emptyPageCount > 0 ? `${pdfInfo.emptyPageCount} sans texte` : 'Toutes lisibles'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center space-x-2 text-slate-400 mb-1">
            <FileText className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-medium">Mots extraits</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            {pdfInfo.totalWords.toLocaleString('fr-FR')}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {pdfInfo.totalChars.toLocaleString('fr-FR')} caractères
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center space-x-2 text-slate-400 mb-1">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">Durée estimée</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            ~{formatDuration(estSeconds)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Basé sur ~150 mots/min
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center space-x-2 text-slate-400 mb-1">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium">État du texte</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white flex items-center space-x-1.5">
            {pdfInfo.totalChars > 100 ? (
              <span className="text-emerald-400 text-lg">Exploitable</span>
            ) : (
              <span className="text-amber-400 text-lg">Faible</span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Extraction 100% locale
          </div>
        </div>
      </div>

      {/* Text Inspector & Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-sm text-white">Aperçu du texte extrait</h3>
            <span className="text-xs text-slate-400">
              (Page {selectedPageIndex + 1} / {pdfInfo.totalPages})
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher un mot..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 min-h-[360px]">
          {/* Page Picker Sidebar */}
          <div className="md:col-span-1 border-r border-slate-800 bg-slate-950/20 max-h-[380px] overflow-y-auto p-2 space-y-1">
            {filteredPages.map((page) => {
              const idx = page.pageNumber - 1;
              const isSelected = selectedPageIndex === idx;

              return (
                <button
                  key={page.pageNumber}
                  onClick={() => setSelectedPageIndex(idx)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <span>Page {page.pageNumber}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                    {page.charCount} car.
                  </span>
                </button>
              );
            })}
          </div>

          {/* Page Text Viewer */}
          <div className="md:col-span-3 p-5 max-h-[380px] overflow-y-auto font-serif text-sm leading-relaxed text-slate-300 whitespace-pre-line selection:bg-indigo-600">
            {currentPage ? (
              currentPage.text.trim() ? (
                currentPage.text
              ) : (
                <div className="text-center py-12 text-slate-500 italic">
                  Aucun texte détecté sur cette page.
                </div>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
