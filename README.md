# PDF to Audio — Convertisseur de PDF en Livres Audio

Application web moderne, réactive et 100% statique permettant de convertir des documents PDF (romans, essais, cours, articles) en livres audio haute fidélité grâce à la synthèse vocale neuronale de l'API Google Gemini TTS.

Conçue pour fonctionner sur ordinateur (Windows, macOS, Linux) et smartphone/tablette (Android, iOS) directement depuis un navigateur moderne.

---

## 🌟 Fonctionnalités Principales

- **Traitement 100% Local du PDF** : L'analyse du document et l'extraction du texte page par page sont réalisées intégralement dans le navigateur avec `PDF.js`. Aucun fichier PDF n'est envoyé à un serveur tiers.
- **Détection des Scans & Alertes** : Détection intelligente des PDF scannés ou sans texte exploitable (avertissant explicitement de la nécessité d'un OCR non inclus dans cette version).
- **Découpage Intelligent en 3 Modes** :
  - **Mode A — Document complet** : Idéal pour les documents courts.
  - **Mode B — Chapitre par chapitre** : Détection automatique des en-têtes (« Chapitre 1 », « Partie II », etc.) avec cases à cocher et renommage.
  - **Mode C — Portions automatiques** : Découpage aux frontières naturelles de phrases (~900 caractères) pour une résilience maximale.
- **Moteur Gemini TTS Officiel** :
  - Modèle recommandé : `gemini-3.8-flash-lite-tts` (rapide et optimisé) ou `gemini-3.8-flash-tts` (expressif).
  - 6 voix neuronales naturelles disponibles : *Kore*, *Puck*, *Fenrir*, *Zephyr*, *Charon*, *Aoede*.
  - Préécoute d'un extrait de 3 secondes pour tester chaque voix.
- **Gestionnaire de Tâches & Reprise sur Incident** :
  - Sauvegarde locale en temps réel dans **IndexedDB**.
  - Reprise après interruption ou fermeture du navigateur.
  - Bouton « Réessayer les échecs » ciblant uniquement les portions non converties.
  - Temporisation et retry progressif (backoff exponentiel) en cas de limitation de quota (erreur 429).
- **Lecteur Audio Intégré** :
  - Barre de progression temporelle et scrubber.
  - Vitesse de lecture réglable (0.8x, 1x, 1.25x, 1.5x, 2x).
  - Navigation entre portions et chapitres.
- **Exportation Complète & Formats Audio** :
  - Téléchargement WAV de chaque portion individuelle.
  - Assemblage WAV complet sans rupture (recalcul précis des en-têtes RIFF/WAVE et concaténation du flux PCM).
  - Exportation en archive **ZIP** (via `JSZip`) contenant tous les fichiers audio ordonnés et un fichier `Sommaire.txt`.
- **Gestion Sécurisée de la Clé API** :
  - Saisie masquée avec bascule d'affichage.
  - Bouton de validation par requête de test minimale auprès de Google.
  - Option facultative d'enregistrement sur l'appareil (décochée par défaut avec avertissement de sécurité).
  - Suppression immédiate de la clé en un clic.

---

## 🚀 Guide de Démarrage Rapide

### 1. Obtenir une clé API Google Gemini gratuite

1. Rendez-vous sur la console [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Connectez-vous avec votre compte Google.
3. Cliquez sur **« Create API Key »** (Créer une clé API).
4. Copiez votre clé (commençant par `AIzaSy...`).
5. Ouvrez l'application **PDF to Audio**, allez dans **Paramètres**, collez votre clé et cliquez sur **« Tester et valider la clé »**.

### 2. Convertir un livre

1. Glissez-déposez votre fichier `.pdf` sur la zone d'importation.
2. Vérifiez le texte extrait et les statistiques (mots, pages, durée estimée).
3. Choisissez votre mode de découpage (Chapitres ou Portions) et la voix souhaitée.
4. Cliquez sur **« Lancer la synthèse vocale »**.
5. Suivez la progression en direct, écoutez les portions terminées et téléchargez l'audio complet ou l'archive ZIP !

---

## 🌐 Déploiement sur GitHub Pages

Cette application est **100% statique** : elle ne nécessite aucun serveur Node.js en production et se déploie directement sur GitHub Pages.

Le workflow GitHub Actions est déjà configuré dans `.github/workflows/deploy.yml`.

### Procédure de déploiement :

1. Créez un nouveau dépôt sur [GitHub](https://github.com/new) (ex: `pdf-to-audio`).
2. Poussez le code source :
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit of PDF to Audio"
   git branch -M main
   git remote add origin https://github.com/<votre-nom-utilisateur>/pdf-to-audio.git
   git push -u origin main
   ```
3. Sur GitHub, rendez-vous dans les **Settings** (Paramètres) du dépôt :
   - Cliquez sur **Pages** (dans le menu de gauche).
   - Sous **Build and deployment > Source**, sélectionnez **GitHub Actions**.
4. Le workflow se lance automatiquement à chaque commit et publie l'application sous l'URL :
   `https://<votre-nom-utilisateur>.github.io/pdf-to-audio/`

---

## 🔒 Confidentialité & Sécurité

- **Aucune base distante obligatoire** : Tous les projets, états d'avancement et fichiers audio sont enregistrés dans la base IndexedDB locale de votre navigateur.
- **Clé API privée** : Votre clé API reste sur votre appareil et est uniquement envoyée aux serveurs officiels de Google (`generativelanguage.googleapis.com`) pour exécuter la synthèse vocale.
- **Texte envoyé** : Seuls les segments de texte sélectionnés pour la lecture audio sont transmis à l'API Google Gemini, conformément aux conditions d'utilisation de Google.

---

## 🛠️ Stack Technique

- **Framework** : React 19, TypeScript
- **Bundler & Build** : Vite
- **Styles** : Tailwind CSS v4
- **Extraction PDF** : PDF.js (`pdfjs-dist`)
- **Synthèse Vocale** : Google Gemini TTS REST API (`gemini-3.8-flash-lite-tts`)
- **Stockage Local** : IndexedDB (Blobs audio et métadonnées projets)
- **Archives & Assemblage** : JSZip, Web Audio / DataView WAV Engine
- **Icônes** : Lucide React
