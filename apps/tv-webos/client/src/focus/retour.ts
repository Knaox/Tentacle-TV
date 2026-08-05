import { lireIntention } from "./touches";
import { conteneurPiegeant } from "./candidats";
import { markPlayerExit } from "@/components/detail/detailTransition";
import { rendreLaMainAuTeleviseur } from "../auth/retourCoquille";

/**
 * La touche Retour de la télécommande.
 *
 * Elle était décodée par `touches.ts` sans que personne l'écoute : le moteur de
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
export type ConsommateurRetour = () => boolean;

const CHEMINS_RACINE = ["/tv", "/tv/"];

const pile: ConsommateurRetour[] = [];

/** Garde de réentrance pour le renvoi d'Échap aux dialogues. */
let renvoiEnCours = false;

/**
 * Inscrit un preneur de la touche Retour. Rend sa fonction de retrait.
 *
 * À appeler depuis un effet, et à retirer au démontage — un consommateur qui
 * survit à son écran capterait le retour pour refermer quelque chose qui n'est
 * plus là.
 */
export function inscrireRetour(consommateur: ConsommateurRetour): () => void {
  pile.push(consommateur);
  return () => {
    const position = pile.indexOf(consommateur);
    if (position >= 0) pile.splice(position, 1);
  };
}

export function installerRetour(): () => void {
  const surTouche = (evenement: KeyboardEvent) => {
    // Notre propre renvoi d'Échap doit ATTEINDRE le dialogue.
    //
    // Depuis que `touches.ts` lit aussi `key`, l'Échap synthétique émis par
    // `fermerConteneurPiegeant` est reconnu comme un retour — et cet écouteur,
    // qui capture sur le document, le consommerait avant que `Modal` ou `Sheet`
    // ne le voient. On reculerait alors d'un écran en laissant la modale
    // ouverte par-dessus le précédent : exactement le défaut que ce renvoi
    // existe pour éviter.
    if (renvoiEnCours) return;

    const intention = lireIntention(evenement);
    if (!intention || intention.type !== "retour") return;

    evenement.preventDefault();
    evenement.stopPropagation();
    reculer();
  };

  document.addEventListener("keydown", surTouche, true);
  return () => document.removeEventListener("keydown", surTouche, true);
}

function reculer(): void {
  for (let position = pile.length - 1; position >= 0; position--) {
    if (pile[position]()) return;
  }

  if (fermerConteneurPiegeant()) return;

  if (surEcranRacine()) {
    rendreLaMainAuTeleviseur();
    return;
  }

  // Quitter le lecteur par l'historique sans le signaler laisserait la fiche
  // rejouer sa transition d'ouverture au retour, alors qu'on en revient.
  if (surLecteur()) markPlayerExit();
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
 * On n'essaie pas de deviner le bouton de fermeture : `conteneurPiegeant` rend
 * l'élément, pas son affordance. Rejouer la touche que ces composants écoutent
 * déjà est le seul moyen qui ne suppose rien de leur structure interne.
 *
 * L'événement synthétique ne porte pas de `keyCode` — mais `lireIntention` lit
 * désormais aussi `key`, et « Escape » y est un retour. Sans le drapeau, notre
 * propre écouteur reprendrait donc l'événement au vol. C'est lui, et non la
 * table des touches, qui garantit que le dialogue reçoit ce qu'on lui envoie.
 */
function fermerConteneurPiegeant(): boolean {
  if (renvoiEnCours) return false;
  const piege = conteneurPiegeant();
  if (!piege) return false;

  renvoiEnCours = true;
  try {
    piege.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  } finally {
    renvoiEnCours = false;
  }
  return true;
}

function surEcranRacine(): boolean {
  return CHEMINS_RACINE.indexOf(window.location.pathname) >= 0;
}

function surLecteur(): boolean {
  return window.location.pathname.indexOf("/tv/watch") === 0;
}
