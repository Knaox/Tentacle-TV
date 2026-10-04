import type { RemoteSignal, SignalPhase } from "../signals";
import { BASE_REMOTE_HINTS } from "./hints";
import type { NoiseBinding, PressBinding, RemoteBindings } from "./types";

/**
 * La télécommande d'Android TV, traduite — TOUT ce que react-native-tvos 0.80
 * livre à l'app sur Android, relevé dans
 * `ReactAndroid/.../modules/core/ReactAndroidHWInputDeviceHelper.java` (la
 * version qu'appelle `ReactRootView.dispatchKeyEvent`) et dans `BackHandler`.
 *
 * Télécommandes visées : celle de la NVIDIA Shield (2019 : croix, OK, Retour,
 * Accueil, Menu ≡, Lecture/Pause, Retour et Avance rapides, volume), celle des
 * Chromecast et boîtiers Google TV (croix, OK, Retour, Accueil, Assistant,
 * volume — ni Lecture/Pause ni Menu), et celles des téléviseurs Android
 * (souvent Lecture/Pause, chaînes, touches de couleur, chiffres). La manette
 * de la Shield aussi : A et B retombent sur OK et Retour (touches de repli
 * d'Android, `Generic.kcm`) quand l'app ne les prend pas — et elle ne les
 * prend pas.
 *
 * D'où viennent les signaux :
 * - `TVEventHandler` : le `KeyEvent` natif, nommé par la table de
 *   react-native-tvos (`KEY_EVENTS_ACTIONS`) ; son `eventKeyAction` vaut 0
 *   (ACTION_DOWN) ou 1 (ACTION_UP) ;
 * - `BackHandler` (`hardwareBackPress`) : Retour, que l'activité rend au
 *   relâchement — l'adaptateur le nomme `back` ;
 * - `Modal.onRequestClose` : Retour dans une modale (son propre `Dialog`).
 *
 * Phases, telles que react-native-tvos les livre — l'app allume
 * `ReactFeatureFlags.enableKeyDownEvents` (`MainApplication.kt`) : un appui
 * simple dit son ENFONCEMENT (0) puis son RELÂCHEMENT (1), et la table ne
 * compte que le relâchement (`on: ["up"]`), comme tvOS. Une touche de
 * transport tenue (Avance, Retour rapides…) redit son enfoncement à chaque
 * répétition d'Android : `createAndroidTvReader` les marque `repeat`, pour
 * qui veut suivre le maintien (le lecteur), sans intention de plus. OK et la
 * croix maintenus : Android répète l'enfoncement (première répétition à
 * `ViewConfiguration.getKeyRepeatTimeout()`, 500 ms sous Android 11, puis
 * toutes les 50 ms) ; react-native-tvos en tire UN `long…` à 0 (le seuil
 * passé, touche encore enfoncée), avale les répétitions, puis un `long…` à 1
 * au relâchement — et pas d'appui simple derrière. C'est le cycle annoncé de
 * tvOS (`hold` : `start` puis `end`), tandis que le moteur de focus natif
 * suit lui-même les répétitions de la croix : la croix MAINTENUE est le
 * défilement rapide d'Android TV, comme le glisser du pavé sur Apple TV.
 * Lecture/Pause, les touches de transport et les chaînes ne connaissent pas
 * le maintien : react-native-tvos ne le détecte que pour OK et la croix.
 *
 * Données seulement : la lecture de l'événement natif (`readAndroidTvEvent`)
 * est ici parce qu'elle est pure ; l'abonnement vit dans l'adaptateur
 * (`apps/tv/src/platform/androidtv/`).
 */

/** `eventKeyAction` → phase (−1 : un événement de focus, sans phase). */
export const ANDROIDTV_KEY_ACTIONS: Readonly<Record<number, SignalPhase>> = { 0: "down", 1: "up" };

/** La forme de `HWEvent` sur Android (react-native-tvos), sans l'importer. */
export interface AndroidTvNativeEvent {
  eventType: string;
  eventKeyAction?: number;
}

/** L'événement natif, lu en signal ; `at` : son arrivée dans le JS. */
export function readAndroidTvEvent(event: AndroidTvNativeEvent, at: number): RemoteSignal {
  const phase = event.eventKeyAction === undefined ? null : ANDROIDTV_KEY_ACTIONS[event.eventKeyAction] ?? null;
  return { name: event.eventType, phase, at };
}

/**
 * La lecture AVEC MÉMOIRE de l'adaptateur : un enfoncement d'une touche déjà
 * enfoncée (sans relâchement entre les deux) est une répétition d'Android, et
 * le signal le dit (`repeat`). Le natif ne transmet pas le compteur de
 * répétition : c'est la seule façon de le retrouver.
 */
export function createAndroidTvReader(): (event: AndroidTvNativeEvent, at: number) => RemoteSignal {
  const held = new Set<string>();
  return (event, at) => {
    const signal = readAndroidTvEvent(event, at);
    if (signal.phase === "up") held.delete(signal.name);
    if (signal.phase !== "down") return signal;
    if (held.has(signal.name)) return { ...signal, repeat: true };
    held.add(signal.name);
    return signal;
  };
}

/** Le nom que l'adaptateur donne à Retour (`BackHandler`, `Modal.onRequestClose`). */
export const ANDROIDTV_BACK_SIGNAL = "back";

const HANDLER = "TVEventHandler";
/** Un appui simple ne compte qu'au relâchement — seule phase livrée, mais
 *  dite : si `enableKeyDownEvents` s'allumait un jour, rien ne compterait double. */
const ON_RELEASE = ["up"] as const satisfies readonly SignalPhase[];

const press = (signal: string, intent: PressBinding["intent"], source: string): PressBinding => ({ signal, intent, on: ON_RELEASE, source });

