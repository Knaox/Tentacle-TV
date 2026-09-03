# Changelog — Serveur (backend + web, image Docker)

Blocs `## [X.Y.Z]` avec `### FR` / `### EN`. Lu par `.github/workflows/server.yml` :
quand `versions.json` → `server` change dans un push sur `main`, une Release
GitHub `server-vX.Y.Z` est créée avec ces notes. Chaque push publie l'image
`ghcr.io/knaox/tentacle-tv` (`:latest` + `:v<server>`).

## [1.16.0]
### FR
- **Les recommandations arrivent.** Un moteur complet construit votre profil de goût sur vos vus, vos favoris et vos notes, et sert des rangées à votre goût : « Pour vous », « Disponible dans votre bibliothèque », « À découvrir », « Parce que vous avez aimé… », « Avec {acteur} », « Les utilisateurs de Tentacle regardent aussi », « Sortir de votre zone de confort »
- **Les animés comptent enfin** : les séries suivies pèsent selon leurs épisodes et deviennent des graines, une rangée « Animés pour vous » et une part d'animés dans « Pour vous » pour ceux qui en regardent — rien ne change pour les autres
- **L'accueil assume la personnalisation** : la bannière « Sélectionné pour vous » et la rangée « Pour vous » sont actives d'entrée — et tant que la reco n'a rien à montrer, la bannière de reprise garde sa place
- **La page Recommandations n'est plus jamais vide** : les Tendances, « Ce que les utilisateurs de Tentacle regardent » et les mieux notés de votre bibliothèque tiennent la scène pendant que votre profil se calcule — un bandeau dit toujours ce qui se passe
- **La clé TMDB active tout** : posée dans Admin → Métadonnées, elle déclenche le calcul des recommandations de tous les comptes en arrière-plan ; absente, la page reste utile — contenu général, et l'admin voit où poser sa clé
- **Dites-nous ce que vous aimez** : à la première visite, une grille de titres de votre bibliothèque amorce votre profil en cinq choix — elle ne s'impose qu'une seule fois
- **Noter, partout** : des étoiles au survol de n'importe quelle affiche, la note globale sur les cartes, vos notes synchronisées vers TMDB et AniList — et l'affiche de fin d'épisode se note désormais, le décompte s'interrompt le temps du geste
- **Vos acteurs** : aimez un acteur ou un réalisateur, des rangées « Avec … » naissent de vos choix — gérées au contact des rangées, portraits compris
- **Filtres par plateforme** : un menu avec les logos de vos services (l'annuaire complet de votre région, Crunchyroll et ADN compris) filtre les recommandations selon vos abonnements
- **La qualité « Auto »** : l'app mesure le débit réel vers le serveur — si la connexion ne porte pas le fichier, un palier adapté prend le relais, badge « Auto » au sélecteur et message discret ; votre choix manuel prime toujours
- **La barre de navigation montre son débordement** : fondu de bord, flèches discrètes et molette quand la fenêtre est étroite — plus d'entrée inatteignable
- **Partagez vos coups de cœur** : la page Favoris fabrique un lien public de vos titres likés
- **« L'Étreinte »** : le nouveau logo enlace l'écran — mascotte, splash et favicon suivent
- **La liste d'épisodes du lecteur s'ouvre sur l'épisode courant**
- **Lecture : plus de piste Dolby copiée vers le HLS fMP4** — l'initialisation sortait sans codec et la lecture échouait

### EN
- **Recommendations are here.** A full engine builds your taste profile from what you watch, favorite and rate, and serves rows to match: "For you", "Available in your library", "Worth discovering", "Because you liked…", "With {actor}", "Tentacle users also watch", "Step outside your comfort zone"
- **Anime finally counts**: followed series weigh by episodes watched and become seeds, an "Anime for you" row and a share of anime in "For you" for those who watch it — nothing changes for anyone else
- **The home screen embraces personalization**: the "Picked for you" banner and the "For you" row are on by default — and while recommendations have nothing to show, the resume banner keeps its place
- **The Recommendations page is never empty again**: Trending, "What Tentacle users are watching" and your library's top rated hold the stage while your profile is computed — a banner always says what's happening
- **The TMDB key switches everything on**: set in Admin → Metadata, it triggers background computation for every account; without it the page stays useful — general content, and the admin sees where to add the key
- **Tell us what you like**: on your first visit, a grid of titles from your library seeds your profile in five picks — it only imposes itself once
- **Rate anywhere**: stars on hover over any poster, the global rating on cards, your ratings synced to TMDB and AniList — and the end-of-episode poster can now be rated, the countdown pauses for the gesture
- **Your actors**: like an actor or a director and "With …" rows grow from your picks — managed right next to the rows, portraits included
- **Platform filters**: a menu with your services' logos (the full directory for your region, Crunchyroll and ADN included) filters recommendations by your subscriptions
- **"Auto" quality**: the app measures the real bandwidth to your server — when the connection can't carry the file, a suitable tier takes over, with an "Auto" badge in the selector and a discreet message; your manual choice always wins
- **The navigation bar shows its overflow**: edge fade, discreet arrows and mouse-wheel scrolling in narrow windows — no more unreachable entries
- **Share your favorites**: the Favorites page builds a public link of your liked titles
- **"The Embrace"**: the new logo hugs the screen — mascot, splash and favicon follow
- **The player's episode list opens on the current episode**
- **Playback: no more Dolby track copied into HLS fMP4** — the init segment came out without a codec and playback failed

## [1.15.1]
### FR
- **L'affiche de fin d'épisode a été redessinée** : la même pastille blanche que les boutons du lecteur, le temps restant montré dans le geste « Lire maintenant », un fond en dégradés qui laisse respirer la bannière de la série
- **Écarter la fiche « à suivre » pendant le générique ne supprime plus l'affiche de fin.** À la toute fin de l'épisode, elle paraît avec un décompte neuf — refuser une vignette sur l'image n'a jamais voulu dire renoncer à la suite
- **La fin d'une lecture ne laisse plus d'image figée.** Fermer l'affiche ramène à la fiche du média — et un film ou un dernier épisode y retournent tout seuls
- **Sauter jusqu'à la fin vaut la fin.** Un +30 s qui dépasse le générique — ou la poignée relâchée sur le bord — termine la lecture et fait paraître l'affiche de fin
- **L'affiche de fin se règle**, dans Réglages > Lecture > À la fin d'un épisode : sa bascule, son aperçu vivant — et le serveur conserve ce choix avec les autres réglages du compte
- **En séance Watch Together, un refus n'éteint plus l'écran des autres** : le décompte de la salle s'annule, l'affiche reste une proposition, et chacun peut encore lancer la suite

### EN
- **The end-of-episode poster has been redesigned**: the same white pill as the player buttons, the time left shown inside the "Play now" gesture, a background of gradients that lets the series banner breathe
- **Dismissing the "up next" card during the credits no longer removes the end poster.** At the very end of the episode it appears with a fresh countdown — refusing a thumbnail on the picture never meant giving up on what's next
- **The end of playback no longer leaves a frozen frame.** Closing the poster returns to the details page — and a film or a final episode goes back there on its own
- **Skipping to the end IS the end.** A +30s that overshoots the credits — or the handle released on the edge — ends playback and brings up the end poster
- **The end poster is now yours to set**, under Settings > Playback > At the end of an episode: its own switch, a live preview — and the server keeps that choice with the account's other playback settings
- **In a Watch Together session, one refusal no longer clears everyone's screen**: the room's countdown is cancelled, the poster stays as an offer, and anyone can still start what's next

## [1.15.0]
### FR
- **Le saut vers la scène post-générique tombe juste.** Il arrivait jusqu'à dix secondes APRÈS le début de la scène — les premières secondes étaient perdues. Il atterrit désormais sur la dernière image du générique : on ne rate plus rien
- **Les fausses détections ne font plus de fausses promesses.** Un bouton « post-générique » pouvait paraître alors que l'épisode continue sous les crédits, un « Passer l'intro » se poser sur l'épilogue quand l'opening y est rejoué, un défilement de cast très dense passer pour une scène (« Avatar : la voie de l'eau ») — et la scène très sombre d'« Iron Man », elle, n'était jamais trouvée. Chaque cas est réglé, sur relevés réels : un passage n'est une scène que s'il en porte la preuve, et le stinger collé à la fin du fichier se repêche
- **Le bouton paraît dès les cartes illustrées sombres d'un générique** (« Captain America : Brave New World »), plus seulement à l'arrivée du défilement noir
- **« Reprendre la lecture » montre l'image exacte où vous vous êtes arrêté** — la même sur tous vos appareils — au lieu de l'affiche de l'épisode
- **Un film n'affiche plus « Terminer la lecture ».** Un bouton ne paraît que s'il y a une scène post-générique à rejoindre ; sinon le générique se joue, et l'écran de fin arrive tout seul
- **Les panneaux du lecteur passent au-dessus des boutons de saut** : le choix des pistes s'ouvrait SOUS la pilule « Passer l'intro » quand les deux se montraient ensemble
- **La section d'administration dit ce que Tentacle détecte lui-même** — générique de fin et scène post-générique, lus dans les vignettes — au lieu d'affirmer qu'il ne détecte rien
- **Le client du téléviseur LG ne devient plus muet après un build interrompu** : un répertoire de build vide masquait jusqu'à la page de diagnostic

### EN
- **The jump to the post-credit scene lands on the mark.** It used to arrive up to ten seconds AFTER the scene had started — its first seconds were lost. It now lands on the last frame of the credits: nothing is missed any more
- **False detections no longer make false promises.** A “post-credit scene” button could appear while the episode carries on under the credits, a “Skip intro” could sit on the epilogue when the opening theme is replayed there, an unusually dense cast crawl could pass for a scene (“Avatar: The Way of Water”) — and Iron Man's very dark scene was never found at all. Each case is fixed, against real measurements: a passage only counts as a scene when it carries proof of one, and a stinger glued to the end of the file is salvaged
- **The button now shows from the dark illustrated title cards of the credits** (“Captain America: Brave New World”), not only once the black crawl arrives
- **“Continue watching” shows the exact frame where you stopped** — the same on all your devices — instead of the episode artwork
- **A film no longer shows “End playback”.** A button only appears when there is a post-credit scene to reach; otherwise the credits play out, and the end screen arrives on its own
- **The player panels now sit above the skip buttons**: the track picker used to open UNDER the “Skip intro” pill when both were on screen
- **The admin section now says what Tentacle detects on its own** — closing credits and post-credit scenes, read from the thumbnails — instead of claiming it detects nothing
- **The LG TV client no longer goes silent after an interrupted build**: an empty build directory used to hide even the diagnostic page

## [1.14.0]
### FR
- **L'épisode qu'on vient de terminer est enfin coché sur la fiche de la série.** On finissait un épisode, on ouvrait la fiche, et il y restait marqué non vu — la liste ne se rafraîchissait qu'au bout de plusieurs minutes
- **Le menu de vitesse de lecture a une croix pour se fermer**, et ne s'ouvre plus par-dessus la liste des épisodes ou le choix des pistes : un seul panneau à la fois
- **Le carrousel « Prochains épisodes » ne propose plus un épisode situé EN ARRIÈRE de votre dernière lecture.** Quand le serveur en désigne un, la suite réelle est recalculée
- **L'épisode suivant est celui d'APRÈS celui que vous venez de regarder.** Commencer une saison par son épisode 6 proposait « suivant : épisode 1 », parce que tout épisode non vu comptait comme un trou à combler ; et remettre un épisode en « non lu » le faisait revenir en tête. La fiche, le carrousel « Prochains épisodes » et le lecteur suivent désormais la même règle — votre dernière lecture — et la fin d'une saison enchaîne sur le premier épisode de la suivante
- **Une invitation à regarder ensemble s'ouvre d'elle-même quand vous êtes à l'accueil** : il ne reste qu'à accepter. Ailleurs elle ne vous interrompt pas — le logo Watch Together porte désormais le NOMBRE d'invitations en attente
- **L'habillage du lecteur ne se pose plus sur l'écran de chargement** : la barre de commandes s'affichait pendant l'attente, invisible mais cliquable, avec une progression à zéro qui ne mesurait rien
- **Plusieurs surbrillances ne se peignaient plus** : la vitesse de lecture sélectionnée, la piste audio ou de sous-titres choisie, l'épisode en cours dans la liste, l'anneau des vignettes d'acteur. Un défaut d'assemblage des couleurs du thème les effaçait en silence
- **Les passages d'un épisode sont désormais résolus par le SERVEUR**, une fois pour toutes les applications : générique de début, résumé, générique de fin, aperçu. Il lit `MediaSegments`, les greffons de détection et, à défaut, vos chapitres nommés — le client ne devine plus rien
- **Les réglages de lecture suivent le COMPTE** et non l'appareil : ce que vous posez sur l'ordinateur vaut sur le téléphone et devant la télévision. Vos anciens réglages d'appareil sont repris automatiquement la première fois
- **Chaque passage se règle** dans Réglages > Lecture : proposer un bouton, passer tout seul, ou ne rien faire, avec le délai du saut automatique et l'affichage du décompte
- **Trois réglages de fin d'épisode, vraiment indépendants** : afficher la fiche « à suivre », afficher son décompte, enchaîner tout seul. Couper le décompte ne fait plus disparaître la fiche
- **Un écran de fin sur le web**, qui n'en avait aucun
- **Une nouvelle section d'administration** liste les greffons de détection des passages : sans l'un d'eux, aucun bouton de saut ne peut apparaître, et rien ne le disait
- **En séance partagée**, refuser un saut se propage avec le passage concerné : refuser le résumé n'éteint plus le décompte d'intro de vos invités
### EN
- **The episode you have just finished is at last ticked on the series page.** You finished an episode, opened the page, and it still showed as unwatched — the list only refreshed after several minutes
- **The playback speed menu has a cross to close it**, and no longer opens on top of the episode list or the track picker: one panel at a time
- **The "Up next" carousel no longer offers an episode that sits BEHIND your last viewing.** When the server points at one, the real successor is worked out instead
- **The next episode is the one AFTER what you just watched.** Starting a season at episode 6 used to offer "next: episode 1", because every unwatched episode counted as a gap to fill; and marking an episode unwatched brought it back to the front. The details page, the "Up next" carousel and the player now follow the same rule — your last viewing — and the end of a season carries on to the first episode of the next
- **A Watch Together invitation opens on its own when you are on the home screen**: all that is left is to accept. Elsewhere it does not interrupt you — the Watch Together icon now carries the NUMBER of pending invitations
- **The player controls no longer sit on top of the loading screen**: the control bar showed during the wait, invisible but clickable, with a progress bar at zero that measured nothing
- **Several highlights had stopped being painted**: the selected playback speed, the chosen audio or subtitle track, the current episode in the list, the ring on cast portraits. A flaw in how theme colours were assembled was silently dropping them
- **Passages within an episode are now resolved by the SERVER**, once for every app: opening titles, recap, closing credits, preview. It reads `MediaSegments`, the detection plugins and, failing that, your named chapters — the client no longer guesses anything
- **Playback settings follow the ACCOUNT** rather than the device: what you set on the computer applies on the phone and in front of the television. Your previous per-device settings are carried over the first time
- **Every passage can be set** under Settings > Playback: offer a button, skip on its own, or do nothing, with the automatic skip delay and the countdown display
- **Three end-of-episode settings, genuinely independent**: show the “up next” card, show its countdown, play the next episode on its own. Turning the countdown off no longer hides the card
- **An end screen on the web**, which had none
- **A new administration section** lists the passage-detection plugins: without one of them no skip button can ever appear, and nothing said so
- **In a shared session**, refusing a skip now travels with the passage concerned: refusing a recap no longer cancels your guests' intro countdown

## [1.13.0]
### FR
- **Deux nouveaux réglages de fin d'épisode**, dans Réglages > Lecture, sur le web comme sur le téléviseur LG. « Proposer l'épisode suivant » gouverne la petite fiche du générique ; « Enchaîner tout seul » gouverne le compte à rebours, sur la fiche comme sur l'écran de fin. Coupez le second et rien ne démarre sans vous : la fiche et l'écran de fin restent affichés, simplement sans décompte. Les deux valent par appareil, et fonctionnent hors ligne comme en séance partagée
- **« Passer l'intro automatiquement » est désormais activé d'origine.** Si vous l'aviez éteint, il le reste
- **Le saut d'intro ne part plus pendant le chargement.** La pilule « Passer l'intro » apparaissait par-dessus l'écran de chargement et le saut se déclenchait à l'instant du lancement, sur une vidéo qui n'avait pas encore d'image
- **La conversion vidéo est libérée même si vous quittez pendant le chargement.** Le serveur gardait un encodage vivant — et ses fichiers temporaires — quand on ressortait d'une vidéo avant sa première image
- **Sur le téléviseur LG, on voit enfin quel réglage est actif.** Les boutons de la page Lecture — langue de l'interface comprise — ne se distinguaient qu'au focus : rien n'indiquait lequel des deux choix était en vigueur
### EN
- **Two new end-of-episode settings**, under Settings > Playback, on the web and on the LG television alike. "Offer the next episode" governs the small card shown over the closing credits; "Play the next episode on its own" governs the countdown, on the card and on the end screen alike. Turn the second off and nothing starts without you: the card and the end screen still appear, simply without a countdown. Both are per device, and work offline as well as in a shared session
- **"Skip the intro automatically" is now on out of the box.** If you had turned it off, it stays off
- **Intro skipping no longer fires during loading.** The "Skip intro" pill used to appear over the loading screen and the skip triggered the moment playback was launched, on a video that had no picture yet
- **The video conversion is released even if you leave while it loads.** The server used to keep an encoding alive — and its temporary files — when you left a video before its first frame
- **On the LG television, you can finally see which setting is active.** The buttons on the Playback page — interface language included — were only distinguishable by focus: nothing showed which of the two choices was in force

## [1.12.9]
### FR
- **Tous les téléviseurs redemandent leur code de jumelage.** La mise à jour qui arrive sur Android TV, Apple TV et LG repart d'un jumelage neuf : chaque téléviseur revient de lui-même sur l'écran de code, sans qu'il faille aller le révoquer un par un. Le serveur porte désormais une « époque de jumelage » qu'il suffira d'incrémenter pour redemander la même chose lors d'une prochaine mise à jour
- **Vos téléviseurs portent enfin leur nom.** Dans Réglages > Sécurité, la liste des appareils jumelés affichait « TV », « TV », « TV » — impossible de savoir lequel révoquer. Elle affiche maintenant « LG TV », « Apple TV » ou « Android TV », et numérote les homonymes quand deux téléviseurs de la même marque sont sur le même compte. Rien à faire : le nom se remplit au premier écran affiché après le jumelage
- **Le lecteur peut passer l'intro tout seul.** Nouveau réglage dans Réglages > Lecture, éteint par défaut : quand une série signale son générique de début, il est passé au bout de trois secondes. Une croix discrète, pendant le décompte, garde l'intro sur l'épisode en cours

### EN
- **Every television asks for its pairing code again.** The update landing on Android TV, Apple TV and LG starts from a fresh pairing: each television returns to the code screen on its own, with no need to revoke them one by one. The server now carries a "pairing epoch" that only needs incrementing to ask the same again on a future update
- **Your televisions finally carry their name.** Under Settings > Security, the list of paired devices read "TV", "TV", "TV" — there was no telling which one to revoke. It now reads "LG TV", "Apple TV" or "Android TV", and numbers duplicates when two televisions of the same make sit on one account. Nothing to do: the name fills in on the first screen shown after pairing
- **The player can skip the intro on its own.** A new setting under Settings > Playback, off by default: when a series marks its opening titles, they are skipped after three seconds. A discreet cross, during the countdown, keeps the intro on the episode you are watching

## [1.12.8]
### FR
- **Ouvrir un film depuis le catalogue d'un plugin ne fait plus clignoter sa fiche.** Le bouton « Regarder » d'une fiche Vigie amenait bien sur la page du média, mais celle-ci rejouait toute son animation d'ouverture — fondu de la bannière, dézoom, montée du texte — par-dessus un écran qui venait de se vider : l'image apparaissait, disparaissait, revenait. Une page de plugin vit dans un cadre isolé, elle ne peut pas passer le relais à l'animation d'ouverture comme le fait une vignette de l'application ; la fiche se pose donc d'emblée dans son état final, exactement comme au retour du lecteur
- **Et la barre du haut reste utilisable en arrivant.** Une fiche de plugin assombrit et floute le bandeau de Tentacle le temps de son affichage. Il n'était jamais remis au net quand on quittait le plugin depuis cette fiche : la barre restait floue et ne répondait plus au clic — jusqu'au rechargement complet de la page

### EN
- **Opening a film from a plugin's catalogue no longer makes its detail page flicker.** The "Watch" button on a Vigie sheet did take you to the media page, but that page replayed its whole opening animation — banner fade, zoom-out, text rising — over a screen that had just emptied: the image appeared, vanished, came back. A plugin page lives in an isolated frame and cannot hand over to the opening animation the way an in-app thumbnail does; the detail page now lands straight in its final state, exactly as it does when returning from the player
- **And the top bar stays usable on arrival.** A plugin sheet dims and blurs the Tentacle bar while it is shown. It was never restored when you left the plugin from that sheet: the bar stayed blurred and stopped responding to clicks — until a full page reload

## [1.12.7]
### FR
- **Changer de piste audio fonctionne enfin sur le téléviseur LG.** En lecture directe, choisir une piste que la dalle ne sait pas ouvrir — un TrueHD Atmos, par exemple — ne faisait strictement rien : ni bascule, ni message, le film restait dans la langue précédente. Le lecteur demande désormais la piste au serveur quand il ne peut pas la fournir lui-même
- **Et l'image y garde son Dolby Vision.** Le remux qui apporte la nouvelle piste audio passe par un conteneur qui préserve les métadonnées Dolby ; l'image reste copiée telle quelle, seul l'audio est converti — en E-AC3, le format que les barres de son reçoivent en Dolby plutôt qu'en son décodé
- **Le texte ne se chevauche plus sur le téléviseur.** Les titres des bandes-annonces d'une fiche débordaient de leur vignette sur les deux voisines — dix-huit chevauchements sur une seule page. Un bouton se dispose maintenant comme n'importe quelle autre boîte, ce qui rend leur effet aux coupures de texte
- **Les rangées d'une bibliothèque respirent.** Elles se recouvraient de onze pixels sur le téléviseur : la hauteur d'une rangée était supposée au lieu d'être mesurée, et toute typographie plus grande la démentait. Le même défaut apparaissait sur le web dès qu'un titre passait sur deux lignes
- La bannière d'une bibliothèque emprunte exactement le même rendu que celle de l'accueil : mêmes voiles, même qualité d'image, un dégradé de moins. Les deux avaient dérivé l'une de l'autre, et l'écart se voyait surtout sur les dalles plus anciennes
- **On peut défiler à la télécommande à pointeur.** Viser le bas ou le côté de l'écran fait défiler la page, doucement en effleurant le bord, vite en s'y collant — comme le fait webOS lui-même. Le curseur ne vole plus le focus pendant le défilement
- Les tailles de texte ne dépendent plus de la génération du téléviseur : elles sont calculées une fois pour toutes, à la construction
- **Se déconnecter du site web ne coupe plus les téléviseurs.** Le jeton de lecture était partagé entre le navigateur qui avait jumelé la TV et la TV elle-même : une simple déconnexion web privait tous les téléviseurs du compte de leur lecture directe et de leur sauvegarde de progression
- **Le jumelage survit à tout, sauf à sa révocation.** Le secret qui signe les jumelages ne peut plus être régénéré par accident au démarrage du serveur (ce qui invalidait tous les appareils d'un coup), un refus passager du serveur ne déconnecte plus un téléviseur, et la révocation volontaire d'un appareil est désormais poussée en direct — le téléviseur webOS se coupe immédiatement, même en pleine lecture
- Le téléviseur LG dit désormais quand une vidéo est illisible (message éphémère) au lieu d'échouer en silence, choisir une qualité y force réellement le palier demandé, la qualité se réduit d'elle-même quand le débit mesuré ne porte pas le fichier, et l'écran ne se met plus en veille pendant une lecture

### EN
- **Switching the audio track finally works on the LG TV.** In direct play, picking a track the panel cannot open — a TrueHD Atmos, for instance — did nothing at all: no switch, no message, the film stayed in the previous language. The player now asks the server for the track when it cannot supply it itself
- **And the picture keeps its Dolby Vision.** The remux that brings the new audio track goes through a container that preserves the Dolby metadata; the picture is still copied as-is, only the audio is converted — to E-AC3, the format soundbars receive as Dolby rather than as decoded sound
- **Text no longer overlaps on the TV.** Trailer titles on a detail page spilled out of their thumbnail onto both neighbours — eighteen overlaps on a single page. A button now lays out like any other box, which gives text truncation its effect back
- **Library rows have room to breathe.** They overlapped by eleven pixels on the TV: row height was assumed rather than measured, and any larger typography proved it wrong. The same flaw showed on the web as soon as a title wrapped to two lines
- A library banner now renders exactly like the home one: same veils, same image quality, one gradient fewer. The two had drifted apart, and the gap showed most on older panels
- **You can scroll with a pointer remote.** Aiming at the bottom or side of the screen scrolls the page, slowly when grazing the edge and fast when hugging it — the way webOS itself does. The cursor no longer steals focus while scrolling
- Text sizes no longer depend on the TV generation: they are computed once and for all, at build time
- **Signing out of the website no longer cuts TVs off.** The playback token was shared between the browser that paired the TV and the TV itself: a simple web sign-out deprived every TV on the account of direct streaming and progress saving
- **Pairing survives everything except its revocation.** The secret that signs pairings can no longer be regenerated by accident at server startup (which invalidated every device at once), a transient server refusal no longer disconnects a TV, and deliberately revoking a device is now pushed live — the webOS TV cuts off immediately, even mid-playback
- The LG TV now says when a video can't be played (ephemeral message) instead of failing silently, picking a quality there actually enforces the chosen preset, quality lowers itself when the measured throughput can't carry the file, and the screen no longer sleeps during playback

## [1.12.6]
### FR
- Les pages ouvertes par un plugin s'affichent enfin dans la police de l'application. Elles tournaient en police système, ce qui les faisait détonner sur chaque écran
- Les pages apportées par un plugin peuvent être retirées de la barre de navigation depuis le menu « Bibliothèques » — elles y figurent par défaut
- Le raccourci de recherche affiche ⌘K sur Mac au lieu de « Ctrl+K » ; les deux fonctionnaient déjà, seul l'affichage était faux
- Une page de plugin reçoit le clavier dès son ouverture : ⌘K y ouvre sa propre recherche au lieu de la recherche globale
- Le README indique clairement que Tentacle TV n'est pas affilié au projet Jellyfin
- **La recherche retrouve les titres ponctués.** « Spider Man » ne rendait rien du tout, alors que « Spider-Man » rendait sept films : le serveur compare le terme au titre en ignorant la casse et les accents, mais pas les tirets ni les apostrophes. La recherche réessaie désormais d'elle-même quand une saisie ne donne rien, puis reclasse les résultats sur ce qui a réellement été tapé — « destin dun heros » ne rend que son film, pas tout ce qui contient « destin ». Une recherche qui aboutissait déjà part toujours en une seule requête et ressort dans le même ordre qu'avant
- La même correction s'applique aux listes que l'on filtre en tapant : utilisateurs de l'administration, invitations, genres d'une bibliothèque et catalogue hors ligne. « jean luc » y retrouve « Jean-Luc »
- **Une affiche absente n'est plus tenue pour définitivement absente.** Quatre bannières masquaient l'image en écrivant directement dans la page, hors du contrôle de l'application : celle qui suivait héritait du masquage, et une affiche récupérée entre-temps ne réapparaissait jamais. Même défaut sur les cartes, recyclées au défilement — un simple ralentissement du serveur condamnait des affiches parfaitement valides
- Les hubs de l'accueil mémorisés pour un démarrage instantané ne réaffichent plus leurs cases vides sans rien redemander : une réponse à trous est affichée tout de suite, puis rafraîchie dans la foulée. Le fond d'une bibliothèque interrogée pendant une coupure n'est plus figé pour toute la session
- Le champ de recherche du panneau d'assistance interrogeait le serveur à chaque caractère tapé

### EN
- Pages opened by a plugin finally use the app's font. They were running on the system font, which made them stand out on every screen
- Plugin pages can be removed from the navigation bar from the Libraries menu — they are pinned by default
- The search shortcut hint shows ⌘K on Mac instead of "Ctrl+K"; both already worked, only the label was wrong
- A plugin page receives the keyboard as soon as it opens: ⌘K opens its own search instead of the global one
- The README now states clearly that Tentacle TV is not affiliated with the Jellyfin project
- **Search now finds punctuated titles.** "Spider Man" returned nothing at all while "Spider-Man" returned seven films: the server compares the term to the title ignoring case and accents, but not hyphens or apostrophes. Search now retries on its own when a query comes back empty, then reranks results against what was actually typed — "destin dun heros" returns only its film, not everything containing "destin". A search that already worked still goes out as a single request and comes back in the same order as before
- The same fix applies to lists filtered by typing: admin users, invitations, library genres and the offline catalog. "jean luc" now finds "Jean-Luc"
- **A missing poster is no longer treated as permanently missing.** Four banners hid the image by writing straight into the page, outside the app's control: the next one inherited the hiding, and a poster fetched in the meantime never came back. Same flaw on cards, which are recycled while scrolling — a brief server slowdown condemned perfectly valid posters
- Home hubs kept for an instant cold start no longer redisplay their empty slots without asking again: a response with gaps is shown immediately, then refreshed right after. A library backdrop requested during an outage is no longer frozen for the whole session
- The support panel's search field was querying the server on every keystroke

## [1.12.5]
### FR
- Vos choix de piste audio et de sous-titres, retenus contenu par contenu, sont de nouveau enregistrés. La table qui les conserve n'avait jamais été créée sur les serveurs installés : chaque démarrage d'une application se soldait par une erreur, et la copie consultée hors ligne restait vide. Elle est créée automatiquement au redémarrage du serveur, sans rien effacer d'existant
### EN
- Your audio and subtitle choices, remembered per title, are saved again. The table holding them had never been created on installed servers: every app launch ended in an error, and the copy used offline stayed empty. It is now created automatically when the server restarts, without erasing anything

## [1.12.4]
### FR
- Regarder une vidéo depuis le navigateur ne compte plus pour deux appareils. Une seule lecture ouvrait deux sessions sur le serveur multimédia : l'une nourrie par la vidéo elle-même, l'autre par les informations de progression. Les deux se présentaient sous une identité différente, si bien que le tableau de bord affichait le même épisode en double, avec quelques secondes d'écart. Il faut se déconnecter puis se reconnecter une fois pour que les sessions déjà ouvertes se rejoignent
- Changer de qualité ou de piste audio en cours de lecture ne laisse plus de conversion à l'abandon. L'ancienne continuait de tourner sur le serveur jusqu'à ce qu'un minuteur l'arrête, une minute plus tard — du travail payé plein pot pour un flux que plus personne ne regardait. Elle est désormais arrêtée dès qu'une autre prend sa place, ce qui vaut aussi pour les sous-titres incrustés et les changements automatiques de mode de lecture
### EN
- Watching from the browser no longer counts as two devices. A single playback opened two sessions on the media server: one fed by the video itself, the other by progress reporting. Each presented a different identity, so the dashboard showed the same episode twice, a few seconds apart. Sign out and back in once for already-open sessions to merge
- Switching quality or audio track mid-playback no longer strands a conversion. The old one kept running on the server until a timer stopped it a minute later — full cost for a stream nobody was watching. It is now stopped as soon as another takes its place, which also covers burned-in subtitles and automatic playback-mode changes

## [1.12.3]
### FR
- Parcourir une bibliothèque rapidement ne coupe plus l'application. Les vignettes et les appels de données se partageaient la même limite de débit : quelques secondes de défilement suffisaient à l'épuiser, et tout tombait d'un coup — notifications, épisodes, catalogue — alors qu'il ne manquait que des affiches. Les images ont désormais leur propre compte
- Une requête refusée pour cause de débit n'est plus retentée : la retenter doublait la facture au pire moment et prolongeait d'autant la minute de disette
- Les affiches sont demandées quand elles approchent de l'écran, plus très en avance : défiler vite ne réclame plus les vignettes de rangées jamais regardées
### EN
- Browsing a library quickly no longer takes the app down. Artwork and data calls shared a single rate limit: a few seconds of scrolling drained it and everything failed at once — notifications, episodes, catalogue — when all that was missing were posters. Images now have a budget of their own
- A request turned down for rate limiting is no longer retried: retrying doubled the bill at the worst possible moment and dragged the lean minute out further
- Posters are requested as they approach the screen rather than far ahead: scrolling fast no longer asks for the artwork of rows you never looked at

## [1.12.2]
### FR
- L'identité d'un appareil est désormais scellée par le serveur. Depuis la 1.12.1 elle était fournie par l'application : un utilisateur du serveur qui connaissait l'appareil d'un autre pouvait s'en servir pour le déconnecter. Aucun accès à son compte n'était possible, mais la gêne était réelle
- Renforcement au passage de la construction des en-têtes envoyés au serveur multimédia
- Vos sessions en cours ne sont pas interrompues par cette mise à jour
### EN
- A device's identity is now sealed by the server. Since 1.12.1 it was supplied by the app: a user of your server who knew someone else's device could use it to sign them out. No access to their account was possible, but the nuisance was real
- Hardened header construction towards the media server along the way
- Your current sessions are not interrupted by this update

## [1.12.1]
### FR
- Deux serveurs Tentacle branchés sur la même médiathèque Jellyfin ne se déconnectent plus l'un l'autre. Se connecter au second ne coupait pas seulement la session du premier : il fallait s'y reconnecter à chaque aller-retour
- Se déconnecter d'un appareil ne ferme plus la session des autres. Chaque navigateur, chaque ordinateur a désormais sa propre session, visible et révocable individuellement depuis Jellyfin
- Une session expirée ramène à l'écran de connexion en expliquant pourquoi. L'application restait jusqu'ici « connectée » devant des pages qui ne chargeaient jamais, sans rien dire
- La session est revérifiée au retour sur l'onglet, et repart pour un tour : elle ne s'éteint pas tant que vous revenez de temps en temps
- Un serveur multimédia qui redémarre ne déconnecte toujours pas : seul un refus explicite met fin à une session
- Quand rien ne se charge alors que le serveur répond, la page le dit et propose de réessayer, au lieu de rester vide
### EN
- Two Tentacle servers pointing at the same Jellyfin library no longer sign each other out. Signing in to the second didn't just end the first one's session: you had to sign in again on every switch
- Signing out on one device no longer ends the session on the others. Every browser and every computer now has its own session, individually visible and revocable from Jellyfin
- An expired session takes you back to the sign-in screen and says why. Until now the app stayed "signed in" in front of pages that never loaded, without a word
- The session is rechecked when you return to the tab, and renewed on the spot: it won't lapse as long as you come back now and then
- A media server restarting still doesn't sign you out: only an explicit refusal ends a session
- When nothing loads although the server is responding, the page says so and offers to retry, instead of staying blank

## [1.12.0]
### FR
- Vitesse de lecture réglable, de 0,5× à 4× : un bouton compteur dans la barre du lecteur, sur le web comme sur l'application de bureau
- Les sous-titres n'affichent plus leur code de mise en forme. Un texte prévu en haut de l'image y est réellement placé, au lieu d'apparaître précédé de « {\an8} »
- L'image n'est plus recompressée quand votre appareil sait déjà la lire : les fichiers 4K HDR et Dolby Vision sont transmis tels quels, et le serveur cesse de les ré-encoder en permanence
- Les fichiers MKV se lisent directement dans le navigateur, sans conversion préalable — l'essentiel d'une médiathèque était jusqu'ici converti sans raison
- Disparition d'un plafond de débit de 42 Mb/s qui n'aurait jamais dû exister : un disque Blu-ray 4K n'est plus converti au seul motif qu'il est trop détaillé
- Le démarrage d'une vidéo ne passe plus par un écran noir ni par un bouton Lecture à cliquer : une seule attente, puis l'image
- Les sous-titres image sont dessinés par l'application. Le serveur n'a plus à ré-encoder le film entier pour les incruster, ce qu'un simple changement de piste suffisait à déclencher
- Les paliers de qualité proposés sont calculés d'après le fichier lu : plus de « 1080p 30 Mb/s » offert sur une source qui n'en fait que 12
- Une préférence de langue que le serveur ne parvient pas à enregistrer ne dégrade plus la qualité de la lecture
- Version serveur minimale requise par les clients portée à 1.12.0
### EN
- Adjustable playback speed, from 0.5× to 4×: a speedometer button in the player bar, on the web and in the desktop app
- Subtitles no longer show their formatting codes. Text meant for the top of the picture is actually placed there, instead of appearing prefixed with "{\an8}"
- The picture is no longer re-compressed when your device can already play it: 4K HDR and Dolby Vision files are passed through as-is, and the server stops re-encoding them permanently
- MKV files play directly in the browser, with no prior conversion — until now most of a library was being converted for no reason
- A 42 Mb/s bitrate ceiling that should never have existed is gone: a 4K Blu-ray disc is no longer converted purely for being too detailed
- Starting a video no longer goes through a black screen or a Play button to click: one wait, then the picture
- Image-based subtitles are drawn by the app. The server no longer has to re-encode the whole film to burn them in, which merely switching track was enough to trigger
- The quality steps on offer are worked out from the file being played: no more "1080p 30 Mb/s" offered on a source that only runs at 12
- A language preference the server fails to save no longer degrades playback quality
- Minimum server version required by clients raised to 1.12.0

## [1.11.0]
### FR
- Correctifs de sécurité
### EN
- Security fixes

## [1.10.0]
### FR
- Refonte de l'interface web : bannière d'accueil retravaillée (dégradé diagonal teinté, rail de marque, bouton « Plus d'infos »), affiches au liseré dégradé et halo qui suit le curseur
- Aperçu au survol des vignettes d'épisode : un volet se déplie sous la vignette avec lecture, résumé, note, durée, qualité et progression. L'image reste à sa place et à sa taille, seul le volet s'ouvre
- Le bouton Lecture d'une affiche de série lance l'épisode à reprendre, ou le premier épisode si la série n'a pas été commencée
- Ouverture animée d'une fiche média : le visuel cliqué rejoint la place exacte qu'il occupera sur la fiche, dont le code est préchargé au survol
- Fiche média : le visuel suit le format du média (image large pour un épisode, affiche verticale sinon), actions en pilules avec état de marque, barre de progression. La page s'ouvre sur la bannière — elle sautait jusqu'ici directement à la liste des épisodes
- « Reprendre » ne s'affiche plus à côté de « 100 % visionné » : le seuil passe à 99 %, un média vu jusqu'au générique est considéré comme terminé
- Filtres de bibliothèque : le mur de pastilles de genres et le panneau latéral plein écran laissent place à des menus ancrés (tri, genres cherchables, année, note, plateformes). La grille reste visible pendant qu'on filtre
- Page bibliothèque : en-tête illustré reprenant la grammaire de la bannière d'accueil
- Thème clair : les dégradés des flèches de carrousel viraient au noir sur fond clair, avec un chevron blanc illisible
### EN
- Web interface redesign: reworked home banner (tinted diagonal gradient, brand rail, "More info" button), posters with a gradient edge and a highlight that follows the cursor
- Episode thumbnail hover preview: a panel unfolds below the thumbnail with playback, synopsis, rating, runtime, quality and progress. The image stays in place and at its size — only the panel opens
- A series poster's Play button starts the episode to resume, or the first episode if the series has not been started
- Animated media page opening: the artwork you clicked travels to the exact place it will occupy on the page, whose code preloads on hover
- Media page: the artwork follows the media format (wide image for an episode, portrait poster otherwise), pill-shaped actions with brand state, progress bar. The page now opens on the banner — it used to jump straight to the episode list
- "Resume" no longer appears next to "100% watched": the threshold moves to 99%, so a media watched through the credits counts as finished
- Library filters: the wall of genre chips and the full-screen side panel give way to anchored menus (sort, searchable genres, year, rating, platforms). The grid stays visible while filtering
- Library page: illustrated header matching the home banner's design language
- Light theme: carousel arrow gradients turned black on light backgrounds, with an unreadable white chevron

## [1.9.0]
### FR
- Mode économie de données : l'application mesure la latence de ses sondes et détecte les connexions lentes. Elle allège alors les images, ne charge l'accueil qu'au fil du défilement et réduit les quotas des carrousels. Réglable dans Réglages › Données (automatique / toujours / jamais), avec une pastille dans la barre du haut quand il est actif
- Affiches et backdrops mis en cache par le navigateur (24 h fermes, une semaine de revalidation en arrière-plan) : ils repartaient du serveur à chaque lancement, alors que les tuiles de trickplay étaient déjà cachées un an
- Cache de l'accueil : au-delà du plafond de taille, les données les plus récentes sont conservées au lieu que tout soit abandonné. Le cache ne s'écrivait plus du tout dès que les carrousels dépassaient 2 Mo — donc plus aucun affichage instantané au démarrage
- Rangées de bibliothèque chargées à l'approche de l'écran : leurs données étaient récupérées même hors champ
- Démarrage du client desktop : plus d'attente bloquante sur la vérification d'installation (jusqu'à 4 s d'écran figé sur une connexion lente ou coupée), elle se fait maintenant en arrière-plan
- Lecture d'un fichier local : la position est transmise en début et en fin de session plutôt qu'à intervalle régulier lorsque le mode économie est actif — 720 requêtes de moins sur deux heures. Elle reste enregistrée localement et se resynchronise au lancement suivant après un arrêt brutal
- Nouvelles routes `/api/downloads` réservées au client desktop : capacités par utilisateur revérifiées EN DIRECT auprès de la policy Jellyfin à chaque démarrage (droits et périmètre de bibliothèques) ; tout refus est un 404 générique, sans divulgation
- Admin : droits par utilisateur écrits directement dans la policy Jellyfin — lecture complète, fusion, écriture, relecture de vérification ; aucune copie locale divergente
- Proxy : route moderne `UserItems/{id}/UserData` autorisée (resynchronisation de la progression enregistrée localement)
- minServer relevé à 1.9.0
### EN
- Data saver mode: the app measures its probe latency and detects slow connections. It then serves lighter images, loads the home as you scroll and reduces carousel quotas. Configurable under Settings › Data (automatic / always / never), with a chip in the top bar when active
- Posters and backdrops are now cached by the browser (24 h firm, one week of background revalidation): they came back from the server on every launch, while trickplay tiles were already cached for a year
- Home cache: past the size ceiling, the freshest entries are kept instead of the whole save being dropped. The cache stopped being written entirely once carousels exceeded 2 MB — so the instant startup never actually happened
- Library rows load as they approach the viewport: their data was fetched even off-screen
- Desktop client startup: no longer blocks on the install check (up to 4 s of frozen screen on a slow or dead connection), it now runs in the background
- Local file playback: position is sent at session start and end rather than at a regular interval while data saver is active — 720 fewer requests over two hours. It is still recorded locally and resyncs on next launch after a hard stop
- New `/api/downloads` routes, reserved for the desktop client: per-user capabilities re-checked LIVE against the Jellyfin policy on every start (rights and library scope); any refusal is a generic 404, no disclosure
- Admin: per-user rights written directly into the Jellyfin policy — full read, merge, write, verification re-read; no diverging local copy
- Proxy: modern `UserItems/{id}/UserData` route allowed (resync of locally recorded progress)
- minServer raised to 1.9.0

## [1.8.0]
<!-- Jamais publiée sur GitHub (la dernière Release serveur était la 1.7.1) :
     ces notes ont été reprises dans le bloc 1.9.0 ci-dessus. Archive. -->
### FR
- Téléchargements desktop : nouvelles routes /api/downloads (capacités par utilisateur, fichier original avec reprise par plages, variante Allégée en MP4 fragmenté transcodé par Jellyfin) — chaque démarrage revérifie EN DIRECT la policy Jellyfin (droit de téléchargement + périmètre de bibliothèques) ; refus en 404 générique, sans divulgation
- Admin > Téléchargements : droits par utilisateur (Téléchargement, Mode Allégé) écrits directement dans la policy Jellyfin — lecture complète, fusion, écriture, relecture de vérification ; aucune copie locale divergente
- Proxy : route moderne UserItems/{id}/UserData autorisée (resynchronisation de la progression regardée hors ligne)
- minServer relevé à 1.8.0 : le desktop 1.16.0 requiert ce serveur
### EN
- Desktop downloads: new /api/downloads routes (per-user capabilities, original file with range resume, Light variant as Jellyfin-transcoded fragmented MP4) — every start re-checks the Jellyfin policy LIVE (download right + library scope); refusals are generic 404s, no disclosure
- Admin > Downloads: per-user rights (Download, Light mode) written directly into the Jellyfin policy — full read, merge, write, verification re-read; no diverging local copy
- Proxy: modern UserItems/{id}/UserData route allowed (resync of progress watched offline)
- minServer raised to 1.8.0: desktop 1.16.0 requires this server

## [1.7.1]
### FR
- Web : thème clair refondu sur les bannières et les fiches — l'affiche reste vive (plus de voile nacré ni de flou), le texte posé sur l'image est blanc dans les deux thèmes, adossé à un dégradé sombre qui garantit la lisibilité même sur une affiche claire (même recette que le mobile)
- Web : micro-interactions raffinées — boutons à ressort, pastille de navigation qui glisse entre les onglets, entrée en cascade de la bannière, survol des affiches avec élévation douce, remplissage de l'indicateur au rythme du carrousel ; le tout respecte « réduire les animations »
- Web : ombres des cartes et liseré de la barre de navigation passés aux tokens du thème (fini les noirs et blancs figés, illisibles en clair)
- Web : l'espace excessif entre les rangées de l'accueil est resserré
- Plugins : les tokens « texte sur média » (blanc constant + assise sombre) sont désormais fournis à l'iframe des plugins
### EN
- Web: light theme reworked on banners and detail pages — artwork stays vivid (no more pearly veil or blur), on-image text is white in both themes, backed by a dark gradient that keeps it readable even over a bright poster (same recipe as mobile)
- Web: refined micro-interactions — springy buttons, navigation pill sliding between tabs, cascading banner entrance, soft card hover lift, carousel indicator fill synced to rotation; all honoring "reduce motion"
- Web: card shadows and navigation bar border now use theme tokens (no more fixed blacks and whites, unreadable in light mode)
- Web: excessive spacing between home rows tightened
- Plugins: "on-media" text tokens (constant white + dark backing) are now provided to the plugin iframe

## [1.7.0]
### FR
- Web : thème clair, sombre ou automatique — l'interface suit le réglage du système en direct ; choix dans Réglages, section Apparence
- Web : Réglages et Administration repensés en navigation latérale ; mot de passe, appareils jumelés et changement de serveur regroupés dans une section Sécurité
- Web : bannières et fiches en thème clair avec flou progressif — l'affiche garde ses couleurs, le texte reste lisible ; effet Liquid Glass activable
- Web : les plugins suivent le thème de l'application, clair compris
- Thème (admin) : les remplissages, surfaces verre, textes sur média et surfaces destructives deviennent surchargeables — l'éditeur passe de 104 à 121 tokens
- Thème (admin) : un changement de couleurs se propage désormais aux utilisateurs web au retour sur l'onglet, sans rechargement de page
### EN
- Web: light, dark or automatic theme — the interface follows the system setting live; pick yours in Settings, Appearance section
- Web: Settings and Administration redesigned with side navigation; password, paired devices and server switching grouped under a Security section
- Web: banners and detail pages in light theme use a progressive blur — artwork keeps its colors, text stays readable; Liquid Glass effect available
- Web: plugins follow the app theme, light included
- Theme (admin): fills, glass surfaces, on-media text and destructive surfaces become overridable — the editor grows from 104 to 121 tokens
- Theme (admin): color changes now reach web users when they return to the tab, without a page reload

## [1.6.2]
### FR
- Notifications Seer : fini les fausses annonces « est sorti(e) sur Tentacle TV » — le serveur vérifie désormais la présence RÉELLE du film ou des saisons dans la bibliothèque Jellyfin avant chaque envoi ; si le contenu n'y est pas (statut Jellyseerr périmé, ex. après une suppression), l'envoi est différé jusqu'à son arrivée réelle — une demande fraîchement créée ne peut plus déclencher une annonce de disponibilité mensongère
- Notifications Seer : disponibilité par saison — chaque saison est annoncée quand ELLE arrive (« Saison 1 est sortie », puis « Saison 2 est sortie » à son tour) ; l'annonce groupée n'est utilisée que si tout est disponible en même temps
- Les contenus arrivant via une demande Seer ne sont annoncés qu'à leur demandeur : la notification « ajouts bibliothèque » des autres utilisateurs ne se déclenche plus quand la demande de quelqu'un d'autre atterrit dans la bibliothèque — fini le « est sorti » reçu par tout le monde dès le premier épisode téléchargé
- Anti-doublon renforcé entre Seer et les ajouts bibliothèque : le contenu d'une notification Seer est identifié par son TMDB (retrouvé via la demande d'origine) même quand la revendication temporaire a expiré — les notifications de demandes restent, comme avant, strictement personnelles (chacun ne reçoit que SES demandes)
- Installation des plugins réparée sur un serveur Windows : l'extraction employait une option GNU tar (« --force-local ») inconnue du tar de Windows, faisant échouer toute installation depuis le marketplace — l'extraction passe par des chemins relatifs, compatibles avec les deux variantes de tar
- Version serveur minimale requise par les clients portée à 1.6.2
### EN
- Seer notifications: no more false “released on Tentacle TV” announcements — the server now verifies the movie or seasons are ACTUALLY present in the Jellyfin library before every push; if the content isn't there (stale Jellyseerr status, e.g. after a deletion), delivery is deferred until it really lands — a freshly created request can no longer trigger a lying availability announcement
- Seer notifications: per-season availability — each season is announced when IT arrives (“Season 1 released”, then “Season 2 released” in turn); the grouped announcement is only used when everything is available at once
- Content arriving through a Seer request is announced to its requester only: other users' “library additions” notification no longer fires when someone else's request lands in the library — no more “released” received by everyone as soon as the first episode is downloaded
- Stronger Seer ↔ library-addition deduplication: the content of a Seer notification is identified by its TMDB id (recovered from the original request) even when the temporary claim has expired — request notifications remain, as before, strictly personal (everyone only receives THEIR own requests)
- Plugin installation fixed on Windows servers: extraction used a GNU-tar-only option (“--force-local”) unknown to the Windows tar, making every marketplace install fail — extraction now uses relative paths, compatible with both tar flavors
- Minimum server version required by the clients raised to 1.6.2

## [1.6.1]
### FR
- Notifications : plus jamais de doublon — un contenu annoncé à un utilisateur ne l'est plus une deuxième fois, même après un redémarrage du serveur, un changement de préférences ou entre Seer et les ajouts bibliothèque (registre persistant consulté avant chaque envoi, alias TMDB + titre enregistrés ensemble pour neutraliser la résolution TMDB tardive)
- Notifications : toujours 1 notification par ajout (une série multi-épisodes = une seule notification groupée par saison), sans jamais retarder l'envoi — si les métadonnées ne sont pas prêtes, le nom brut est utilisé comme avant
- La notification de test devient un outil de diagnostic réservé au développement (invisible en production, même pour les administrateurs)
### EN
- Notifications: duplicates are gone for good — content announced to a user is never announced twice, even after a server restart, a preference change, or across Seer and library additions (persistent registry checked before every push, TMDB + title aliases recorded together to neutralize late TMDB resolution)
- Notifications: always 1 notification per addition (a multi-episode series = a single season-grouped notification), without ever delaying delivery — when metadata isn't ready the raw name is used, as before
- The test notification becomes a development-only diagnostic tool (invisible in production, even for administrators)

## [1.6.0]
### FR
- Watch Together : GIFs dans le chat de groupe — tendances et recherche (propulsées par KLIPY), envoi en un clic, animation à l'écran chez tous les membres. Aucune configuration : la clé est intégrée à l'application.
- Watch Together : réactions emoji plus fluides en rafale (limite anti-spam serveur assouplie) et nouveau canal temps réel dédié aux GIFs
- Sécurité : les URLs de GIFs partagées sont validées côté serveur (domaines KLIPY uniquement, HTTPS)
### EN
- Watch Together: GIFs in the group chat — trending and search (powered by KLIPY), one-click send, animated on screen for every member. Zero configuration: the key ships with the application.
- Watch Together: smoother rapid-fire emoji reactions (relaxed server anti-spam limit) and a new dedicated realtime channel for GIFs
- Security: shared GIF URLs are validated server-side (KLIPY domains only, HTTPS)

## [1.5.6]
### FR
- Notifications d'ajout : fini le doublon quand une saison arrive épisode par épisode — une seule notification « Série — Saison N » est envoyée par ajout, même si Jellyfin importe les épisodes en plusieurs vagues.
- Anti-doublon Seer/bibliothèque plus fiable : un contenu demandé via Seer est reconnu par son identifiant TMDB (et non plus par son titre), y compris pour les épisodes (via la série) et les films — plus de notification « ajout bibliothèque » en double quand le titre Jellyfin diffère du titre Seer (langue), ou quand le film vient d'être importé.
### EN
- Library-addition notifications: no more duplicate when a season arrives episode by episode — a single “Series — Season N” notification is sent per addition, even if Jellyfin imports the episodes in several waves.
- More reliable Seer/library deduplication: content requested through Seer is matched by its TMDB id (no longer by title), including for episodes (via the series) and movies — no more duplicate “library added” notification when the Jellyfin title differs from the Seer title (language), or when the movie was just imported.

## [1.5.5]
### FR
- Anti-doublon : un contenu demandé via le plugin Seer ne déclenche plus qu'UNE notification (celle de Seer, « … est sortie ») au lieu de deux (Seer + « ajout bibliothèque »). Les autres utilisateurs reçoivent toujours leur notification d'ajout.
- Les notifications d'ajout survivent au redémarrage : les contenus ajoutés pendant que le serveur était éteint sont notifiés au redémarrage (instantané persistant, plus « avalés » par la baseline).
- Notifications d'ajout : on attend que Jellyfin ait fini d'indexer un contenu avant de notifier — fini les titres en « nom de fichier » brut et les épisodes non regroupés quand les métadonnées (série, saison, numéro) n'étaient pas encore récupérées.
### EN
- Deduplication: content requested via the Seer plugin now triggers only ONE notification (Seer's “… is now on Tentacle TV”) instead of two (Seer + “library added”). Other users still get their library-addition notification.
- Library-addition notifications survive restarts: content added while the server was down is notified on restart (persistent snapshot, no longer swallowed by the baseline).
- Library-addition notifications: wait until Jellyfin has finished indexing an item before notifying — no more raw "filename" titles or ungrouped episodes when metadata (series, season, number) hadn't been fetched yet.

## [1.5.4]
### FR
- Notifications d'ajouts en bibliothèque : formulation « <contenu> est sorti·e sur Tentacle TV » avec accord grammatical (film/épisode/série/saison). Quand plusieurs épisodes d'une même saison arrivent ensemble, ils sont regroupés en « Série — Saison N (X épisodes) » au lieu d'être listés un par un.
- Le média est désormais nommé de façon fiable même quand Jellyfin date les fichiers par leur date d'origine (l'item n'apparaissait pas comme « récent ») — fini la notification générique « Nouveau sur Tentacle TV » sans titre.
### EN
- Library-addition notifications: new wording “<content> is now on Tentacle TV” with correct French grammatical agreement. When several episodes of the same season arrive together, they are grouped as “Series — Season N (X episodes)” instead of being listed one by one.
- The media is now reliably named even when Jellyfin dates files by their original date (the item didn't show up as “recent”) — no more generic “New on Tentacle TV” notification without a title.

## [1.5.3]
### FR
- Notifications d'ajouts en bibliothèque : la notification affiche désormais le titre exact du contenu (film, série, saison, ou épisode au format SxxExx) au lieu d'un libellé générique.
### EN
- Library-addition notifications: the notification now shows the exact title of the added content (movie, series, season, or episode in SxxExx format) instead of a generic label.

## [1.5.2]
### FR
- Notifications d'ajouts en bibliothèque : détection basée sur le nombre total d'items (fiable même quand Jellyfin date les contenus selon le fichier et non la date d'ajout), avec le titre récupéré quand c'est possible.
### EN
- Library-addition notifications: detection based on the total item count (reliable even when Jellyfin dates content by file date rather than add date), with the title fetched when available.

## [1.5.1]
### FR
- Notifications d'ajouts en bibliothèque : détection fiabilisée par interrogation périodique de Jellyfin (ne dépend plus uniquement de l'événement temps réel, qui pouvait être manqué) — les nouveaux contenus déclenchent désormais la notification de façon robuste.
### EN
- Library-addition notifications: detection made reliable via periodic polling of Jellyfin (no longer relying solely on the real-time event, which could be missed) — new content now triggers the notification reliably.

## [1.5.0]
### FR
- **Notifications push mobile** : l'app peut désormais recevoir des notifications même fermée. Deux réglages (Profil › Préférences › Notifications, opt-in) : nouveaux **ajouts en bibliothèque**, et — si le plugin Seer est actif — **contenu demandé disponible** (uniquement ses propres demandes). Nouveaux endpoints serveur `/api/push` (enregistrement du jeton Expo, préférences, notification de test réservée aux admins). Livraison via Expo Push → APNs (iOS) / FCM (Android).
### EN
- **Mobile push notifications**: the app can now receive notifications even when closed. Two opt-in settings (Profile › Preferences › Notifications): new **library additions**, and — when the Seer plugin is active — **requested content available** (your own requests only). New server `/api/push` endpoints (Expo token registration, preferences, admin-only test notification). Delivery via Expo Push → APNs (iOS) / FCM (Android).

## [1.4.1]
### FR
- Jumelage : un appareil (Android TV / Apple TV) dont le jumelage est révoqué est désormais déconnecté immédiatement et renvoyé à l'écran de jumelage — auparavant il pouvait rester connecté jusqu'à un échec d'authentification ultérieur (voire indéfiniment s'il restait inactif).
### EN
- Pairing: a device (Android TV / Apple TV) whose pairing is revoked is now disconnected immediately and sent back to the pairing screen — previously it could stay connected until a later authentication failure (or indefinitely if left idle).

## [1.4.0]
### FR
- Streaming direct : le serveur re-fournit automatiquement un jeton Jellyfin valide (repris d'un autre appareil du compte) quand celui d'un appareil jumelé est expiré ou absent — au jumelage et via `/api/config/streaming`. Requis par l'app TV pour la récupération automatique après une erreur de lecture.
### EN
- Direct streaming: the server now automatically re-provisions a valid Jellyfin token (borrowed from another device on the account) when a paired device's token is expired or missing — at pairing time and via `/api/config/streaming`. Required by the TV app for automatic recovery after a playback error.

## [1.3.0]
### FR
- Version courante du serveur (historique antérieur : voir CHANGELOG.md racine)
### EN
- Current server version (older history: see root CHANGELOG.md)

---
