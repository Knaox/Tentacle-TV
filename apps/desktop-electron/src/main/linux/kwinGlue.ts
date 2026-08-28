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
 */

import { createHash } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  arreterScript,
  chargerScriptDeclaratif,
  lancerScript,
} from "./kwinScripting";

const GABARIT = `import QtQml
import org.kde.kwin

QtObject {
    id: racine
    property var hote: null
    property var video: null
    // Rattrapage du PREMIER coller : l'écriture de géométrie est asynchrone
    // et windowAdded précède le mappage effectif — la copie posée à l'adoption
    // peut être perdue, et sans elle mpv reste à sa taille de naissance
    // jusqu'au détour d'activation (~0,5 s d'éclair, mesuré). Une minuterie
    // UNIQUE la rejoue. JAMAIS via frameGeometryChanged de la vidéo : notre
    // propre écriture déclencherait le signal qu'elle écoute (boucle).
    property var rattrapage: Timer {
        interval: 150
        repeat: false
        onTriggered: racine.coller()
    }

    function coller() {
        if (racine.hote === null || racine.video === null) return;
        var g = racine.hote.frameGeometry;
        racine.video.frameGeometry = Qt.rect(g.x, g.y, g.width, g.height);
        Workspace.raiseWindow(racine.video);
        Workspace.raiseWindow(racine.hote);
    }
    function reprendreActivation() {
        if (racine.hote !== null && racine.video !== null && racine.video.active) {
            Workspace.activeWindow = racine.hote;
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
    Component.onCompleted: {
        var ws = Workspace.windows;
        for (var i = 0; i < ws.length; i++) racine.prendre(ws[i]);
        Workspace.windowAdded.connect(racine.prendre);
        console.warn("[tentacle-colle] posée — pid __PID__, hote="
            + (racine.hote !== null) + ", video=" + (racine.video !== null));
    }
}
`;

/** Le QML de la colle pour un processus donné. Exporté pour les tests. */
export function gabaritColle(pid: number): string {
  return GABARIT.replaceAll("__PID__", String(pid));
}

/**
 * Une pose de colle : un fichier QML écrit, chargé et lancé dans KWin.
 *
 * Le nom du fichier porte un HACHAGE du contenu : le moteur QML de KWin met
 * les composants en cache par chemin, et un gabarit qui évolue avec
 * l'application doit changer de chemin pour être relu (mesuré, banc du 28.08).
 */
export class ColleKwin {
  private id: number | null = null;
  private chemin: string | null = null;

  async poser(): Promise<boolean> {
    const contenu = gabaritColle(process.pid);
    const hachage = createHash("sha256").update(contenu).digest("hex").slice(0, 12);
    const chemin = path.join(tmpdir(), `tentacle-colle-${String(process.pid)}-${hachage}.qml`);
    try {
      writeFileSync(chemin, contenu, "utf8");
    } catch {
      return false;
    }
    const id = await chargerScriptDeclaratif(chemin);
    if (id === null || !(await lancerScript(id))) {
      try { rmSync(chemin); } catch { /* déjà absent */ }
      return false;
    }
    this.id = id;
    this.chemin = chemin;
    return true;
  }

  /** L'arrêt du script détruit l'instance QML : la colle cesse de suivre. */
  async retirer(): Promise<void> {
    const id = this.id;
    const chemin = this.chemin;
    this.id = null;
    this.chemin = null;
    if (id !== null) await arreterScript(id);
    if (chemin !== null) {
      try { rmSync(chemin); } catch { /* déjà absent */ }
    }
  }
}
