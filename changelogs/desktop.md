# Changelog — Desktop (macOS + Windows + Linux)

Blocs `## [X.Y.Z]` avec `### FR` / `### EN`. Lu par `.github/workflows/desktop.yml` :
Mac App Store / TestFlight (max 4000 caractères), Microsoft Store (max 1500),
Release GitHub Linux (illimité). Une seule version pour les trois OS
(`versions.json` → `desktop`), un seul tag `desktop-vX.Y.Z`.
Variante par canal : un bloc `## [mac-X.Y.Z]` remplace le bloc nu pour App
Store Connect uniquement (`asc-release-notes.mjs`, CHANNEL=mac) — utile quand
les notes Apple doivent rester génériques.

## [mac-1.21.0]
### FR
- **L'épisode qu'on vient de terminer est enfin coché sur la fiche de la série.** On finissait un épisode, on ouvrait la fiche, et il y restait marqué non vu — la liste ne se rafraîchissait qu'au bout de plusieurs minutes
- **Le menu de vitesse de lecture a une croix pour se fermer**, et ne s'ouvre plus par-dessus la liste des épisodes ou le choix des pistes : un seul panneau à la fois
- **L'épisode suivant est celui d'APRÈS celui que vous venez de regarder.** Commencer une saison par son épisode 6 proposait « suivant : épisode 1 », parce que tout épisode non vu comptait comme un trou à combler ; et remettre un épisode en « non lu » le faisait revenir en tête. La proposition suit désormais votre dernière lecture — sur la fiche, sur l'accueil et dans le lecteur —, et la fin d'une saison enchaîne sur le premier épisode de la suivante
- **L'habillage du lecteur ne se pose plus sur l'écran de chargement.** La barre de commandes s'affichait pendant l'attente, avec une progression à zéro qui ne mesurait rien — et sur le web elle restait cliquable tout en étant invisible
- **Une invitation à regarder ensemble s'ouvre d'elle-même quand vous êtes à l'accueil** : il ne reste qu'à accepter. Ailleurs elle ne vous interrompt pas — le logo Watch Together porte désormais le NOMBRE d'invitations en attente, là où un simple point ne disait pas combien
- **Plusieurs surbrillances ne se peignaient plus** : la vitesse de lecture sélectionnée, la piste audio ou de sous-titres choisie, l'épisode en cours dans la liste, l'anneau des vignettes d'acteur. Un défaut d'assemblage des couleurs du thème les effaçait en silence
- **Quitter un film ne déplace plus la fenêtre** (macOS). Elle reste exactement comme vous l'avez laissée — en plein écran si vous y étiez, en plein écran fenêtré ou fenêtrée sinon — sans transition et sans changement de bureau. Le rectangle noir qui restait parfois par-dessus l'application en sortant d'un film en plein écran disparaît avec : il venait de cette transition, ouverte à l'instant où la vidéo s'arrête
- **Deux nouveaux réglages de fin d'épisode**, dans Réglages > Lecture. « Proposer l'épisode suivant » gouverne la petite fiche du générique ; « Enchaîner tout seul » gouverne le compte à rebours, sur la fiche comme sur l'écran de fin. Coupez le second et rien ne démarre sans vous : la fiche et l'écran de fin restent affichés, simplement sans décompte
- **« Passer l'intro automatiquement » est désormais activé d'origine.** Si vous l'aviez éteint, il le reste
- **Le saut d'intro ne part plus pendant le chargement** : la pilule apparaissait par-dessus l'écran de chargement et le saut se déclenchait à l'instant du lancement
- **Les passages d'un épisode se règlent un par un**, dans Réglages > Lecture : générique de début, résumé de l'épisode précédent, générique de fin, aperçu du suivant. Pour chacun, trois choix — proposer un bouton, passer tout seul, ne rien faire — et, pour le saut automatique, le décompte et son **délai au millième de seconde près**
- **Un seul bouton, blanc, partout.** Il compte, il se refuse d'une croix, et il dit où il mène : pendant un générique de fin suivi d'une scène, il propose de sauter jusqu'à la scène, pas jusqu'à l'épisode suivant. La croix ne paraît que sur l'image nue — elle arrête le décompte et retire le bouton — sans jamais vous priver du geste : montrez les commandes, il est là
- **Les réglages de lecture suivent votre COMPTE**, plus l'appareil : ce que vous posez sur l'ordinateur vaut devant la télévision et sur le téléphone
- **Trois réglages de fin d'épisode, vraiment indépendants** : afficher la fiche « à suivre », afficher son compte à rebours, enchaîner tout seul. Couper le décompte ne fait plus disparaître la fiche

### EN
- **The episode you have just finished is at last ticked on the series page.** You finished an episode, opened the page, and it still showed as unwatched — the list only refreshed after several minutes
- **The playback speed menu has a cross to close it**, and no longer opens on top of the episode list or the track picker: one panel at a time
- **The next episode is the one AFTER what you just watched.** Starting a season at episode 6 used to offer "next: episode 1", because every unwatched episode counted as a gap to fill; and marking an episode unwatched brought it back to the front. The suggestion now follows your last viewing — on the details page, on the home screen and in the player — and the end of a season carries on to the first episode of the next
- **The player controls no longer sit on top of the loading screen.** The control bar showed during the wait, with a progress bar at zero that measured nothing — and on the web it stayed clickable while being invisible
- **A Watch Together invitation opens on its own when you are on the home screen**: all that is left is to accept. Elsewhere it does not interrupt you — the Watch Together icon now carries the NUMBER of pending invitations, where a plain dot never said how many
- **Several highlights had stopped being painted**: the selected playback speed, the chosen audio or subtitle track, the current episode in the list, the ring on cast portraits. A flaw in how theme colours were assembled was silently dropping them
- **Leaving a film no longer moves the window** (macOS). It stays exactly as you left it — full screen if you were in full screen, zoomed or windowed otherwise — with no transition and no desktop switch. The black rectangle that sometimes stayed on top of the app after leaving a full-screen film goes with it: it came from that very transition, opening at the moment playback stops
- **Two new end-of-episode settings**, under Settings > Playback. "Offer the next episode" governs the small card shown over the closing credits; "Play the next episode on its own" governs the countdown, on the card and on the end screen alike. Turn the second off and nothing starts without you: the card and the end screen still appear, simply without a countdown
- **"Skip the intro automatically" is now on out of the box.** If you had turned it off, it stays off
- **Intro skipping no longer fires during loading**: the pill used to appear over the loading screen and the skip triggered the moment playback was launched
- **Passages within an episode are set one by one**, under Settings > Playback: opening titles, recap of the previous episode, closing credits, preview of the next. For each, three choices — offer a button, skip on its own, do nothing — and, for automatic skipping, the countdown and its **delay to the millisecond**
- **One button, white, everywhere.** It counts down, it can be refused with a cross, and it says where it leads: during closing credits followed by a scene, it offers to skip to the scene, not to the next episode. The cross only appears over the bare picture — it stops the countdown and takes the button away — without ever denying you the gesture: bring up the controls and it is there
- **Playback settings follow your ACCOUNT**, not the device: what you set on the computer applies in front of the television and on the phone
- **Three end-of-episode settings, genuinely independent**: show the “up next” card, show its countdown, play the next episode on its own. Turning the countdown off no longer hides the card

