# Bandes-annonces sur Apple TV — fiables et rapides

Retour d'essai du 2026-10-02 : « Les bandes-annonces plantent 2 fois sur 3 sur
Apple TV, et quand elle se lance, la bande-annonce met énormément de temps à se
lancer. » Ce document dit ce qui se passait (mesuré), ce qui a changé, les
chiffres avant / après, et ce qui reste fragile.

Seule l'Apple TV est concernée : elle n'a pas de WebView, le serveur doit lui
fournir un flux qu'AVPlayer lit. Web, bureau, mobile, Android TV et LG
embarquent le lecteur YouTube et ne passent pas par ce chemin — sauf l'aperçu
au survol des cartes (web et bureau, 2026-10-14), qui lit le relais : voir
« Aperçu au survol ».

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

- **La fiche prépare la bande-annonce** (`useTrailerPreparation.ts`, Apple TV et Android TV) :
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

**La pile de l'image de production**, éprouvée à part dans un conteneur
`node:20-alpine` (Node 20.20, Python 3.12 et deno 2.3 d'Alpine, zipapp
officiel 2026.08.19), avec le code serveur compilé : l'ouvrier démarre, le
maître `visionos` vient en 1,8 s une fois l'ouvrier chaud, la vidéo « pour
enfants » passe par le MP4 (11,6 s dans cette petite VM de deux cœurs, avec
le premier téléchargement du solveur de défis), et le relais lit maître,
liste et segments par undici sous Node 20.

**Depuis l'image allégée (2026-10-05), plus de deno** : `node:24-alpine`
(Node 24.21, Python 3.14), et yt-dlp résout les défis JavaScript avec le
Node du serveur (`--js-runtimes node:<process.execPath>`, et `js_runtimes`
pour l'ouvrier ; yt-dlp l'accepte dès Node 22). Mesuré sur la même vidéo,
même yt-dlp 2026.08.19 : `web_embedded` rend 41 formats dont 25 vidéos à
URL résolue, avec deno 2.3.1 comme avec Node 24.21 — et `web` seulement des
images dans les deux cas (jeton PO, sans rapport avec le moteur). Le maître
`visionos` vient en 2,4 s, ouvrier compris.

## Les autres plateformes

Web, bureau, mobile et LG lisent le lecteur YouTube embarqué : rien ne
change pour eux, leurs tests restent verts. Android TV lit désormais le
relais, comme l'Apple TV (même `TrailerWebView`, ExoPlayer). Le relais leur est
ouvert s'il le faut un jour — par exemple pour lire dans l'app, sur le
bureau macOS, ce que la WebView y refuse (Referer retiré, erreur 153) et
qu'on ouvre aujourd'hui dans le navigateur.

## Le lecteur simplifié : qualités et sous-titres (2026-10-11)

Sur les deux téléviseurs, la bande-annonce devient un lecteur réduit à
l'essentiel : sous-titres ou non, qualité, avancer / reculer. Le serveur le
déclare par la capacité `trailers.player` ; sans elle, avancer et reculer
marchent (purement client), qualité et sous-titres n'existent pas.

**`GET /api/trailers/resolve?ytId=…&lang=fr`** garde son contrat et ajoute :

- `qualities: [{ height, path }]` — un maître RÉDUIT à chaque hauteur H.264
  du maître (`master-720.m3u8`, mêmes listes et segments relayés, même
  jeton), de 360p à 1080p ; « Auto » reste `path`. Un MP4 de repli : `[]`.
