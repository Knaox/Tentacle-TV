/**
 * La COLLE KWin : la fenêtre mpv suit la nôtre — géométrie ET empilement.
 *
 * C'est elle qui rend la lecture FENÊTRÉE sur Wayland, comme sur Windows : la
 * vidéo se cale sous la fenêtre de l'application, la suit quand on la déplace
 * ou la redimensionne, passe en plein écran quand ELLE y passe, et en ressort
 * de même. Une fois posée, la colle vit CÔTÉ COMPOSITEUR : aucun aller-retour
 * par processus ensuite, KWin suit ses propres signaux.
 *
 * # Ce que le banc du 28.08 a fixé (docs/LINUX-FENETRE-VIDEO.md)
 *
 * - géométrie : copie du `frameGeometry` de l'hôte via `Qt.rect` — moteur
 *   déclaratif OBLIGATOIRE (voir `kwinScripting.ts`) ;
 * - empilement : `raiseWindow(video)` puis `raiseWindow(hôte)` — la paire
 *   reste adjacente, l'hôte devant, SANS toucher à l'activation ; un intrus
 *   activé passe devant la paire (comportement fenêtré normal) et la paire se
 *   reforme à la réactivation de l'hôte ;
 * - habillage : mpv sans bordure, absent de la barre des tâches et d'alt-tab ;
 * - activation : le compositeur active volontiers la fenêtre mpv à sa
 *   naissance — la colle rend aussitôt l'activation à l'hôte, sinon le clavier
 *   (espace, flèches) parlerait à une fenêtre sourde (`input-*=no`).
 *
 * # L'appariement par PID
 *
 * libmpv vit DANS notre processus : la fenêtre mpv porte le pid du processus
 * principal, comme la nôtre. Le couple (pid, resourceClass) identifie donc les
 * deux fenêtres sans dépendre d'un nom d'application : `mpv` = la vidéo, tout
 * autre classe du même pid = l'hôte (les fenêtres DevTools, mêmes pid et
 * classe, sont écartées par leur titre).
 *
 * # Un dossier NEUF à chaque pose — la panne du 28.08 au soir
 *
 * Le moteur QML de KWin ne voit PAS un fichier créé dans un dossier qu'il a
 * DÉJÀ servi : il rend « File name case mismatch » pour un chemin pourtant
 * présent, bien nommé, lisible (mesuré : mêmes droits, même étiquette SELinux
 * qu'un fichier qui charge). Conséquence relevée au journal de KWin : la
 * PREMIÈRE pose après un démarrage du compositeur réussit, toutes les
 * suivantes échouent — d'où une fenêtre mpv libre dès le DEUXIÈME lancement de
 * l'application, et le « ça remarche quand je redémarre le poste ».
 *
 * L'échec est MUET côté application : `loadDeclarativeScript` rend un numéro,
 * `run` réussit, et seul le journal du compositeur dit que le composant n'a
 * jamais été construit. C'est `glueCheck.ts` qui rattrape ce mensonge.
 *
 * Chaque pose écrit donc son QML dans un dossier qui n'a JAMAIS servi —
 * `tentacle-colle-<pid>-<n>/glue.qml` (banc : deux dossiers neufs d'affilée,
 * deux chargements réussis). Ce dossier ne contient qu'un fichier, en
 * minuscules : jamais candidat à un nom de type QML — l'autre piège du 28.08,
 * un fichier parasite de /tmp qui prenait la place de `Timer`.
 *
 * # Les types QML sont QUALIFIÉS
 *
 * `Qml.QtObject`, `Qml.Timer`, `Qml.Component.onCompleted`, `Kwin.Workspace` :
 * un type qualifié ne se résout jamais contre le dossier du fichier. Mesuré au
 * banc — à condition de qualifier AUSSI l'objet attaché `Component`, qui rend
 * sinon « Non-existent attached object » et tue le composant entier.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  arreterScript,
  chargerScriptDeclaratif,
  lancerScript,
} from "./kwinScripting";

const GABARIT = `import QtQml as Qml
import org.kde.kwin as Kwin

Qml.QtObject {
    id: racine
    property var hote: null
    property var video: null
    // Rattrapage du PREMIER coller : l'écriture de géométrie est asynchrone
    // et windowAdded précède le mappage effectif — la copie posée à l'adoption
    // peut être perdue, et sans elle mpv reste à sa taille de naissance
    // jusqu'au détour d'activation (~0,5 s d'éclair, mesuré). Une minuterie
    // UNIQUE la rejoue. JAMAIS via frameGeometryChanged de la vidéo : notre
    // propre écriture déclencherait le signal qu'elle écoute (boucle).
    property var rattrapage: Qml.Timer {
        interval: 150
        repeat: false
        onTriggered: racine.coller()
    }

    function coller() {
        if (racine.hote === null || racine.video === null) return;
        var g = racine.hote.frameGeometry;
        racine.video.frameGeometry = Qt.rect(g.x, g.y, g.width, g.height);
        Kwin.Workspace.raiseWindow(racine.video);
        Kwin.Workspace.raiseWindow(racine.hote);
    }
    function reprendreActivation() {
        if (racine.hote !== null && racine.video !== null && racine.video.active) {
            Kwin.Workspace.activeWindow = racine.hote;
        }
    }
    function suivreMinimise() {
        if (racine.hote === null || racine.video === null) return;
        racine.video.minimized = racine.hote.minimized;
    }
    function prendre(w) {
        if (w.pid !== __PID__) return;
        if (w.resourceClass === "mpv") {
            if (racine.video !== null) return;
            racine.video = w;
            w.noBorder = true;
            w.skipTaskbar = true;
            w.skipSwitcher = true;
            w.skipPager = true;
            w.closed.connect(function () { racine.video = null; });
            w.activeChanged.connect(racine.reprendreActivation);
            racine.reprendreActivation();
            racine.suivreMinimise();
            racine.coller();
            racine.rattrapage.restart();
            return;
        }
        if (racine.hote !== null) return;
        if (w.caption.indexOf("Developer Tools") === 0) return;
        racine.hote = w;
        w.frameGeometryChanged.connect(racine.coller);
        w.activeChanged.connect(function () {
            if (racine.hote !== null && racine.hote.active) racine.coller();
        });
        try { w.minimizedChanged.connect(racine.suivreMinimise); } catch (e) { }
        w.closed.connect(function () { racine.hote = null; });
        racine.coller();
    }
    Qml.Component.onCompleted: {
        var ws = Kwin.Workspace.windows;
        for (var i = 0; i < ws.length; i++) racine.prendre(ws[i]);
        Kwin.Workspace.windowAdded.connect(racine.prendre);
        console.warn("[tentacle-colle] posée — pid __PID__, hote="
            + (racine.hote !== null) + ", video=" + (racine.video !== null));
    }
}
`;

/** Le QML de la colle pour un processus donné. Exporté pour les tests. */
export function gabaritColle(pid: number): string {
  return GABARIT.replaceAll("__PID__", String(pid));
}

