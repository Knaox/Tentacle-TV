# Bandes-annonces sur Apple TV — fiables et rapides

Retour d'essai du 2026-10-02 : « Les bandes-annonces plantent 2 fois sur 3 sur
Apple TV, et quand elle se lance, la bande-annonce met énormément de temps à se
lancer. » Ce document dit ce qui se passait (mesuré), ce qui a changé, les
chiffres avant / après, et ce qui reste fragile.

Seule l'Apple TV est concernée : elle n'a pas de WebView, le serveur doit lui
fournir un flux qu'AVPlayer lit. Web, bureau, mobile, Android TV et LG
embarquent le lecteur YouTube et ne passent pas par ce chemin.

## Ce qui se passait

### Pas un plantage de l'app : un échec de lecture

Aucun rapport de plantage de `TentacleTV` pour le simulateur de l'essai
(`~/Library/Logs/DiagnosticReports`) : les sept rapports présents viennent de
clones de bancs et n'ont rien à voir avec les bandes-annonces (assertion de
l'inspecteur au rechargement de Metro, chien de garde de scène en
arrière-plan). Aucun plantage non plus pendant la centaine de lancements des
bancs de ce chantier, échecs et délais compris. « Plantent » voulait dire :
l'écran disait « YouTube ne fournit pas cette bande-annonce » au bout de
longues secondes.

### La cause : un sélecteur de format que YouTube a rendu caduc

L'ancien code demandait à yt-dlp un flux **muxé** (audio et vidéo dans le même
manifeste) : `best[protocol*=m3u8][acodec!=none][vcodec!=none]`, puis un MP4
muxé. Mesuré le 2026-10-02 (yt-dlp 2026.08.19, la dernière stable) :

- le client `web_safari`, le seul qui sert le HLS muxé (formats 91 à 96), est
  forcé en « SABR » presque toujours : il ne rend plus aucun format ;
- le client `visionos` — par défaut dans yt-dlp depuis 2026.08 — rend un
  **maître HLS à la Apple** : variantes vidéo H.264 jusqu'en 1080p, audio en
  pistes séparées, sans défi JavaScript. Exactement ce qu'AVPlayer lit. Mais
  ses variantes sont « vidéo seule » : le filtre `acodec!=none` les écartait ;
- yt-dlp répondait donc « Requested format is not available », cinq fois de
  suite (cinq essais de 3 à 5 s), puis le serveur rendait 404 et retenait
  l'échec **dix minutes** — toute relance échouait aussitôt ;
- les seules réussites étaient les vidéos « pour enfants » (Disney, Pixar) :
  repli sur le MP4 360p (format 18) du client `web_embedded`… au bout des
  cinq essais, faute de HLS — 25 à 28 s.

Le retour de l'utilisateur (« 2 fois sur 3 ») est même optimiste : sur
l'adresse de ce poste, le HLS muxé ne venait plus du tout.

### Une fragilité latente, en production

Les URL googlevideo sont **signées pour l'adresse IP de l'extraction**
(`sparams` contient `ip`). Le serveur les extrayait, le téléviseur les lisait :
un Apple TV qui sort par une autre adresse que le serveur (serveur distant,
VPN, IPv6 d'un côté et IPv4 de l'autre) se les voyait refuser en 403.

## Ce qui a changé

### Serveur (`apps/backend/src/services/trailers/`)

- **Le choix du flux est le nôtre** (`trailerSource.ts`) : yt-dlp rend tout
  (`-j`), on prend le maître HLS qui porte du H.264, sinon un MP4 muxé
  H.264 + AAC, quel que soit l'itag. Indifférent aux numéros de format, que
  YouTube change souvent.
- **Les passes** : `visionos` d'abord (≈ 1,5 s, sans JavaScript ; yt-dlp y
  ajoute de lui-même `web_embedded` pour une vidéo « pour enfants » ou sous
  limite d'âge), puis les clients PAR DÉFAUT de yt-dlp — ceux que ses
  mainteneurs tiennent à jour — avec `web_safari` et `web_embedded`. Réglable
  sans livraison : `TENTACLE_TRAILER_CLIENTS="visionos;default,web_safari"`.