const NO_USE = "aucune intention ne lui correspond dans l'app (Apple TV n'a pas la touche)";
const unused = (signal: string, reason = NO_USE): NoiseBinding => ({ signal, reason });
const NEVER_HELD = "jamais émis : react-native-tvos ne détecte le maintien que pour OK et la croix";

export const ANDROIDTV_BINDINGS: RemoteBindings = {
  platform: "androidtv",
  remote: "NVIDIA Shield (2019), Chromecast / Google TV, téléviseurs Android ; manette de la Shield (A, B)",
  presses: [
    press("up", { type: "move", direction: "haut" }, `${HANDLER} — DPAD_UP`),
    press("down", { type: "move", direction: "bas" }, `${HANDLER} — DPAD_DOWN`),
    press("left", { type: "move", direction: "gauche" }, `${HANDLER} — DPAD_LEFT`),
    press("right", { type: "move", direction: "droite" }, `${HANDLER} — DPAD_RIGHT`),
    press("select", { type: "select" }, `${HANDLER} — DPAD_CENTER, ENTER, NUMPAD_ENTER, BUTTON_SELECT, SPACE ; l'élément le reçoit aussi (onClick natif)`),
    press("playPause", { type: "playPause" }, `${HANDLER} — MEDIA_PLAY_PAUSE (Shield ; absente des télécommandes Google TV)`),
    press("play", { type: "transport", command: "lecture" }, `${HANDLER} — MEDIA_PLAY`),
    press("pause", { type: "transport", command: "pause" }, `${HANDLER} — MEDIA_PAUSE`),
    press("stop", { type: "transport", command: "arret" }, `${HANDLER} — MEDIA_STOP`),
    press("fastForward", { type: "transport", command: "avance" }, `${HANDLER} — MEDIA_FAST_FORWARD`),
    press("rewind", { type: "transport", command: "retour" }, `${HANDLER} — MEDIA_REWIND`),
    press("channelUp", { type: "page", direction: "haut" }, `${HANDLER} — CHANNEL_UP (téléviseurs, Google TV)`),
    press("channelDown", { type: "page", direction: "bas" }, `${HANDLER} — CHANNEL_DOWN`),
    press(ANDROIDTV_BACK_SIGNAL, { type: "retour" }, "BackHandler (hardwareBackPress), Modal.onRequestClose — BACK, manette B"),
  ],
  holds: [
    { signal: "longSelect", key: "select", source: `${HANDLER} — OK tenu au-delà de la première répétition (≈ 500 ms)` },
    { signal: "longUp", key: "haut", source: HANDLER },
    { signal: "longDown", key: "bas", source: HANDLER },
    { signal: "longLeft", key: "gauche", source: HANDLER },
    { signal: "longRight", key: "droite", source: HANDLER },
  ],
  swipes: [],
  drags: [],
  noise: [
    { signal: "focus", reason: "le focus arrive sur un élément : le magasin du focus le voit, clé par clé" },
    { signal: "blur", reason: "le focus quitte un élément : idem" },
    unused("menu", "Menu ≡ (Shield, certains téléviseurs) : Apple TV n'a pas de touche d'options — l'appui maintenu sur OK en tient lieu, comme sur Apple TV"),
    unused("next", "piste suivante : pas d'intention « épisode suivant » au vocabulaire (le lecteur l'offre à l'écran)"),
    unused("previous", "piste précédente : idem"),
    unused("info"), unused("captions"), unused("guide"), unused("record"), unused("bookmark"), unused("dvr"),
    unused("red"), unused("green"), unused("blue"), unused("yellow"), unused("teletext"), unused("window"),
    ...["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => unused(digit)),
    unused("tv", "touche TV : le système bascule sur l'entrée TV"),
    unused("tvInput", "le système choisit la source"),
    unused("avrInput", "l'amplificateur, pas l'app"),
    unused("avrPower", "l'amplificateur, pas l'app"),
    unused("stbInput", "le décodeur, pas l'app"),
    unused("stbPower", "le décodeur, pas l'app"),
    unused("longPlayPause", NEVER_HELD),
    unused("longRewind", NEVER_HELD),
    unused("longFastForward", NEVER_HELD),
    unused("longChannelUp", NEVER_HELD),
    unused("longChannelDown", NEVER_HELD),
  ],
  system: [
    { control: "Accueil, appui", effect: "l'écran d'accueil d'Android TV / Google TV" },
    { control: "Accueil, maintien", effect: "les applications récentes ou le panneau rapide (selon le système)" },
    { control: "Assistant / micro", effect: "l'Assistant Google ; la dictée passe par le module de reconnaissance de l'app" },
    { control: "Volume, sourdine, alimentation, entrée", effect: "le téléviseur ou le boîtier (HDMI-CEC ou infrarouge)" },
    { control: "Touches d'app (Netflix, YouTube…), bouton personnalisable de la Shield", effect: "le système lance l'app ou l'action réglée" },
    { control: "Retour, maintien", effect: "rien de plus qu'un appui (Android le rend au relâchement)" },
  ],
  traits: {
    focusMovesBeforeIntent: true,
    pressOnRelease: true,
    announcedHolds: true,
    holdThresholdMs: 500,
    backDecidedAhead: false,
    touchSurface: false,
    dragOnDemand: false,
    dragUnit: null,
    playPauseKey: "sometimes",
  },
  hints: {
    ...BASE_REMOTE_HINTS,
    // Sans Lecture/Pause (Google TV), la feuille garde son bouton « Demander »
    // au pied : cocher par OK, puis l'atteindre — l'indication dit les deux.
    seasonsShortcut: "requests:seasonsShortcutAndroid",
  },
};