- `subtitles: [{ lang, label, auto, path }]` — les pistes de YouTube,
  relayées en WebVTT (`/api/trailers/subs/<ytId>/<clé>.vtt`, même jeton) :
  les pistes posées par la chaîne, puis la reconnaissance vocale d'origine
  si aucune piste posée ne parle sa langue. `lang` (l'interface) puis
  l'anglais en tête, six au plus, `lang` unique dans la liste.

Le serveur relit `youtube.com/api/timedtext` — ces URL ne sont pas liées à
l'adresse IP (`ip=0.0.0.0`) — au format `json3`, et le convertit lui-même
(`timedText.ts`) : le `vtt` de YouTube pour sa reconnaissance vocale fait
défiler deux lignes, chacune deux fois, minutée mot à mot ; converti, une
réplique à la fois, chacune finie quand la suivante paraît. Le téléviseur
dessine les répliques en calque (`SubtitleLayer`, parseur partagé) :
AVPlayer ne sait pas ajouter de piste texte à un maître HLS.

**Mesuré** (yt-dlp 2026.08.19, client `visionos`, 14 bandes-annonces : Dune 2,
Oppenheimer, Inception, Interstellar, Breaking Bad, Jumanji 2, Anniversary,
La Femme de ménage, Bugonia, Harry Potter (VF), Avengers : Doomsday, Dragons,
Dying for Sex, Adults (VOST)) :

| | Bandes-annonces |
|---|---|
| H.264 jusqu'en 1080p (qualités 1080 · 720 · 480 · 360, ou 1080 · 720 · 360) | 12 / 14 |
| Plafonnées à 720p (720 · 480 · 360) | 2 / 14 (Breaking Bad, Inception) |
| Pistes posées par la chaîne (toujours l'anglais) | 3 / 14 |
| Reconnaissance vocale d'origine (`fr` pour une VF, `en` sinon) | 10 / 14 |
| Au moins une piste | 11 / 14 |
| Aucune piste | 3 / 14 (Breaking Bad, Jumanji, Interstellar) |

Une VOST de YouTube porte en général ses sous-titres français DANS l'image ;
sa piste est l'anglais reconnu. Une VF n'offre que le français reconnu.

À travers le relais (10 d'entre elles, de ce poste) : extraction 1,4 à 2,2 s
(ligne de commande), une piste WebVTT en 68 à 109 ms, 27 à 51 répliques.

**Jamais les traductions automatiques** (`tlang`, ~150 langues) : YouTube
les refuse en **429** à un serveur (5 sur 5 ce jour-là), quand la piste
d'origine passe. Une option qui échouerait à coup sûr n'est pas offerte.

**Côté TV** (`apps/tv/src/screens/trailer/`) : `TrailerWebView` reste le
lecteur, commandable par des props facultatives (`quality`, `subtitle`,
`paused`, `onTracks`, `onProgress`, `onCue`) et `ref.seekTo`. Une autre
qualité recharge le flux à la même position (`startPosition` natif), la
première image déjà acquise : pas de second chargement. Le chien de garde
connaît la pause et le saut ; les tics qui disent encore l'ancienne position
après un saut sont ignorés (5 s au plus).

## Aperçu au survol (2026-10-14)

Au survol d'une carte, le web et le bureau montrent un aperçu de la
bande-annonce dans une mini-carte 16:9. Règle de Damien : AUCUNE transition
s'il n'y a pas de bande-annonce lisible, rien non plus sur erreur — la vidéo
est éprouvée AVANT d'être proposée. L'aperçu lit le RELAIS (pas l'iframe
YouTube) : qualité maîtrisée, aucun habillage YouTube, un vrai essai côté
serveur. Capacité `trailers.preview` (1.28.0).

**Le contrat** : `packages/shared/src/trailers/trailerPreview.ts`, recopié
octet pour octet dans `apps/backend/src/trailers/` (avec la liste,
`trailerList.ts` : test miroir). Le client fait UN appel :

- `GET /api/trailers/preview?itemId=…&lang=fr` — un titre de la
  bibliothèque ; `?tmdbId=…&mediaType=movie|tv&lang=fr` — un titre hors
  bibliothèque (carte TMDB, Vigie). `trailerPreviewPath()` écrit la
  demande, `parseTrailerPreviewQuery()` la relit au serveur, mêmes règles.
- 200 `{ ytId, path, mimeType, expiresAt, heights, qualities }` : `path` est
  le maître relayé (« Auto » : 720p d'abord) ou, à défaut de HLS (vidéo
  « pour enfants »), un MP4 ; `qualities` = un maître réduit par hauteur, la
  meilleure en tête ; `expiresAt` borne le jeton et les URL amont.
- Refus `{ error }`, tous « rien à montrer » : 404 `no_trailer` (aucune
  bande-annonce, titre invisible pour ce compte, collection, personne…),
  404 `unavailable` (aucune ne se lit), 429 `rate_limited` (le délai dans
  `Retry-After` — exposé au CORS, que le bureau lise l'en-tête — et dans le
  corps, `retryAfterS`), 400 `invalid_request`.

**Le choix** (`services/trailers/preview/`) : un titre de la bibliothèque est
lu AU NOM du compte (clé d'administration + `userId` : Jellyfin rend 404 pour
ce qu'il ne voit pas) ; un épisode ou une saison valent leur série. Les
candidates : `RemoteTrailers` de Jellyfin et vidéos TMDB (clé du serveur,
`titleVideos.ts` ; Jellyseerr sans clé), fusionnées par `mergeTrailers` — la
règle de la fiche : la langue d'abord (VF en français), une bande-annonce
avant un teaser ; YouTube seulement, jamais featurette, coulisses ni extrait.
TMDB ne rend que l'anglais sans paramètre (mesuré : aucune des cinq VF de
Dune) : on demande `include_video_language=<langue>,en,null`, puis la langue
originale si rien ne convient.

**La vérification** : trois candidates au plus, dans l'ordre, jusqu'à la
première qui s'extrait (yt-dlp, budget de 20 s, APRÈS les lectures : un
aperçu n'occupe jamais plus d'une des deux places d'extraction,
`extractionSlots.ts`) et dont le maître et les listes de départ se lisent
chez googlevideo. En même temps, sans retarder la réponse, le départ d'un
lecteur qui commence au plus haut — la liste de la variante la plus haute et
celle de son audio, puis leur PREMIER segment — est lu d'avance
(`trailerSegments.ts` : 32 Mo, cinq minutes, quatre lectures à la fois) ; le
lecteur qui les demande les reçoit de la mémoire ou rejoint la lecture en
cours.

**La mémoire** : la décision par (titre, langue) — trouvée jusqu'à
l'échéance des URL, aucune bande-annonce une heure, aucune lisible une
minute ; demandes identiques partagées ; une vidéo que le relais a oubliée
est reprise d'abord, sans relire TMDB. Le relais garde 96 vidéos (48 avant).
**La protection** : un seau par compte (six décisions d'avance, une toutes
les 5 s — une décision gardée ne coûte rien) et quatre décisions en cours au
plus sur le serveur.

**Lisible par hls.js depuis le bureau** : le CORS de Tentacle reflète
`tentacle://app` sur la route et sur tout le relais (maître, listes,
segments, MP4 par plages), CORS ouvert comme restreint (`CORS_ORIGINS`) ;
chaque URI réécrite porte le jeton. Éprouvé dans Chrome 155 sans tête, page
d'une AUTRE origine que le serveur, hls.js 1.6.15 de `node_modules`, puis
dans le bureau (Electron) contre le banc : 1080p dès le premier fragment.

**Deux défauts du relais corrigés en passant** : googlevideo dit ses segments
`application/octet-stream`, que la compression globale tenait pour
compressible — chaque segment partait en zstd vers un navigateur ; segments
et MP4 relayés ne sont plus compressés. Et un lecteur qui part en cours de
route (survol fini) n'est plus une erreur au journal : silence, comme au
proxy de Jellyfin ; une vraie panne amont répond 502, un délai 504.

**Mesuré** (banc du 2026-10-14 : Jellyfin 10.11 jetable, yt-dlp 2026.08.19 de
Homebrew en ligne de commande, charge 6 à 23 sur 10 cœurs) :

| | Délai de `/preview` | Première image après la réponse |
|---|---|---|
| À froid (3 films du banc, 3 titres TMDB) | 1,3 à 2,1 s | 0,12 à 0,23 s (départ au plus haut) |
| À chaud (décision gardée) | 1 à 25 ms | 0,11 à 0,25 s (navigateur neuf) |
| Deux candidates mortes avant la bonne (Cowboy Bebop) | 6,3 s | — |

Hauteur obtenue : 1080p pour la plupart (Dune, Dune 2, Interstellar,
Oppenheimer, Charade, La Nuit des morts-vivants), 720p pour Inception, 480p
pour les films muets (Metropolis, Le Kid) — ce que YouTube sert, pas plus ;
un MP4 360p quand YouTube ne sert pas de HLS (Sherlock Junior, Your Name).
Le départ au plus haut : la meilleure hauteur dès la première image.

**Surveiller** (`grep '\[trailers\] aperçu'`) :

- `aperçu tmdb:movie:438631|fr : gHt8tCHbB2M (hls, 1080) en 1387 ms, essai 1/3`
- `aperçu jf:<id>|fr : aucune bande-annonce` — ou `(TMDB sans réponse)` ;
- `aperçu … : aucune lisible (3 candidate(s), … ms)` — yt-dlp les refuse ;
- `aperçu … : … reprise` — une décision dont le relais avait oublié la vidéo.

## Ce qui reste fragile, et comment le surveiller

- **YouTube change.** `visionos` peut un jour exiger un jeton PO, comme
  `web` ou `mweb` avant lui. La seconde passe (clients par défaut de yt-dlp)
  prend alors le relais, plus lentement, et la mise à jour quotidienne de
  yt-dlp (stable) suit YouTube. Signe à guetter : des lignes
  `via default,web_safari,web_embedded` au lieu de `via visionos`.
- **Les vidéos « pour enfants »** (Disney, Pixar) n'ont, avec la stable
  2026.08.19, que le MP4 360p de `web_embedded`, qui exige un moteur
  JavaScript (le Node du serveur) et les défis JavaScript (≈ 4 à 6 s
  d'extraction). La nightly de yt-dlp (≥ c7fb478) leur
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
