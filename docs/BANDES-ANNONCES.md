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

Mobile et LG lisent le lecteur YouTube embarqué. Android TV lit le relais,
comme l'Apple TV (même `TrailerWebView`, ExoPlayer). Le web et le bureau ont
leur lecteur COMPLET depuis le 14 oct. (section suivante).

## Le lecteur complet du web et du bureau (2026-10-14)

`apps/web/src/components/trailerPlayer/` : un PETIT lecteur posé sur la page
(carte 16:9, plein écran sur demande — choix de Damien : lancer et refermer
vite), sans publicité,
chaque vidéo par le relais — jamais stockée. Ouvert par « Bande-annonce », la
rangée des extras et le héros de la reco (`detail/TrailerViewer.tsx`), face à
un serveur qui déclare `trailers.player` ; sinon la modale d'avant.

- **Relais Dailymotion** (AlloCiné). La clé du relais devient une référence
  (`videoRef.ts`) : l'identifiant YouTube nu — inchangé pour l'aperçu, sa
  mémoire et les téléviseurs — ou `dm:<id>` (`%3A` dans les chemins).
  `dailymotionSource.ts` lit `/player/metadata/video/<id>` et prend
  `qualities.auto`, jamais `advertising.ad_url` (le même flux, publicités
  insérées). Mesuré le 14 oct. : maître H.264 + AAC en MPEG-TS, segments de
  3 s aux URI relatives `../../../frag(1)/…` (résolues depuis l'adresse
  finale, `relayEntry.ts`), URL signées pour l'adresse qui les obtient,
  qualités lues dans le maître, résolution en ~200 ms. Échéance non
  documentée : une heure.
- **Repli sur le lecteur officiel.** `/resolve` d'une vidéo YouTube que le
  relais ne tient pas passe par le garde des lectures (`takeYouTubePlayback` :
  budget du serveur, seau du compte, pause et sa lecture-sonde) ; refusée,
  `409 { fallback: "embed", reason }`. Le lecteur ouvre alors l'iframe de
  YouTube pour CETTE bande-annonce, avec la ligne « des publicités peuvent
  apparaître ». Une lecture qui échoue (indisponible, rien en 15 s) passe à la
  suivante ; au bout de la file, le lecteur officiel (YouTube) ou la fermeture
  (Dailymotion n'a pas de repli sans publicité) — `trailerFailureStep`, shared.
  `/prepare` ne part jamais pendant une pause et compte comme une lecture.
- **Règles partagées** (`packages/shared/src/trailers/player/`, tv-core les
  réexporte) : la réponse de `resolve` (dont `language`, la langue du serveur,
  qui range les sous-titres quand le client n'en demande pas), les choix,
  la mémoire des sous-titres, la file. Sous-titres au départ : le choix retenu
  du compte, sinon la piste POSÉE dans la langue du serveur, sauf pour une
  bande-annonce déjà dans cette langue — jamais la reconnaissance vocale.
- **Bureau** : le plein écran passe par l'IPC de la fenêtre
  (`player_fullscreen_enter`, `toggle_fullscreen`, `player_fullscreen_leave`) —
  la coquille refuse `requestFullscreen` ; macOS défait le plein écran posé
  pendant la bande-annonce. Écran gardé allumé pendant la lecture.
- **LG** : la porte du dossier (`index.ts`) est remplacée par un shim et le
  dossier exclu — faux hls.js, LG en pause : la dalle garde la modale.
- **Vérifié au banc** (14 oct., serveur de test, navigateur) : YouTube en
  1080p (première image en 117 ms, vidéo tenue), Dailymotion en 720p, ←/→,
  J/L, M, ↑/↓ (volume mémorisé), Espace/K, Maj+N/Maj+P, qualité (1080 → 720
  sans recharger), C (sous-titres posés, mémorisés par compte), 409 → lecteur
  officiel, Échap qui ferme sans quitter la fiche. Reste à éprouver sur le
  bureau réel : le plein écran par l'IPC (KWin d'abord), l'image dans l'image.

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
serveur. Capacité `trailers.preview` (1.29.0).

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
lu AU NOM du compte (`catalog/catalogTitle.ts` : ce qu'il ne voit pas ne
décide rien pour les autres). Les candidates sont celles du CATALOGUE du titre
(`/api/trailers/catalog`, `previewCandidates.ts`), dans son ordre : un épisode
ou une saison prennent LEUR saison (puis les précédentes, la série), la langue
du SERVEUR d'abord (localisée, sous-titrée, le reste) — le bouton « Bande-
annonce » et l'aperçu montrent ainsi la même vidéo. Les vidéos en ligne
seulement : YouTube, et Dailymotion (AlloCiné) pour un client qui l'annonce
(`dm=1` ; la réponse porte alors `source` et un `ytId` vide — un client
d'avant n'en reçoit jamais). Une vidéo Dailymotion passe par le relais, sans
extraction YouTube, et reste permise quand YouTube bride l'adresse. Un
catalogue encore vide (une source finit en fond) : 429 « réessayez dans 3 s »,
rien de retenu.

**La vérification** : trois candidates au plus, dans l'ordre, jusqu'à la
première qui s'extrait (yt-dlp, budget de 20 s, APRÈS les lectures : un
aperçu n'occupe jamais plus d'une des deux places d'extraction,
`extractionSlots.ts`) et dont le maître et les listes de départ se lisent
chez googlevideo. En même temps, sans retarder la réponse, le DÉPART de
l'aperçu — la variante la plus riche jusqu'à 720p (celle que le client prend
sur un écran Retina, cf. « Côté client ») et l'audio de son groupe : leurs
listes, puis leur PREMIER segment — est lu d'avance (`trailerSegments.ts` :
32 Mo, cinq minutes, quatre lectures à la fois) ; le lecteur qui les demande
les reçoit de la mémoire ou rejoint la lecture en cours. Une décision à
prendre démarre aussi l'ouvrier yt-dlp d'avance (`prewarmYtWorker`) : Python
et yt-dlp se chargent pendant que TMDB répond — jamais pour une reprise dont
le relais tient encore la source (aucune extraction ne suivra).

