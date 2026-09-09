/**
 * Le liseré de la fenêtre de mpv : le retirer en plein écran, le rendre en
 * sortant — et savoir QUAND on a le droit d'y toucher.
 *
 * Séparé de `macosChildWindow.ts`, qui pose la fenêtre, et de `macosSurface.ts`,
 * qui suit la lecture : écrire dans le `styleMask` d'une fenêtre qui ne nous
 * appartient pas est un métier à soi seul, et il a coûté un crash.
 */

import { trace } from "./native";
import { FULLSCREEN_MASK, msg } from "./objc";

/**
 * Le temps qu'AppKit met à se poser après un changement d'espace.
 *
 * ⚠️ Il ne sert PAS qu'au confort : c'est la distance qui sépare le geste sur le
 * `styleMask` de la transition qui le ferait lever. `enter-full-screen` arrive
 * quand Electron croit la transition finie, mais macOS bouge encore la fenêtre —
 * et la promotion vers un espace de plein écran, elle, est décidée à
 * l'affichage, donc APRÈS `addChildWindow:`.
 */
export const SETTLE_MS = 500;

/** Ce sur quoi le geste porte, relevé au moment où il part et non avant. */
export interface SeamTarget {
  window: unknown;
  fullscreen: boolean;
}

/** `NSWindowStyleMaskBorderless` — aucun style, donc aucune décoration. */
const NO_DECORATION = 0;

/**
 * Le liseré, tel que le détient la surface qui l'a créé.
 *
 * `schedule` demande le geste — il partira quand AppKit se sera posé ; `forget`
 * oublie le masque relevé et désarme une demande en attente, au détachement.
 */
export interface Seam {
  schedule(): void;
  forget(): void;
}

/**
 * Retire son cadre à la fenêtre de mpv — toujours — et lui rend ses coins.
 *
 * # Le liseré, et d'où il vient
 *
 * `--border=no` ne suffit pas : côté mpv il se contente de MASQUER la barre de
 * titre (`didSet { if !border { common.titleBar?.hide() } }`), en laissant
 * `NSWindowStyleMaskTitled` posé — mesuré, `styleMask` = 32783. macOS dessine
 * alors sa bordure claire sur le bord supérieur, et notre page transparente la
 * laisse voir : un liseré gris neutre d'un point. C'est un défaut connu du côté
 * d'Electron aussi, dont la fenêtre est `titled` et non opaque
 * (electron#17944, electron#15008, tous deux sans correctif).
 *
 * # Pourquoi SEULEMENT en plein écran
 *
 * ⚠️ Parce qu'en fenêtré, une bordure de fenêtre est NORMALE — toutes les
 * fenêtres de macOS en ont une — et que la retirer coûte les coins arrondis :
 * `borderless` les carre, et un rectangle dépassait alors des coins de la nôtre.
 * Essayé, mesuré, signalé : reposer un `cornerRadius` sur la couche de la vue de
 * contenu de mpv donne des coins visiblement faux, `roundedCorners` d'Electron ne
 * s'appliquant qu'à SA fenêtre. Écarté.
 *
 * En plein écran, rien de tout cela ne se pose : l'écran est rectangulaire.
 *
 * Ce que l'utilisateur voit revenir en fondu quand les contrôles s'effacent est
 * un AUTRE défaut, et il vient de la page : voir le plancher d'alpha de
 * `videoScrim.ts`, que la transition d'opacité fait traverser vers le bas.
 *
 * ⚠️ Écartés, mesurés : `title-bar=no` côté mpv ATTÉNUE le liseré (50 → 14,6)
 * sans le supprimer — gardé tout de même, le gain est réel ; retirer l'ombre de
 * la fenêtre principale l'AGGRAVE (14,6 → 50).
 *
 * # La fenêtre que macOS a promue — on n'y touche pas
 *
 * ⚠️ Quand la lecture démarre alors que l'application est DÉJÀ en plein écran,
 * AppKit peut donner à la fenêtre de mpv son propre espace et lui poser
 * `NSWindowStyleMaskFullScreen`. Écrire `borderless` efface alors ce bit, et
 * `-[NSWindow setStyleMask:]` lève — c'est un crash MORTEL, pas une erreur : une
 * exception Objective-C ne traverse pas koffi, aucun `try` JavaScript ne la
 * rattrape, et Chromium arme le gestionnaire fatal d'AppKit. Un utilisateur
 * Mac Intel l'a payé en 1.21.0, `SIGILL` en pleine lecture.
 *
 * La garde n'est donc pas défensive, elle est nécessaire — et elle est aussi la
 * bonne réponse au fond : une fenêtre à qui macOS a donné un espace à elle n'a
 * aucun liseré à retirer, puisque notre page n'est plus devant. Il n'y a
 * littéralement rien à faire.
 *
 * La promotion est une transition ASYNCHRONE décidée à l'affichage — voir
 * `stateAtDiscovery` dans `macosSurfaceDiag.ts` et l'en-tête de
 * `macosWindowOptions.ts`, qui la mesure : `masque=49159`.
 *
 * # Le geste est TOUJOURS différé
 *
 * ⚠️ `schedule` ne pose rien tout de suite, et ce n'est pas négociable. Il se
 * réarme aussi à chaque appel : Electron n'expose aucun évènement de DÉBUT de
 * transition — ni `will-enter-full-screen` ni équivalent, vérifié dans ses types
 * — donc rien ne dit qu'une animation commence. Deux bascules rapprochées
 * feraient écrire la première demande au milieu de la seconde ; le `clearTimeout`
 * est ce qui l'empêche.
 *
 * # Pourquoi une fabrique, et non deux fonctions
 *
 * ⚠️ Le masque à rendre était un `let` de MODULE, jamais réinitialisé et partagé
 * par toutes les lectures. Or une fenêtre de mpv ne survit pas à la sienne :
 * avec `force-window=no` elle naît au premier `loadfile` et meurt avec la sortie
 * vidéo. Le masque relevé sur l'une pouvait donc être réécrit sur la suivante,
 * qui n'est pas le même objet. L'état appartient à la surface, `forget()` le
 * rend au détachement, et le pointeur est mémorisé AVEC le masque : on ne
 * restaure que là où l'on a relevé.
 */
