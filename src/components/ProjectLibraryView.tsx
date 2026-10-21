import React, { useState } from 'react';
import {
  FolderClock,
  BookOpen,
  Calendar,
  Layers,
  Clock,
  Trash2,
  ArrowRight,
  Archive,
  AlertTriangle,
  FileAudio,
  CheckCircle2,
} from 'lucide-react';
import { ProjectData } from '../types';
import { formatDuration } from '../audio/wavHelper';
import { exportProjectToZip } from '../export/zipExporter';

interface ProjectLibraryViewProps {
  projects: ProjectData[];
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onClearAllData: () => void;
}

export const ProjectLibraryView: React.FC<ProjectLibraryViewProps> = ({
  projects,
  onOpenProject,
  onDeleteProject,
  onClearAllData,
}) => {
  const [exportingId, setExportingId] = useState<string | null>(null);

  const handleDownloadZip = async (project: ProjectData) => {
    setExportingId(project.id);
    try {
      await exportProjectToZip(project);
    } catch (e: unknown) {
      alert((e as Error)?.message || 'Erreur lors de l\'exportation');
    } finally {
      setExportingId(null);
    }
  };

  const confirmDelete = (project: ProjectData) => {
    if (confirm(`Voulez-vous vraiment supprimer le projet "${project.title}" et tous ses fichiers audio locaux ?`)) {
      onDeleteProject(project.id);
    }
  };

  const confirmClearAll = () => {
    if (
      confirm(
        'ATTENTION : Vous êtes sur le point d\'effacer TOUS les projets, historiques et fichiers audio enregistrés dans la base IndexedDB de ce navigateur.\n\nCette action est irréversible. Confirmez-vous la suppression intégrale ?'
      )
    ) {
      onClearAllData();
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Bibliothèque Locale
          </h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">
            Tous vos projets sont conservés localement dans la base IndexedDB de votre navigateur.
          </p>
        </div>

        {projects.length > 0 && (
          <button
            onClick={confirmClearAll}
            className="flex items-center space-x-1.5 px-3 py-2 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-xs font-medium transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Effacer toutes les données locales</span>
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
            <FolderClock className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Aucun livre audio enregistré</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
              Importez un document PDF dans l'onglet Convertisseur pour lancer votre première synthèse vocale. Vos projets apparaîtront ici automatiquement.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((proj) => {
            const completedCount = proj.segments.filter((s) => s.status === 'completed').length;
            const totalCount = proj.segments.filter((s) => s.selected).length;
            const isFinished = totalCount > 0 && completedCount === totalCount;
            const totalSecs = proj.segments.reduce(
              (acc, s) => acc + (s.audioDurationSeconds || 0),
              0
            );

            return (
              <div
                key={proj.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isFinished
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}
                      >
                        {isFinished ? 'Terminé' : `${completedCount} / ${totalCount} segments`}
                      </span>
                      <span className="text-xs text-slate-400">
                        Voix: <strong className="text-slate-300">{proj.selectedVoice}</strong>
                      </span>
                    </div>

                    <button
                      onClick={() => confirmDelete(proj)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Supprimer ce projet"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-white line-clamp-1">{proj.title}</h3>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      Fichier source : {proj.pdfInfo.name}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                    <div>
                      <span className="block text-[10px] text-slate-500">Pages</span>
                      <span className="font-medium text-slate-300">{proj.pdfInfo.totalPages}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">Durée audio</span>
                      <span className="font-medium text-slate-300">{formatDuration(totalSecs)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">Date</span>
                      <span className="font-medium text-slate-300">
                        {new Date(proj.updatedAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-2 pt-4 mt-2 border-t border-slate-800">
                  {completedCount > 0 ? (
                    <button
                      onClick={() => handleDownloadZip(proj)}
                      disabled={exportingId === proj.id}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{exportingId === proj.id ? 'ZIP en cours...' : 'Télécharger ZIP'}</span>
                    </button>
                  ) : <div />}

                  <button
                    onClick={() => onOpenProject(proj.id)}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    <span>Ouvrir / Reprendre</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
