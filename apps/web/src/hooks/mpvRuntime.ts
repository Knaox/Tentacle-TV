import type { MpvObservableProperty } from "tauri-plugin-libmpv-api";
import { desktopPlatform, isDesktopApp, isElectronShell } from "../desktop/bridge";
import type { MpvTrack } from "./mpvTrackList";

/**
 * Runtime mpv partagé : détection de plateforme, singleton du plugin
 * (Windows/Linux : tauri-plugin-libmpv-api ; macOS : adaptateur render API),
 * porte de sérialisation init/destroy, options d'init et propriétés observées.
 * Extraction mécanique de useDesktopPlayer (limite 300 lignes/fichier).
 */

export interface MpvState {
  playing: boolean; position: number; duration: number;
  volume: number; muted: boolean; paused: boolean; eof: boolean;
  audioTrack: number; subtitleTrack: number; fullscreen: boolean;
  buffered: number; buffering: boolean; seeking: boolean; tracks: MpvTrack[];
}

export const defaultMpvState: MpvState = {
  playing: false, position: 0, duration: 0, volume: 100,
  muted: false, paused: true, eof: false, audioTrack: 1,
  subtitleTrack: 0, fullscreen: false, buffered: 0, buffering: false, seeking: false, tracks: [],
};

export interface PlayOptions {
  url: string;
  startPosition?: number;
  audioTrack?: number;
  subtitleTrack?: number;
}

/** Application de bureau, quel que soit le shell (Tauri ou Electron).
 *  La détection vit dans `desktop/detect.ts` : elle était dupliquée ici, ne
 *  connaissait que Tauri, et faisait basculer l'app Electron sur le lecteur web
 *  alors qu'elle a mpv. Les trois signaux Tauri y sont conservés à l'identique
 *  — sur certaines webviews Linux/webkit2gtk, `__TAURI_INTERNALS__` peut n'être
 *  pas encore visible au moment du routage (Watch.tsx). « Linux doit utiliser mpv. » */
export function isTauri(): boolean {
  return isDesktopApp();
}

/** Detect macOS — used to route to native HLS player (AVFoundation) instead of MPV.
 *  Uses navigator.platform with userAgent fallback (platform is deprecated). */
export function isMacOS(): boolean {
  if (typeof navigator === "undefined") return false;
  // Primary: navigator.platform (still reliable in WKWebView as of 2025)
  if (navigator.platform?.startsWith("Mac")) return true;
  // Fallback: userAgent check (in case platform is empty or changed in future WebKit)
  return /Macintosh|Mac OS X/i.test(navigator.userAgent);
}

/** Detect Windows — utilisé pour brancher l'updater MSIX sur le Microsoft Store. */
export function isWindows(): boolean {
  if (typeof navigator === "undefined") return false;
  if (navigator.platform?.startsWith("Win")) return true;
  return /Windows NT/i.test(navigator.userAgent);
}

/** Detect Linux (bureau hors macOS/Windows) — cible de l'auto-updater intégré
 *  universel (aucun store : AppImage/deb/rpm/pacman via GitHub Releases). */
export function isLinux(): boolean {
  return desktopPlatform() === "linux";
}

/** Build distribué via le Mac App Store (canal injecté à la compilation).
 *  → MAJ détectées via l'App Store (pas d'auto-update intégré).
 *  Défini dans `desktop/channel.ts`, sans dépendance : `desktop/capabilities.ts`
 *  en a besoin et ne peut pas importer ce fichier-ci sans créer un cycle. */
export { isAppStoreBuild } from "../desktop/channel";

// Lazy-loaded plugin API — only available in Tauri context
// On macOS & Linux: uses our custom mpv Render API adapter (mêmes commandes Rust
//   `mpv_*` + évènements `mpv://*`, deux adaptateurs identiques).
// On Windows: uses tauri-plugin-libmpv-api (embarquement `--wid`).
export type PluginApi = typeof import("tauri-plugin-libmpv-api");
let api: PluginApi | null = null;

export function getMpvApi(): PluginApi | null {
  return api;
}

