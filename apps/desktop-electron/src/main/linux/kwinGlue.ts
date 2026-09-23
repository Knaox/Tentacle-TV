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
 * - couche : `keepAbove` sur mpv tant que l'hôte est plein écran ET actif,
 *   sinon le panneau du bureau s'intercale entre les deux et se voit par la
 *   transparence de notre fenêtre (mesuré le 15.09) ;
 * - habillage : mpv sans bordure, absent de la barre des tâches ; dans
 *   Alt+Tab, c'est LUI qui représente l'application pendant la lecture (sa
 *   vignette montre l'image), l'hôte hors lecture ;
 * - activation : le compositeur active volontiers la fenêtre mpv à sa
 *   naissance — la colle rend aussitôt l'activation à l'hôte, sinon le clavier
 *   (espace, flèches) parlerait à une fenêtre sourde (`input-*=no`). JAMAIS à
 *   un hôte réduit : l'activer le restaurerait (le 23.09, la réduction
 *   s'annulait ainsi elle-même) ;
 * - réduction, bureaux virtuels, activités : la vidéo suit l'hôte.
 *
 * Le détail de chaque geste est dans le gabarit, `kwinGlueTemplate.ts`.
 *
 * # L'appariement par PID
 *
 * libmpv vit DANS notre processus : la fenêtre mpv porte le pid du processus
 * principal, comme la nôtre. Le couple (pid, resourceClass) identifie donc les
 * deux fenêtres sans dépendre d'un nom d'application : la classe de la vidéo
 * (l'app-id de `videoWindowIdentity.ts`, ou `mpv` à défaut) = la vidéo, tout
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
 * # UNE colle par processus — posée à la première lecture, gardée jusqu'au départ
 *
 * La colle n'a rien à savoir du fichier en cours : elle adopte TOUTE fenêtre
 * `mpv` de notre pid (`windowAdded`), et `video` retombe à null quand celle-ci
 * se ferme (`closed`). Une pose sert donc à tous les épisodes d'un lancement.
 * La décrocher et la reposer à chaque lecture — ce qu'on faisait — coûtait
 * quatre appels D-Bus par épisode, et surtout laissait derrière elle des
 * gestionnaires morts (ci-dessous). Depuis le 17.09.2026, `liveGlue.ts` ne
 * pose que s'il n'y a rien de vivant ; seule la contre-lecture
 * (`waylandGlueSurface.ts`) repose, quand la fenêtre ne suit vraiment pas.
 *
 * # Les gestionnaires MORTS — 2 827 exceptions en sept jours
 *
 * Décrocher un greffon détruit son instance QML, mais PAS ce qu'elle a
 * connecté : KWin garde les gestionnaires posés sur ses fenêtres et sur
 * `Workspace.windowAdded`, et les rappelle avec `racine` déjà null. Relevé au
 * journal du compositeur le 17.09.2026 : « TypeError: Cannot read property
 * 'hote' of null » à chaque évènement de fenêtre, N fois — N poses depuis le
 * lancement, jamais décrémenté. `lacher()` défait donc, à la destruction, tout
 * ce que `prendre()` a noué ; les fermetures sont NOMMÉES pour cela, une
 * fonction anonyme ne se déconnectant pas.
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
import { glueFolder, removeFolder, pluginName } from "./glueCleanup";
import { glueTemplate } from "./kwinGlueTemplate";
import { loadDeclarativeScript, unloadScript, runScript } from "./kwinScripting";
import { videoWindowAppId } from "./videoWindowIdentity";

// Le gabarit vit à part (`kwinGlueTemplate.ts`, ce que la colle suit) ; les
// tests le lisent encore d'ici.
export { glueTemplate };

/** Numéro de pose du processus : deux poses ne partagent JAMAIS un dossier. */
let applied = 0;

/** Le temps que KWin rende un nom : son déchargement est différé. */
const BREATH_MS = 100;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Une pose de colle : un dossier neuf, un QML écrit dedans, chargé et lancé
 * dans KWin. Voir l'en-tête pour la raison du dossier neuf.
 */
export class KwinGlue {
  private folder: string | null = null;

  async apply(): Promise<boolean> {
    applied += 1;
    const folder = glueFolder(process.pid, applied);
    const filePath = path.join(folder, "glue.qml");
    try {
      mkdirSync(folder, { recursive: true });
      writeFileSync(filePath, glueTemplate(process.pid, videoWindowAppId()), "utf8");
    } catch {
      return false;
    }
    // UNE seule colle vivante par processus : la pose précédente — ou le
    // reliquat d'un lancement mort dont le pid a été réattribué — est
    // décrochée d'abord, sinon KWin refuse un greffon déjà chargé.
    const name = pluginName(process.pid);
    await unloadScript(name);
    let id = await loadDeclarativeScript(filePath, name);
    if (id === null) {
      // Le déchargement de KWin est différé (`deleteLater`) : une seconde
      // chance, une seule, le temps qu'il ait rendu le nom.
      await wait(BREATH_MS);
      id = await loadDeclarativeScript(filePath, name);
    }
    if (id === null || !(await runScript(id))) {
      removeFolder(folder);
      return false;
    }
    this.folder = folder;
    return true;
  }

  /** Décrocher le greffon détruit l'instance QML : la colle cesse de suivre. */
  async remove(): Promise<void> {
    const folder = this.folder;
    this.folder = null;
    if (folder === null) return;
    await unloadScript(pluginName(process.pid));
    removeFolder(folder);
  }
}
