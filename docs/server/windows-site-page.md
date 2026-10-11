# Page du site : `/docs/server/windows/`

Contenu de la page « Tentacle Server pour Windows » du site tentacletv.app. Le site ne vit pas dans ce dépôt :
ses sources sont dans le dossier local « Tentacle Web » (Vite multi-pages, une page bilingue par sujet sous
`docs/server/<sujet>/index.html`). Ce fichier donne le texte, l'ordre et les réglages de la page ; il reste à
le poser dans le gabarit du site (même structure que `docs/server/install/index.html`).

La référence, plus complète, est [windows.md](windows.md) (EN) et [fr/windows.md](fr/windows.md). La page du
site en est la version pas à pas : phrases courtes, une action par étape, captures.

## Réglages de la page

| | EN | FR |
|---|---|---|
| Adresse | `https://tentacletv.app/docs/server/windows/` (stable, ne se renomme pas) | idem, `?lang=fr` |
| `data-doc` | `windows` | |
| `<title>` | Tentacle Server for Windows — Tentacle TV | Tentacle Server pour Windows — Tentacle TV |
| Description | Install Tentacle on a Windows PC from the Microsoft Store: first launch, start with Windows, firewall, data, updates, Jellyfin. | Installer Tentacle sur un PC Windows depuis le Microsoft Store : premier lancement, démarrage avec Windows, pare-feu, données, mises à jour, Jellyfin. |
| Sommaire (`docs-toc.html`) | groupe *Get started*, juste après *Install the server*, icône `i-windows` | groupe *Pour commencer* |
| Libellé du sommaire | Windows PC (Store app) | PC Windows (app du Store) |
| Ligne méta | `i-clock` 5 minutes · `i-windows` Windows 10 · 11 | 5 minutes · Windows 10 · 11 |
| Pager | précédent : *Install the server* ; suivant : *Open the wizard · the code* | |

Sur la page *Install the server* (`install/`), ajouter en tête un encadré : « On a Windows PC? The Tentacle
Server app of the Microsoft Store needs no Docker » / « Sur un PC Windows ? L'app Tentacle Server du Microsoft
Store se passe de Docker », lien vers `/docs/server/windows/`. Sur `/install/` (auto-hébergement), un bouton
Microsoft Store quand l'identifiant Store sera connu.

**Rien dans l'app ne pointe encore vers cette page.** Si l'assistant doit y renvoyer, il faudra une clé
`windows` dans `SETUP_DOC_PATHS` (`packages/shared/src/setupWizard/setupDocLinks.ts`) — à décider avec le fil
qui fait les textes par plateforme (A2).

## Chapeau

- EN : One app from the Microsoft Store, no Docker, no terminal. It lives next to the clock, starts with
  Windows and updates itself. You only need Jellyfin, which the wizard can install for you.
- FR : Une app du Microsoft Store, sans Docker ni terminal. Elle vit près de l'horloge, démarre avec Windows et
  se met à jour toute seule. Il ne vous faut que Jellyfin, que l'assistant peut installer pour vous.

## Section `install` — Install the app / Installer l'app

1. EN : Open the **Microsoft Store**, search for **Tentacle Server**, click **Get**.
   FR : Ouvrez le **Microsoft Store**, cherchez **Tentacle Server**, cliquez sur **Obtenir**.
2. EN : Click **Open**. The Tentacle icon appears next to the clock (maybe under the **^** arrow).
   FR : Cliquez sur **Ouvrir**. L'icône de Tentacle paraît près de l'horloge (peut-être sous la flèche **^**).
3. EN : Your browser opens the setup wizard. From this PC, no code is asked: answer its questions.
   FR : Votre navigateur ouvre l'assistant d'installation. Depuis ce PC, aucun code n'est demandé : répondez à
   ses questions.

Encadré (`i-lightbulb`) — EN : The wizard opens only once. Later, right-click the icon › **Open
administration**. / FR : L'assistant ne s'ouvre qu'une fois. Ensuite, clic droit sur l'icône › **Ouvrir
l'administration**.

## Section `jellyfin` — Jellyfin

- EN : Already have Jellyfin? The wizard finds it, on this PC or on your network. Just pick it.
  FR : Vous avez déjà Jellyfin ? L'assistant le trouve, sur ce PC ou sur votre réseau. Choisissez-le.
- EN : No Jellyfin yet? Click **Install Jellyfin**. Tentacle downloads the official installer from
  jellyfin.org, checks it, and starts it once you agree. Choose the **basic** install, not the service.
  FR : Pas encore de Jellyfin ? Cliquez sur **Installer Jellyfin**. Tentacle télécharge l'installateur
  officiel depuis jellyfin.org, le vérifie et le lance avec votre accord. Choisissez l'installation
  **simple**, pas le service.
- EN : If that fails, the wizard opens jellyfin.org: install it there, then come back.
  FR : Si cela échoue, l'assistant ouvre jellyfin.org : installez-le là, puis revenez.

## Section `libraries` — Your movies folders / Vos dossiers de films

- EN : Write folders as Jellyfin sees them: `D:\Films`. On this PC, **Browse with File Explorer** opens
  Windows' folder picker.
  FR : Écrivez les dossiers tels que Jellyfin les voit : `D:\Films`. Sur ce PC, **Parcourir avec
  l'Explorateur** ouvre le sélecteur de dossiers de Windows.
