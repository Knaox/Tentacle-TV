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
 * # Un greffon NOMMÉ, `tentacle-colle-<pid>`
 *
 * Un script chargé survit au processus qui l'a posé : quitter en pleine
 * lecture — ou se faire tuer — laisse son instance QML vivante dans le
 * compositeur. Le nom est la seule prise pour la décrocher : on décroche avant
 * chaque pose (une seule colle vivante par processus), au départ de
 * l'application, et au lancement suivant pour les pids qui ne répondent plus.
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

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dossierPose, effacerDossier, nomGreffon } from "./glueCleanup";
import { chargerScriptDeclaratif, dechargerScript, lancerScript } from "./kwinScripting";

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

/** Le temps que KWin rende un nom : son déchargement est différé. */
const RESPIRATION_MS = 100;

function attendre(ms: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, ms));
}

/**
 * Une pose de colle : un dossier neuf, un QML écrit dedans, chargé et lancé
 * dans KWin. Voir l'en-tête pour la raison du dossier neuf.
 */
export class ColleKwin {
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
    // UNE seule colle vivante par processus : la pose précédente — ou le
    // reliquat d'un lancement mort dont le pid a été réattribué — est
    // décrochée d'abord, sinon KWin refuse un greffon déjà chargé.
    const nom = nomGreffon(process.pid);
    await dechargerScript(nom);
    let id = await chargerScriptDeclaratif(chemin, nom);
    if (id === null) {
      // Le déchargement de KWin est différé (`deleteLater`) : une seconde
      // chance, une seule, le temps qu'il ait rendu le nom.
      await attendre(RESPIRATION_MS);
      id = await chargerScriptDeclaratif(chemin, nom);
    }
    if (id === null || !(await lancerScript(id))) {
      effacerDossier(dossier);
      return false;
    }
    this.dossier = dossier;
    return true;
  }

  /** Décrocher le greffon détruit l'instance QML : la colle cesse de suivre. */
  async retirer(): Promise<void> {
    const dossier = this.dossier;
    this.dossier = null;
    if (dossier === null) return;
    await dechargerScript(nomGreffon(process.pid));
    effacerDossier(dossier);
  }
}
