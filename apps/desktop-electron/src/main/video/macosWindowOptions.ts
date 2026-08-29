/**
 * Les options mpv qui empêchent macOS d'ouvrir un SECOND bureau de plein écran.
 *
 * # Le défaut, et sa mesure
 *
 * Application en plein écran, l'utilisateur lance une vidéo : la lecture est
 * correcte, mais un bureau supplémentaire apparaît à côté, occupé par une
 * fenêtre noire, et il survit à la sortie du plein écran. Compté au serveur de
 * fenêtres (`CGSCopyManagedDisplaySpaces`), avant et après le lancement :
 *
 *   avant   5 espaces, dont 2 de plein ecran
 *   apres   6 espaces, dont 3 de plein ecran   ← et macOS bascule dessus
 *
 * # Pourquoi la correction ne peut PAS venir après coup
 *
 * mpv crée sa fenêtre en `NSWindowCollectionBehaviorFullScreenPrimary` — c'est
 * en dur dans son `init` (`video/out/mac/window.swift`), aucune option ne le
 * change. Et AppKit ne consulte ce comportement qu'à **l'affichage initial** de
 * la fenêtre : une fenêtre `FullScreenPrimary` qui apparaît pendant que
 * l'application est en plein écran se voit attribuer son propre espace.
 *
 * Tout ce qui suit a été mesuré, et ÉCARTÉ :
 *
 *  - poser `FullScreenAuxiliary` dès qu'on trouve la fenêtre — c'est ce que
 *    fait `macosChildWindow.ts`, et la promotion a lieu quand même. La décision
 *    est déjà prise ; seule la transition, asynchrone, reste à venir ;
 *  - accélérer la recherche de la fenêtre : impossible par construction. mpv
 *    crée SA fenêtre et l'affiche dans un unique `DispatchQueue.main.sync`, sur
 *    le thread principal — celui-là même qui fait tourner la boucle Node.
 *    Aucun minuteur ne peut s'y intercaler, à aucune cadence ;
 *  - ne PAS attacher la fenêtre comme fille : promue quand même (`enfant=NON
 *    comportement=256 videoPromue=OUI`). La filiation n'y est pour rien ;
 *  - lui retirer `NSWindowStyleMaskResizable`, pour la rendre inéligible :
 *    promue quand même (`masque=49159`).
 *
 * # Ce qui reste : parler à mpv avant qu'il n'affiche
 *
 * `initWindow` pose le comportement de collection AVANT `orderFront`, et
 * n'appelle `orderFront` que si la fenêtre n'est pas demandée minimisée :
 *
 * ```swift
 * window.setOnAllWorkspaces(Bool(option.vo.all_workspaces))   // + .canJoinAllSpaces
 * window.setMinimized(minimized)
 * if !minimized { window.orderFront(nil) }                    // ← l'affichage initial
 * ```
 *
 * Ces deux options sont donc les seuls leviers qui agissent AVANT la décision
 * d'AppKit. On ne les pose QUE si l'application est déjà en plein écran quand
 * la lecture démarre : hors de ce cas, le défaut n'existe pas, et le chemin
 * nominal reste rigoureusement inchangé.
 *
 * ⚠️ **macOS uniquement**, et montage à deux fenêtres uniquement : la Render
 * API ne crée aucune fenêtre, donc aucun espace.
 */

import type { BrowserWindow } from "electron";
import type { MpvValue } from "./mpvAllowlist";

/**
 * Complète les options d'init quand la lecture démarre en plein écran.
 *
 * `window-minimized=yes` ne minimise rien de visible — la fenêtre n'a jamais
 * été affichée, il n'y a rien à ranger dans le Dock. Ce qu'on achète, c'est le
 * `if !minimized` : mpv n'appelle pas `orderFront`, donc **l'affichage initial
 * n'a pas lieu chez lui**. C'est nous qui l'affichons, une fois la fenêtre
 * trouvée et `FullScreenAuxiliary` posé — et AppKit consulte alors un
 * comportement correct. Voir `deminiaturize` dans `macosChildWindow.ts`.
 *
 * ⚠️ `on-all-workspaces=yes` a été essayé d'abord, et MESURÉ insuffisant :
 * `canJoinAllSpaces` est bien posé avant l'affichage (`on-all-workspaces` rend
 * `yes` à l'interrogation), et macOS promeut la fenêtre quand même — un espace
 * de plein écran de plus, comme sans l'option.
 */
export function adaptToFullscreen(
  options: Readonly<Record<string, MpvValue>>,
  host: BrowserWindow,
): Record<string, MpvValue> {
  const output: Record<string, MpvValue> = { ...options };
  if (process.platform !== "darwin" || !host.isFullScreen()) return output;
  output["window-minimized"] = "yes";
  return output;
}