export const loadMpvApi = async (): Promise<boolean> => {
  try {
    // Electron pilote libmpv depuis son processus principal, par koffi. Les
    // commandes et les évènements sont les mêmes que côté Rust : l'adaptateur
    // est donc le même, seul le nom du module dit lequel des deux répond.
    if (isElectronShell()) {
      api = await import("../lib/mpvElectronApi") as unknown as PluginApi;
      return true;
    }
    if (isMacOS()) {
      api = await import("../lib/mpvMacosApi") as unknown as PluginApi;
    } else if (isLinux()) {
      // Linux : Render API custom (GtkGLArea + GtkOverlay) — l'overlay HTML des
      // contrôles s'affiche au-dessus de la vidéo dans une seule fenêtre.
      api = await import("../lib/mpvLinuxApi") as unknown as PluginApi;
    } else {
      api = await import("tauri-plugin-libmpv-api");
    }
    return true;
  } catch {
    return false;
  }
};

// Serialization gate: init must wait for any pending destroy to complete.
// Prevents race condition when switching episodes (key={itemId} unmounts+remounts).
let pendingDestroy: Promise<void> = Promise.resolve();

export function setPendingDestroy(p: Promise<void>): void {
  pendingDestroy = p;
}

/** Awaits `pendingDestroy` mais ne bloque jamais plus de `timeoutMs`. Si destroy
 *  ne répond pas (Windows GL context lock, mpv freeze), on force le passage —
 *  un nouvel `api.init()` recréera l'instance proprement. */
