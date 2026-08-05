<p align="center">
  <img src="../../addon/content/icons/icon-96.png" alt="Logo AIdea" width="88" />
</p>

# AIdea

<p align="center">
  <a href="../../README.md">English</a>
  ·
  <a href="./README.zh-CN.md">简体中文</a>
  ·
  <a href="./README.zh-TW.md">繁體中文</a>
  ·
  <a href="./README.ja.md">日本語</a>
  ·
  <a href="./README.ko.md">한국어</a>
  ·
  <a href="./README.fr.md">Français</a>
</p>

<p align="center">
  <strong>🌐 Website:</strong> <a href="https://visterainer.github.io/aidea-zotero/fr/">https://visterainer.github.io/aidea-zotero/fr/</a>
</p>

AIdea est un plugin open source et gratuit pour Zotero, conçu comme assistant de recherche alimenté par l'IA. 🔐 Il prend en charge la connexion OAuth avec OpenAI (ChatGPT), Google Gemini et GitHub Copilot. ⚙️ Il prend aussi en charge les API compatibles OpenAI, ainsi que les modèles locaux ou auto-hébergés via Ollama, LM Studio, vLLM et des environnements similaires. Il intègre dans la vue Bibliothèque et les lecteurs PDF et EPUB de Zotero le dialogue avec plusieurs fournisseurs, l'analyse contextuelle des documents, l'export de notes, la mémoire locale, la traduction par sélection et la traduction intégrale des documents.

<p align="center">
  <img alt="OpenAI ChatGPT" src="https://img.shields.io/badge/OpenAI-ChatGPT-10A37F?style=for-the-badge&logo=openai&logoColor=white" />
  <img alt="Google Gemini" src="https://img.shields.io/badge/Google-Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img alt="GitHub Copilot" src="https://img.shields.io/badge/GitHub-Copilot-111111?style=for-the-badge&logo=github&logoColor=white" />
</p>

<p align="center">
  <img alt="OpenAI Compatible API" src="https://img.shields.io/badge/OpenAI-Compatible%20API-4B5563?style=flat-square&logo=openai&logoColor=white" />
  <img alt="Ollama" src="https://img.shields.io/badge/Ollama-1F2937?style=flat-square&logoColor=white" />
  <img alt="LM Studio" src="https://img.shields.io/badge/LM%20Studio-2563EB?style=flat-square&logoColor=white" />
  <img alt="vLLM" src="https://img.shields.io/badge/vLLM-7C3AED?style=flat-square&logoColor=white" />
</p>

## Vue d'ensemble

AIdea s'adresse aux chercheurs qui souhaitent conserver dans Zotero la lecture d'articles et de livres numériques, les questions de suivi, l'extraction de passages, l'organisation des notes et la traduction intégrale. Le plugin ajoute un espace de travail IA cohérent et durable à la vue Bibliothèque ainsi qu'aux lecteurs PDF et EPUB, afin d'éviter les allers-retours entre Zotero et plusieurs outils externes.

## Capacités principales

- **Dialogue IA dans le panneau latéral** de la vue Bibliothèque et des lecteurs PDF et EPUB
- **Contexte centré sur le document** à partir de texte PDF sélectionné, de la structure éditoriale EPUB 2/3, de captures, de figures et de pièces jointes
- **Actions rapides** pour résumer, expliquer, traduire et exécuter d'autres tâches fréquentes
- **Plusieurs modes de connexion**, avec OAuth ou API compatible OpenAI
- **Traduction intégrale** exécutée dans Zotero avec export PDF
- **Traduction par sélection** dans les lecteurs PDF et EPUB, avec détection automatique du format, contexte documentaire borné et ajout possible aux notes Zotero
- **Historique et mémoire locale**, avec isolation par bibliothèque et export des réponses vers les notes Zotero
- **Rendu enrichi** pour Markdown, blocs de code, tableaux, LaTeX et réponses en flux

## Captures d'écran

### Dialogue dans le panneau latéral

<p align="center">
  <img src="../../doc/screenshots/chat_panel_en.png" alt="Dialogue AIdea dans le panneau latéral de Zotero" width="900" />
</p>

### Traduction intégrale

<p align="center">
  <img src="../../doc/screenshots/translate_panel_en.png" alt="Panneau de traduction intégrale AIdea" width="900" />
</p>