- EN : On a NAS, use the network path `\\NAS\share\Films`, not a drive letter like `Z:`: Jellyfin does not
  see drive letters.
  FR : Sur un NAS, utilisez le chemin réseau `\\NAS\partage\Films`, pas une lettre comme `Z:` : Jellyfin ne
  voit pas les lettres de lecteur.

## Section `menu` — The icon's menu / Le menu de l'icône

Tableau repris de [windows.md, « The icon's menu »](windows.md#the-icons-menu) (EN) et
[fr/windows.md, « Le menu de l'icône »](fr/windows.md#le-menu-de-licône) (FR), avec une capture du menu.

## Section `startup` — Start with Windows / Démarrer avec Windows

- EN : Tentacle starts each time you sign in to Windows. Turn it off or on from the icon's menu.
  FR : Tentacle démarre à chaque ouverture de session Windows. Coupez-le ou rallumez-le depuis le menu de
  l'icône.
- EN : It does not start before someone signs in. After a Windows update, turn on **Settings › Accounts ›
  Sign-in options › "Use my sign-in info to automatically finish setting up after an update"**.
  FR : Il ne démarre pas tant que personne n'ouvre de session. Pour les mises à jour de Windows, activez
  **Paramètres › Comptes › Options de connexion › « Utiliser mes informations de connexion pour terminer
  automatiquement la configuration après une mise à jour »**.
- EN : A PC that only serves Tentacle? Let Windows sign in by itself with Microsoft's **Autologon** tool, and
  never let the PC sleep.
  FR : Un PC qui ne sert qu'à Tentacle ? Faites ouvrir la session par Windows avec l'outil **Autologon** de
  Microsoft, et ne laissez jamais le PC se mettre en veille.

## Section `network` — Firewall and network / Pare-feu et réseau

- EN : Nothing to open: the app brings its own firewall rule, for home networks only.
  FR : Rien à ouvrir : l'app apporte sa propre règle de pare-feu, pour les réseaux domestiques seulement.
- EN : Phones and TVs don't find the server? Your network is probably **Public**: **Settings › Network &
  internet › Wi-Fi** (or Ethernet) › your network › **Private network**.
  FR : Téléphones et TV ne trouvent pas le serveur ? Votre réseau est sans doute **Public** : **Paramètres ›
  Réseau et Internet › Wi-Fi** (ou Ethernet) › votre réseau › **Réseau privé**.
- EN : Port 3000 taken? Icon › **Change port**. Devices already paired must be paired again.
  FR : Port 3000 pris ? Icône › **Changer de port**. Les appareils déjà jumelés doivent l'être à nouveau.

## Section `data` — Your data / Vos données

- EN : Everything is in `C:\ProgramData\Tentacle Server`. Uninstalling the app keeps it: reinstall, and your
  server is back as it was.
  FR : Tout est dans `C:\ProgramData\Tentacle Server`. Désinstaller l'app le garde : réinstallez, et votre
  serveur revient tel qu'il était.
- EN : To erase it: icon › **Delete server data…**. Jellyfin and your movies are never touched.
  FR : Pour l'effacer : icône › **Supprimer les données du serveur…**. Jellyfin et vos films ne sont jamais
  touchés.

## Section `updates` — Updates / Mises à jour

- EN : Nothing to do. The app installs Store updates itself, when nobody is watching, after saving a copy of
  its database.
  FR : Rien à faire. L'app installe elle-même les mises à jour du Store, quand personne ne regarde rien, après
  avoir gardé une copie de sa base.

## Section `questions` — accordéon

| EN | FR | Réponse (résumée) |
|---|---|---|
| Does it work on Windows Server? | Ça marche sur Windows Server ? | Server 2025 avec l'expérience de bureau, par `winget --source msstore`, à confirmer ; rien de promis pour 2019 et 2022 |
| And on an ARM PC? | Et sur un PC ARM ? | paquet x64 seulement, émulation non éprouvée ; Jellyfin n'a pas d'installateur ARM |
| Where is the log? | Où est le journal ? | icône › Ouvrir le journal ; `…\Tentacle Server\logs` |
| Do I still need Docker? | Faut-il encore Docker ? | non ; les piles Docker restent pour un NAS ou un Linux |

Encadré final « Still stuck? / Toujours bloqué ? » comme les autres pages.

## Captures à faire (`data-shot`)

| Nom EN / FR | Ce qu'elle montre |
|---|---|
| `win-store-en` / `win-store-fr` | la fiche du Store, bouton Obtenir |
| `win-tray-en` / `win-tray-fr` | l'icône près de l'horloge, puis son menu ouvert, serveur en marche |
| `win-wizard-jellyfin-en` / `-fr` | l'étape Jellyfin avec le bouton Installer Jellyfin |
| `win-folder-picker-en` / `-fr` | le sélecteur de dossiers de l'Explorateur sur `D:\Films` |
| `win-network-private-en` / `-fr` | Paramètres de Windows, type de profil réseau sur Privé |
| `win-startup-en` / `-fr` | Paramètres › Applications › Démarrage, Tentacle Server allumé |
