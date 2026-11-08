# Étude (pont) — le contrat entre le front de Tentacle et sa coquille de bureau

Lu en lecture seule : Tentacle-TV `dev` (desktop 1.42.0, serveur 1.40.0 ; `apps/desktop-electron`,
`apps/web`), et la référence `~/.cache/tentacle-cef/ref/jellium-desktop` aux ères C++ (`3462549`)
et Rust (`main` 1b73a13). Chemins Tentacle relatifs à `apps/`.

## 1. Comment le front détecte la coquille

**Un seul signal : `typeof window.tentacle === "object"` au chargement du module**
(`web/src/desktop/detect.ts`). Aucun drapeau de build, aucun user agent. Le résultat est FIGÉ au
démarrage (« une détection paresseuse ouvrait la porte aux courses de WebKitGTK »). Conséquence
pour nous : `window.tentacle` doit exister **avant le premier script de la page** — exactement ce que
fait le preload Electron, et ce que donne `registerInjectedScript` du socle (`OnContextCreated`).

`window.tentacle` présent ⇒ le front se comporte en « bureau » partout (`isDesktopApp()`) :
- **adresse du serveur** : `localStorage.tentacle_server_url` (`lib/backendBase.ts`, `App.tsx` :
  sans elle, écran « adresse du serveur » avant tout) ; le web, lui, reste relatif ;
- authentification par **jeton** (`tentacle_token`), pas par cookie httpOnly (`main.tsx` :
  `useCredentials` seulement hors bureau) ; client Jellyfin annoncé « Tentacle TV - Desktop » ;
- requêtes à 12 s (bascule hors ligne), `deviceName = "Desktop"`.

Interface attendue (`desktop/types.ts`, `ElectronBridge`) — forme exposée par
`desktop-electron/src/preload/index.ts` :

| membre | rôle | absent / vide → |
|---|---|---|
| `invoke(cmd, args?) → Promise` | commande native ; rejette si canal non autorisé | — (obligatoire) |
| `on(event, cb) → unlisten` | évènement natif, charge **nue** (`bridge.ts` la ré-enveloppe en `{payload}`) | — (obligatoire) |
| `version` | version du bundle (À propos, mises à jour) | constante de build |
| `platform` | `"darwin"`/`"linux"`/`"win32"` | — (obligatoire) |
| `capabilities: string[]` | **commandes réellement branchées** | section d'UI masquée, sans erreur |
| `titleBarHeight` | bandeau que la page dessine (macOS sans barre de titre) | 0 |
| `montage`, `fenetrage` | Linux seulement | absents ailleurs |
| `liquidGlass`, `windowFocus` | macOS 26 verre natif / focus réel | absents : pas d'option verre, `document.hasFocus()` |
| `openExternal`, `pickFolder`, `relaunch` | navigateur système, dossier, relance | appelés seulement sur geste |

**Le mécanisme clé : `capabilities`.** Toute fonctionnalité native est gardée par
`hasNativeCommand(nom)` (`desktop/capabilities.ts`) : `supportsMpv()` ⇔ `"mpv_init"` présent ;
sinon `pages/Watch.tsx` route vers le lecteur WEB (hls.js). Idem téléchargements
(`downloads_list`), hors ligne (`session_cache_get`), musique native (`audio_play`), PiP
(`pip_open`), SMTC, mises à jour, relais Jellyfin. **Pourquoi c'est notre levier** : on peut
n'annoncer QUE ce qu'on implémente ; le front cache le reste proprement, sans erreur.

## 2. Canaux — inventaire précis

Liste fermée côté Electron : `desktop-electron/src/main/channels.ts` (89 commandes, 10 évènements).
Le preload préfixe tout par `tentacle:` (`ipcRenderer.invoke("tentacle:"+cmd, args ?? {})`).

### 2.1 Le lecteur vidéo (indispensables pour lire dans mpv)

Adaptateur unique `web/src/lib/mpvElectronApi.ts`, piloté par `hooks/useMpvLifecycle.ts`,
`useMpvCommands.ts`, `mpvTrackList.ts`, `mpvRuntime.ts`.