- **Le serveur RELAIE le flux** (`routes/trailerMedia.ts`) : maître, listes et
  segments passent par lui. Le téléviseur ne parle qu'à son serveur, quelle
  que soit son adresse. Le maître servi ne garde que le H.264 (que tout
  Apple TV décode en matériel), retire les sous-titres de YouTube, met la
  720p en tête (AVPlayer part de la première variante). Une URL refusée en
  cours de route (échéance, révocation) déclenche UNE nouvelle extraction,
  transparente. L'accès passe par un jeton signé dans l'URL (AVPlayer
  n'envoie pas d'en-tête d'autorisation), lié à une vidéo et à une échéance.
- **Un ouvrier yt-dlp gardé chaud** (`ytWorker.ts`) : un processus Python qui
  importe yt-dlp une fois et sert les extractions suivantes — 1,0 à 1,5 s au
  lieu de 2,3 à 3,2 s en ligne de commande. Il s'éteint après cinq minutes
  sans travail (≈ 60 Mo rendus). Il ne marche qu'avec le zipapp officiel
  (celui de l'image, ou la copie mise à jour chaque jour) ; ailleurs (yt-dlp
  de Homebrew en dev), ou s'il meurt, la ligne de commande reprend.
- **Un budget** : 40 s pour toutes les passes (sous les 45 s du téléviseur) ;
  une passe qui l'épuise met fin à l'extraction. Un délai épuisé n'est pas
  retenu (le geste suivant réessaie), un autre raté passager 15 s, une vidéo
  retirée ou privée une heure.
- **Mémoire** : une vidéo résolue reste jusqu'à l'échéance de ses URL (~6 h),
  48 au plus, extractions partagées, deux à la fois au plus.
- **Routes** : `GET /api/trailers/resolve` garde son contrat (`url`,
  `mimeType`, `expiresAt`) et ajoute `path` — les versions de l'app déjà
  installées lisent le relais sans mise à jour. `GET /api/trailers/prepare`
  (préparer), `POST /api/trailers/report` (le compte rendu, ci-dessous),
  `/api/trailers/hls/…` et `/api/trailers/file/…` (les flux relayés).

### Apple TV (`apps/tv/src/screens/trailer/`, `redesignWiring/`)

- **La fiche prépare la bande-annonce** (`useTrailerPreparation.ios.ts`) :
  300 ms après que la liste des bandes-annonces est arrêtée, le serveur
  extrait et charge le maître et les premières listes pendant qu'on lit la
  fiche. Le lancement n'attend plus yt-dlp.
- Le flux vient du chemin relayé (`path` posé derrière l'adresse que la TV
  connaît).
- **Chaque issue part au serveur** (`reportTrailerOutcome`) : la première image
  et son délai depuis l'ouverture de l'écran, ou l'échec et sa raison.
- Sans image en 15 s (20 s avant), l'échec ; l'indisponible dit sa phrase puis
  **rend la fiche de lui-même** au bout de 4 s (le focus retrouve
  « Bande-annonce »). Rien de nouveau à l'écran.

## Chiffres avant / après

Banc : l'app en **build Release** au simulateur tvOS 26.2 (Apple TV 4K
3ᵉ génération, 1080p), compte de test, vraie bibliothèque en lecture seule ;
les titres sont ouverts par la recherche et « Bande-annonce » pressé au pavé
(agent XCUITest), focus vérifié avant chaque OK. Le délai est mesuré DANS
l'app, de l'ouverture de l'écran de la bande-annonce à la première image
(`onReadyForDisplay`), et recoupé à l'image près sur un enregistrement de
l'écran (écart < 0,2 s). La bande-annonce lancée est celle que la TV choisit
(VF d'abord). « Avant » : le même banc, les routes des bandes-annonces
servies par le backend de dev, au code de la base, avec yt-dlp 2026.08.19 —
la version que l'image de production tient à jour.

| | Avant (code de la base) | Après (série finale) |
|---|---|---|
| Lancements réussis | **2 / 20** (10 titres × 2) | **32 / 32** (16 titres × 2) |
| Première image, médiane | — (deux réussites : 25,0 et 28,4 s) | **0,29 s** (premiers lancements : 0,80 s) |
| 90 % des lancements sous | — | 1,09 s |
| Pire cas | échec au bout de 13,5 à 23,3 s ; réussite à 28,4 s | **1,32 s** |
| Relancer après un échec | échec immédiat, dix minutes durant | — |

Titres : Le Pont de la rivière Kwaï (1957), Psychose (1960), 2001 (1968),
Rocky (1976), The Thing (1982), Toy Story 5 et Vaiana (2026, vidéos « pour
enfants »), Breaking Bad, Dark, Demon Slayer, Alien: Earth, Ça : Bienvenue à
Derry, bref., The Boys, 56 Jours, Better Call Saul — films et séries, VF,
VOST et versions originales. Chaque titre est lancé deux fois ; la fiche est
laissée trois secondes avant l'appui, le temps de la lire.

Autres séries, mêmes conditions :

- **Appui immédiat, serveur et ouvrier à froid** (8 titres, dès que
  « Bande-annonce » a le focus) : 8 / 8, médiane 0,88 s ; pire 5,4 s — Toy
  Story 5, vidéo « pour enfants » dont l'extraction (défis JavaScript) a pris
  8,9 s, préparée mais pas encore prête à l'appui.
- **Sous forte charge** (24 à 62 sur 10 cœurs) : 28 / 28, médiane 0,81 s ;
  pire 14,6 s — l'ouvrier démarrait à froid, et Python mettait plus de dix
  secondes à importer yt-dlp.
- **Échecs provoqués** (relais du banc) : résolution refusée → la phrase
  d'indisponibilité à +1,2 s, la fiche rendue à +5,7 s, focus sur
  « Bande-annonce » ; segments refusés en pleine lecture → AVPlayer -1102
  à 26,6 s, compte rendu au serveur, la fiche rendue 4 s plus tard. Aucun
  écran figé, aucun plantage.

La charge du poste pendant la série finale : 14 à 38 sur 10 cœurs (sept
autres sessions de travail en parallèle). Une extraction y prend 1,2 à 3,4 s
(`visionos`) et 4,6 à 5,1 s (« pour enfants »), contre 1,0 à 1,5 s au calme.

## Les autres plateformes

Web, bureau, mobile, Android TV et LG lisent le lecteur YouTube embarqué :
rien ne change pour eux, leurs tests restent verts. Le relais leur est
ouvert s'il le faut un jour — par exemple pour lire dans l'app, sur le
bureau macOS, ce que la WebView y refuse (Referer retiré, erreur 153) et
qu'on ouvre aujourd'hui dans le navigateur.

## Ce qui reste fragile, et comment le surveiller

- **YouTube change.** `visionos` peut un jour exiger un jeton PO, comme
  `web` ou `mweb` avant lui. La seconde passe (clients par défaut de yt-dlp)
  prend alors le relais, plus lentement, et la mise à jour quotidienne de
  yt-dlp (stable) suit YouTube. Signe à guetter : des lignes
  `via default,web_safari,web_embedded` au lieu de `via visionos`.
- **Les vidéos « pour enfants »** (Disney, Pixar) n'ont, avec la stable
  2026.08.19, que le MP4 360p de `web_embedded`, qui exige deno et les défis
  JavaScript (≈ 4 à 6 s d'extraction). La nightly de yt-dlp (≥ c7fb478) leur
  donne le HLS 91 à 96 jusqu'en 1080p : il arrivera avec la prochaine stable,
  sans rien changer ici. Suivre la nightly en production serait un autre
  choix de mise à jour automatique — non fait.
- **Le bridage de l'adresse par YouTube** (« Sign in to confirm you're not a
  bot », « try again later ») : passager, jamais retenu longtemps. La
  préparation dès la fiche multiplie un peu les extractions ; le cache de six
  heures et le partage des extractions les contiennent.
- **Un serveur saturé** : le budget de 40 s borne l'attente ; un délai épuisé
  n'empêche pas de réessayer aussitôt.

**Surveiller** (`docker logs <conteneur> 2>&1 | grep '\[trailers\]'`) :

- `… : hls via visionos en 1840 ms` — une extraction, son client, sa durée ;
- `… : première image en 812 ms` — une lecture réussie, vue par le téléviseur ;
- `… : échec de lecture après … ms (raison)` — ce que la TV a vu échouer ;
- `… : aucun flux (…)` — rien d'extractible : la raison de yt-dlp suit ;
- `ouvrier yt-dlp 2026.x.y prêt` — l'ouvrier (re)démarre, avec sa version.

Rejouer une extraction à la main, dans le conteneur :
`yt-dlp --extractor-args youtube:player_client=visionos -F <URL>` — une ligne
`m3u8` avec `avc1` = le maître est là.

## Le banc

Monté pour ce chantier (bloc-notes de la session, à recopier) : un relais
local sur le port du banc qui renvoie tout au backend de dev SAUF les routes
des bandes-annonces, servies par le code du worktree (mode « après ») ou
laissées au backend de dev (mode « avant ») ; l'app Release sur un simulateur
neuf, sa session posée dans le conteneur par `defaults import` (le jeton
n'apparaît jamais en ligne de commande) ; l'agent XCUITest d'`atv-remote` sur
des ports à soi ; un pilote qui ouvre chaque titre par la recherche et ne
presse OK que sur un focus vérifié ; les comptes rendus de la TV relevés par
le relais. Sonde AVPlayer macOS (`avprobe`) pour les premières mesures de
flux, hors app : le maître `visionos` y donne sa première image en 0,5 à
1,5 s en direct, 0,2 à 0,9 s à travers le relais une fois résolu.
