import { lireIntention } from "./touches";
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

  if (surEcranRacine()) {
    rendreLaMainAuTeleviseur();
    return;
  }

  // Quitter le lecteur par l'historique sans le signaler laisserait la fiche
  // rejouer sa transition d'ouverture au retour, alors qu'on en revient.
  if (surLecteur()) markPlayerExit();
  window.history.back();
}

function surEcranRacine(): boolean {
  return CHEMINS_RACINE.indexOf(window.location.pathname) >= 0;
}

function surLecteur(): boolean {
  return window.location.pathname.indexOf("/tv/watch") === 0;
}