**La mémoire** : la décision par (titre, langue, version des règles) — trouvée jusqu'à
l'échéance des URL (dix minutes pour une langue de repli), aucune bande-annonce une heure, aucune lisible dix
minutes (elle a coûté jusqu'à trois extractions) ; demandes identiques
partagées ; une vidéo que le relais a oubliée est reprise d'abord, sans
relire TMDB. Le relais garde 160 vidéos COMPLÈTES ; au-delà, les plus
anciennes perdent leurs listes mais gardent leur SOURCE jusqu'à son
échéance (1 000 au plus, quelques Ko chacune, `relayEviction.ts`) : revenir
sur un titre relit googlevideo, jamais YouTube. Décisions et sources
survivent à un REDÉMARRAGE (`previewMemoryStore.ts` :
`<données>/trailers/preview-memory.json` — le volume de données, ou
`TENTACLE_DATA_DIR` —, 0600, écrit cinq secondes après un changement et à
l'arrêt propre du serveur (rien de la dernière rafale ne se perd), repris
au démarrage tant que ça vaut et réécrit sans l'échu ; fichier abîmé : départ
à vide). Ce qui y reste : 1 000 décisions et 1 000 sources au plus (~2 Mo au
pire, ~100 Ko pour une soirée de 50 titres), jamais plus vieux que
l'échéance des URL (~6 h) ; des identifiants de titres et de vidéos et des
URL googlevideo signées pour l'adresse du serveur — aucune donnée de compte. Une source gardée que googlevideo ne sert plus (adresse changée,
révocation) donne UNE extraction neuve, dans les garde-fous de la décision.

**Un jeton d'aperçu n'extrait jamais** (`relayToken.ts`). Les chemins que
rend `/preview` portent un jeton de portée « aperçu » (`expiry.p.mac`, la
portée signée avec la vidéo). Le relais, partagé avec la TV, peut avoir
oublié la vidéo (96 au plus) quand hls.js demande son maître : avec un jeton
de lecture (`/resolve`), il la ré-extrait comme toujours ; avec un jeton
d'aperçu, JAMAIS — 404, et le client redemande `/preview`, seule porte qui
tienne les garde-fous (seau, plafond, place unique, disjoncteur, budget).
De même pour une URL que googlevideo refuse en cours de route.
**La protection** : un seau par compte (dix décisions d'avance, une toutes
les 3 s — une décision gardée ou préparée ne coûte rien) et quatre décisions
en cours au plus sur le serveur.

**Ménager YouTube** (`youtubeGuard.ts`). Constaté le 2026-10-14 vers 2 h :
après ≥ 146 extractions d'une nuit de bancs, YouTube a placé l'adresse de la
maison sous vérification anti-robot — plus AUCUNE extraction ne passait, pour
aucun client de yt-dlp, Apple TV comprise. L'aperçu multiplie les extractions
(une à trois par titre froid) : il pourrait faire bloquer les bandes-annonces
de toute la maison. Deux garde-fous, pour les aperçus seulement :

