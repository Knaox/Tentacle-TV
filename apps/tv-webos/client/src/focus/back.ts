import { readIntent } from "./keys";
import { trappingContainer } from "./candidates";
import { systemKeyboardVisible } from "./systemKeyboard";
import { closeExpandedMenu } from "./expandedMenu";
import { markPlayerExit } from "@/components/detail/detailTransition";
import { yieldToTv } from "../auth/returnToShell";

/**
 * La touche Retour de la télécommande.
 *
 * Elle était décodée par `keys.ts` sans que personne l'écoute : le moteur de
 * focus ne traite que les déplacements, les touches du lecteur que le
 * transport. Sur un téléviseur, c'est pourtant la deuxième touche la plus
 * utilisée après OK — et la seule qui permette de sortir d'où que ce soit.
 *
 * **Une pile de consommateurs, pas une inspection du DOM.** Deviner ce qu'il
 * faut fermer en regardant les `[role="dialog"]` marche jusqu'au jour où une
 * surcouche n'en est pas un. Les écrans qui ont quelque chose à refermer
 * s'inscrivent ; le dernier inscrit répond en premier, comme une pile de
 * modales. Celui qui a traité le retour le dit, et la chaîne s'arrête là.
 *
 * Sans preneur, on recule d'un écran. Et sur l'écran racine, on ne recule pas
 * dans le vide : on rend la main au téléviseur, qui affiche son propre menu —
 * c'est ce que fait toute application de salon, et c'est ce que l'utilisateur
 * attend d'un deuxième appui sur Retour depuis l'accueil.
 */

/** Rend vrai si le retour a été traité et ne doit pas aller plus loin. */
export type BackConsumer = () => boolean;

const ROOT_PATHS = ["/tv", "/tv/"];

const stack: BackConsumer[] = [];

/** Garde de réentrance pour le renvoi d'Échap aux dialogues. */
let bouncing = false;

/**
 * Inscrit un preneur de la touche Retour. Rend sa fonction de retrait.
 *
 * À appeler depuis un effet, et à retirer au démontage — un consommateur qui
 * survit à son écran capterait le retour pour refermer quelque chose qui n'est
 * plus là.
 */
export function registerBack(consumer: BackConsumer): () => void {
  stack.push(consumer);
  return () => {
    const position = stack.indexOf(consumer);
    if (position >= 0) stack.splice(position, 1);
  };
}

/**
 * Un seul Retour peut être cédé au clavier système, jamais deux.
 *
 * Céder la touche est juste sur une vraie dalle : c'est par elle qu'on referme
 * le clavier, et la lui prendre faisait reculer d'un écran entier au premier
 * appui. Mais cela suppose que le clavier la CONSOMME — et ce n'est pas
 * toujours vrai. Mesuré sur le Simulator webOS 26 : `keyboardStateChange`
 * annonce le clavier, `document.hasFocus()` est faux, et pourtant ni le clavier
 * ni nous ne traitons la touche. Plus de flèches, plus de Retour : l'écran de
 * recherche devenait une pièce sans porte.
 *
 * Le drapeau garantit une issue en deux appuis. Le premier revient au clavier ;
 * si le clavier est toujours annoncé au second, c'est qu'il n'a rien pris, et
 * l'on reprend la main. Il se lève à chaque Retour traité, et retombe dès que
 * le clavier n'est plus là — de sorte qu'un appui isolé, plus tard, cède encore.
 */
let backYieldsToKeyboard = false;

