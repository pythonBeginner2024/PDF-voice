import React from 'react';
import {
  HelpCircle,
  KeyRound,
  ShieldCheck,
  FileCheck,
  Github,
  ExternalLink,
  Cpu,
  AlertTriangle,
  Info,
  ServerOff,
  Database,
} from 'lucide-react';

export const HelpAndPrivacyView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Aide, Confidentialité & Déploiement
        </h1>
        <p className="text-slate-400 mt-1 text-sm sm:text-base">
          Tout savoir sur le fonctionnement de PDF to Audio, l'obtention de votre clé API Gemini, le respect de vos données et le déploiement sur GitHub Pages.
        </p>
      </div>

      {/* Guide 1: Clé API Gemini */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Comment obtenir votre clé API Gemini gratuite ?</h2>
            <p className="text-xs text-slate-400">Quelques étapes simples sans carte bancaire requise.</p>
          </div>
        </div>

        <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300 leading-relaxed">
          <li>
            Rendez-vous sur la console officielle{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline inline-flex items-center space-x-1"
            >
              <span>Google AI Studio</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>{' '}
            et connectez-vous avec votre compte Google personnel.
          </li>
          <li>
            Cliquez sur le bouton bleu <strong>« Create API Key »</strong> (Créer une clé API).
          </li>
          <li>
            Sélectionnez un projet Google Cloud existant ou laissez Google en créer un automatiquement.
          </li>
          <li>
            Copiez la clé générée (commençant par <code className="text-indigo-300 font-mono">AIzaSy...</code>) et collez-la dans l'onglet <strong>Paramètres</strong> de cette application.
          </li>
          <li>
            Cliquez sur <strong>« Tester et valider la clé »</strong> pour vérifier que votre accès est actif.
          </li>
        </ol>

        <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl text-xs text-slate-400 space-y-1">
          <div className="flex items-center space-x-2 text-indigo-400 font-semibold">
            <Info className="w-4 h-4" />
            <span>Quotas et limites de la version gratuite :</span>
          </div>
          <p>
            Le palier gratuit (Free Tier) de l'API Gemini offre des quotas généreux pour les projets personnels. Si vous rencontrez une erreur 429 (Resource Exhausted), le convertisseur marque la portion et reprend automatiquement après un court délai de temporisation (backoff exponentiel).
          </p>
        </div>
      </div>

      {/* Guide 2: Confidentialité & Traitement des données */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Transparence & Confidentialité des Données</h2>
            <p className="text-xs text-slate-400">Architecture locale et utilisation des services externes.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-indigo-400 font-semibold">
              <ServerOff className="w-4 h-4" />
              <span>Aucun serveur intermédiaire</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              L'application s'exécute à 100% dans votre navigateur. Aucun fichier PDF ou audio n'est téléversé vers un serveur tiers propriétaire ou une base distante.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
              <Database className="w-4 h-4" />
              <span>Stockage IndexedDB local</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Vos projets, portions de texte et enregistrements WAV sont stockés dans la base IndexedDB de votre navigateur. Vous pouvez tout purger en un clic.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-sky-400 font-semibold">
              <Cpu className="w-4 h-4" />
              <span>Synthèse vocale Gemini</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Seuls les segments de texte sélectionnés sont transmis directement de votre navigateur à l'API Google Gemini avec votre propre clé, soumis aux conditions d'utilisation de Google.
            </p>
          </div>
        </div>
      </div>

      {/* Guide 3: Déploiement sur GitHub Pages */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white">
            <Github className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Déploiement sur GitHub Pages</h2>
            <p className="text-xs text-slate-400">Hébergez gratuitement votre propre instance statique en 3 minutes.</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-300">
          <p>
            Cette application est conçue pour fonctionner comme une Single-Page Application (SPA) 100% statique, sans backend Node.js requis. Le fichier <code className="text-indigo-300 font-mono">.github/workflows/deploy.yml</code> est déjà inclus dans le dépôt.
          </p>

          <div className="bg-slate-950 p-4 rounded-xl font-mono text-xs text-slate-300 space-y-2 border border-slate-800">
            <p className="text-indigo-400 font-semibold"># Procédure de publication :</p>
            <p>1. Poussez le code source sur un dépôt GitHub (ex: <code>username/pdf-to-audio</code>)</p>
            <p>2. Allez dans l'onglet <strong>Settings &gt; Pages</strong> de votre dépôt GitHub</p>
            <p>3. Sous <strong>Build and deployment &gt; Source</strong>, sélectionnez <strong>« GitHub Actions »</strong></p>
            <p>4. Le workflow se déclenche automatiquement à chaque commit et publie le site sur <code>https://username.github.io/pdf-to-audio/</code></p>
          </div>
        </div>
      </div>
    </div>
  );
};