## [1.21.0]
### FR
- **L'épisode qu'on vient de terminer est enfin coché sur la fiche de la série.** On finissait un épisode, on ouvrait la fiche, et il y restait marqué non vu — la liste ne se rafraîchissait qu'au bout de plusieurs minutes
- **Le menu de vitesse de lecture a une croix pour se fermer**, et ne s'ouvre plus par-dessus la liste des épisodes ou le choix des pistes : un seul panneau à la fois
- **L'épisode suivant est celui d'APRÈS celui que vous venez de regarder.** Commencer une saison par son épisode 6 proposait « suivant : épisode 1 », parce que tout épisode non vu comptait comme un trou à combler ; et remettre un épisode en « non lu » le faisait revenir en tête. La proposition suit désormais votre dernière lecture — sur la fiche, sur l'accueil et dans le lecteur —, et la fin d'une saison enchaîne sur le premier épisode de la suivante
- **L'habillage du lecteur ne se pose plus sur l'écran de chargement.** La barre de commandes s'affichait pendant l'attente, avec une progression à zéro qui ne mesurait rien — et sur le web elle restait cliquable tout en étant invisible
- **Une invitation à regarder ensemble s'ouvre d'elle-même quand vous êtes à l'accueil** : il ne reste qu'à accepter. Ailleurs elle ne vous interrompt pas — le logo Watch Together porte désormais le NOMBRE d'invitations en attente, là où un simple point ne disait pas combien
- **Plusieurs surbrillances ne se peignaient plus** : la vitesse de lecture sélectionnée, la piste audio ou de sous-titres choisie, l'épisode en cours dans la liste, l'anneau des vignettes d'acteur. Un défaut d'assemblage des couleurs du thème les effaçait en silence
- **Quitter un film ne déplace plus la fenêtre** (macOS). Elle reste exactement comme vous l'avez laissée — en plein écran si vous y étiez, en plein écran fenêtré ou fenêtrée sinon — sans transition et sans changement de bureau. Le rectangle noir qui restait parfois par-dessus l'application en sortant d'un film en plein écran disparaît avec : il venait de cette transition, ouverte à l'instant où la vidéo s'arrête
- **Deux nouveaux réglages de fin d'épisode**, dans Réglages > Lecture. « Proposer l'épisode suivant » gouverne la petite fiche du générique ; « Enchaîner tout seul » gouverne le compte à rebours, sur la fiche comme sur l'écran de fin. Coupez le second et rien ne démarre sans vous : la fiche et l'écran de fin restent affichés, simplement sans décompte
- **« Passer l'intro automatiquement » est désormais activé d'origine.** Si vous l'aviez éteint, il le reste
- **Le saut d'intro ne part plus pendant le chargement** : la pilule apparaissait par-dessus l'écran de chargement et le saut se déclenchait à l'instant du lancement
- **Les passages d'un épisode se règlent un par un**, dans Réglages > Lecture : générique de début, résumé de l'épisode précédent, générique de fin, aperçu du suivant. Pour chacun, trois choix — proposer un bouton, passer tout seul, ne rien faire — et, pour le saut automatique, le décompte et son **délai au millième de seconde près**
- **Un seul bouton, blanc, partout.** Il compte, il se refuse d'une croix, et il dit où il mène : pendant un générique de fin suivi d'une scène, il propose de sauter jusqu'à la scène, pas jusqu'à l'épisode suivant. La croix ne paraît que sur l'image nue — elle arrête le décompte et retire le bouton — sans jamais vous priver du geste : montrez les commandes, il est là
- **Les réglages de lecture suivent votre COMPTE**, plus l'appareil : ce que vous posez sur l'ordinateur vaut devant la télévision et sur le téléphone
- **Trois réglages de fin d'épisode, vraiment indépendants** : afficher la fiche « à suivre », afficher son compte à rebours, enchaîner tout seul. Couper le décompte ne fait plus disparaître la fiche
- **Linux : la fenêtre vidéo ne se détache plus.** Au deuxième lancement de l'application — et à tous les suivants — la vidéo s'ouvrait dans une fenêtre libre, flottant par-dessus l'interface, jusqu'au redémarrage du poste. Elle suit de nouveau la fenêtre, et l'application vérifie désormais qu'elle la suit vraiment
- **Linux tourne enfin sur la même application que Windows et macOS.** Vos films téléchargés, votre session et vos réglages sont repris tels quels à la mise à jour — rien à refaire
- **Le HDR arrive sur Linux.** Sur une session Wayland avec un bureau récent (KDE Plasma 6.2+, GNOME 48+, Hyprland), un film HDR est transmis tel quel à votre écran, sans être aplati. Sous X11 il reste converti : X.Org ne gère pas les couleurs étendues et ne les gérera jamais
- **Le lecteur vidéo voyage dans le paquet.** Plus rien à installer à côté, et le HEVC fonctionne enfin — les versions de mpv fournies par les distributions en sont dépourvues
- **Sur Wayland, la lecture suit votre fenêtre** — fenêtrée ou plein écran, comme sur Windows et macOS — sur KDE Plasma, où le compositeur sait placer la vidéo pour nous. Le HDR y fonctionne dans les deux cas. Sur les autres bureaux Wayland (GNOME, wlroots), le protocole n'autorise pas une application à placer ses fenêtres : la lecture y occupe tout l'écran. Un réglage permet de repasser en X11 pour retrouver la fenêtre partout, sans HDR
- **Votre machine ne s'endort plus en pleine séance**, même réglée pour se suspendre au bout d'un moment d'inactivité
- **L'AppImage s'installe vraiment** : la commande d'installation unique lui pose son entrée de menu et son icône, et sait la désinstaller. Le paquet Arch est produit directement, plus par recompression du paquet Debian
- Les **touches média** du clavier et l'intégration au bureau (icône, épinglage) fonctionnent comme sur les autres systèmes

