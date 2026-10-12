# Fiche Microsoft Store de Tentacle Server

Texte à saisir dans Partner Center pour le produit **Tentacle Server** (second produit du même compte que
l'app de bureau, identité et `STORE_ID` propres, à réserver). Français et anglais. Les règles citées sont
celles des [Microsoft Store Policies](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies).

Règles de la fiche, à ne pas défaire :

- **Nom** : « Tentacle Server », dans les deux langues. Jamais « Jellyfin » ni « Jelly… » / « …fin » dans le
  nom (charte de Jellyfin).
- **Première ligne de la description** : la dépendance à Jellyfin (règle 10.2.4, « at the beginning of the
  description »).
- **« Jellyfin » n'apparaît jamais dans les termes de recherche** (règle 10.1.3) ; il est nommé en texte
  seulement, **sans aucun logo de Jellyfin**, ni dans les visuels, ni dans les captures (vérifier l'onglet du
  navigateur et l'écran de Jellyfin dans chaque capture).
- Les données gardées à la désinstallation et leur suppression sont dites (règle 10.2.7).

## Description

### FR

> Nécessite Jellyfin, serveur multimédia gratuit (installation proposée depuis jellyfin.org).
>
> Tentacle Server fait de votre PC Windows le serveur de Tentacle TV, sans Docker ni ligne de commande. Il
> s'installe en un clic, vit près de l'horloge, démarre avec votre session Windows et se met à jour tout
> seul.
>
> Un assistant vous guide une question à la fois : il trouve Jellyfin sur votre PC ou votre réseau (ou
> propose de télécharger l'installateur officiel depuis jellyfin.org, avec votre accord), crée votre compte,
> prépare vos bibliothèques (D:\Films, un dossier partagé \\NAS\partage…) et règle Jellyfin pour une lecture
> fluide.
>
> Ensuite, toute la famille regarde ses films et ses séries avec les applications Tentacle TV : ordinateur,
> téléphone, Apple TV, Android TV, téléviseurs LG. Recommandations personnelles, profils de la famille,
> regarder ensemble à distance, passer l'intro et le générique, accès hors de chez soi.
>
> Ce que fait l'app :
> - Un serveur qui démarre à l'ouverture de votre session Windows ; vous pouvez le couper dans le menu de son
>   icône ou dans Paramètres > Applications > Démarrage.
> - Une règle de pare-feu pour les réseaux privés seulement : rien n'est ouvert sur un réseau public.
> - Des extensions facultatives, choisies et installées par l'administrateur dans un catalogue dont chaque
>   fichier est vérifié par une empreinte SHA-256.
> - Les mises à jour du Store installées à un moment calme, après une copie de sauvegarde de la base.
>
> Vos données restent sur votre PC, dans C:\ProgramData\Tentacle Server. Elles sont conservées si vous
> désinstallez l'app, pour retrouver votre serveur tel quel en la réinstallant. Pour les effacer, choisissez
> « Supprimer les données du serveur… » dans le menu de l'icône, puis désinstallez l'app. Jellyfin et vos
> fichiers ne sont jamais modifiés.
>
> Tentacle Server n'est pas affilié au projet Jellyfin. Jellyfin est une marque de Jellyfin, Inc.

### EN

> Requires Jellyfin, the free media server (installation offered from jellyfin.org).
>
> Tentacle Server turns your Windows PC into the server for Tentacle TV, with no Docker and no command line.
> It installs in one click, lives next to the clock, starts with your Windows session and updates itself.
>
> A wizard guides you one question at a time: it finds Jellyfin on your PC or your network (or offers to
> download the official installer from jellyfin.org, with your agreement), creates your account, prepares
> your libraries (D:\Movies, a shared folder \\NAS\share…) and tunes Jellyfin for smooth playback.
>
> Then the whole family watches its movies and shows with the Tentacle TV apps: computer, phone, Apple TV,
> Android TV, LG TVs. Personal recommendations, family profiles, watching together from afar, skipping intros
> and credits, access away from home.
>
> What the app does:
> - A server that starts when you sign in to Windows; turn it off from its icon's menu or in Settings > Apps >
>   Startup.
> - A firewall rule for private networks only: nothing is opened on a public network.
> - Optional extensions, chosen and installed by the administrator from a catalog where every file is checked
>   against a SHA-256 fingerprint.
> - Store updates installed at a quiet moment, after a backup copy of the database.
>
> Your data stays on your PC, in C:\ProgramData\Tentacle Server. It is kept if you uninstall the app, so that
> reinstalling brings your server back as it was. To erase it, choose "Delete server data…" in the icon's
> menu, then uninstall the app. Jellyfin and your files are never modified.
>
> Tentacle Server is not affiliated with the Jellyfin project. Jellyfin is a trademark of Jellyfin, Inc.

## Description courte

- FR : Le serveur de Tentacle TV sur votre PC, sans Docker. Nécessite Jellyfin (installation proposée depuis
  jellyfin.org).
- EN : The Tentacle TV server on your PC, without Docker. Requires Jellyfin (installation offered from
  jellyfin.org).

## Fonctionnalités (une par ligne, 200 caractères au plus)

| FR | EN |
|---|---|
| Assistant d'installation guidé, une question par écran | Guided setup wizard, one question per screen |
| Détecte Jellyfin sur le PC ou le réseau, ou propose son installateur officiel | Finds Jellyfin on the PC or the network, or offers its official installer |
| Bibliothèques sur un disque local ou un dossier partagé du réseau | Libraries on a local drive or a shared network folder |
| Démarre avec votre session Windows, réglable dans Paramètres > Démarrage | Starts with your Windows session, adjustable in Settings > Startup |
| Icône près de l'horloge : administration, port, journal, données | Icon next to the clock: administration, port, log, data |
| Pare-feu ouvert sur les réseaux privés seulement | Firewall opened on private networks only |
| Mises à jour installées à un moment calme, base sauvegardée avant | Updates installed at a quiet moment, database backed up first |
| Applications Tentacle TV : PC, Mac, téléphone, Apple TV, Android TV, TV LG | Tentacle TV apps: PC, Mac, phone, Apple TV, Android TV, LG TV |
| Données gardées sur votre PC, supprimables depuis le menu | Data kept on your PC, deletable from the menu |

## Termes de recherche (7 au plus, jamais « Jellyfin »)

| FR | EN |
|---|---|
| serveur multimédia | media server |
| serveur maison | home server |
| auto-hébergé | self-hosted |
| films | movies |
| séries | tv shows |
| streaming | streaming |
| Tentacle | Tentacle |

## Autres champs

| Champ | Valeur |
|---|---|
| Catégorie | Divertissement (la même que l'app de bureau, à vérifier dans Partner Center) |
| Site web | `https://tentacletv.app/docs/server/windows/` |
| Contact du support | `https://tentacletv.app/support` |
| Politique de confidentialité | la même URL que l'app de bureau (à reprendre de sa fiche) |
| Configuration requise | Windows 10 version 2004 (build 19041) ou plus récent, x64 ; Jellyfin 10.10 ou plus récent ; réseau local |
| Copyright | © Tentacle TV |
| « Quoi de neuf » | bloc `## [X.Y.Z]` de `changelogs/server-windows.md` (fil E), 1 500 caractères par langue |
| Âge (questionnaire IARC) | aucun contenu fourni par l'app ; contenu choisi par l'utilisateur sur son propre serveur |

## Notes de certification (Options de soumission › Notes pour la certification)

> Tentacle Server is a self-hosted server. On first launch, a tray icon appears next to the clock and the
> default browser opens the setup wizard at http://<this PC's LAN address>:3000. No account on our side is
> needed.
>
> To test: launch the app, follow the wizard. It needs Jellyfin (free media server). If Jellyfin is not
> installed, the wizard offers "Install Jellyfin": only after the user clicks it, the app downloads the
> official Jellyfin installer from repo.jellyfin.org, checks its SHA-256 fingerprint (read from
> repo.jellyfin.org itself) and its size, then starts it interactively. Jellyfin's own installer asks for
> administrator approval and installs outside our package; our app never elevates. If the download or check
> fails, or on ARM64, the wizard opens jellyfin.org/downloads/windows instead. Jellyfin is announced on the
> first line of the description (10.2.4). Tentacle never updates or modifies Jellyfin.
>
> Extensions (10.2.2): the administration can install optional extensions from a catalog. Each file is
> verified against a SHA-256 fingerprint published in the catalog; a file without a fingerprint is refused.
> Extensions are installed only by the server's administrator, never automatically, and they add media
> features described in this listing (requests, statistics), not a different product.
>
> yt-dlp: the app bundles the official yt-dlp (zipapp, run by a bundled embeddable Python from the Python
> Software Foundation) to play movie trailers on Apple TV. Once a day it fetches the latest official yt-dlp
> release from github.com/yt-dlp, requires the release's SHA-256 checksum and checks the version before using
> it; any failure keeps the bundled copy. This keeps trailers working when YouTube changes; it does not
> change the app's function.
>
> Startup: a windows.startupTask, enabled after the first launch, controlled by the user in Settings > Apps >
> Startup and in the icon's menu. Firewall: an inbound rule declared in the manifest for our executable only,
> on Domain and Private profiles (never Public).
>
> Uninstall (10.2.7): the server database is kept in %ProgramData%\Tentacle Server so that a reinstall finds
> the server as it was. The listing says so, and the tray menu offers "Delete server data…" (with
> confirmation), which erases that folder. Store updates: since the server always runs, the app downloads and
> installs its own Store update (StoreContext) at a quiet moment, after stopping the server cleanly, and
> restarts itself.

## Justification de `runFullTrust` (Options de soumission › Capacités restreintes)

D'après l'étude MSIX, mise à jour des arbitrages du diagnostic (pas de ffmpeg ni de fpcalc embarqués en v1,
yt-dlp par Python embarquable, règle de pare-feu sans port, sélecteur de dossiers) :

> Tentacle Server is a self-hosted media server companion for Jellyfin. It is a packaged Win32 desktop
> application: a tray host that starts and supervises a bundled Node.js server process, which listens on the
> local network (inbound firewall rule declared in the manifest, Domain and Private profiles only) so the
> user's own devices (TV, phone, desktop apps) can reach it. It needs full trust to run that server process
> and its bundled tools (an embeddable Python running yt-dlp), to open the Windows folder picker for the
> media folders the user chooses in the setup wizard, to start Jellyfin's official installer when the user
> asks for it, and to keep its database in %ProgramData%\Tentacle Server so that it is not lost by an
> uninstall or a reset. It installs no driver and no Windows service, never elevates, and starts at sign-in
> only while the user keeps the startup option enabled (Settings > Apps > Startup).

## Captures et visuels à faire

Tout est rangé, avec le champ de Partner Center de chaque fichier, dans
[`store-assets/README.md`](store-assets/README.md). Captures de bureau 1920 × 1080 (le Store accepte de
1366 × 768 à 3840 × 2160), une série FR et une série EN, **aucun logo de Jellyfin visible** (onglets compris).

Visuels de la fiche — FAITS, tirés de `brand/` (`store.py`, `generate-icons.py --write brand/store/server`),
jamais retouchés à la main : affiche 9:16 en 720 × 1080 et 1440 × 2160, zone 1:1 en 1080 × 1080 et
2160 × 2160, dans `brand/store/server/`.

| # | Capture | État |
|---|---|---|
| 1 | Assistant, accueil | faite (`store-assets/{fr,en}/01-welcome.png`) |
| 2 | Assistant, étape Jellyfin : « Télécharger et installer Jellyfin » | faite (`02-jellyfin.png`) |
| 3 | Installation de Jellyfin suivie en trois étapes | faite (`03-jellyfin-install.png`) |
| 4 | Jellyfin installé, dans la liste | faite (`04-jellyfin-ready.png`) |
| 5 | Bibliothèques, choisies avec l'Explorateur (`D:\Films`) | faite (`05-libraries.png`) |
| 6 | Récapitulatif | faite (`06-recap.png`) |
| 7 | Icône et son menu, « En marche, port 3000 » | à prendre dans la VM (marche à suivre dans le README) |
| 8 | Écran de démarrage | à prendre dans la VM (idem) |
| 9 | Tableau de bord, « Mise à jour par le Microsoft Store » | à prendre dans la VM, app installée |
| 10 | Accès à distance, adresses réglées | à prendre dans la VM, app installée |
| 11 | Le résultat : l'accueil de Tentacle TV | bibliothèque libre de droits seulement |

## Reste à confirmer

- Les libellés « Installer Jellyfin » et « Parcourir avec l'Explorateur » (fil C) et la carte « Mise à jour par
  le Microsoft Store » (fil A2), repris ici et dans les captures.
- La mise à jour pilotée par l'app et la copie dans `backups\` (fil D), décrites ici comme prévues.
- L'interrupteur qui éteint « Installer Jellyfin » si la certification le refuse (règle 10.1.5) : la
  description et les notes devront alors dire « lien vers jellyfin.org » au lieu de « installation proposée ».
- L'identifiant Store, l'URL de confidentialité, la catégorie et la mention de copyright, à reprendre de la
  fiche de l'app de bureau dans Partner Center.