- **Le disjoncteur.** Une extraction (aperçu OU lecture) qui rencontre la
  vérification anti-robot ou une limite de YouTube (`youTubeBlock` : « not a
  bot », captcha, HTTP 429, « rate-limited », « try again later », « unusual
  traffic ») suspend TOUTES les extractions d'aperçu 30 min, doublées à chaque
  rechute jusqu'à 4 h, remises à zéro par la première extraction réussie (une
  lecture de la TV suffit). Pendant ce temps, `/preview` répond tout de suite
  `unavailable`, sans TMDB ni extraction, sans rien retenir par titre ; une
  bande-annonce déjà décidée que le relais tient encore — prête, ou sa seule
  SOURCE (après un redémarrage, listes relâchées) — se sert toujours. Un
  aperçu bloqué n'essaie ni l'autre client ni la candidate suivante : un
  blocage n'est JAMAIS une candidate morte.
- **Le budget.** 30 extractions d'aperçu par heure glissante pour tout le
  serveur, comptées en EXTRACTIONS (pas en décisions) ; au-delà, 429
  `rate_limited` avec le délai honnête jusqu'à la prochaine place. Une
  famille qui parcourt sa bibliothèque survole rarement plus de nouveaux
  titres en une heure (chaque décision est gardée des heures), et c'est un
  dixième de ce que yt-dlp documente pour une session invitée (~300 vidéos
  par heure) : les lectures gardent la marge.
- **Les lectures** (`/resolve`, `/prepare`) ne changent pas : priorité,
  passes, mémoire des échecs. Elles ne sont pas espacées pendant un blocage :
  ce sont des gestes explicites, rares au regard des aperçus, et la première
  qui réussit est la meilleure sonde — elle rend aussitôt les aperçus.