### EN
- **The episode you have just finished is at last ticked on the series page.** You finished an episode, opened the page, and it still showed as unwatched — the list only refreshed after several minutes
- **The playback speed menu has a cross to close it**, and no longer opens on top of the episode list or the track picker: one panel at a time
- **The next episode is the one AFTER what you just watched.** Starting a season at episode 6 used to offer "next: episode 1", because every unwatched episode counted as a gap to fill; and marking an episode unwatched brought it back to the front. The suggestion now follows your last viewing — on the details page, on the home screen and in the player — and the end of a season carries on to the first episode of the next
- **The player controls no longer sit on top of the loading screen.** The control bar showed during the wait, with a progress bar at zero that measured nothing — and on the web it stayed clickable while being invisible
- **A Watch Together invitation opens on its own when you are on the home screen**: all that is left is to accept. Elsewhere it does not interrupt you — the Watch Together icon now carries the NUMBER of pending invitations, where a plain dot never said how many
- **Several highlights had stopped being painted**: the selected playback speed, the chosen audio or subtitle track, the current episode in the list, the ring on cast portraits. A flaw in how theme colours were assembled was silently dropping them
- **Leaving a film no longer moves the window** (macOS). It stays exactly as you left it — full screen if you were in full screen, zoomed or windowed otherwise — with no transition and no desktop switch. The black rectangle that sometimes stayed on top of the app after leaving a full-screen film goes with it: it came from that very transition, opening at the moment playback stops
- **Two new end-of-episode settings**, under Settings > Playback. "Offer the next episode" governs the small card shown over the closing credits; "Play the next episode on its own" governs the countdown, on the card and on the end screen alike. Turn the second off and nothing starts without you: the card and the end screen still appear, simply without a countdown
- **"Skip the intro automatically" is now on out of the box.** If you had turned it off, it stays off
- **Intro skipping no longer fires during loading**: the pill used to appear over the loading screen and the skip triggered the moment playback was launched
- **Passages within an episode are set one by one**, under Settings > Playback: opening titles, recap of the previous episode, closing credits, preview of the next. For each, three choices — offer a button, skip on its own, do nothing — and, for automatic skipping, the countdown and its **delay to the millisecond**
- **One button, white, everywhere.** It counts down, it can be refused with a cross, and it says where it leads: during closing credits followed by a scene, it offers to skip to the scene, not to the next episode. The cross only appears over the bare picture — it stops the countdown and takes the button away — without ever denying you the gesture: bring up the controls and it is there
- **Playback settings follow your ACCOUNT**, not the device: what you set on the computer applies in front of the television and on the phone
- **Three end-of-episode settings, genuinely independent**: show the “up next” card, show its countdown, play the next episode on its own. Turning the countdown off no longer hides the card
- **Linux: the video window no longer detaches.** From the second launch of the app onwards, video opened in a free-floating window over the interface until the machine was restarted. It follows the app window again — and the app now checks that it really does
- **Linux now runs the same application as Windows and macOS.** Your downloaded films, your session and your settings carry over as they are — nothing to redo
- **HDR comes to Linux.** On a Wayland session with a recent desktop (KDE Plasma 6.2+, GNOME 48+, Hyprland), an HDR film is passed to your screen untouched instead of being flattened. Under X11 it is still converted: X.Org does not handle extended colour and never will
- **The video player travels inside the package.** Nothing left to install alongside, and HEVC finally works — the mpv builds shipped by distributions do not carry it
- **On Wayland, playback follows your window** — windowed or full screen, as on Windows and macOS — on KDE Plasma, where the compositor can place the video for us. HDR works in both cases. On other Wayland desktops (GNOME, wlroots) the protocol does not let an application place its own windows, so playback takes the whole screen there. A setting switches back to X11 for windowed playback everywhere, without HDR
- **Your machine no longer falls asleep mid-film**, even when set to suspend after a while idle
- **The AppImage really installs**: the one-line install command gives it a menu entry and an icon, and knows how to remove it. The Arch package is now built directly rather than repacked from the Debian one
- Keyboard **media keys** and desktop integration (icon, pinning) work as they do on the other systems

## [1.20.8]
### FR
- Nouveau réglage dans Réglages > Lecture : passer l'intro automatiquement. Éteint par défaut ; une fois allumé, le générique de début d'une série est passé au bout de trois secondes
- Le décompte se lit sur le bouton habituel, qui ne bouge pas de place, et une croix discrète garde l'intro sur l'épisode en cours — sans renoncer au saut manuel

### EN
- New setting under Settings > Playback: skip the intro automatically. Off by default; once on, a series' opening titles are skipped after three seconds
- The countdown reads on the usual button, which does not move, and a discreet cross keeps the intro on the episode you are watching — without giving up the manual skip

## [1.20.7]
### FR
- Les pages ouvertes par un plugin s'affichent enfin dans la police de l'application. Elles tournaient en police système, ce qui les faisait détonner sur chaque écran
- Les pages apportées par un plugin peuvent être retirées de la barre de navigation depuis le menu « Bibliothèques » — elles y figurent par défaut
- Le raccourci de recherche affiche ⌘K sur Mac au lieu de « Ctrl+K » ; les deux fonctionnaient déjà, seul l'affichage était faux
- Une page de plugin reçoit le clavier dès son ouverture : ⌘K y ouvre sa propre recherche au lieu de la recherche globale

### EN
- Pages opened by a plugin finally use the app's font. They were running on the system font, which made them stand out on every screen
- Plugin pages can be removed from the navigation bar from the Libraries menu — they are pinned by default
- The search shortcut hint shows ⌘K on Mac instead of "Ctrl+K"; both already worked, only the label was wrong
- A plugin page receives the keyboard as soon as it opens: ⌘K opens its own search instead of the global one

## [1.20.6]
### FR
- L'application ne vous déconnecte plus à chaque démarrage. Elle demandait au serveur de valider votre session sans lui joindre votre jeton d'identification : le serveur répondait qu'il ne la connaissait pas, et vous étiez renvoyé à l'écran de connexion. Le navigateur n'était pas concerné, il transmet cette preuve autrement
- Un refus isolé du serveur ne ferme plus votre session : il en faut deux, confirmés à cinq secondes d'intervalle. Une coupure réseau ou un serveur qui redémarre ne vous déconnecte plus au passage
- **La recherche retrouve les titres ponctués.** « Spider Man » ne rendait rien alors que « Spider-Man » rendait sept films : le serveur compare le terme au titre sans tenir compte de la casse ni des accents, mais les tirets et les apostrophes comptent. La recherche réessaie désormais d'elle-même quand une saisie ne donne rien, puis reclasse les résultats sur ce qui a été tapé. Les listes que l'on filtre en tapant en profitent aussi
- **Une affiche absente n'est plus tenue pour définitivement absente** : les bannières et les cartes la redemandent, là où un simple ralentissement du serveur condamnait jusqu'ici des affiches parfaitement valides
### EN
- The app no longer signs you out every time it starts. It was asking the server to validate your session without attaching your identification token: the server replied that it did not know the session, and you were sent back to the sign-in screen. The browser was unaffected — it presents that proof another way
- A single refusal from the server no longer ends your session: two are required, confirmed five seconds apart. A network drop or a restarting server no longer signs you out along the way
- **Search now finds punctuated titles.** "Spider Man" returned nothing while "Spider-Man" returned seven films: the server ignores case and accents when matching, but hyphens and apostrophes count. Search now retries on its own when a query comes back empty, then reranks results against what was typed. Lists filtered by typing benefit too
- **A missing poster is no longer treated as permanently missing**: banners and cards ask for it again, where a brief server slowdown used to condemn perfectly valid artwork