| canal | charge → réponse | usage |
|---|---|---|
| `mpv_init` | `{options:{initialOptions:{…}, observedProperties:[[nom, format, …]]}}` → `"ok"` | timeout page 8 s ; l'OBSERVATION est posée côté natif à partir de la liste |
| `mpv_command` | `{name, args:[scalaires]}` → `void` (rejette `"<name> : <err>"`) | `loadfile url replace …`, `seek <s> absolute\|relative`, `cycle pause`, `set aid <n>`, `set sid <n>\|no`, `sub-add <url> select\|auto`, `stop` |
| `mpv_set_property` | `{name, value}` → `void` | `pause`, `volume`, `mute`, `speed`, `sub-visibility`, `ao-volume` (Linux) |
| `mpv_get_property` | `{name, format}` → valeur typée ou `null` | `track-list/count`, `track-list/N/{id,type,lang,title,codec,selected,forced,default,external}` (9 lectures par piste, 300 ms après `file-loaded`), `pause` après `playback-restart`, `sid` après `sub-add`, `duration`, `demuxer-cache-state` |
| `mpv_destroy` | `{}` → `void` | démontage du lecteur (fin, retour, changement d'épisode) ; le `mpv_init` suivant attend ≤ 3 s |
| `mpv_harden_child_window` | `{}` → bool | Windows ; appelé après init, réponse ignorée |
| `player_surface_transparent` | `{on}` | **hors macOS** seulement (`useMpvLifecycle`) |
| `toggle_fullscreen` | `{}` → **nouvel** état bool | bouton plein écran, touche F |
| `player_fullscreen_enter` | `{}` → état COURANT (ne bascule pas : ouvre la « session » du film) | montage du lecteur |
| `player_fullscreen_leave` | `{}` | sortie du lecteur (rend la fenêtre comme avant sous Windows/Linux) |
| `prevent_display_sleep_start/stop` | `{}` | pendant la lecture |

Évènements :
- `mpv://property-change` : `{name, data, id, at}` — `data` décodé selon le format (flag→bool,
  int64/double→nombre, string) ; `at` = `Date.now()` à la lecture dans la file mpv (la page
  extrapole `time-pos`, étranglé à 8 Hz côté Electron).
  Propriétés observées (`OBSERVED_PROPERTIES`) : `pause`, `time-pos`, `audio-pts`, `duration`,
  `volume`, `ao-volume`, `mute`, `aid`, `sid`, `demuxer-cache-duration`, `paused-for-cache`,
  `seeking`, `eof-reached`, `hwdec-current`.
- `mpv://event` : `{event, …}` — noms de libmpv : `start-file`, `file-loaded`,
  `playback-restart` (première image ET fin de chaque seek : la page les COMPTE),
  `video-reconfig`, `idle`, `shutdown`, `end-file` avec **`reason` et `error` NUMÉRIQUES**
  (`mpv_end_file_reason` : EOF 0, STOP 2, QUIT 3, ERROR 4, REDIRECT 5 — `lib/mpvTypes.ts`).
  `end-file` ERROR pendant le chargement ⇒ repli (`onEndFileFailure`) ; EOF ⇒ fin / épisode suivant.
- `window://fullscreen` : bool, à CHAQUE changement (y compris hors appli : bouton vert…).

Options d'init envoyées par la page (`buildMpvInitOptions`, branche macOS) : `vo=gpu-next`,
`hwdec`, `keep-open=yes`, `force-window=no`, `gpu-api=vulkan`, `gpu-context=macvk`,
`target-colorspace-hint=yes`, `border=no`, `title-bar=no`, `auto-window-resize=no`, entrées
coupées, cache (`demuxer-max-bytes=512MiB`, `cache-pause-wait=15`, `cache-pause-initial=yes`…),
`stream-lavf-o` (reconnexion bornée), `osc=no`, `osd-level=0`, titres. **Ce qui change chez nous** :
tout ce qui touche à la FENÊTRE et à la sortie (`vo`, `gpu-api`, `gpu-context`, `force-window`,
`border`, `title-bar`, `wid`…) appartient au `Player` de vidéo-HDR (mpv dessine dans NOTRE
`CAMetalLayer`, contexte `moltenvk` + `wid`, voir `docs/etude/video-hdr-macos.md`) : le pont les
**écarte** ; le reste (cache, réseau, hwdec, OSD coupé) passe, filtré par une liste blanche comme
Electron (`main/video/mpvAllowlist.ts` : une option inconnue y est écartée en silence ; une
commande hors liste — `run`, `subprocess`, `load-script` — refusée).

Piège mesuré par Tentacle (`main/video/mpvState.ts`) : `mpv_get_property` **synchrone** depuis le
fil principal gèle macOS (mpv attend le fil principal pour sa sortie vidéo) — au démarrage ET en
fin de fichier. Electron sert donc `get` depuis le souvenir des propriétés observées, ou en
asynchrone. Même règle chez la référence (`AGENTS.md` : jamais d'API mpv synchrone depuis un
rappel). Le pont n'appelle donc QUE `mpv_get_property_async` (ou le cache) — demande faite à
vidéo-HDR.

### 2.2 Nécessaires au démarrage

**Aucun.** Au chargement, seuls `invoke("app_link_take")` (rejet avalé : « une coquille d'avant
n'a pas la commande ») et `listen("app-link")` partent sans garde ; tout le reste est derrière
`capabilities` ou un geste. Un canal non annoncé doit simplement **rejeter** (comme Electron :
`canal refuse`). Mais `window.tentacle` présent ⇒ le front exige `tentacle_server_url` : le shim
la pose (voir § 4).

### 2.3 Peuvent rester absents sans erreur

Verre natif (`liquidGlass`), `windowFocus`, PiP (`pip_*`), téléchargements et hors ligne
(`downloads_*`, `session_cache_*`, `avatar_cache_*`), mises à jour (`check_msix_update`,
`detect_linux_install_format`…), SMTC (`smtc_*`), préchauffage (`mpv_prewarm`, `media_warm`),
HDR d'écran Windows (`display_hdr_*`), sondes (`video_surface_probe`, `video_edr_probe` —
macOS dev seulement), session Linux, requêtes déléguées (`client_fetch_*`), greffons
(`plugin_document_set`), **relais Jellyfin** (`jellyfin_session_post`, `jellyfin_playback_info`,
`jellyfin_kill_encodings`, voir § 3). Musique native (`audio_*`, `audio://event`) : axe octave.

## 3. Comment la coquille charge le front, et ce que ça change

Electron sert le build web embarqué sous un schéma privilégié **`tentacle://app/`**
(`main/appProtocol.ts`, `standard+secure+corsEnabled`) ; l'utilisateur saisit l'adresse du serveur
(`tentacle_server_url`), toutes les API partent alors en cross-origin vers ce serveur. Conséquences
qu'Electron a dû compenser :
- **CORS** : aucun Jellyfin n'autorise l'origine `tentacle://app` ; or le lecteur appelle Jellyfin
  EN DIRECT (`PlaybackInfo` sous le jeton utilisateur, télémétrie `Sessions/Playing*` — le proxy
  `/api/jellyfin` substitue la clé admin et perd la position de reprise). D'où les trois relais
  `jellyfin_*` exécutés par le processus principal (`desktop/sessionPost.ts`, `playerRelay.ts`).
- **cookies** : inutilisables cross-origin ⇒ jeton en `localStorage`.
- **stockage** : rangé par origine (`tentacle://app`), d'où la migration Tauri → Electron.

**Notre choix : charger le front DEPUIS l'URL du serveur** (`http://127.0.0.1:3471/` sur le banc),
comme la référence charge jellyfin-web depuis le serveur Jellyfin. Pourquoi :
1. le front et l'API sont même origine : plus de CORS vers Tentacle ;
2. Tentacle ajoute l'origine web aux `CorsHosts` de Jellyfin à la fin de l'assistant
   (`setup/routes/completeRoute.ts`, jamais `tentacle://`) et Jellyfin répond `*` par défaut
   (mesuré sur le banc : préflight `OPTIONS /Sessions/Playing` → 204, `Allow-Origin: *`) : la voie
   directe marche depuis la page, **les relais `jellyfin_*` deviennent inutiles** — on ne les
   annonce pas, le front fait son `fetch` comme sur le web ;
3. le front suit la version du serveur (pas de build web à embarquer ni à tenir à jour) ;
4. rien à reconstruire de Tentacle : le banc sert l'image publiée.
Le revers : le front servi est celui du serveur (1.42.0 ici), pas celui du dépôt `dev` ; et le
stockage est rangé sous l'origine du serveur (un changement de serveur = un autre stockage).

## 4. La référence : comment elle remplace la lecture du navigateur

**Ère C++** (`3462549`, `src/cef/cef_app.cpp`) : JS embarqué (`src/web/native-shim.js`,
`mpv-player-core.js`, `mpv-video-player.js`…) transformé en tableaux d'octets
(`cmake/embed_all_resources.cmake`). Dans le **renderer**, `OnContextCreated` crée
`window.jmpNative` (fonctions V8 `CefV8Value::CreateFunction` + un `NativeV8Handler`), puis
`ExecuteJavaScript` des scripts, après substitution de `__SERVER_URL__`/`__SETTINGS_JSON__`. JS →
natif : chaque fonction V8 envoie un `CefProcessMessage` du même nom (`playerLoad`, `playerSeek`…)
au processus navigateur (`Client::OnProcessMessageReceived`) — ni `CefMessageRouter` ni
extension. Natif → JS : `executeJS("window._nativeEmit('playing')")` par concaténation de chaînes.
Le shim réimplémente l'API du vieux client Qt (`window.api.player`, signaux, `NativeShell`,
`getPlugins() → mpvVideoPlayer…`) que **jellyfin-web sait déjà consommer** — aucune modification
du front. Défauts : injecté dans TOUS les contextes (iframes, overlay) ; chaînes non échappées.

