/**
 * Le QML de la colle KWin — extrait de `kwinGlue.ts`, qui en dit le pourquoi
 * (moteur déclaratif, dossier neuf, types qualifiés, gestionnaires morts).
 * Ici, ce que la colle SUIT, geste par geste. Le QML s'assemble de fragments
 * (`glueQml/`) : ce que la vidéo tient de l'hôte (`followQml.ts`), la fenêtre
 * PiP (`pipQml.ts`) et ses gestes (`pipGestureQml.ts`), l'adoption des
 * fenêtres et le lâcher (`adoptionQml.ts`). Ses identifiants sont en
 * anglais depuis le 09.10.2026 — les relevés plus anciens de
 * docs/LINUX-FENETRE-VIDEO.md disent `racine`, `hote`, `coller`,
 * `reprendreActivation`, `prendre`, `lacher` pour `root`, `host`, `glue`,
 * `reclaimActivation`, `take`, `release`.
 *
 * # La réduction — la colle l'annulait elle-même (23.09.2026)
 *
 * Symptôme rapporté : « quand je réduis la fenêtre avec mpv démarré, la
 * fenêtre mpv ne suit pas, et tout bugue ». Lu dans les sources de KWin 6.7 :
 * `Window::setMinimized` passe `m_minimized` à vrai, puis `doMinimize()` rend
 * le focus à la fenêtre suivante de la chaîne — mpv, juste dessous. La colle
 * voyait mpv actif et rendait aussitôt l'activation à l'hôte… or
 * `Workspace::activateWindow` DÉ-RÉDUIT la fenêtre qu'il active
 * (`activation.cpp`, `if (window->isMinimized()) window->setMinimized(false)`).
 * La réduction s'annulait dans son propre élan, et `minimizedChanged` partait
 * avec un hôte déjà restauré : mpv ne se réduisait jamais.
 *
 * D'où : on ne rend JAMAIS l'activation à un hôte réduit — on réduit la vidéo
 * avec lui, d'un tour de boucle plus tard (hors de la pile d'activation de
 * KWin), et c'est alors la vraie fenêtre suivante qui reçoit le focus. Dans
 * l'autre sens, une vidéo rendue à l'écran (Alt+Tab la montre pendant la
 * lecture, voir plus bas) ramène l'hôte avec elle.
 *
 * # Alt+Tab — la vignette est celle d'UNE fenêtre
 *
 * `WindowThumbnailItem` ne rend que le `windowItem()` de la fenêtre désignée
 * (`scripting/windowthumbnailitem.cpp`) : la vignette de notre fenêtre montre
 * l'interface, transparente là où la vidéo se trouve — qui vit dans une AUTRE
 * fenêtre. Pendant la lecture, c'est donc la fenêtre vidéo qui représente
 * l'application dans le sélecteur (`skipSwitcher` échangé) : sa vignette
 * montre l'image, et la choisir rend la main à l'hôte (`reclaimActivation`).
 * Hors lecture — mpv garé, titre vide (`ipc/videoLifecycle.ts`) — l'hôte
 * reprend sa place : la vignette montrerait sinon une image noire.
 *
 * Le titre et l'icône de cette entrée sont ceux de l'application : mpv porte
 * le titre de notre fenêtre, et un app-id qui désigne un `.desktop` à notre
 * icône (`videoWindowIdentity.ts`). C'est aussi par cet app-id — reçu ici
 * comme `__VIDEO_CLASS__` — que la colle reconnaît la fenêtre vidéo.
 *
 * # Bureaux virtuels, activités, couches
 *
 * Même famille de défaut que la réduction : la vidéo restait sur le bureau où
 * elle était née quand on envoyait la fenêtre ailleurs, et un hôte « toujours
 * au-dessus » (ou en dessous) laissait d'autres fenêtres s'intercaler entre
 * lui et la vidéo — visibles à travers sa transparence.
 *
 * # Le plein écran, partagé avec la vidéo (09.10.2026)
 *
 * Symptôme rapporté : « en plein écran, dès que je clique sur une autre
 * fenêtre, la barre des tâches et les notifications passent par-dessus la
 * vidéo ». KWin garde une fenêtre plein écran en couche « active » tant que la
 * fenêtre ACTIVE est sur un AUTRE écran (`Window::isActiveFullScreen`, KWin
 * 6.7.5) ; la vidéo, elle, ne tenait sa couche que de l'activation de l'hôte —
 * elle retombait sous le panneau et sous les notifications, que l'hôte
 * transparent laissait voir. Reproduit au banc (KWin virtuel à deux écrans,
 * plasmashell imbriqué), corrigé en passant la vidéo en plein écran avec
 * l'hôte : KWin lui applique alors sa règle, à elle aussi.
 */