- **Le reconnaître** : avec `--ignore-no-formats-error`, yt-dlp ne rend pas
  la raison de YouTube en erreur mais en AVERTISSEMENT — et les avertissements
  étaient jetés (`--no-warnings`, l'ouvrier les taisait) : un blocage ne se
  voyait que comme « 0 formats ». La ligne de commande et l'ouvrier gardent
  désormais leurs avertissements ; une vidéo retirée ou privée se lit toujours
  sur les seules erreurs.

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

**Anti-spam — exigence de Damien (14/10, midi)** : « plusieurs survols ne
doivent jamais spammer YouTube ; repasser sur la même carte ne doit pas
spammer l'API ». Ce qui le tient :

- **Une demande par titre et par page.** La réponse de `/preview` (refus
  compris) est gardée par le client autant que le serveur garde sa décision ;
  une demande partie VA AU BOUT même si le pointeur part (le serveur la mène
  à son terme de toute façon : l'abandonner, c'était la refaire au retour) ;
  une nouvelle demande après un refus passager REJOINT celle qu'une autre
  carte du même titre a en vol ; un titre dont la vidéo vient de lâcher
  n'active même pas la requête (dix minutes).
- **Une extraction par titre tant que sa décision vaut** : décisions
  positives ET négatives gardées, partagées, survivant au redémarrage ;
  jamais de ré-extraction parce qu'un client revient (cf. « La mémoire »).
- **Un segment téléchargé une fois par titre et par page** : listes et
  segments d'un jeton d'APERÇU partent en `private, max-age=…, immutable`
  jusqu'à une minute avant l'échéance du jeton — un retour relit tout du
  cache du navigateur sans même revalider (`trailerMedia.ts`). Une réponse
  RÉUSSIE seulement : un refus passager de googlevideo (503, 429) part en
  `no-store`, la reprise de hls.js le redemande. Les lectures de la TV
  gardent leurs en-têtes.
- **Aucune requête pendant un balayage ou un défilement** : l'intention
  exige un pointeur ARRÊTÉ (cf. « Côté client ») ; un coup de molette ferme
  la porte globale (`previewQuiet.ts`, agent V) jusqu'à un vrai mouvement.
- Le budget horaire, le seau par compte et le disjoncteur restent des
  filets : en navigation normale, on ne les atteint plus.

Mesuré au banc (14/10 après-midi, backend réel du worktree avec un FAUX
yt-dlp qui compte ses appels et un faux googlevideo local ; puis
`antispam.mjs` de l'agent R, build de production, aperçus simulés) :

| Geste | Avant | Après |
|---|---|---|
| 20 survols de la même carte | 2 demandes, 1 extraction | 1 demande, 1 extraction ; listes et segments du cache |
| 20 survols COURTS (400 ms) | 2 à 3 demandes | 1 demande |
| 3 cartes en alternance (7 tours) | 6 demandes, 3 extractions ; 61 Mo, 0 % de cache (R) | 3 demandes, 3 extractions ; 3,1 Mo, 85 % du cache |
| Balayage LENT de 21 cartes (365 à 730 ms par carte) | 21 demandes, 5 à 10 extractions | 0 |
| Balayage 80 / 150 / 220 ms par carte | 0 / 0 / 1 | 0 / 0 / 0 |
| Molette avec pauses, pointeur immobile | 3 extractions | 0 (porte de V) |
| Redémarrage du serveur, puis retour sur un titre décidé | 1 extraction | 0 (réponse en 290 ms) |

**Côté client : quand demander, quoi charger, quand montrer**
(`packages/shared/src/trailers/preview/`, `apps/web/src/trailerPreview/`) :

- **L'intention** : 200 ms de survol ET un pointeur immobile depuis 100 ms
  (moins de 6 px ; `intentStillMs`, `intentMovePx`) — chaque mouvement et
  chaque coup de molette repoussent la demande (`pointerMotion.ts`, écouté
  pendant l'intention seulement). Un arrêt franc dès l'entrée garde ses
  200 ms ; le clavier aussi.
- **La qualité de la boîte** : départ ET plafond au plus petit niveau qui
  couvre ENTIÈREMENT la mini-carte en pixels de l'écran (`previewLevelCap.ts`)
  — 720p sur Retina dès 331 px (vu à l'œil : une 360p étirée de 3 % y est
  molle, la 1080p n'ajoute rien à la 720p), 360p en densité 1, jamais une
  1080p dans 300 à 560 px. Le plafond suit la boîte, et la vidéo rognée de son
  letterbox. La langue passe toujours avant la définition (le choix de la
  bande-annonce n'y touche pas).
- **Le préchargement** : avant la révélation, une seconde de tampon — le
  premier segment, celui que le serveur a lu d'avance (hls.js en prenait
  trente secondes : son tampon de 60 Mo) ; montrée, douze secondes.
- **La révélation sur l'image** : la bande-annonce VÉRIFIÉE par le serveur,
  son premier fragment VIDÉO reçu ici (le flux coule : `FRAG_LOADED` du
  niveau principal, ou des images en tampon en lecture native) et l'image du
  titre chargée et décodée dans la mini-carte (`reportStillReady`) : la
  mini-carte se montre au rendez-vous (le délai choisi, cf. 16/10) sans attendre la première
  image ; la vidéo la rejoint en fondu (`videoReady`), ou la mini-carte
  s'efface si elle ne vient pas (8 s). Un flux trouvé mais bloqué (en-têtes
  puis rien, segments refusés) ne fait rien grandir — recette de R, banc :
  `_stall`, `_failseg=404|500` → jamais montrée, voisines immobiles ; réseau
  lent → montrée à son premier fragment. Sans image : à la première image,
  comme avant ; sans bande-annonce lisible : rien, jamais.
- **Le letterbox incrusté** (`previewLetterbox.ts`) : à la première image,
  UNE copie dans un canevas de 64 × 144 mesure les bandes noires au pixel près
  (noir d'encodage pur, des deux côtés, contenu jusqu'aux bords) ; la vidéo
  se rogne par une échelle posée en `transform` (`videoCrop`), bornée au
  2,4:1, jamais sur des piliers, 1 dans le doute (scène sombre, logo sur fond
  noir, fondu, canevas taché). Banc : spring 1,349 (cropdetect : 1,353), mha
  et mhaladder 1, spring43 1,018 ; 3 à 6 ms une fois par aperçu.

Délais au banc (aperçus SIMULÉS, serveur froid 1,5 à 2,3 s selon le titre —
les chiffres de la nuit —, build de production, charge ~8) :

| | Avant (f45bf593c) | Après |
|---|---|---|
| Froid, montrée (4 titres) | 2 083 à 2 762 ms | 1 972 à 2 591 ms (intention + serveur + 75 à 175 ms : le premier fragment) |
| Chaud, montrée | 826 à 839 ms (1re image à 473–534) | 822 à 843 ms (1re image à 370–446) |
| Déjà vu, montrée | 837 à 885 ms | 828 ms |
| Lecture, rendu / GPU (% d'un cœur, mini-carte de 331 px) | 5,3 / 3,7 (1080p) | 2,4 / 3,5 (360p, densité 1) ; 2,6–3,1 / 3,5–3,7 (720p, Retina) |

À froid, le client n'ajoute plus que 75 à 175 ms au serveur (le premier
fragment vidéo ; ~60 ms si l'on n'attendait que l'image, mais un flux bloqué
ferait alors grandir la mini-carte) : passer sous 1,5 s
demande un serveur sous ~1,2 s (ouvrier chaud, TMDB, vérification) — à
mesurer sur le réseau de la maison, pas sur un partage de connexion.

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

### Langue, taille, reprise, survol unique (14/10, soir)

Quatre défauts relevés à l'essai (nés en dev, absents des notes de version) :

- **La VO au lieu de la VF.** Le LIBELLÉ passe avant le code langue de TMDB,
  qui étiquette `fr` des VOST et des VO : « VOST », « VOSTFR », « VO STFR »,
  « VO », « V.O. », « version originale » (limites de mot) ; rang doublée →
  sous-titrée → autre (`trailerLangFit` / `trailerLangRank`, shared
  `trailerList.ts`, recopié). La langue qui classe est celle du SERVEUR — la
  langue des métadonnées de Jellyfin (`previewLanguage.ts`, via
  `reco/titleLanguage.ts`) : serveur en français, la VF d'abord ; en anglais,
  la VO anglaise ; celle du client à défaut. Une langue moins bonne trouvée
  après l'échec d'une meilleure (VF muette, VO lisible) n'est gardée que DIX
  MINUTES : le survol suivant réessaie la VF (un raté permanent reste retenu
  une heure par le relais, sans extraction). La clé de décision porte la
  version des règles (`|r2`) : les VOST crues VF, gardées sur le disque, ne
  servent plus. Un « Clip » ou une « Featurette » que son libellé dit
  bande-annonce reste candidat (`trailerKind`).
- **L'aperçu d'une affiche plus petit que celui d'une vignette** (331 px
  contre 414 à 1 440 de fenêtre : l'affiche restait au plancher). Sa
  croissance part désormais de la largeur d'une vignette moyenne
  (`idealCardWidth`, `previewPlacement.ts`) ; Vigie, qui n'a que des
  affiches, de même (`placement.ts`).
- **La reprise depuis zéro.** Quitter une carte puis y revenir reprend la
  bande-annonce où on l'avait laissée (`previewPositions.ts` ; Vigie
  `positions.ts`) : position retenue par VIDÉO (le chemin du flux sans jeton,
  jamais le titre), dix minutes, effacée à la fin ou à deux secondes de la
  fin ; hls.js repart par `startLoad(position)` sans retomber à 0, un MP4 s'y
  place à `loadedmetadata`. Le coût est nul : listes et segments sont dans le
  cache du navigateur.
- **Survoler deux fois.**
  - Serveur : les extractions d'aperçu se servent la plus RÉCENTE d'abord
    (`extractionSlots.ts`) — la carte sous le pointeur ne fait plus la queue
    derrière celles déjà quittées —, et une décision que plus personne
    n'attend cède sa place. Une demande `/preview` attend DOUZE secondes au
    plus (sous les 15 s du client) : au-delà, 429 « réessayez dans une
    seconde », et la décision CONTINUE ; la demande suivante la rejoint, sans
    puiser dans le seau. Le plafond de quatre décisions ne compte que celles
    qu'on attend : une rangée balayée ne bloque plus la carte survolée.
  - Client : le délai propre de la demande (15 s) n'est plus une panne
    (`timeout`, redemandé 1,5 s plus tard au lieu de 10 s) ; une réponse
    arrivée déjà échue se redemande au lieu d'être ignorée ; après un
    défilement à la molette, la carte où la page s'arrête, sous un pointeur
    TENU immobile 1,2 s, lance son aperçu sans le petit mouvement qu'il
    fallait (`previewQuiet.ts`). Après une mini-carte refermée (Échap, fin),
    la voisine attend toujours un vrai mouvement. Vigie : délai de 15 s par
    une course (le pont de l'hôte ignore `signal`), même redemande.

**Surveiller** (`grep '\[trailers\] aperçu'`) :

- `aperçu tmdb:movie:438631|fr|r2 : gHt8tCHbB2M (hls, 1080) en 1387 ms (TMDB 177, extraction 1140, vérification 253), essai 1/3`
  — où passe le temps d'une décision ; `…, essai 2/3, langue de repli gardée
  10 min` : la meilleure langue a échoué (la ligne `aucun flux (…)` juste
  avant dit pourquoi) ;
- `mémoire des aperçus reprise : 12 décision(s), 9 source(s)` — au démarrage ;
- `aperçu jf:<id>|fr : aucune bande-annonce` — ou `(TMDB sans réponse)` ;
- `aperçu … : aucune lisible (3 candidate(s), … ms)` — yt-dlp les refuse ;
- `aperçu … : … reprise` — une décision dont le relais avait oublié la vidéo ;
- `YouTube demande une vérification anti-robot — aperçus suspendus 30 min`
  (ou `YouTube limite les demandes de ce serveur — …`), puis `YouTube répond de
  nouveau — aperçus repris` à la première extraction réussie ;
- `aperçus : 30 extractions dans l'heure — les suivantes attendent N min`.

### Instantané : les titres à l'écran préparés d'avance (15/10)

À l'essai, hors bibliothèque (Vigie, « À demander » de la recherche, saga),
l'aperçu mettait 2 à 4 s : tout se décidait AU SURVOL, en série — TMDB
(~0,3 s), PUIS la recherche AlloCiné chez Dailymotion (0,5 à 0,7 s par page,
deux pages au plus), PUIS la vidéo (yt-dlp 0,9 à 1,4 s à chaud ; Dailymotion
0,15 s de métadonnées et ses listes), PUIS la vérification (mesuré le 15/10
depuis le poste). Et la bibliothèque restait « presque un tout petit peu
lente » : révélation à 800 ms, puis 340 ms d'agrandissement sur une image
figée avant le premier mouvement.

- **Le serveur prépare les titres à l'écran** — `POST
  /api/trailers/preview/warm` (contrat `trailerPreviewWarm.ts`, recopié ;
  capacité `trailers.previewWarm`, 1.30.0). Le client dit ses titres
  visibles (40 au plus) ; le serveur prépare en fond, trois à la fois, les
  derniers vus d'abord (`preview/previewWarm.ts`) : le catalogue (TMDB par sa
  file de FOND, AlloCiné à la cadence de PRÉPARATION de Dailymotion), puis la
  PREMIÈRE vidéo du catalogue — résolue si c'est AlloCiné, préparée si c'est
  une vidéo YouTube que le relais tient déjà. **Jamais d'extraction YouTube
  en fond** (refusée d'office, `ExtractionOptions.background`) : une première
  vidéo à extraire attend le survol (« différé », dix minutes de repos),
  comme un catalogue dont une source n'a pas VRAIMENT répondu
  (`buildCatalogDetailed` → `answered`) ou une première vidéo qui ne se lit
  pas. La décision prise en fond est donc toujours celle que le survol aurait
  prise (`previewSteps.ts`, gestes partagés). La réponse rend tout de suite
  les aperçus DÉJÀ prêts — le corps même de `GET /preview` (`previewBody.ts`) ;
  un titre de la bibliothèque n'est rendu qu'à un compte qui le voit, et ne
  se décide jamais pour les autres depuis un compte qui ne le voit pas. Un
  seau par compte : dix demandes, puis une toutes les deux secondes. La
  demande garde l'ouvrier yt-dlp chaud pendant qu'on parcourt les titres.
- **Les priorités** : un GET TMDB de fond rattrapé par quelqu'un qui attend
  passe dans la file interactive (`tmdb/client.ts`, `promote`) ; la mémoire
  du catalogue relance en interactif une lecture de fond qu'on attend (30 s
  de patience en fond, 8 en interactif). Dailymotion a des seaux de
  préparation à part (API : trois d'avance puis une par seconde ; flux :
  trois puis deux par seconde), sans la pause de 30 s qui suit un appel
  attendu, et laisse aux appels attendus les 100 derniers du budget de
  l'heure — sa cadence ne dépense rien de plus, elle finit plus tôt : un
  écran de titres neufs se prépare en une demi-minute environ, ses premiers
  en deux ou trois secondes ; une recherche attendue ne rejoint jamais une
  recherche de préparation (refusée faute de place, elle ne lui rendrait
  rien). Dailymotion ne publie aucune limite de lecture : le budget de
  l'heure (300) reste la nôtre.
- **Le client** (`apps/web/src/trailerPreview/previewWarm.ts`) : UN
  observateur de visibilité pour toute l'app — les cartes inscrivent leur
  visuel par `useCardPreview`, aucun état React de plus. La page posée
  (450 ms), les titres visibles partent par lots de 40, les derniers apparus
  d'abord ; un titre deux fois au plus en dix minutes (la seconde 5 s plus
  tard, pour recevoir ce que le serveur a préparé entre-temps), jamais s'il a
  déjà son aperçu en cache. Les aperçus prêts entrent dans le cache des
  aperçus (`seedTrailerPreviews`, api-client) : le survol ne demande plus
  rien, la vidéo part à l'intention. Branché par la liaison racine
  (`usePreviewWarm`) si le serveur le déclare et que rien n'interdit les
  aperçus ; hls.js s'y charge d'avance, au premier temps mort. Vigie a son
  jumeau (`src/preview/warm.ts`, rangé dans `previewSource.seed`).
- **Plus tôt, et en mouvement** : la demande part à 200 ms (pointeur
  toujours arrêté depuis 100 ms), la mini-carte paraît à 600 ms, et la vidéo
  JOUE dès qu'elle paraît — plus d'image figée le temps de l'agrandissement :
  du survol au premier mouvement, ~0,6 s au lieu de ~1,15 s.
- **Le reste** : le seau des aperçus par compte passe à dix d'avance puis un
  toutes les 3 s (parcourir des titres neufs ne se heurte plus à « réessayez
  dans 5 s ») ; 160 vidéos complètes au relais au lieu de 96 (les aperçus
  préparés de quelques écrans) ; le titre lu au nom du compte, que chaque
  survol relit, gardé dix minutes au lieu de deux.

Mesuré le 15/10 (banc réseau : le VRAI Dailymotion, TMDB simulé à 250 ms par
appel, serveur français) : préparés en fond en 1,1 à 2,4 s (catalogue 0,8 à
2,1 s — la recherche AlloCiné surtout —, résolution Dailymotion 0,2 à 0,3 s,
vérification 9 à 36 ms), puis **le survol répond en 0 à 1 ms** ; le même
survol à froid, sans préparation : 2,4 s. Aucune extraction YouTube.

Ce qui reste lent : un titre dont la meilleure bande-annonce est sur YouTube
et que le relais ne tient pas — l'extraction (~1 à 1,4 s) a lieu au survol,
sous ses garde-fous. Pré-extraire les titres à l'écran ferait bloquer
l'adresse de la maison (« Ménager YouTube ») : écarté.

Surveiller : `aperçu tmdb:movie:603|fr|r5|dm : dm:x8e90ff (hls, 720) en 812 ms
(catalogue 640, extraction 150, vérification 22), préparé en fond` — une
décision prise en fond ; `…, préparé en fond (reprise)` — une décision
gardée dont la vidéo AlloCiné a été relue (après un redémarrage, ou son
échéance d'une heure).

## Aperçu au focus — Apple TV et Android TV (2026-10-14)

Le même aperçu que le bureau, sur les téléviseurs, avec la carte qui devient
GRANDE (façon Netflix) pendant qu'il se joue. Même contrat, même capacité
(`trailers.preview`), même machine (`reduceTrailerPreview`, shared) : seul le
déclencheur change — le FOCUS tenu d'une carte de rangée, pas le pointeur.

- **Le rythme** (tv-core `cards/trailerPreviewTv.ts`, `TV_TRAILER_PREVIEW_TIMING`) :
  la demande part après 1 s de focus tenu (pas de second délai d'immobilité :
  la télécommande ne tremble pas), la carte grandit au plus tôt à 1,8 s ET
  seulement avec la première image, se replie en 220 ms. Volume 0,7.
- **La grande carte** (`redesign/cards/CardPreviewTile.tsx`) : 16:9, au moins
  42 % de l'écran (tv-core `trailerPreviewTileSize`), jamais plus large que la
  zone de contenu. Elle grandit DANS la cellule de la carte : la rangée lui
  fait place (`CardShell` `expansion`), les voisines glissent, la rangée défile
  pour la montrer entière (`trailerPreviewScrollTarget`). Jamais un calque
  par-dessus les voisines : tvOS ne focaliserait plus une carte recouverte.
  Image du titre d'abord, la vidéo dessus, le logo (ou le titre) en bas sur un
  voile.
- **Le port** : la vue ne sait rien de la vidéo (`redesign/cards/trailerPreviewPort.tsx`) ;
  l'intégration (`redesignWiring/trailerPreview/`) fournit le crochet. Seule la
  carte FOCALISÉE monte une session (`PreviewSession` : la requête, la
  machine, la vidéo) — une rangée de vingt cartes n'en paie qu'une.
- **La vidéo** (`PreviewVideo`, react-native-video) : chargée cachée et en
  pause, lue au relais du serveur (HLS, départ à 4 s, ou MP4). AVPlayer sur
  Apple TV ; ExoPlayer en `TextureView` sur Android TV (seule à suivre
  l'opacité) — la surface vient de l'adaptateur
  (`platform/tvos/player/previewVideoSurface{,.android}.ts`). Faute d'avis de
  première image 1,5 s après le chargement, le chargement vaut prêt.
- **Mémoire de l'appareil** (tv-core `createTrailerPreviewMemory`) : une vidéo
  qui lâche n'est pas redemandée de sitôt ; la position est gardée 10 min (le
  retour sur la carte reprend où l'on en était). Un seul aperçu à la fois
  (l'arbitre partagé), rien en arrière-plan.
- **Réglages** (Réglages › Lecture, seulement face à `trailers.preview`) :
  « Aperçus au focus » et « Son des aperçus », réglages du TÉLÉVISEUR
  (`tentacle_tv_trailer_previews`, `tentacle_tv_trailer_preview_sound`), allumés.
- **TanStack Query v4 à l'exécution sur la TV** : `staleTime` en fonction et
  `gcTime` n'y existent pas — la requête d'aperçu passe un `staleTime`
  numérique et `cacheTime` (`useTrailerPreviewStream`).
- **Pas encore** : les cartes qui se redressent (`MorphCard`), les grilles, les
  cartes absentes (hors bibliothèque) ; une rangée en bas d'écran grandit vers
  le bas sans défilement vertical. Rien d'éprouvé sur un appareil depuis ce
  chantier (aucun simulateur dans l'environnement) : à vérifier au banc.

## Doublage par IA, délai choisi, télécommande (16/10)

### Jamais un doublage automatique

Relevé le 16/10 (yt-dlp 2026.08.19, client `visionos`) : une vidéo YouTube à
plusieurs pistes met dans son maître HLS UNE ligne `#EXT-X-MEDIA:TYPE=AUDIO`
par langue et par groupe, toutes `DEFAULT=NO,AUTOSELECT=YES`. Chaque piste se
dit trois fois : `YT-EXT-XTAGS` (protobuf en base64, paires `acont` /
`lang`), le NAME (« Français (France) - dubbed-auto ») et l'URI
(`xtags%3Dacont%3Ddubbed-auto:lang%3Dfr-FR`) ; les formats https le disent
dans `xtags=` de leur URL. `acont` : `original` (identifiant `.4`),
`dubbed` — un doublage HUMAIN (`.3`) —, `dubbed-auto` — la voix de synthèse
(`.10`) —, `descriptive`. AVPlayer, ExoPlayer, mpv et hls.js prenaient la
piste de la langue de l'appareil : la voix de synthèse sur un appareil en
français, et l'aperçu disait « VF » (TMDB étiquette `fr` ce qu'un
contributeur a entendu… doublé).

- **Le relais tranche** (`audioTracks.ts`, `hlsAudio.ts`) : une piste par
  groupe — un doublage humain dans la langue du serveur, sinon l'originale —,
  réécrite `DEFAULT=YES` ; doublages automatiques et audiodescription
  retirés, variantes muxées comprises ; jamais un MP4 dont l'URL dit
  `dubbed-auto`. Une vidéo à une seule piste (le cas courant) ne change pas.
- **La version dite est celle qu'on entend** (`playedTrailerVersion`,
  shared) : la piste jouée (`audio` de `ResolvedTrailer`, de `/resolve`, de la
  décision d'aperçu) corrige la version du catalogue. Une « VF » qu'on entend
  en anglais devient une VO ; l'aperçu essaie alors les candidates suivantes
  qui promettent mieux, et ne la garde qu'en réserve (dix minutes). Règles
  `r6` : les décisions d'avant ne servent plus.
- **Preuve réelle** (16/10, notre code de bout en bout, serveur en français) :
  `H_G8DRU5Sn4` (doublages automatiques, 19 langues) → seule « American English
  - original » servie ; `4ofJpOEXrZs` (doublages humains) → « Français -
  dubbed » servie. Fixtures : `audioTracks.fixtures.ts` (hôte et IP
  neutralisés).
- **Reste** : le lecteur OFFICIEL de YouTube (repli quand l'extraction est
  refusée, modale locale de Vigie hors hôte) choisit encore sa piste seul.

### Un délai, choisi par l'utilisateur

Du début du survol (ou du focus) à la PREMIÈRE IMAGE : le même partout, réglé
sur l'appareil, 800 ms par défaut (0,5 · 0,8 · 1,2 · 2 s) — shared
`previewDelay.ts`. La demande part AVANT le délai (web : 400 ms avant, jamais
sous 200 ms et un pointeur arrêté ; TV : 350 ms avant, jamais sous 300 ms de
focus tenu — 450 ms au délai par défaut), la révélation au délai ; une source lente paraît dès qu'elle est
prête. Vigie le reçoit par le pont (`trailerPreview.delayMs`, additif ; 600 ms
face à un hôte d'avant).

### La télécommande pendant l'aperçu (TV)

Lecture/Pause met vraiment l'aperçu en pause et le reprend (Lecture et Pause
séparées d'Android aussi) ; MAINTENUE, elle coupe ou remet le son de l'aperçu
seul — le réglage « Son des aperçus », retenu. Ni la Siri Remote (volume par
HDMI-CEC/IR) ni Android TV (sourdine et volume gardés par le système) ne
laissent la sourdine à l'app. Sur Android, react-native-tvos ne détecte pas le
maintien de Lecture/Pause : `createAndroidTvReader` le reconstruit (première
répétition ≈ 500 ms). En build DEBUG sur tvOS, ce maintien ouvre le menu de
développement (`RCTTVRemoteHandler`, `RCT_DEV`).

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
  bot », « try again later ») : passager, jamais retenu longtemps — mais réel :
  le 2026-10-14, une nuit de bancs (≥ 146 extractions) a suffi à faire
  vérifier l'adresse de la maison. Les aperçus se suspendent d'eux-mêmes
  (« Aperçu au survol », « Ménager YouTube ») ; une lecture de la TV reste
  tentée, et sa réussite les rend. La préparation dès la fiche multiplie un
  peu les extractions ; le cache de six heures et le partage des extractions
  les contiennent.
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