## [mac-1.20.6]
<!-- Bloc macOS CUMULATIF : 1.20.6 + 1.20.5 + 1.20.4. Ces deux dernières ont été
     publiées ailleurs mais PAS sur l'App Store ; sans ce cumul, leurs nouveautés
     ne seraient jamais annoncées aux utilisateurs Mac. Repris tel quel par
     asc-release-notes.mjs, qui cherche « mac-<version> » avant de se replier sur
     le bloc nu — Windows et Linux gardent donc la 1.20.6 seule. Limite ASC :
     4000 caractères PAR LANGUE, on est très en dessous.

     ATTENTION au placement : un commentaire posé APRÈS les puces d'un bloc est
     happé par la dernière sous-section (`grab` s'arrête au prochain `###`, pas
     à la fin des puces). Ici il est avant `### FR`, donc hors de FR comme de EN.
     Mesuré : placé plus bas, il ajoutait 6 fausses lignes aux notes anglaises. -->
### FR
- L'application ne vous déconnecte plus à chaque démarrage. Elle demandait au serveur de valider votre session sans lui joindre votre jeton d'identification : le serveur répondait qu'il ne la connaissait pas, et vous étiez renvoyé à l'écran de connexion
- Un refus isolé du serveur ne ferme plus votre session : il en faut deux, confirmés à cinq secondes d'intervalle. Une coupure réseau ou un serveur qui redémarre ne vous déconnecte plus au passage
- Vitesse de lecture réglable, de 0,5× à 4× : un bouton compteur dans la barre du lecteur
- Les sous-titres n'affichent plus leur code de mise en forme. Un texte prévu en haut de l'image y est réellement placé, au lieu d'apparaître précédé de « {\an8} »
- L'image n'est plus recompressée quand l'ordinateur sait déjà la lire : les fichiers 4K HDR et Dolby Vision sont transmis tels quels, et le serveur cesse de les ré-encoder en permanence
- Disparition d'un plafond de débit de 42 Mb/s qui n'aurait jamais dû exister : un disque Blu-ray 4K n'est plus converti au seul motif qu'il est trop détaillé
- Le démarrage d'une vidéo ne passe plus par un écran noir : une seule attente, puis l'image
- Les paliers de qualité proposés sont calculés d'après le fichier lu : plus de « 1080p 30 Mb/s » offert sur une source qui n'en fait que 12
- Correction d'un plantage au lancement d'une vidéo sur les Mac à processeur Intel
### EN
- The app no longer signs you out every time it starts. It was asking the server to validate your session without attaching your identification token: the server replied that it did not know the session, and you were sent back to the sign-in screen
- A single refusal from the server no longer ends your session: two are required, confirmed five seconds apart. A network drop or a restarting server no longer signs you out along the way
- Adjustable playback speed, from 0.5× to 4×: a speedometer button in the player bar
- Subtitles no longer show their formatting codes. Text meant for the top of the picture is actually placed there, instead of appearing prefixed with "{\an8}"
- The picture is no longer re-compressed when the computer can already play it: 4K HDR and Dolby Vision files are passed through as-is, and the server stops re-encoding them permanently
- A 42 Mb/s bitrate ceiling that should never have existed is gone: a 4K Blu-ray disc is no longer converted purely for being too detailed
- Starting a video no longer goes through a black screen: one wait, then the picture
- The quality steps on offer are worked out from the file being played: no more "1080p 30 Mb/s" offered on a source that only runs at 12
- Fixed a crash when starting a video on Intel-based Macs

## [1.20.5]
### FR
- Vitesse de lecture réglable, de 0,5× à 4× : un bouton compteur dans la barre du lecteur
- Les sous-titres n'affichent plus leur code de mise en forme. Un texte prévu en haut de l'image y est réellement placé, au lieu d'apparaître précédé de « {\an8} »
- L'image n'est plus recompressée quand l'ordinateur sait déjà la lire : les fichiers 4K HDR et Dolby Vision sont transmis tels quels, et le serveur cesse de les ré-encoder en permanence
- Disparition d'un plafond de débit de 42 Mb/s qui n'aurait jamais dû exister : un disque Blu-ray 4K n'est plus converti au seul motif qu'il est trop détaillé
- Le démarrage d'une vidéo ne passe plus par un écran noir : une seule attente, puis l'image
- Les paliers de qualité proposés sont calculés d'après le fichier lu : plus de « 1080p 30 Mb/s » offert sur une source qui n'en fait que 12
### EN
- Adjustable playback speed, from 0.5× to 4×: a speedometer button in the player bar
- Subtitles no longer show their formatting codes. Text meant for the top of the picture is actually placed there, instead of appearing prefixed with "{\an8}"
- The picture is no longer re-compressed when the computer can already play it: 4K HDR and Dolby Vision files are passed through as-is, and the server stops re-encoding them permanently
- A 42 Mb/s bitrate ceiling that should never have existed is gone: a 4K Blu-ray disc is no longer converted purely for being too detailed
- Starting a video no longer goes through a black screen: one wait, then the picture
- The quality steps on offer are worked out from the file being played: no more "1080p 30 Mb/s" offered on a source that only runs at 12

<!-- Bloc rapatrié de la branche release/desktop-v1.20.4, jamais fusionnée dans
     main : la 1.20.4 a bien été publiée (build du 02/08/2026) mais ses notes
     n'existaient que là. Archive. -->
## [1.20.4]
### FR
- Correction d'un plantage au lancement d'une vidéo sur les Mac à processeur Intel
### EN
- Fixed a crash when starting a video on Intel-based Macs

## [1.20.3]
### FR
- Corrections d'anomalies mineures
### EN
- Minor issues fixed