import { PIP_MAX_STEP_MS } from "../pip/pipMotion";
import { PIP_CAPTIONS, PIP_COMMAND_KINDS, PIP_GESTURE_CLOSE, PIP_GESTURE_OPEN, PIP_MARGIN } from "../pip/pipCaptions";
import { PIP_FRAME, PIP_INSET, PIP_MAX_SHARE, PIP_MIN_HEIGHT, PIP_MIN_WIDTH } from "../pip/pipFrame";
import { ADOPTION_QML } from "./glueQml/adoptionQml";
import { FOLLOW_QML } from "./glueQml/followQml";
import { PIP_GESTURE_QML } from "./glueQml/pipGestureQml";
import { PIP_MOTION_QML } from "./glueQml/pipMotionQml";
import { PIP_QML } from "./glueQml/pipQml";

const HEAD = `import QtQml as Qml
import org.kde.kwin as Kwin

Qml.QtObject {
    id: root
    property var host: null
    property var video: null
    // La fenêtre PiP (glueQml/pipQml.ts), son mode, sa dernière géométrie
    // connue, le geste en cours et sa géométrie de départ
    // (glueQml/pipGestureQml.ts), et les contraintes d'empilement posées
    // (paires dessous, dessus).
    property var pip: null
    property string pipMode: ""
    property var pipRect: null
    property string pipGesture: ""
    property var gestureStart: null
    property var constraints: []
    // Le mouvement animé du PiP en cours, et le dernier joué
    // (glueQml/pipMotionQml.ts) : une image à 60 Hz, puis un temps de
    // tassement où une taille livrée en retard ne recale rien.
    property var anim: null
    property string pipCommand: ""
    property var motionTick: Qml.Timer {
        interval: 16
        repeat: true
        onTriggered: root.stepPipMotion()
    }
    property var motionSettle: Qml.Timer {
        interval: 300
        repeat: false
        onTriggered: root.anim = null
    }
    // Rattrapage du PREMIER coller : l'écriture de géométrie est asynchrone
    // et windowAdded précède le mappage effectif — la copie posée à l'adoption
    // peut être perdue, et sans elle mpv reste à sa taille de naissance
    // jusqu'au détour d'activation (~0,5 s d'éclair, mesuré). Une minuterie
    // UNIQUE la rejoue. JAMAIS via frameGeometryChanged de la vidéo : notre
    // propre écriture déclencherait le signal qu'elle écoute (boucle).
    property var catchUp: Qml.Timer {
        interval: 150
        repeat: false
        onTriggered: root.glue()
    }
    // La réduction de la vidéo avec l'hôte, un tour de boucle plus tard : hors
    // de la pile d'activation de KWin, qui est en train de réduire l'hôte.
    property var minimizeLater: Qml.Timer {
        interval: 0
        repeat: false
        onTriggered: root.minimizeWithHost()
    }

    function isVideo(w) {
        return w.resourceClass === "mpv" || w.resourceClass === __VIDEO_CLASS__;
    }`;

const TEMPLATE = `${HEAD}${FOLLOW_QML}${PIP_QML}${PIP_GESTURE_QML}${PIP_MOTION_QML}${ADOPTION_QML}}
`;

/**
 * Le QML de la colle pour un processus donné. `videoClass` : l'app-id que
 * porte la fenêtre mpv (`videoWindowIdentity.ts`) ; sans lui, seule la classe
 * « mpv » par défaut est reconnue. Inliné en littéral JSON — un chemin peut
 * contenir espaces et guillemets, que le QML doit lire tels quels.
 */
export function glueTemplate(pid: number, videoClass: string | null = null): string {
  return TEMPLATE.replaceAll("__PID__", String(pid))
    .replaceAll("__VIDEO_CLASS__", JSON.stringify(videoClass ?? "mpv"))
    .replaceAll("__PIP_FLOATING__", JSON.stringify(PIP_CAPTIONS.floating))
    .replaceAll("__PIP_DOCKED__", JSON.stringify(PIP_CAPTIONS.docked))
    .replaceAll("__PIP_GESTURE_OPEN__", JSON.stringify(PIP_GESTURE_OPEN))
    .replaceAll("__PIP_GESTURE_CLOSE__", JSON.stringify(PIP_GESTURE_CLOSE))
    .replaceAll("__PIP_COMMAND_KINDS__", JSON.stringify(PIP_COMMAND_KINDS))
    .replaceAll("__PIP_MAX_STEP__", String(PIP_MAX_STEP_MS))
    .replaceAll("__PIP_MARGIN__", String(PIP_MARGIN))
    .replaceAll("__PIP_SHADOW__", String(PIP_FRAME.shadow))
    .replaceAll("__PIP_INSET__", String(PIP_INSET))
    .replaceAll("__PIP_MIN_WIDTH__", String(PIP_MIN_WIDTH))
    .replaceAll("__PIP_MIN_HEIGHT__", String(PIP_MIN_HEIGHT))
    .replaceAll("__PIP_SHARE_FLOATING__", String(PIP_MAX_SHARE.floating))
    .replaceAll("__PIP_SHARE_DOCKED__", String(PIP_MAX_SHARE.docked));
}
