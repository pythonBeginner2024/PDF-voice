import React from 'react';
import { Headphones, BookOpen, Settings, HelpCircle, FolderClock, KeyRound } from 'lucide-react';

export type ActiveTab = 'converter' | 'library' | 'settings' | 'help';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  hasApiKey: boolean;
  savedProjectsCount: number;
  currentProjectTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  hasApiKey,
  savedProjectsCount,
  currentProjectTitle,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <button
            onClick={() => setActiveTab('converter')}
            className="flex items-center space-x-3 text-left focus:outline-none group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight">PDF to Audio</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                  Gemini TTS
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                {currentProjectTitle ? `Projet : ${currentProjectTitle}` : 'Convertisseur de livres audio'}
              </p>
            </div>
          </button>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveTab('converter')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'converter'
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden md:inline">Convertisseur</span>
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FolderClock className="w-4 h-4" />
              <span className="hidden md:inline">Bibliothèque</span>
              {savedProjectsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[11px] font-semibold bg-slate-800 text-slate-300 rounded-full">
                  {savedProjectsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer relative ${
                activeTab === 'settings'
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden md:inline">Paramètres</span>
              {/* API Key Status Indicator */}
              <span
                className={`w-2 h-2 rounded-full ring-2 ring-slate-900 ${
                  hasApiKey ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                }`}
                title={hasApiKey ? 'Clé API configurée' : 'Clé API manquante'}
              />
            </button>

            <button
              onClick={() => setActiveTab('help')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'help'
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Aide & Confidentialité"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden lg:inline">Aide & Confidentialité</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