## [mac-1.20.3]
### FR
- Cette version fait passer l'application macOS sur une nouvelle base technique, déjà en service sur Windows. Le lecteur vidéo, vos données et vos réglages sont inchangés : rien à réinstaller, rien à reconfigurer
- HDR véritable : sur un écran compatible, l'image est transmise telle quelle au lieu d'être ramenée en couleurs standard, et l'écran passe en HDR le temps du film
- La vidéo en plein écran occupe enfin tout l'écran : plus de bandes noires sur les bords, ni de barre de menus qui reste visible quand on part d'une fenêtre agrandie
- Sur plusieurs écrans, le plein écran reste sur l'écran où se trouve la fenêtre au lieu de partir chez le voisin
- La fenêtre retrouve une vraie barre : on la déplace en la saisissant, et les commandes de fenêtre ne débordent plus sur le contenu
- La lecture démarre d'une traite : l'image n'apparaît plus avant que de quoi la tenir soit prêt
- Interface améliorée : les affiches et les vignettes se détachent nettement de la page au survol, et leurs informations apparaissent sans attendre
- Mémoire optimisée : l'application ne garde en mémoire que ce qui est réellement à l'écran, quelle que soit la taille de votre catalogue
- Mode hors ligne repensé : ses propres menus, un catalogue rangé par série, et seuls les titres disponibles sans connexion vous sont proposés
- Le catalogue hors ligne montre où vous en êtes : coche sur ce qui est vu, barre sur ce qui est en cours. Un titre déjà vu se relance depuis le début
- Sélection multiple dans votre bibliothèque hors ligne : retirer ou relancer plusieurs titres d'un coup
- Ce que vous regardez hors ligne remonte sur votre serveur au retour du réseau : position et épisodes vus
- La préparation d'un titre pour le hors ligne se poursuit quand vous passez sur autre chose, et l'ordinateur ne s'endort plus en cours de route. S'il s'endort quand même, elle reprend d'elle-même au réveil
- Fermer l'application pendant une préparation hors ligne demande confirmation, au lieu de l'interrompre sans un mot
- Corrections d'anomalies mineures
### EN
- This version moves the macOS app to a new technical foundation, already in use on Windows. The video player, your data and your settings are unchanged: nothing to reinstall, nothing to set up again
- True HDR: on a compatible display the picture is passed through as-is instead of being flattened to standard colours, and the screen switches to HDR for the length of the film
- A video in fullscreen finally fills the whole screen: no more black bars around the edges, and no menu bar left showing when starting from a maximised window
- With several displays, fullscreen stays on the screen the window is on instead of jumping to the neighbour
- The window has a proper title bar again: grab it to move the window, and the window controls no longer sit on top of the content
- Playback starts in one go: the picture no longer appears before there is enough buffered to keep it running
- Improved interface: posters and thumbnails now lift cleanly off the page on hover, and their details appear without delay
- Optimised memory: the app only keeps on hand what is actually on screen, however large your catalogue
- Reworked offline mode: its own menus, a catalogue grouped by series, and only the titles available without a connection are offered
- The offline catalogue shows where you stand: a tick on what is watched, a bar on what is in progress. A title already watched restarts from the beginning
- Multiple selection in your offline library: remove or restart several titles at once
- What you watch offline syncs back to your server when the network returns: position and watched episodes
- Preparing a title for offline use keeps going when you switch to something else, and the computer no longer falls asleep partway through. Should it sleep anyway, it resumes on its own when it wakes
- Closing the app while a title is being prepared for offline use now asks for confirmation instead of cutting it off without a word
- Minor issues fixed

## [1.20.2]
### FR
- Interface améliorée : les affiches et les vignettes se détachent nettement de la page au survol, et leurs informations apparaissent sans attendre
- Corrections d'anomalies mineures
- Mémoire optimisée : l'application ne garde en mémoire que ce qui est réellement à l'écran, quelle que soit la taille de votre catalogue
### EN
- Improved interface: posters and thumbnails now lift cleanly off the page on hover, and their details appear without delay
- Minor issues fixed
- Optimised memory: the app only keeps on hand what is actually on screen, however large your catalogue

## [1.20.1]
### FR
- La vidéo en plein écran occupe enfin tout l'écran : plus de bandes noires sur les bords, ni de barre des tâches qui reste visible quand on part d'une fenêtre agrandie
- Sur plusieurs écrans, le plein écran reste sur l'écran où se trouve la fenêtre au lieu de partir chez le voisin
- Vos téléchargements continuent quand vous passez sur autre chose, et l'ordinateur ne s'endort plus au milieu d'un transfert. S'il s'endort quand même, ils repartent tout seuls au réveil
- Fermer l'application pendant un téléchargement demande confirmation, au lieu de l'interrompre sans un mot
### EN
- A video in fullscreen finally fills the whole screen: no more black bars around the edges, and no taskbar left showing when starting from a maximised window
- With several displays, fullscreen stays on the screen the window is on instead of jumping to the neighbour
- Your downloads keep going when you switch to something else, and the computer no longer falls asleep in the middle of a transfer. Should it sleep anyway, they resume on their own when it wakes
- Closing the app during a download now asks for confirmation instead of cutting it off without a word

## [1.20.0]
### FR
- La version Windows repose désormais sur Electron : le lecteur, vos données et vos réglages sont inchangés, rien à réinstaller
- HDR véritable : sur un écran compatible, l'image est transmise telle quelle au lieu d'être ramenée en couleurs standard, et l'écran passe en HDR le temps du film
- Navigation hors ligne repensée : ses propres menus, un catalogue rangé par série, et seuls les titres disponibles vous sont proposés
- Le catalogue hors ligne montre où vous en êtes : coche sur ce qui est vu, barre sur ce qui est en cours. Un titre déjà vu se relance depuis le début
- Sélection multiple dans votre bibliothèque hors ligne : retirer ou relancer plusieurs titres d'un coup
- Ce que vous regardez hors ligne remonte sur votre serveur au retour du réseau : position et épisodes vus
### EN
- The Windows version now runs on Electron: the video player, your data and your settings are unchanged — nothing to reinstall, nothing to set up again
- True HDR: on a compatible display the picture is passed through as-is instead of being flattened to standard colours, and the screen switches to HDR for the length of the film
- Reworked offline navigation: its own menus, a catalogue grouped by series, and only the titles actually available are offered
- The offline catalogue shows where you stand: a tick on what is watched, a bar on what is in progress. A title already watched restarts from the beginning
- Multiple selection in your offline library: remove or restart several titles at once
- What you watch offline syncs back to your server when the network returns: position and watched episodes

## [1.17.1]
### FR
- Windows : plus de scintillement à l'ouverture d'une fiche depuis la recherche, ni au retour d'une vidéo vers sa fiche — la fenêtre reste opaque en dehors de la lecture, et ne devient transparente que le temps du film
- Ouvrir une fiche depuis la recherche l'anime désormais comme partout ailleurs : l'affiche cliquée rejoint sa place sur la fiche, au lieu d'apparaître sans transition
- En quittant le lecteur, la fiche est là telle qu'on l'a laissée : elle ne rejoue plus son ouverture par-dessus un écran noir. Idem après un simple rafraîchissement
- « Reprendre la lecture » se réordonne tout de suite : le titre qu'on vient de regarder repasse en tête, sans attendre
- Vu, Ma liste et Favoris se voient immédiatement sur les vignettes « nouveaux épisodes » des derniers ajouts, sans recharger la page
- L'accueil revient en haut de page quand on y retourne
- Le survol d'une affiche ne reste plus accroché derrière le curseur quand on fait défiler rapidement
### EN
- Windows: no more flickering when opening a title from search, or when coming back from a video to its details — the window now stays opaque outside playback, and only turns transparent for the length of the film
- Opening a title from search is now animated like everywhere else: the poster you clicked flies to its place on the details page, instead of appearing with no transition
- Leaving the player drops you back on the details page exactly as you left it — it no longer replays its opening over a black screen. Same after a plain refresh
- "Continue watching" reorders right away: the title you just watched moves back to the front, no waiting
- Watched, My list and Favourites now show up instantly on the "new episodes" tiles of recent additions, with no page reload
- Home scrolls back to the top when you return to it
- A poster's hover no longer lingers behind the cursor when you scroll quickly