**Ère Rust** (`src/jfn_cef`, `src/web`, `src/playback`) : même principe, durci —
- profil d'injection PAR NAVIGATEUR (`extra_info` de `CreateBrowser`, `injection.rs`) et **frame
  principale seulement** (`fd97f8c` : « must not pollute iframes ») ;
- listes fermées (enums) des fonctions natives et des scripts ; un nom inconnu est ignoré ;
- natif → JS sérialisé par serde + échappement U+2028/2029 (`95bc630`), livré sur le fil UI de CEF ;
- mpv fait autorité (position, pause, seek viennent des observations ; jamais d'aller-retour JS) ;
- sélecteur de serveur natif, sonde par `CefURLRequest` (mêmes proxy/TLS que la page) ;
- `background_color = 0` + conteneur vidéo transparent : la page se compose sur la vidéo.
Aucun filtrage par ORIGINE : toute page de la frame principale reçoit `jmpNative`.

## 5. Ce que le pont retient, et pourquoi

| choix | pourquoi |
|---|---|
| Recréer `window.tentacle` à l'identique (`invoke`/`on`/`capabilities`…), pas l'API `NativeShell` | c'est le contrat que le front de Tentacle consomme déjà ; zéro modification du front (même logique que jellium avec jellyfin-web) |
| Script injecté par `registerInjectedScript` (socle) avant la page, frame principale | la détection est figée au chargement ; iframes (greffons) jamais exposées — leçon `fd97f8c` |
| Shim générique : `invoke(c)` → `__shell.invoke("tentacle:"+c)` si `c ∈ capabilities`, sinon rejet `canal refuse` | une liste fermée côté natif comme `channels.ts` ; les modules (pont, octave) déclarent leurs commandes, le shim n'a rien à savoir |
| `capabilities` = ce qui est RÉELLEMENT branché, injecté en JSON au démarrage | le front masque le reste sans erreur ; pas d'IPC synchrone |
| Exposé seulement sur l'origine du serveur configuré | Electron n'expose qu'à `tentacle://app` ; la référence n'a pas ce garde, on l'ajoute (une redirection vers un site tiers ne doit pas piloter mpv) |
| Le shim pose `tentacle_server_url = origin` s'il manque, avant la page | front chargé du serveur ⇒ même origine ; c'est le geste du preload (`restoreLocalStorage`) ; évite l'écran « adresse du serveur » |
| Pas de relais `jellyfin_*` | même origine + CORS `*` de Jellyfin : la voie directe marche ; moins de surface native |
| Options mpv : liste blanche ; options de fenêtre/sortie écartées | la sortie (couche Metal, PQ, EDR) est à vidéo-HDR ; la page ne doit pas pouvoir casser le HDR ni lancer `run`/`subprocess` |
| `mpv_get_property` servi en asynchrone (ou par le cache observé) | gel mesuré par Tentacle et règle `AGENTS.md` de la référence |
| Charges JSON construites par la bibliothèque JSON, jamais à la main | leçon `95bc630` (injection par chaîne non échappée) |
| Plein écran : `toggle_fullscreen` rend le nouvel état, `player_fullscreen_enter` l'état courant, `window://fullscreen` à chaque changement | sémantique exacte de `ipc/shell.ts` + `playerFullscreenSession.ts` ; sinon icône et Échap désaccordés |
| `platform: "darwin"`, `titleBarHeight` fourni par le socle | la page dessine le bandeau si la fenêtre n'a pas de barre de titre |
