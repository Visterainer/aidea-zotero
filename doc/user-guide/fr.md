# Guide d’utilisation d’AIdea

[简体中文](./zh-CN.md) · [繁體中文](./zh-TW.md) · [English](./en.md) · [日本語](./ja.md) · [한국어](./ko.md) · **Français**

Pour AIdea 4.0.2 et Zotero 7 à 10. Connectez un modèle, vérifiez sa réponse sur la section 3.2.1 de *[Attention Is All You Need](https://arxiv.org/html/1706.03762v7#S3.SS2.SSS1)*, puis produisez un PDF bilingue anglais–chinois simplifié. Les adresses de connexion données en exemple sont fictives.

## Sommaire

1. [Installation et connexion des modèles](#installation-et-connexion-des-modèles)
2. [Réglages de l’interface](#réglages-de-linterface)
3. [Réglages de la discussion](#réglages-de-la-discussion)
4. [Traduction intégrale des PDF](#traduction-intégrale-des-pdf)
5. [Traduction de la sélection](#traduction-de-la-sélection)
6. [Dépannage](#dépannage)
   - [La liste des modèles est vide après connexion](#la-liste-des-modèles-est-vide-après-connexion)
   - [Quels journaux copier](#quels-journaux-copier)
   - [Demander un diagnostic à un agent local](#demander-un-diagnostic-à-un-agent-local)

## Installation et connexion des modèles

1. Téléchargez le fichier `.xpi` d’AIdea depuis la [dernière version](https://github.com/Visterainer/aidea-zotero/releases/latest). Dans **Outils → Extensions** de Zotero, ouvrez la roue dentée et choisissez l’installation depuis un fichier. Sélectionnez le téléchargement et redémarrez Zotero.
2. Ouvrez un article et déployez le panneau AIdea à droite. Dans **Paramètres → Configuration du modèle**, choisissez le mode de connexion correspondant à votre service.

**Compte ChatGPT.** Dans la carte OpenAI, installez ou mettez à jour l’environnement pour obtenir la version autonome de Codex CLI. Lancez la connexion OAuth, autorisez l’accès dans votre navigateur, puis actualisez les modèles dans Zotero. Le CLI gère la connexion sur votre ordinateur. AIdea utilise cette autorisation pour accéder aux modèles disponibles avec votre compte.

**Compte GitHub Copilot.** Lancez la connexion OAuth dans la carte Copilot. Vérifiez le code de l’appareil, confirmez l’autorisation sur GitHub, puis actualisez les modèles dans Zotero. Cette procédure fonctionne sans installer Codex CLI.

**Clé API ou modèle local.** Choisissez le mode API. Saisissez l’URL de base du service (par exemple `https://api.example.com/v1`), la clé et l’identifiant exact du modèle. Vous pouvez récupérer la liste ou ajouter un identifiant manuellement. Avec Ollama, démarrez le serveur puis renseignez `http://127.0.0.1:11434/v1` et le nom d’un modèle installé. Laissez la clé vide uniquement si le service autorise les requêtes sans authentification.

**Mise à jour du CLI.** Par défaut, AIdea vérifie périodiquement l’environnement OAuth et vous avertit lorsqu’une mise à jour est disponible. En mode automatique, elle démarre après 60 secondes. Reporter ou réduire la notification la diffère de 24 heures. Le mode silencieux désactive les vérifications et les rappels. La carte OpenAI permet une mise à jour manuelle. L’onglet de traduction gère séparément l’environnement PDF.

[![Configuration du modèle dans le panneau AIdea](../../site/public/media/reader/settings-en-US.jpg)](../../site/public/media/reader/settings-en-US.jpg)

## Réglages de l’interface

### Changer les couleurs et la barre d’onglets

Ouvrez **Paramètres → Configuration de base**. ① Affichez ou masquez les onglets. Survolez le haut du panneau pour les faire réapparaître. ② Choisissez un thème clair, sombre ou par défaut. ③ Ouvrez les réglages d’affichage et de texte. La langue de l’interface se règle ici aussi.

[![Les onglets, le thème et les réglages du texte](../../site/public/media/reader/window-settings-en-US.jpg)](../../site/public/media/reader/window-settings-en-US.jpg)

### Régler la taille du texte, l’interligne et les marges

Ouvrez les réglages d’affichage et de texte, puis choisissez un préréglage compact, standard, confortable ou à grands caractères. Déplacez la fenêtre par son titre pour garder une réponse visible.

① L’**interligne de la conversation** s’applique aux questions et aux réponses. Gardez un corps de 13 px et passez de 1,45 à 1,65 pour espacer les lignes d’une même réponse.

② L’**interligne de la zone de saisie** s’applique au brouillon. Tapez deux lignes pour comparer. ③ L’**interligne de la traduction de sélection** s’applique à la fenêtre de traduction. Sélectionnez un passage pour vérifier.

[![Les trois réglages d’interligne dans la fenêtre complète de Zotero](../../site/public/media/reader/window-line-height-en-US.jpg)](../../site/public/media/reader/window-line-height-en-US.jpg) [![Détail des interlignes de la conversation, de la saisie et des traductions](../../site/public/media/reader/detail-line-height-en-US.jpg)](../../site/public/media/reader/detail-line-height-en-US.jpg)

Chaque zone a sa propre taille de texte. L’**espacement des messages** sépare deux bulles. Les **marges internes** séparent le texte des bords de sa bulle. Élargissez la fenêtre de traduction pour limiter les retours à la ligne. L’échelle des images se règle dans **Images**. **Réinitialiser** rétablit la typographie par défaut.

### Redimensionner le volet de Zotero et la fenêtre

Dépliez **AIdea** à droite du lecteur. Tirez le séparateur vers la gauche pour élargir le panneau. Pour gagner en hauteur, étirez la fenêtre Zotero par son bord inférieur ou maximisez-la.

### Régler séparément la hauteur des messages et de la saisie

Dans la discussion, tirez ② le coin droit juste au-dessus des raccourcis pour lire davantage de la réponse, ou ③ le coin extérieur sous Envoyer pour agrandir la zone de saisie. Tirez vers le bas pour agrandir, vers le haut pour réduire. Les hauteurs sont mémorisées. Faites défiler le panneau si une poignée est hors champ.

[![① Largeur du panneau · ② Hauteur de la conversation · ③ Hauteur de la saisie](../../site/public/media/reader/window-resize-en-US.jpg)](../../site/public/media/reader/window-resize-en-US.jpg)

## Réglages de la discussion

Choisissez d’abord le modèle, puis vérifiez les documents joints à la question. Une fois la réponse reçue, vérifiez quelle partie du texte a été transmise et ouvrez les références qui étayent l’explication.

### Choisir le modèle de la discussion

1. **Compte ChatGPT ou Copilot.** Dans les réglages des modèles, actualisez la liste sur la carte du fournisseur. Cochez les modèles voulus dans la liste des modèles disponibles. Le choix est enregistré immédiatement.
2. **Clé API ou serveur local.** Vérifiez l’adresse de base et saisissez une clé si le service l’exige. Récupérez la liste ou ajoutez manuellement l’identifiant exact. Dans la liste récupérée, cochez tous les modèles à conserver, puis enregistrez la sélection. Elle remplace la liste de ce service.
3. Revenez à la discussion. Cliquez sur le nom du modèle sous le champ de saisie et choisissez le fournisseur, puis le modèle. Si le menu est vide, vérifiez les cases cochées. Si l’actualisation ne renvoie aucun modèle après la connexion, [suivez les étapes de dépannage du proxy](#la-liste-des-modèles-est-vide-après-connexion).

Choisissez un modèle texte pour un passage ou un modèle acceptant les images pour un schéma ou un scan. Pour une démonstration, cherchez un effort de raisonnement réglable. Pour plusieurs articles longs, vérifiez la fenêtre de contexte.

[![① Cliquez sur le nom du modèle sous la saisie. ② La coche indique le modèle actif. Cliquez sur une autre ligne pour en changer.](../../site/public/media/reader/window-models-en-US.jpg)](../../site/public/media/reader/window-models-en-US.jpg)

Changer de modèle conserve les réponses précédentes. Pour poser la même question à un autre modèle, cliquez sur **Réessayer** à côté de la réponse.

### Régler le raisonnement, le contexte et les consignes

<img src="../../addon/content/icons/action-reasoning-bulb.svg" width="18" height="18" alt=""> Survolez l’ampoule pour lire l’effort de raisonnement actuel. Cliquez dessus, choisissez un niveau proposé par le modèle, puis envoyez votre question. Si une flèche apparaît, le niveau à droite est celui appliqué. Une ampoule grise indique que le modèle ne propose aucun niveau réglable ou que ses capacités restent inconnues. Dans ce dernier cas, actualisez la liste des modèles.

| Réglage | Où et comment l’utiliser |
| --- | --- |
| Effort de raisonnement | Cliquez sur l’ampoule à côté du modèle. Gardez d’abord le réglage par défaut. Pour examiner une démonstration, essayez un niveau pris en charge. La discussion, la traduction de sélection et la traduction intégrale conservent des préférences distinctes. |
| Fenêtre de contexte | Dans les options avancées du modèle, laissez la limite en tokens vide pour le calcul automatique. Si le modèle ne reçoit fréquemment que des extraits, vérifiez la fenêtre réelle du fournisseur avant de saisir une limite. AIdea réserve de la place pour la réponse. |
| Consigne système | Dans les réglages avancés, indiquez par exemple « Donne la conclusion, puis le passage qui la justifie ». La nouvelle consigne remplace celle de la discussion dès la prochaine question. Effacez-la pour rétablir la valeur par défaut. La traduction de sélection a sa propre consigne. |

[![① L’ampoule ouvre le menu de raisonnement. ② La coche indique le niveau actif. Le modèle illustré propose six niveaux. Les choix disponibles dépendent du modèle.](../../site/public/media/reader/window-effort-en-US.jpg)](../../site/public/media/reader/window-effort-en-US.jpg)

### Joindre un passage, un article, une figure ou un fichier

Dans le lecteur PDF ou EPUB, vérifiez le titre de l’article affiché près de la zone de saisie. Vous pouvez aussi ouvrir une discussion indépendante depuis la bibliothèque.

| Source | Comment la joindre |
| --- | --- |
| <img src="../../addon/content/icons/action-add-text.svg" width="18" height="18" alt=""> Passage | Sélectionnez le texte dans le lecteur, puis ajoutez-le depuis la fenêtre contextuelle ou la barre de saisie. Vérifiez que l’extrait apparaît avant l’envoi. Si le bouton manque dans la fenêtre, activez-le dans les réglages avancés. |
| <img src="../../addon/content/icons/action-slash.svg" width="18" height="18" alt=""> Second article | Saisissez `@` suivi d’un mot du titre ou ouvrez le sélecteur de références avec le trombone. Utilisez les flèches puis Entrée ou Tab. Vérifiez le titre et la version de chaque article. |
| <img src="../../addon/content/icons/action-screenshot.svg" width="18" height="18" alt=""> Figure ou équation | Cliquez sur les ciseaux dans le PDF et encadrez la figure avec sa légende. Échap annule la capture. Vous pouvez aussi coller ou déposer une image. Vérifiez les indices dans l’aperçu et choisissez un modèle acceptant les images. |
| <img src="../../addon/content/icons/action-slash.svg" width="18" height="18" alt=""> Fichier local | Utilisez le trombone ou déposez un PDF, une image, un fichier texte, Markdown ou de code. La limite par PDF téléversé est de 50 Mio. Si l’extraction échoue, joignez le passage ou une capture lisible. |

Les articles de référence et les fichiers restent disponibles entre deux questions. Retirez-les avec **×** après la comparaison. Les captures et sélections en attente sont retirées du champ après l’envoi. Ajoutez-les de nouveau pour désigner explicitement le même passage.

① Cliquez sur le trombone sous la zone de saisie. Choisissez ② pour joindre un fichier ou ③ pour sélectionner un article de référence.

[![① Cliquez sur le trombone sous la zone de saisie. Choisissez ② pour joindre un fichier ou ③ pour sélectionner un article de référence.](../../site/public/media/reader/window-context-menu-en-US.jpg)](../../site/public/media/reader/window-context-menu-en-US.jpg)

### Envoyer une question ou utiliser un raccourci

<img src="../../addon/content/icons/action-send.svg" width="18" height="18" alt=""> **Entrée** envoie la question et **Maj+Entrée** insère un saut de ligne. Dans le sélecteur `@`, Entrée valide d’abord l’article. Pendant la génération, utilisez le bouton d’annulation pour interrompre la réponse.

Les raccourcis de traduction, de résumé, de points clés, de méthode et de limites remplacent le brouillon et envoient leur consigne immédiatement. Joignez le passage au préalable et copiez le brouillon si vous voulez le garder. Un clic droit permet de modifier le nom et la consigne, d’ajouter ou de supprimer un raccourci, ou de passer en mode déplacement pour les réordonner.

[![① Faites un clic droit sur le raccourci de traduction. ② Modifiez sa consigne ou supprimez le raccourci depuis ce menu.](../../site/public/media/reader/window-shortcuts-en-US.jpg)](../../site/public/media/reader/window-shortcuts-en-US.jpg)

① Faites un clic droit sur le raccourci de traduction. ② Modifiez sa consigne ou supprimez le raccourci depuis ce menu.

### Tester la connexion sur un passage

1. Dans *Attention Is All You Need*, ajoutez le paragraphe sous l’équation (1), au § 3.2.1. Joignez la figure 2 si vous souhaitez aussi interroger le schéma.
2. Demandez « Pourquoi diviser le produit scalaire par √dₖ ? Indique l’hypothèse sur la variance et le passage qui la justifie. » Près de la réponse, vérifiez si le modèle a reçu le texte intégral, des extraits, le résumé seul ou aucun corps de texte. Au besoin, joignez le passage manquant.
3. Ouvrez une référence pour vérifier la page PDF ou la section EPUB. Un numéro de page écrit en texte libre demande une vérification manuelle. Si le lien ne retrouve plus la source, vérifiez la notice Zotero et le fichier original sur cet appareil.
4. Dans la même discussion, demandez quelle étape du raisonnement change si les composantes des requêtes et des clés n’ont plus une variance unitaire.

[![La figure 2 et une réponse de démonstration en anglais sur le facteur d’échelle de l’équation (1).](../../site/public/media/reader/window-chat-en-US.jpg)](../../site/public/media/reader/window-chat-en-US.jpg)

### Générer un schéma à partir d’un article

Lors du test dans Zotero, AIdea a généré et exporté un schéma du Transformer avec **gpt-6.1-sol** via **ChatGPT OAuth (Codex)**. Ce modèle de discussion fait appel à un outil de génération d’images. Pour les autres connexions, sa disponibilité dépend du service et du modèle.

1. Dans la discussion, utilisez le trombone pour joindre le PDF de *Attention Is All You Need*. Vérifiez le nom du fichier et le modèle sélectionné.
2. Envoyez cette demande.

   > À partir de la section 3 du PDF joint, utilise la génération d’images pour dessiner le Transformer sur une diapositive 16:9 destinée à une conférence. Sur un fond ivoire, place de grands libellés en anglais et deux empilements isométriques, bleu cobalt pour l’encodeur et vermillon pour le décodeur, chacun marqué ×6. Pars des séquences source et cible décalée, avec leurs plongements et le codage positionnel. Mets en évidence la flèche qui transmet K et V de l’encodeur à l’attention croisée, Q provenant du décodeur. Termine par un petit diagramme en barres des probabilités du prochain token. Prévois des marges généreuses et des caractères lisibles au fond de la salle. Renvoie l’image.

3. Attendez que l’image apparaisse dans la réponse. Faites un clic droit **sur l’image**, choisissez l’exportation puis un dossier pour le PNG. Comparez les flèches à la figure 1, notamment la sortie de l’encodeur vers l’attention croisée du décodeur.

[![Le PDF joint et la consigne en anglais dans la zone de saisie de Zotero.](../../site/public/media/reader/window-diagram-prompt-en-US.jpg)](../../site/public/media/reader/window-diagram-prompt-en-US.jpg)

[Ouvrir le PNG exporté lors du test dans Zotero (libellés en chinois).](../../site/public/media/reader/transformer-generated-zh.png)

### Modifier une question, réessayer ou créer une branche

Après la génération, cliquez sur **Modifier** près de votre question, corrigez-la et renvoyez-la. Pour comparer deux réponses, utilisez l’action de nouvelle tentative sur la dernière réponse compatible et choisissez un modèle. Les flèches parcourent les versions. Le modèle choisi devient aussi celui du champ de saisie.

Pour explorer une piste à partir d’une réponse, créez une branche depuis cette réponse. La nouvelle discussion reprend les échanges jusqu’à cet endroit. Le bouton de nouvelle discussion ouvre une conversation vide.

[![① Cliquez sur le crayon près de la question pour la modifier. ② Cliquez sur la flèche circulaire sous la réponse pour réessayer.](../../site/public/media/reader/window-reply-en-US.jpg)](../../site/public/media/reader/window-reply-en-US.jpg)

① Cliquez sur le crayon près de la question pour la modifier. ② Cliquez sur la flèche circulaire sous la réponse pour réessayer.

### Retrouver les preuves dans un long échange

Lorsque l’historique dépasse le budget de contexte, les anciens échanges peuvent être résumés ou seuls les plus récents conservés. AIdea peut aussi rappeler des éléments pertinents de la bibliothèque courante selon l’espace disponible. Pour revenir sur une valeur, une équation ou une légende précise, joignez de nouveau le passage et vérifiez la référence dans la nouvelle réponse.

### Conserver les réponses et retrouver une discussion

Copiez la réponse ou enregistrez-la comme note. Une discussion liée à un article crée une note sous sa notice, une discussion indépendante peut créer une note dans la bibliothèque. Les blocs de code et de mathématiques ont leur propre bouton de copie. Le menu d’exportation permet de copier la discussion entière en Markdown ou de l’enregistrer comme note.

<img src="../../addon/content/icons/action-history.svg" width="18" height="18" alt=""> L’horloge ouvre l’historique pour reprendre, renommer ou épingler une discussion. Le balai efface la conversation courante. Les commandes de nettoyage de l’historique peuvent effacer toutes les discussions non épinglées ou toutes les discussions de la liste.

### Reprendre ses conversations sur un autre appareil

<img src="../../addon/content/icons/action-export.svg" width="18" height="18" alt=""> Attendez la fin de la réponse en cours. Dans le menu d’exportation du panneau de discussion, choisissez la conversation actuelle, toutes les discussions de cet article ou toutes celles de la bibliothèque. Choisissez JSON pour le texte et les références, ou ZIP pour inclure les captures et les fichiers téléversés disponibles. Sur le second appareil, importez l’archive depuis le même menu, vérifiez l’aperçu et confirmez la fusion. Synchronisez les originaux séparément avec Zotero pour que les références retrouvent les mêmes notices et fichiers. Les identifiants, les paramètres et la base de mémoire se gèrent séparément.

[![Menu d’importation et trois périmètres d’exportation des discussions](../../site/public/media/reader/window-export-en-US.jpg)](../../site/public/media/reader/window-export-en-US.jpg)

## Traduction intégrale des PDF

### Traduire un PDF

Ouvrez l’onglet **Traduire**. Avant la première tâche, installez ou actualisez l’environnement de traduction et attendez qu’il soit prêt. Cet environnement produit les PDF et se gère séparément du CLI de connexion à OpenAI.

① Vérifiez le PDF, ② choisissez le dossier de sortie, ③ le modèle de traduction et ④ le format traduit seul ou bilingue. Choisissez les langues source et cible, puis lancez la traduction.

[![① Vérifiez le PDF, ② choisissez le dossier de sortie, ③ le modèle de traduction et ④ le format traduit seul ou bilingue.](../../site/public/media/reader/window-translation-en-US.jpg)](../../site/public/media/reader/window-translation-en-US.jpg)

### Ajouter plusieurs documents au lot

Dans la bibliothèque, maintenez **Ctrl** (Windows/Linux) ou **⌘** (macOS) pour sélectionner plusieurs notices, ou **Maj** pour une plage continue. Après l’ajout, retirez les fichiers superflus et vérifiez le modèle, les formats et les destinations.

1. Pour plusieurs articles, sélectionnez des notices avec un PDF joint et préparez un lot depuis le menu contextuel. Vous pouvez aussi ajouter la sélection depuis l’onglet de traduction. Vérifiez la liste avant de lancer les tâches.
2. Choisissez au moins un format et une destination (pièce jointe Zotero ou dossier). Lancez le lot, vérifiez le nombre de fichiers à ignorer, à créer ou à remplacer, puis confirmez. Ouvrez le PDF terminé sous la notice ou depuis le dossier choisi.

Par défaut, la file produit uniquement les fichiers manquants. Conservez ce réglage si vous avez annoté une traduction existante, car le remplacement du fichier peut invalider ses annotations. Après un redémarrage, ouvrez la file et reprenez le traitement. Si la traduction a réussi mais que le classement a échoué, corrigez la destination et relancez les tâches en échec pour enregistrer le fichier déjà produit.

[![① Ajoutez les articles sélectionnés dans la bibliothèque. Vérifiez la liste puis lancez le lot avec ②. Ici, les deux articles de la liste correspondent au nombre affiché sur le bouton.](../../site/public/media/reader/window-batch-en-US.jpg)](../../site/public/media/reader/window-batch-en-US.jpg)

① Ajoutez les articles sélectionnés dans la bibliothèque. Vérifiez la liste puis lancez le lot avec ②. Ici, les deux articles de la liste correspondent au nombre affiché sur le bouton.

### Options avancées de traduction

Pour l’exemple, choisissez **Anglais → Chinois simplifié**. En cas de code `429`, réduisez le débit de requêtes (QPS) et le nombre de tâches parallèles, puis réessayez avec un PDF. Les pages numérisées peuvent bénéficier de l’OCR automatique. Vous pouvez aussi régler la traduction des tableaux et des annexes, le traitement des références, le glossaire et la police de sortie.

[![Page 6 en anglais à gauche et en chinois simplifié à droite. Le tableau 1 compare la complexité de calcul de plusieurs types de couches.](../../site/public/media/translate-example-table.png)](../../site/public/media/translate-example-table.png)

Page 6 en anglais à gauche et en chinois simplifié à droite. Le tableau 1 compare la complexité de calcul de plusieurs types de couches.

La traduction intégrale peut aussi traduire les libellés des schémas d’architecture. Dans la figure 1 de FactorMiner, suivez les flèches bleues entre « Memory Retrieval » et « Library Update » dans l’original anglais à gauche. Dans la version en chinois simplifié à droite, ces étapes portent les noms « 记忆检索 » et « 库更新 ».

[![Figure 1 de FactorMiner, avec le schéma en anglais à gauche et en chinois simplifié à droite](../../site/public/media/factorminer-figure-1-en-zh.png)](../../site/public/media/factorminer-figure-1-en-zh.png)

## Traduction de la sélection

Dans les paramètres de traduction de sélection, ① activez la traduction, ② choisissez le modèle et ③ les langues source et cible. En mode automatique, sélectionnez du texte dans un PDF ou EPUB. En mode manuel, cliquez sur Traduire dans la fenêtre contextuelle.

[![Dans les paramètres de traduction de sélection, ① activez la traduction, ② choisissez le modèle et ③ les langues source et cible](../../site/public/media/reader/window-selection-settings-en-US.jpg)](../../site/public/media/reader/window-selection-settings-en-US.jpg)

Vous pouvez aussi régler le niveau de raisonnement si le modèle le permet et afficher les boutons **Copier** et **Ajouter à la note**.

L’exemple suit *[Attention Is All You Need](https://arxiv.org/html/1706.03762v7#S3.SS2.SSS1)* de Vaswani et ses collègues. Sélectionnez **Scaled Dot-Product Attention** dans la figure 2 pour lire sa traduction en chinois simplifié, « 缩放点积注意力 ». Les captures de discussion et de sélection utilisent des réponses de démonstration locales.

① Cochez l’écriture de la traduction dans l’annotation. Une fois le texte traduit, choisissez ② une couleur de surlignage. Rouvrez le surlignage pour lire la traduction en commentaire. Pour un simple extrait, choisissez ③ **Ajouter à la note**. La case est initialement décochée, puis conserve votre choix.

[![① Cochez l’écriture de la traduction dans l’annotation](../../site/public/media/reader/window-selection-en-US.jpg)](../../site/public/media/reader/window-selection-en-US.jpg)

## Dépannage

### Le panneau est absent après installation

Vérifiez dans **Outils → Extensions** qu’AIdea est activé. Quittez complètement Zotero (**⌘Q** sous macOS), relancez-le, ouvrez un PDF puis le panneau de droite. Si AIdea reste absent, relevez les versions du système, de Zotero et de l’extension.

### La liste des modèles est vide après connexion

1. Actualisez les modèles et cherchez l’étape en échec et le code d’état dans la console des paramètres. Un utilisateur avait changé de logiciel proxy. Zotero utilisait encore l’ancien port alors que la connexion dans le navigateur réussissait.
2. Si vous utilisez un proxy, comparez son protocole et son port d’écoute aux réglages système du proxy ou du fichier PAC. Zotero, les extensions du navigateur et le terminal peuvent emprunter des chemins différents. Après correction, quittez puis relancez Zotero, actualisez les modèles, cochez-en un puis sélectionnez-le dans la discussion et envoyez une courte question.
3. En cas de `401`, vérifiez l’autorisation ou la clé API. Si un `403` précise une restriction de compte ou de région, consultez les indications du fournisseur. Si seule la traduction intégrale renvoie `502`, notez le résultat des trois fonctions avec le même modèle et ouvrez la console de traduction.

[Issue #34](https://github.com/Visterainer/aidea-zotero/issues/34) · [Issue #109](https://github.com/Visterainer/aidea-zotero/issues/109) · [Issue #60](https://github.com/Visterainer/aidea-zotero/issues/60) · [Aide officielle de Zotero sur les connexions](https://www.zotero.org/support/kb/connection_error)

### Quels journaux copier

| Opération en échec | Données à copier | Précisions à joindre |
| --- | --- | --- |
| Installation ou réparation de l’environnement de traduction, génération du PDF | Dans la console de l’onglet de traduction, copiez toute la sortie, du clic initial à la première erreur et à l’état final. Si un chemin de journal apparaît, relevez le passage correspondant. | Système et architecture, versions de Zotero et d’AIdea, étape, modèle et mode d’authentification. Pour un PDF, précisez fichier unique ou lot, texte ou scan, format de sortie et éventuel lien avec un fichier particulier. |
| Installation de l’environnement OAuth, connexion ou actualisation des modèles | Dans la console des paramètres, copiez séparément la progression et le journal détaillé avec leurs boutons de copie. | Système, architecture et versions, fournisseur, bouton utilisé, résultat de l’autorisation dans le navigateur, état dans Zotero, code d’erreur et résultat après vérification du proxy et redémarrage. |

[![① Ouvrez la console des réglages. Utilisez ② et ③ pour copier les journaux du haut et du bas. Masquez les chemins personnels avant de les partager.](../../site/public/media/reader/window-logs-en-US.jpg)](../../site/public/media/reader/window-logs-en-US.jpg)

① Ouvrez la console des réglages. Utilisez ② et ③ pour copier les journaux du haut et du bas. Masquez les chemins personnels avant de les partager.

### Anonymiser avant le partage

Dans un éditeur local, remplacez les adresses électroniques, clés, jetons, codes d’appareil, paramètres d’URL de retour OAuth, identifiants du proxy et noms d’utilisateur dans les chemins par `<masqué>`. Gardez les versions, étapes, codes et messages d’erreur. Contrôlez aussi les champs de compte et de clé et la barre d’adresse sur les captures.

[Signaler un bug](https://github.com/Visterainer/aidea-zotero/issues/new/choose)

### Demander un diagnostic à un agent local

Copiez cette demande dans Codex ou un autre agent local et joignez vos journaux anonymisés.

> Système et architecture [préciser], Zotero [version], AIdea [version]. Après un clic sur [bouton], j’attendais [résultat] et j’ai obtenu [erreur]. Avec le même modèle, discussion [état], traduction de la sélection [état], traduction intégrale [état]. Journaux anonymisés : [coller]. Repère la première erreur exploitable, identifie l’étape en cause (proxy, OAuth, environnement de traduction, requête au modèle ou sauvegarde) et propose une vérification minimale. Utilise uniquement les éléments fournis, sans lire d’identifiants ni envoyer de fichiers.

### Autres questions

- **La sélection ne déclenche aucune traduction.** Vérifiez l’activation de la fonction, son modèle et la langue cible. Essayez de copier une phrase. Une page numérisée doit comporter du texte sélectionnable.
- **La discussion fonctionne mais l’environnement PDF est indisponible.** Installez-le ou réparez-le depuis l’onglet **Traduire**. L’installateur prend en charge macOS 13 et ultérieur, Linux avec glibc 2.28 ou ultérieure et les systèmes Windows 64 bits compatibles.
- **Où part le texte ?** L’historique et la mémoire sont conservés localement. La discussion et la traduction envoient les extraits et le contenu des pièces jointes nécessaires au service choisi. Pour un traitement sur l’appareil, vérifiez que l’adresse sélectionnée pointe vers votre serveur local.