export async function awaitPendingDestroy(timeoutMs: number): Promise<void> {
  await Promise.race([
    pendingDestroy,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/** Awaits une promesse avec timeout. Throw si le timeout expire. */
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}-timeout`)), ms)),
  ]);
}

export const OBSERVED_PROPERTIES = [
  ["pause", "flag"],
  ["time-pos", "double", "none"],
  ["duration", "double", "none"],
  ["volume", "double"],
  // Volume du flux AUDIO NATIF (PipeWire/Pulse sur Linux) — distinct du softvol
  // mpv ci-dessus. C'est LUI que l'utilisateur règle via l'OSD système ; comme
  // mpv recrée un flux à chaque média (remount), WirePlumber peut le remettre à
  // 100 % (clé de restauration liée au layout de canaux 5.1/stéréo). Persisté
  // et réappliqué par useMpvLifecycle sur Linux.
  ["ao-volume", "double", "none"],
  ["mute", "flag"],
  ["aid", "int64"],
  ["sid", "int64"],
  ["demuxer-cache-duration", "double", "none"],
  ["paused-for-cache", "flag"],
  // Seek en vol (far-seek HLS = plusieurs secondes) : lu par le transport
  // Watch Together (signal buffering + gel de la boucle de drift).
  ["seeking", "flag"],
  ["eof-reached", "flag"],
] as const satisfies readonly MpvObservableProperty[];

/** Options d'init mpv. `renderApi` = macOS/Linux SOUS TAURI (Render API custom :
 *  mpv dessine dans notre surface GL, aucune fenêtre native) ; sinon une fenêtre
 *  mpv existe — enfant `--wid` sous Windows, NSWindow attachée sous macOS,
 *  fenêtre calée sous la nôtre sous Linux/Electron. */
export function buildMpvInitOptions(renderApi: boolean): Record<string, string | number | boolean> {
  // Trois mondes, pas deux. Le durcissement ci-dessous vise la fenêtre ENFANT
  // Win32 et ses messages ; macOS n'a ni `window-dragging` ni `native-touch`,
  // et sa fenêtre est désarmée côté natif (`setIgnoresMouseEvents:`).
  const fenetreWin32 = !renderApi && isWindows();
  const fenetreMacos = !renderApi && isMacOS();
  const fenetreLinux = !renderApi && isLinux();

  return {
    vo: "gpu-next",
    hwdec: "auto-safe",
    "keep-open": "yes",
    // Render API (macOS/Linux) : mpv dessine dans notre FBO (vo=libmpv, forcé
    // côté Rust) — pas de fenêtre native, donc ni force-window ni durcissement
    // des entrées. Windows (--wid) : la fenêtre vidéo mpv est une fenêtre enfant
    // vivant sur son propre thread, dont la file d'entrée est attachée à celle
    // du thread UI. Toute boucle modale côté mpv gèle l'app entière (son et
    // image continuent, plus rien n'est cliquable). On lui retire donc tout
    // traitement d'entrée — l'UI est intégralement en HTML (DesktopPlayer).
    ...(fenetreWin32 && {
      "force-window": "yes",
      "window-dragging": "no",   // supprime SendMessage(WM_NCLBUTTONDOWN, HTCAPTION)
      "input-cursor": "no",      // supprime SetCapture() sur WM_LBUTTONDOWN
      "input-builtin-bindings": "no",
      "input-media-keys": "no",  // les touches média passent par SMTC (smtc.rs)
      "native-touch": "no",
      "cursor-autohide": "no",
    }),
    // ── macOS : les cinq lignes dont dépend tout le HDR ──────────────────────
    //
    // Établies en phase 1, chacune mesurée. Aucune n'est un réglage de confort.
    ...(fenetreMacos && {
      // ⚠️ `no`, et c'est TOUT le HDR qui en dépend — pas un réglage de confort.
      //
      // En `yes`, mpv ouvre sa fenêtre dès l'initialisation et y affiche son
      // écran d'attente : la couche Metal naît alors en **SRGB**
      // (`reconfig to 960x540 rgba rgb/bt.709/srgb`). Le compositeur de macOS
      // tranche à cet instant-là, lui refuse tout headroom, et **ne revient
      // jamais sur sa décision** quand la couche passe en PQ au chargement du
      // film. Le signal est parfait — `ITUR_2100_PQ`, `Metal layer HDR active`,
      // métadonnées de mastering, aucun tone-mapping — et l'image sort plate.
      //
      // Le défaut a été signalé par l'utilisateur, tous nos témoins au vert :
      // « au lancement, y'a clairement pas de HDR ». Ce qui l'a trahi : une
      // transition de fenêtre, dans un sens comme dans l'autre, recrée la couche
      // et force le compositeur à réévaluer — « la lumière fut ». Mesuré au
      // journal, headroom figé à 1,00 depuis l'attache, puis à la bascule :
      // 3,18 → 3,65 → 4,19 → 4,82 → 5,51.
      //
      // En `no`, la fenêtre n'est créée qu'au premier `loadfile`, donc
      // directement avec la vidéo : la couche naît en PQ, et le headroom est
      // accordé DÈS LA PREMIÈRE IMAGE, sans aucune transition. Mesuré : 5,51.
      //
      // Rien à combler pendant ce temps : l'écran de chargement du lecteur est
      // opaque et plein cadre (`PlayerLoadingScreen`), et la recherche de la
      // fenêtre côté natif sonde dix secondes (`macosSurface.ts`) — elle la
      // trouve au `loadfile` comme elle la trouvait à l'init.
      //
      // Windows garde `yes` : sa fenêtre vidéo est une fenêtre ENFANT créée par
      // `--wid`, et tout son durcissement d'entrées la suppose présente.
      "force-window": "no",
      // Vulkan est la SEULE API disponible sur macOS (`--gpu-api=help` ne liste
      // qu'elle) : libplacebo n'a pas de backend Metal, et le contexte OpenGL
      // cocoa a été retiré de mpv en 0.37. `macvk` traduit Vulkan vers Metal
      // par MoltenVK et crée une CAMetalLayer — la seule surface macOS capable
      // de plage étendue.
      "gpu-api": "vulkan",
      "gpu-context": "macvk",
      // ⚠️ LA ligne qui décide de tout, et elle ne peut PAS rester sur `auto`.
      //
      // En `auto`, mpv n'envoie le signal que s'il peut interroger l'espace
      // colorimétrique de l'écran — ce que le swapchain Vulkan de libplacebo
      // n'implémente pas. Le drapeau retombe donc à « non » et la couche Metal
      // reste en sRGB. Mesuré, les deux cas côte à côte :
      //
      //   auto → « Metal layer colorspace changed: SRGB »       (pas de HDR)
      //   yes  → « colorspace changed: ITUR_2100_PQ » + « HDR active »
      //
      // Le piège est qu'en `auto` mpv annonce quand même une sortie `pq` dans
      // ses propriétés : c'est le gamma qu'il CALCULE, pas ce qu'il POSE sur
      // l'écran. S'y fier ferait conclure à tort que le HDR passe.
      "target-colorspace-hint": "yes",
      // Zéro-copie jusqu'à Vulkan par `VK_EXT_metal_objects`, 10 bits compris.
      hwdec: "videotoolbox",
      // La fenêtre est attachée sous la nôtre : ni cadre, ni ombre, ni titre.
      border: "no",
      // ⚠️ `border=no` ne suffit pas, et les deux options ne font PAS la même
      // chose : côté mpv, `border` se contente de MASQUER la barre de titre
      // (`didSet { if !border { common.titleBar?.hide() } }`), en laissant
      // `NSWindowStyleMaskTitled` posé. macOS dessine alors sa bordure claire sur
      // le bord supérieur de la fenêtre — un liseré gris neutre de un point,
      // mesuré à (50, 50, 50) sur toute la largeur, que notre page transparente
      // laisse voir en plein écran. `title-bar=no` s'attaque à la barre
      // elle-même, par le chemin que mpv prévoit pour cela.
      "title-bar": "no",
      // ⚠️ Sans cela, mpv REDIMENSIONNE sa fenêtre à la taille de chaque
      // nouveau fichier et la recentre. Aucun évènement d'Electron n'accompagne
      // ce changement, donc notre calage n'est pas rejoué et la vidéo se
      // retrouve décalée dans un rectangle plus petit. Constaté au changement
      // d'épisode — et le lecteur est remonté à CHAQUE épisode (`key={itemId}`).
      "auto-window-resize": "no",
      "input-cursor": "no",
      "input-media-keys": "no",
      "cursor-autohide": "no",
    }),
    // ── Linux : la fenêtre de mpv, telle que la coquille l'attend ────────────
    //
    // ⚠️ Ce bloc ne contient PAS le HDR. `gpu-api`, `gpu-context`,
    // `target-colorspace-hint` et `fullscreen` dépendent de la SESSION — Wayland
    // ou X11 — que la page ne connaît pas : elle ne voit qu'un `linux`. Le
    // processus principal les pose après, voir `linux/optionsMpv.ts`.
    //
    // Ce qui reste ici est ce qui ne dépend que du montage « fenêtre » :
    ...(fenetreLinux && {
      // Même raison que sur macOS : la fenêtre naît AVEC la vidéo, donc avec son
      // espace colorimétrique. En `yes`, mpv ouvrirait d'abord une fenêtre vide,
      // et sur Wayland elle serait plein écran — un rectangle noir installé sur
      // toute la sortie avant même que le film ne commence.
      "force-window": "no",
      // La fenêtre est calée sous la nôtre : ni cadre, ni titre.
      border: "no",
      // ⚠️ Sans cela, mpv REDIMENSIONNE sa fenêtre à la taille de chaque nouveau
      // fichier. Aucun évènement d'Electron n'accompagne ce changement, donc le
      // calage n'est pas rejoué — et le lecteur est remonté à CHAQUE épisode.
      "auto-window-resize": "no",
      // La fenêtre ne traite aucune entrée : l'interface est intégralement en
      // HTML, et c'est notre fenêtre qui la reçoit.
      "input-cursor": "no",
      "input-builtin-bindings": "no",
      "input-media-keys": "no",
      "cursor-autohide": "no",
    }),
    // Use keyframe seeking by default (hr-seek breaks HLS segment boundaries)
    "hr-seek": "default",
    cache: "yes",
    // ⚠️ C'est un PLAFOND EN OCTETS, et c'est lui qui bornait la réserve sur
    // les gros contenus — pas le débit. `demuxer-readahead-secs` vise 30 s,
    // mais 150 MiB ne représentent que ~12 s d'un 4K à 100 Mb/s, et ~9 s d'un
    // remux UHD à 128 Mb/s : la barre de chargement restait courte et la
    // réserve mince, là précisément où la moindre irrégularité coûte cher. Un
    // film léger (15 Mb/s), lui, atteignait ses 30 s sans jamais approcher le
    // plafond — d'où un défaut qui ne se voyait QUE sur les contenus lourds.
    //
    // 512 MiB tient les 30 s visées jusqu'à ~140 Mb/s. C'est un plafond, pas
    // une réservation : mpv n'alloue que ce qu'il garde, donc une lecture
    // légère continue de tenir dans quelques dizaines de mégaoctets.
    "demuxer-max-bytes": "512MiB",
    "demuxer-max-back-bytes": "75MiB",
    // Ce que mpv exige d'avoir en réserve pour (re)partir. Il sert deux fois :
    // c'est le seuil du remplissage initial (via `cache-pause-initial`, plus
    // bas) ET celui de la reprise après une coupure. Une marge, pas une
    // attente : à 3 s, la moindre irrégularité du débit repassait sous le
    // seuil et rendormait la lecture aussitôt repartie ; au-delà de 5 s, c'est
    // le chargement lui-même qui devient long. Le remplissage, lui, continue
    // jusqu'à `demuxer-readahead-secs` — on ne l'attend pas pour lancer l'image.
    //
    // Le coût de cette réserve n'est PAS de quinze secondes : c'est
    // `15 × bitrate ÷ débit`. Sur un film léger servi par un réseau local, elle
    // est remplie en une fraction de seconde et ne se voit pas ; c'est sur les
    // gros contenus qu'elle se paie, et c'est là qu'elle sert.
    //
    // Quinze et non huit parce que c'est le choix assumé : le chargement déjà
    // à l'écran s'allonge un peu, et la lecture ne s'interrompt plus derrière.
    // Le code de mpv le confirme (`handle_update_cache`, v0.40) : avant
    // `restart_complete`, l'attente est exactement `ts_info.duration <
    // cache_pause_wait` ; après, mpv exige un vrai assèchement des deux bouts
    // (`demux_underrun && output_underrun`) pour s'interrompre — cette valeur
    // ne rend donc pas les coupures en cours de lecture plus fréquentes.
    "cache-pause-wait": 15,
    // ⚠️ mpv se REMPLIT avant de lancer l'image, au lieu de démarrer dès qu'il
    // en a une. C'est le défaut que son propre manuel décrit à cette option :
    //
    //   « some common behavior is that playback starts, but network caches
    //     immediately underrun when trying to decode more data as playback
    //     progresses »
    //
    // Mot pour mot ce qui était constaté — un chargement, l'image, puis un
    // second chargement quelques instants après. Deux fausses pistes avant
    // celle-ci (un seek de réveil, un changement de piste redondant) : le
    // défaut n'était pas dans ce qu'on faisait EN PLUS, mais dans ce que mpv
    // fait par défaut.
    //
    // Le temps total ne change pas. L'attente de `cache-pause-wait` est déjà
    // subie aujourd'hui — après l'image, en pleine coupure ; elle passe avant,
    // dans le chargement qui est déjà à l'écran. Sur un fichier local, le cache
    // se remplit aussitôt et l'attente est nulle.
    //
    // ⚠️ À déclarer AUSSI dans `OPTIONS_INIT` (`mpvAllowlist.ts`) : la coquille
    // Electron écarte en silence toute option qu'elle ne connaît pas.
    "cache-pause-initial": "yes",
    "demuxer-readahead-secs": 30,
    // HLS/network resilience. `reconnect_max_retries` BORNE la boucle de
    // reconnexion ffmpeg : sans elle, un flux invalidé côté serveur (403/404
    // après fin de session Jellyfin) était réessayé À L'INFINI — le teardown
    // de l'instance mpv ne finissait jamais (threads select()/join du dump
    // freeze-probe du 15.07.2026) et l'audio zombie persistait. Option
    // inconnue du libmpv embarqué = simple warning mpv, jamais fatal.
    "network-timeout": 30,
    "stream-lavf-o": "reconnect=1,reconnect_streamed=1,reconnect_on_network_error=1,reconnect_on_http_error=4xx\\,5xx,reconnect_delay_max=5,reconnect_max_retries=8",
    "demuxer-lavf-o": "probesize=10000000,analyzeduration=10000000",
    osc: "no",
    "input-default-bindings": "no",
    "input-vo-keyboard": "no",
    "force-media-title": "Tentacle TV",
    "audio-client-name": "Tentacle TV",
    title: "Tentacle TV",
    // Diagnostic : `localStorage.tentacle_mpv_log = "1"` écrit un log
    // mpv verbeux (le plugin forwarde ces options verbatim à mpv) —
    // indispensable pour débugger un flux HLS qui ne démarre pas.
    ...(typeof localStorage !== "undefined" && localStorage.getItem("tentacle_mpv_log") === "1" ? {
      "log-file": isWindows() ? "C:\\tmp\\tentacle-mpv.log" : "/tmp/tentacle-mpv.log",
      "msg-level": "all=v",
    } : {}),
  };
}