export function installBack(): () => void {
  const onKey = (event: KeyboardEvent) => {
    // Notre propre renvoi d'Échap doit ATTEINDRE le dialogue.
    //
    // Depuis que `keys.ts` lit aussi `key`, l'Échap synthétique émis par
    // `closeTrappingContainer` est reconnu comme un retour — et cet écouteur,
    // qui capture sur le document, le consommerait avant que `Modal` ou `Sheet`
    // ne le voient. On reculerait alors d'un écran en laissant la modale
    // ouverte par-dessus le précédent : exactement le défaut que ce renvoi
    // existe pour éviter.
    if (bouncing) return;

    // Le clavier système passe avant nous, exactement comme pour le moteur de
    // déplacement (`engine.ts`). Tant qu'il occupe l'écran, Retour lui
    // appartient : c'est par là qu'on le referme. Le lui prendre faisait
    // reculer d'un écran ENTIER au premier appui — la surcouche de recherche
    // était démontée, ses résultats avec elle, et l'utilisateur se retrouvait
    // sur l'accueil en croyant n'avoir refermé qu'un clavier.
    const intention = readIntent(event);
    if (!intention || intention.type !== "retour") return;

    if (systemKeyboardVisible()) {
      if (!backYieldsToKeyboard) {
        backYieldsToKeyboard = true;
        return;
      }
    } else {
      // Le clavier est parti : le prochain appui isolé aura de nouveau droit à
      // sa politesse.
      backYieldsToKeyboard = false;
    }

    event.preventDefault();
    event.stopPropagation();
    goBack();
  };

  document.addEventListener("keydown", onKey, true);
  return () => document.removeEventListener("keydown", onKey, true);
}

function goBack(): void {
  for (let position = stack.length - 1; position >= 0; position--) {
    if (stack[position]()) return;
  }

  // Le piège d'abord : c'est lui qui désigne le menu qu'on regarde, quand il y
  // en a plusieurs d'ouverts.
  if (closeExpandedMenu(trappingContainer())) return;
  if (closeTrappingContainer()) return;

  if (onRootScreen()) {
    yieldToTv();
    return;
  }

  // Quitter le lecteur par l'historique sans le signaler laisserait la fiche
  // rejouer sa transition d'ouverture au retour, alors qu'on en revient.
  if (onPlayer()) markPlayerExit();
  window.history.back();
}

/**
 * Referme un dialogue qui n'a inscrit aucun consommateur — en lui envoyant
 * Échap, la convention du web.
 *
 * Les écrans que nous écrivons s'inscrivent à la pile. Ceux d'`apps/web` ne
 * peuvent pas : ils ignorent l'existence du téléviseur, et c'est bien ainsi.
 * Or plusieurs sont atteignables — la bande-annonce d'un extra ouvre une
 * `Modal`, une carte de grille un menu contextuel. Sans cette étape, Retour
 * reculait d'un écran EN LAISSANT la modale ouverte par-dessus le précédent.
 *
 * Pire : cet écouteur consomme aussi Échap (keyCode 27), en capture sur le
 * document. `Modal` et `Sheet` écoutent, eux, sur la fenêtre en phase de
 * remontée — que `stopPropagation` coupe. **Échap avait donc cessé de fermer
 * les modales**, y compris au clavier. On répare les deux d'un geste.
 *
 * On n'essaie pas de deviner le bouton de fermeture : `trappingContainer` rend
 * l'élément, pas son affordance. Rejouer la touche que ces composants écoutent
 * déjà est le seul moyen qui ne suppose rien de leur structure interne.
 *
 * L'événement synthétique ne porte pas de `keyCode` — mais `readIntent` lit
 * désormais aussi `key`, et « Escape » y est un retour. Sans le drapeau, notre
 * propre écouteur reprendrait donc l'événement au vol. C'est lui, et non la
 * table des touches, qui garantit que le dialogue reçoit ce qu'on lui envoie.
 */
function closeTrappingContainer(): boolean {
  if (bouncing) return false;
  const trap = trappingContainer();
  if (!trap) return false;

  bouncing = true;
  try {
    trap.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  } finally {
    bouncing = false;
  }
  return true;
}

function onRootScreen(): boolean {
  return ROOT_PATHS.indexOf(window.location.pathname) >= 0;
}

function onPlayer(): boolean {
  return window.location.pathname.indexOf("/tv/watch") === 0;
}
