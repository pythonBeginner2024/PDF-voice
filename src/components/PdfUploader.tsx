import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { extractTextFromPdf, ExtractionProgress } from '../pdf/extractor';
import { PdfDocumentInfo } from '../types';

interface PdfUploaderProps {
  onDocumentExtracted: (pdfInfo: PdfDocumentInfo) => void;
  onError: (errorMessage: string) => void;
}

export const PdfUploader: React.FC<PdfUploaderProps> = ({
  onDocumentExtracted,
  onError,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      onError('Seuls les fichiers PDF (.pdf) sont acceptés.');
      return;
    }

    // Check size (> 100 MB warning)
    if (file.size > 100 * 1024 * 1024) {
      onError('Ce fichier est trop volumineux (> 100 Mo). Veuillez importer un document plus léger.');
      return;
    }

    setIsProcessing(true);
    setCurrentFileName(file.name);
    setProgress({ currentPage: 0, totalPages: 0, percent: 0 });

    try {
      const pdfInfo = await extractTextFromPdf(file, file.name, (p) => {
        setProgress(p);
      });

      if (pdfInfo.totalPages === 0) {
        throw new Error('Le document PDF semble vide ou endommagé.');
      }

      onDocumentExtracted(pdfInfo);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Erreur lors de l\'ouverture du fichier PDF';
      onError(`Impossible de lire le document : ${msg}. Vérifiez que le PDF n'est pas protégé par mot de passe.`);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-700/80 hover:border-indigo-500/60 bg-slate-900/60 hover:bg-slate-900/90'
        } ${isProcessing ? 'pointer-events-none opacity-90' : ''}`}
      >
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/10">
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            ) : (
              <Upload className="w-8 h-8" />
            )}
          </div>

          {!isProcessing ? (
            <>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white">
                  Glissez-déposez votre livre ou document PDF
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  ou cliquez ici pour sélectionner un fichier sur votre appareil
                </p>
              </div>

              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium border border-slate-700">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>PDF avec texte sélectionnable (Romans, essais, articles, cours...)</span>
              </div>
            </>
          ) : (
            <div className="space-y-3 pt-2">
              <h3 className="text-base font-semibold text-white">
                Extraction du texte en cours...
              </h3>
              <p className="text-xs text-slate-400 truncate font-mono">
                {currentFileName}
              </p>

              {progress && (
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>
                      Page {progress.currentPage} sur {progress.totalPages || '...'}
                    </span>
                    <span>{progress.percent}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