## [1.17.0]
### FR
- Nouvelle interface : bannière d'accueil retravaillée, affiches au liseré lumineux et halo qui suit le curseur
- Aperçu au survol des épisodes : la vignette déplie sous elle un volet avec lecture, résumé, note, durée, qualité et progression
- Le bouton Lecture d'une série lance directement l'épisode à reprendre, ou le premier si vous la commencez
- Ouverture d'une fiche animée : l'affiche cliquée rejoint sa place sur la fiche, qui se charge par anticipation dès le survol
- Fiche média revue : le visuel d'un épisode s'affiche enfin au bon format, actions plus lisibles, et la page s'ouvre sur la bannière au lieu de sauter à la liste des épisodes
- Filtres de bibliothèque en menus déroulants (tri, genres cherchables, année, note, plateformes) : la grille reste visible pendant le filtrage
- Bannière encadrée : ses couleurs débordent du cadre en un halo qui suit l'image et son zoom, sur l'accueil comme sur la fiche média
- Survol des épisodes : plus de à-coup à l'ouverture de l'aperçu, qui prolonge désormais la vignette au lieu de s'y superposer
- L'aperçu s'ouvre sur toutes les cartes : quand la place manque en bas, ou quand la carte touche le bord de la rangée, les informations se posent sur la carte elle-même en voile translucide plutôt que de déborder
- L'aperçu suit sa carte quand vous faites défiler la page au lieu de disparaître, et retrouve son déroulé complet dès qu'il y a de nouveau la place
- Les rangées se calent sur des cartes entières : plus de carte coupée en deux au bord du carrousel
- Ouverture d'une fiche : le visuel garde son format pendant tout le trajet, et la bannière d'accueil ouvre la fiche avec la même animation que les cartes
- Transitions raccourcies dans toute l'application : l'ouverture d'une fiche passe de 0,7 à 0,45 s, et les textes apparaissent d'une même cascade sur toutes les pages
- La fiche média s'ouvre toujours en haut, sur sa bannière, et la bande noire qui masquait l'affiche sous le titre a disparu
- Halo lumineux également sur la bannière des bibliothèques
- Tri « Derniers ajouts » : il listait en fait les plus anciens ajouts — chaque tri part désormais dans son sens naturel
- Photo de profil sans liseré : sur un si petit disque, il rognait l'image
- Votre photo de profil reste affichée hors ligne : elle est conservée sur l'appareil et mise à jour à chaque retour en ligne
- Thème clair : dégradés de défilement des carrousels corrigés, ils viraient au noir
### EN
- New interface: reworked home banner, posters with a glowing edge and a highlight that follows the cursor
- Episode hover preview: the thumbnail unfolds a panel with playback, synopsis, rating, runtime, quality and progress
- A series' Play button now starts the episode to resume, or the first one if you are beginning it
- Animated detail opening: the poster you clicked travels to its place on the page, which preloads on hover
- Revised media page: an episode's artwork finally uses the right format, clearer actions, and the page opens on the banner instead of jumping to the episode list
- Library filters as dropdown menus (sort, searchable genres, year, rating, platforms): the grid stays visible while filtering
- Framed banner: its colours spill out of the frame as a glow that follows the artwork and its zoom, on the home page and the media page alike
- Episode hover: no more jolt when the preview opens — it now continues the thumbnail instead of stacking on top of it
- The preview opens on every card: when there is no room below, or when the card touches the edge of the row, the information settles onto the card itself as a translucent veil rather than spilling out
- The preview follows its card as you scroll instead of vanishing, and regains its full unfold as soon as there is room again
- Rows settle on whole cards: no more card cut in half at the edge of the carousel
- Opening a media page: the artwork keeps its shape for the whole journey, and the home banner opens the page with the same animation as the cards
- Shorter transitions throughout: opening a media page goes from 0.7 s to 0.45 s, and text now appears with the same cascade on every page
- The media page always opens at the top, on its banner, and the black band that hid the artwork under the title is gone
- Glow effect on the library banner too
- "Recently added" sort: it actually listed the oldest additions — every sort now starts in its natural direction
- Profile picture without its outline: on such a small disc it was cropping the image
- Your profile picture stays visible offline: it is kept on the device and refreshed every time you come back online
- Light theme: carousel scroll gradients fixed, they turned black

## [mac-1.17.0]
### FR
- Application nettement plus fluide : survol des affiches, défilement des rangées, barre de navigation et ouverture d'une fiche ont tous été allégés — même rendu, beaucoup moins de calcul
- Chargement plus léger : les affiches hors écran ne sont plus dessinées, et la bannière d'accueil se met en pause dès qu'elle sort de vue ou que la fenêtre passe en arrière-plan
- Le plein écran est respecté : quitter une vidéo ne fait plus sortir l'application du plein écran, sauf si c'est le lecteur qui l'y avait mise
- Le bouton plein écran du lecteur suit désormais celui de macOS : bouton vert, Ctrl+Cmd+F et Mission Control sont pris en compte, et Échap quitte d'abord le plein écran
- Nouvelle interface : bannière encadrée dont les couleurs débordent en un halo qui suit l'image, affiches au liseré lumineux, halo qui suit le curseur
- Aperçu au survol des épisodes : la vignette déplie un volet avec lecture, résumé, note, durée, qualité et progression — sans à-coup, sur toutes les cartes (celles du bord de rangée s'y calent, celles du bas de l'écran déplient vers le haut), et il suit sa carte quand vous faites défiler la page
- Les rangées se calent sur des cartes entières : plus de carte coupée en deux au bord du carrousel
- Ouverture d'une fiche animée : le visuel cliqué rejoint sa place sur la fiche en gardant son format, la bannière d'accueil comprise, et la page s'ouvre en haut
- Fiche média revue : le visuel d'un épisode s'affiche au bon format, actions plus lisibles
- Filtres de bibliothèque en menus déroulants (tri, genres cherchables, année, note, plateformes) : la grille reste visible pendant le filtrage
- Le bouton Lecture d'une série lance directement l'épisode à reprendre, ou le premier si vous la commencez
- Votre photo de profil reste affichée hors ligne, mise à jour à chaque retour en ligne
- Lecture hors ligne : aucune donnée réseau consommée pendant la lecture — fiche, chapitres, « passer l'intro » / « passer le générique », préférences de langues et épisode suivant fonctionnent de bout en bout
- Sélecteur d'épisodes du lecteur disponible hors ligne, groupé par saison
- Préférences de langues et langue de l'interface modifiables hors ligne : enregistrées localement puis synchronisées au retour en ligne, sans écrasement
- La progression vue hors ligne est envoyée à Jellyfin dès le retour en ligne (reprise à jour sur vos autres appareils)
- Chat de groupe (Watch Together) : les contrôles du lecteur ne restent plus bloqués à l'écran après avoir écrit un message
- Thème clair : dégradés de défilement des carrousels corrigés, ils viraient au noir
### EN
- Noticeably smoother app: poster hovering, row scrolling, the navigation bar and opening a media page have all been lightened — same look, far less computation
- Lighter loading: posters off screen are no longer drawn, and the home banner pauses as soon as it scrolls out of view or the window goes to the background
- Full screen is respected: leaving a video no longer takes the app out of full screen, unless the player is what put it there
- The player's full-screen button now follows the macOS one: green button, Ctrl+Cmd+F and Mission Control are picked up, and Esc leaves full screen first
- New interface: framed banner whose colours spill out as a glow that follows the artwork, posters with a glowing edge and a highlight that follows the cursor
- Episode hover preview: the thumbnail unfolds a panel with playback, synopsis, rating, runtime, quality and progress — without a jolt, on every card (those at the edge of a row line up against it, those near the bottom unfold upwards), and it follows its card as you scroll
- Rows settle on whole cards: no more card cut in half at the edge of the carousel
- Animated page opening: the artwork you clicked travels to its place keeping its shape, home banner included, and the page opens at the top
- Revised media page: an episode's artwork uses the right format, clearer actions
- Library filters as dropdown menus (sort, searchable genres, year, rating, platforms): the grid stays visible while filtering
- A series' Play button starts the episode to resume, or the first one if you are beginning it
- Your profile picture stays visible offline, refreshed every time you come back online
- Offline playback: no network data used during playback — details, chapters, "skip intro" / "skip credits", language preferences and next episode all work end to end
- In-player episode picker available offline, grouped by season
- Language preferences and interface language editable offline: saved locally, then synced once back online, with no overwrite
- Progress watched offline is sent to Jellyfin as soon as you are back online (up-to-date resume on your other devices)
- Group chat (Watch Together): player controls no longer stay stuck on screen after typing a message
- Light theme: carousel scroll gradients fixed, they turned black