### Traduction par sélection

<p align="center">
  <img src="../../doc/screenshots/selection_translation_popup.png" alt="Fenêtre de traduction par sélection dans le lecteur PDF" width="900" />
</p>

<p align="center">
  <img src="../../doc/screenshots/selection_translation_settings.png" alt="Paramètres de traduction par sélection AIdea" width="900" />
</p>

### Paramètres des fournisseurs et des modèles

<p align="center">
  <img src="../../doc/screenshots/settings_oauth_models_en.png" alt="Paramètres des fournisseurs et des modèles AIdea" width="900" />
</p>

## Connexions prises en charge

| Option                                 | Authentification                               | Remarques                                                                      |
| -------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| OpenAI (ChatGPT)                       | OAuth via Codex CLI                            | Le plugin peut installer automatiquement l'environnement Node.js si nécessaire |
| Google Gemini                          | OAuth intégré au plugin (PKCE)                 | Le plugin peut installer automatiquement l'environnement Node.js si nécessaire |
| GitHub Copilot                         | OAuth intégré au plugin (Device Code)          | Aucun bootstrap Node.js supplémentaire n'est requis                            |
| Point de terminaison compatible OpenAI | URL de base API, modèle et clé API facultative | Convient aux services locaux, auto-hébergés ou tiers compatibles               |

## Installation

### Prérequis

- Zotero 7 ou version ultérieure
- Node.js uniquement si le fournisseur choisi en a besoin ; AIdea peut l'installer automatiquement pour les flux pris en charge

### Installer le plugin

1. Téléchargez le dernier paquet `.xpi` depuis [Releases](https://github.com/Visterainer/aidea-zotero/releases).
2. Dans Zotero, ouvrez `Tools` -> `Add-ons`.
3. Dans le menu engrenage, choisissez `Install Add-on From File...`.
4. Sélectionnez le fichier `.xpi` téléchargé.
5. Redémarrez Zotero.

### Mise à niveau

Installez simplement le nouveau paquet `.xpi` par-dessus l'ancien. AIdea conserve les paramètres locaux, l'historique des conversations et les données de mémoire.

## Démarrage rapide

1. Ouvrez `Tools` -> `Add-ons` -> `AIdea` -> `Settings`.
2. Choisissez soit la connexion OAuth, soit le mode API.
3. Actualisez les modèles disponibles et sélectionnez celui à utiliser.
4. Ouvrez un élément Zotero, un PDF ou un EPUB, puis commencez depuis le panneau latéral AIdea.

Pour la traduction intégrale, passez à l'onglet de traduction, définissez le modèle et le chemin de sortie, puis lancez la tâche directement dans Zotero.

Pour la traduction par sélection, activez l'option dans les paramètres, choisissez un modèle et sélectionnez du texte dans le lecteur PDF ou EPUB ; AIdea détecte automatiquement le format actif. Pour un PDF, la première utilisation crée un cache local avec un résumé compact et les termes importants. Pour un EPUB, AIdea utilise directement un contexte de livre borné et ancré sur la sélection, sans requête de préchauffage séparée.

## Prise en charge des langues

- **Interface du plugin :** English, 简体中文, 繁體中文, 日本語, 한국어, Français, Deutsch, Español, Русский, Português, العربية, हिन्दी
- **Documentation et site du projet :** English, 简体中文, 繁體中文, 日本語, 한국어, Français

## Confidentialité et traitement des données

- Les jetons OAuth sont conservés localement sur votre machine.
- Les requêtes API sont envoyées directement au fournisseur choisi ou au point de terminaison configuré.
- L'historique des conversations et la mémoire sont stockés dans la base SQLite locale de Zotero.
- Le projet n'exploite aucun service relais et ne collecte pas de télémétrie d'usage.

## Développement

```bash
npm install
npm start
npm run build
npm run test:unit
```

## Licence et attribution

AIdea est distribué sous licence [AGPL-3.0-or-later](../../LICENSE).

Le projet est dérivé de [llm-for-zotero](https://github.com/yilewang/llm-for-zotero). Consultez [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) pour les mentions tierces.

## ⭐ Star History

<a href="https://star-history.com/#Visterainer/aidea-zotero&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Visterainer/aidea-zotero&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Visterainer/aidea-zotero&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Visterainer/aidea-zotero&type=Date" />
 </picture>
</a>