/** Numéro de pose du processus : deux poses ne partagent JAMAIS un dossier. */
let poses = 0;

/** Le dossier de la n-ième pose de ce processus. Exporté pour les tests. */
export function dossierPose(pid: number, numero: number): string {
  return path.join(tmpdir(), `tentacle-colle-${String(pid)}-${String(numero)}`);
}

function effacerDossier(dossier: string): void {
  try {
    rmSync(dossier, { recursive: true, force: true });
  } catch {
    /* déjà absent, ou /tmp balayé sous nos pieds */
  }
}

/**
 * Une pose de colle : un dossier neuf, un QML écrit dedans, chargé et lancé
 * dans KWin. Voir l'en-tête pour la raison du dossier neuf.
 */
export class ColleKwin {
  private id: number | null = null;
  private dossier: string | null = null;

  async poser(): Promise<boolean> {
    poses += 1;
    const dossier = dossierPose(process.pid, poses);
    const chemin = path.join(dossier, "glue.qml");
    try {
      mkdirSync(dossier, { recursive: true });
      writeFileSync(chemin, gabaritColle(process.pid), "utf8");
    } catch {
      return false;
    }
    const id = await chargerScriptDeclaratif(chemin);
    if (id === null || !(await lancerScript(id))) {
      effacerDossier(dossier);
      return false;
    }
    this.id = id;
    this.dossier = dossier;
    return true;
  }

  /** L'arrêt du script détruit l'instance QML : la colle cesse de suivre. */
  async retirer(): Promise<void> {
    const id = this.id;
    const dossier = this.dossier;
    this.id = null;
    this.dossier = null;
    if (id !== null) await arreterScript(id);
    if (dossier !== null) effacerDossier(dossier);
  }
}