## [1.16.2]
### FR
- Chat de groupe (Watch Together) : les contrôles du lecteur ne restent plus bloqués à l'écran après avoir écrit un message ou cliqué dans le chat — ils s'estompent dès que vous ne touchez plus à rien et reviennent en tapant ou en bougeant la souris
- Lecture d'un fichier téléchargé : zéro donnée réseau consommée pendant la lecture, même en ligne — fiche, chapitres, « passer l'intro » / « passer le générique », préférences de langues et épisode suivant fonctionnent entièrement depuis le disque (le sélecteur d'épisodes, ouvert volontairement, affiche toute la série quand vous êtes en ligne)
- « Passer l'intro » et « passer le générique » fonctionnent désormais hors ligne sur les contenus téléchargés (enregistrés au téléchargement, récupérés automatiquement pour les téléchargements existants)
- Sélecteur d'épisodes du lecteur disponible hors ligne : il liste les épisodes téléchargés de la série, groupés par saison
- Préférences de langues et langue de l'interface entièrement consultables et modifiables hors ligne : enregistrées localement puis synchronisées automatiquement au retour en ligne, sans écrasement
- Suppression après visionnage : choisissez un délai (immédiatement, 1 h, 6 h, 12 h ou 24 h) ; le téléchargement affiche quand il sera supprimé, et la suppression a lieu même si l'application était fermée à l'échéance
- La progression d'un fichier lu localement est envoyée à Jellyfin en fin de lecture (reprise à jour sur vos autres appareils)
### EN
- Group chat (Watch Together): player controls no longer stay stuck on screen after typing a message or clicking in the chat — they fade as soon as you stop interacting and come back when you type or move the mouse
- Playing a downloaded file: zero network data used during playback, even while online — details, chapters, "skip intro" / "skip credits", language preferences and next episode all work entirely from disk (the episode picker, opened deliberately, shows the full series while you are online)
- "Skip intro" and "skip credits" now work offline on downloaded content (saved at download time, fetched automatically for existing downloads)
- In-player episode picker available offline: it lists the downloaded episodes of the series, grouped by season
- Language preferences and interface language fully viewable and editable offline: saved locally, then synced automatically once back online, with no overwrite
- Delete after watching: pick a delay (immediately, 1 h, 6 h, 12 h or 24 h); the download shows when it will be removed, and deletion happens even if the app was closed when the time came
- Progress of a locally played file is sent to Jellyfin at the end of playback (up-to-date resume on your other devices)

## [1.16.1]
### FR
- Coupure de connexion détectée en quelques secondes : l'application réagit immédiatement au lieu d'attendre
- La lecture démarre sans délai quand le serveur est injoignable
- Fiabilité du mode hors ligne renforcée et corrections diverses
### EN
- Connection loss now detected within seconds: the app reacts immediately instead of waiting
- Playback starts without delay when the server is unreachable
- Improved offline mode reliability and various fixes

## [mac-1.16.0]
### FR
- Améliorations de la lecture et de la stabilité
- Optimisations de performance et corrections diverses
- Interface affinée dans les thèmes clair et sombre
### EN
- Playback and stability improvements
- Performance optimizations and various fixes
- Interface refinements in light and dark themes

## [1.16.0]
### FR
- Téléchargements : enregistrez un film, un épisode ou une saison entière sur l'ordinateur depuis sa fiche, en qualité Originale (fichier source) ou Allégée (1080p, 720p ou 480p, taille estimée avant lancement, sous-titres inclus)
- Mode Hors ligne : bascule automatique quand le serveur ne répond plus, retour automatique dès qu'il répond, bascule manuelle possible — catalogue local avec affiches, fiches et lecture sans aucune connexion
- Écran Téléchargements : progression en direct, pause/reprise (y compris après une coupure ou un redémarrage), suppression avec confirmation, espace occupé et espace libre, option « supprimer après visionnage »
- Lecture locale prioritaire : un contenu téléchargé est toujours lu depuis le disque, même connecté ; la position est conservée hors ligne et resynchronisée avec le serveur au retour en ligne
- Multi-comptes : chaque compte ne voit que ses téléchargements ; un même contenu téléchargé par deux comptes n'occupe l'espace qu'une seule fois
- Droits pilotés par le serveur : l'administrateur choisit qui peut télécharger et qui a droit au mode Allégé (écrit directement dans Jellyfin)
- Catalogue hors ligne organisé par saison, avec page dédiée : bannière, résumé et épisodes triés par numéro
- Hors ligne comme en ligne : aperçus de la barre de progression, affiche au chargement, sous-titres, menu des langues lisible et préférences de langues appliquées
### EN
- Downloads: save a movie, an episode or a whole season to your computer from its page, as Original (source file) or Light quality (1080p, 720p or 480p, size estimated up front, subtitles included)
- Offline mode: automatic switch when the server stops responding, automatic return as soon as it responds, manual switch available — local catalog with artwork, pages and playback without any connection
- Downloads screen: live progress, pause/resume (including after a network cut or an app restart), confirmed deletion, used and free space, per-item "delete after watching" option
- Local playback first: downloaded content always plays from disk, even while online; position is kept offline and resynced with the server when back online
- Multi-account: each account only sees its own downloads; the same content downloaded by two accounts only uses disk space once
- Server-driven rights: the administrator chooses who can download and who gets Light mode (written directly into Jellyfin)
- Offline catalog organized by season, with a dedicated page: banner, summary and episodes sorted by number
- Offline as online: seek bar previews, loading artwork, subtitles, readable language menu and language preferences applied

## [1.15.1]
### FR
- Thème clair refondu sur les bannières et les fiches : l'affiche reste vive (plus de voile nacré ni de flou), le texte posé sur l'image est blanc dans les deux thèmes, sur un dégradé sombre lisible même quand l'affiche est claire
- Micro-interactions raffinées : boutons à ressort, pastille de navigation qui glisse entre les onglets, entrée en cascade de la bannière, survol des affiches avec élévation douce — « réduire les animations » respecté
- Ombres des cartes et liseré de la barre de navigation harmonisés avec le thème (fini les traits blancs et ombres noires figés en clair)
- Espacement des rangées de l'accueil resserré
### EN
- Light theme reworked on banners and detail pages: artwork stays vivid (no more pearly veil or blur), on-image text is white in both themes, over a dark gradient that stays readable even on bright posters
- Refined micro-interactions: springy buttons, navigation pill sliding between tabs, cascading banner entrance, soft card hover lift — "reduce motion" honored
- Card shadows and navigation bar border aligned with the theme (no more fixed white lines and black shadows in light mode)
- Tighter spacing between home rows

## [1.15.0]
### FR
- Thème clair, sombre ou automatique : l'application suit le réglage de votre système en direct, sur Windows comme sur macOS — choix dans Réglages, section Apparence
- Réglages repensés en navigation latérale (Apparence, Sécurité, Lecture) : mot de passe, appareils jumelés et changement de serveur sont enfin regroupés dans Sécurité
- Administration repensée sur le même modèle : chaque section accessible d'un clic, sans défilement, avec sa propre icône — et sans les boutons redondants
- Bannières d'accueil et fiches : en thème clair, un flou progressif remplace les voiles — l'affiche garde ses couleurs, le texte reste lisible
- Effet Liquid Glass activable dans Apparence : réfraction sur les surfaces translucides, repli automatique sur l'effet verre classique quand le moteur ne le permet pas
- Les plugins suivent désormais le thème de l'application, clair compris
- Barre de navigation modernisée : état actif en pastille sobre, navigation au clavier visible
- Confirmations : plus aucune boîte de dialogue système muette sur macOS
- Notifications de mise à jour : correction d'un enchaînement qui pouvait laisser macOS et Windows sans annonce alors qu'une version était disponible
- macOS : « Ouvrir l'App Store » ouvre réellement la fiche Tentacle TV — le lien vers le store était bloqué silencieusement par la liste d'autorisations d'ouverture d'URL
- macOS : la notification de mise à jour n'apparaît plus avant que la version soit réellement en ligne sur l'App Store
### EN
- Light, dark or automatic theme: the app follows your system setting live, on Windows and macOS alike — pick yours in Settings, Appearance section
- Settings redesigned with side navigation (Appearance, Security, Playback): password, paired devices and server switching are finally grouped under Security
- Administration redesigned on the same model: every section one click away, no scrolling, each with its own icon — and without the redundant buttons
- Home banners and detail pages: in light theme, a progressive blur replaces the veils — artwork keeps its colors, text stays readable
- Liquid Glass effect available in Appearance: refraction on translucent surfaces, automatic fallback to the classic glass effect when the engine cannot render it
- Plugins now follow the app theme, light included
- Modernized navigation bar: sober pill active state, visible keyboard navigation
- Confirmations: no more silent system dialogs on macOS
- Update notifications: fixed a sequence that could leave macOS and Windows unannounced while a version was available
- macOS: "Open the App Store" really opens the Tentacle TV page — the store link was silently blocked by the URL-opening allowlist
- macOS: the update notification no longer shows before the version is actually live on the App Store

## [1.13.1]
### FR
- Corrections mineures de l'interface

### EN
- Minor UI bug fixes

## [1.13.0]
### FR
- Lecture : les sous-titres s'affichent de nouveau pendant le transcodage, avec leur mise en forme complète (identique à la lecture directe)
- Watch Together : le chat ne disparaît plus pendant qu'on l'utilise — survol, saisie, émojis en rafale, défilement des GIFs et redimensionnement le gardent visible ; sans interaction, il s'estompe avec les contrôles comme avant
- macOS : « Ouvrir l'App Store » ouvre désormais la fiche Tentacle TV sans fermer l'application — cliquez sur « Mettre à jour » dans l'App Store, il s'occupe du reste
- Windows : les nouveautés s'affichent enfin dans la fenêtre de mise à jour, comme sur macOS et Linux
- La fenêtre de mise à jour suit le thème de l'application (bouton principal blanc)
- Les descriptions de films, séries et épisodes interprètent leur mise en forme (gras, italique, retours à la ligne) au lieu d'afficher le code brut
- Bannière d'accueil : bouton « Reprendre S2 · E5 » compact (numéro de saison/épisode sur le bouton, plus de titre d'épisode qui déborde) — harmonisé sur toutes les fiches
### EN
- Playback: subtitles show up again while transcoding, with their full styling (identical to direct play)
- Watch Together: the chat no longer vanishes while you're using it — hovering, typing, rapid-fire emojis, GIF scrolling and resizing keep it visible; when idle it still fades with the controls
- macOS: "Open the App Store" now opens the Tentacle TV page without closing the app — click "Update" in the App Store and it handles the rest
- Windows: release notes finally show in the update window, just like on macOS and Linux
- The update window follows the app theme (white primary button)
- Movie, series and episode descriptions render their formatting (bold, italics, line breaks) instead of showing raw markup
- Home banner: compact "Resume S2 · E5" button (season/episode number on the button, no more overflowing episode title) — harmonized across all detail pages