export function createSeam(target: () => SeamTarget | null): Seam {
  /** Le style que mpv a donné à sa fenêtre, pour le lui rendre en sortant. */
  let originalStyle = 0;
  /** Et la fenêtre d'où il vient — un masque ne se rend pas à une autre. */
  let owner: unknown = null;
  let pending: ReturnType<typeof setTimeout> | null = null;

  function apply(window: unknown, fullscreen: boolean): void {
    if (!window) return;
    const current = msg.count(window, "styleMask");
    // La seule lecture de `styleMask` du dépôt qui décidait sans regarder ce bit.
    if ((current & FULLSCREEN_MASK) !== 0) {
      // Tracé : c'est le seul témoin du cas qui tuait l'application, et il ne
      // se déduit d'aucun symptôme — la lecture se déroule normalement.
      trace(`liseré : masque ${current}, fenêtre promue par macOS — rien à faire`);
      return;
    }
    if (fullscreen) {
      if (current === NO_DECORATION) return;
      originalStyle = current;
      owner = window;
      msg.setStyleMask(window, NO_DECORATION);
      trace(`liseré retiré — masque ${current} → ${NO_DECORATION}`);
      return;
    }
    if (current !== NO_DECORATION || originalStyle === 0) return;
    if (owner !== window) {
      trace(`liseré : masque ${originalStyle} relevé sur une AUTRE fenêtre — non rendu`);
      return;
    }
    msg.setStyleMask(window, originalStyle);
    rehideTitleBar(window);
    trace(`liseré rendu — masque ${NO_DECORATION} → ${originalStyle}`);
  }

  return {
    schedule(): void {
      if (pending !== null) clearTimeout(pending);
      pending = setTimeout(() => {
        pending = null;
        // Relevé MAINTENANT et non à la demande : entre les deux, la lecture a
        // pu s'arrêter et la fenêtre disparaître.
        const now = target();
        if (now === null) return;
        apply(now.window, now.fullscreen);
      }, SETTLE_MS);
    },

    forget(): void {
      if (pending !== null) clearTimeout(pending);
      pending = null;
      originalStyle = 0;
      owner = null;
    },
  };
}

/** `NSWindowTitleHidden` — le titre existe, AppKit ne le dessine pas. */
const HIDDEN_TITLE = 1;

/** Les trois boutons de fenêtre : fermer, réduire, zoomer. */
const STANDARD_BUTTONS = [0, 1, 2];

/**
 * Refait ce que mpv avait fait à sa barre de titre, et que nous lui avons défait.
 *
 * ⚠️ Rendre le `styleMask` titré RECONSTRUIT la barre de titre. mpv ne l'avait
 * jamais supprimée — `title-bar=no` ne fait que la MASQUER
 * (`common.titleBar?.hide()`) — et il ne la remasque pas quand on lui change son
 * style sous les pieds. À la sortie du plein écran, la fenêtre vidéo réaffichait
 * donc une barre complète : ses propres feux de circulation, et le titre
 * « Tentacle TV » que mpv pose sur sa fenêtre. Vue à l'écran, sous notre bandeau,
 * à la hauteur exacte où commence la fenêtre de mpv.
 *
 * Les trois gestes sont ceux de mpv lui-même, dans le même ordre. Aucun ne
 * dépend d'un état antérieur : les rejouer sur une fenêtre déjà masquée est sans
 * effet, ce qui rend la fonction sûre à appeler plus d'une fois.
 *
 * ⚠️ Écarté : ne plus restaurer le `styleMask` du tout. La fenêtre resterait
 * `borderless`, donc à coins carrés — et si le recouvrement du bandeau cache
 * désormais ceux du haut, ceux du BAS dépasseraient des coins arrondis de la
 * nôtre.
 */
function rehideTitleBar(window: unknown): void {
  msg.setFlag(window, "setTitlebarAppearsTransparent:", true);
  msg.setInt(window, "setTitleVisibility:", HIDDEN_TITLE);
  for (const button of STANDARD_BUTTONS) {
    msg.setFlag(msg.index(window, "standardWindowButton:", button), "setHidden:", true);
  }
}