## [1.12.2]
### FR
- Watch Together : nouveau sélecteur de réactions dans le chat — ~470 emojis en 8 catégories, envoi en un clic, spam bienvenu (le sélecteur reste ouvert)
- Watch Together : GIFs dans le chat (recherche + tendances, propulsés par KLIPY) — un clic et le GIF s'anime à l'écran pour tout le groupe (nécessite un serveur 1.6.0+)
- Watch Together : panneau de chat redimensionnable (poignée en haut à gauche, taille mémorisée)
- Windows : correction d'un gel de l'application pendant la lecture (interblocage du moteur vidéo)
- À propos : la version affichée pouvait rester bloquée sur un numéro antérieur (Windows et développement) — corrigé
### EN
- Watch Together: new reaction picker in the chat — ~470 emojis across 8 categories, one-click send, spam-friendly (the picker stays open)
- Watch Together: GIFs in the chat (search + trending, powered by KLIPY) — one click and the GIF animates on screen for the whole group (requires a 1.6.0+ server)
- Watch Together: resizable chat panel (top-left handle, size remembered)
- Windows: fixed an application freeze during playback (video engine deadlock)
- About: the displayed version could stay stuck on an older number (Windows and development builds) — fixed

## [1.12.1]
### FR
- Watch Together : correction du démarrage de l'épisode suivant à ~1/3 au lieu du début (la position de reprise du premier épisode ne fuit plus vers les suivants)
### EN
- Watch Together: fixed the next episode starting at ~1/3 instead of the beginning (the first episode's resume position no longer leaks into subsequent episodes)

## [1.12.0]
### FR
- Versions unifiées : macOS, Windows et Linux partagent désormais le même numéro de version et sortent ensemble
### EN
- Unified versions: macOS, Windows and Linux now share the same version number and ship together

---
