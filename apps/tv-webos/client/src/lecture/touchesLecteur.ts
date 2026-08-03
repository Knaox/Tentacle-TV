import { lireIntention, type TransportCommande } from "../focus/touches";

/**
 * Les touches de transport de la télécommande.
 *
 * Une télécommande LG porte des touches dédiées — lecture, pause, arrêt,
 * avance et retour rapides — que le client web ne connaît pas : il n'a jamais
 * eu affaire qu'à un clavier, où ces touches n'existent pas. Sans ce module
 * elles resteraient muettes, et l'utilisateur devrait piloter la lecture en
 * naviguant jusqu'aux boutons de la barre de contrôle.
 *
 * Le module agit directement sur l'élément `<video>`, sans passer par les
 * composants. Ce n'est pas un contournement : le lecteur du client web est
 * lui-même piloté par cet élément, et tout ce qui l'observe — barre de
 * progression, télémétrie de lecture, reprise — écoute ses événements. Une
 * pause déclenchée ici est donc vue exactement comme un clic sur le bouton.
 */

/** Pas de déplacement des touches d'avance et de retour, en secondes. */
const PAS_SECONDES = 30;

export function installerTouchesLecteur(): () => void {
  const surTouche = (evenement: KeyboardEvent) => {
    const intention = lireIntention(evenement);
    if (!intention || intention.type !== "transport") return;

    const video = document.querySelector("video");
    if (!video) return;

    evenement.preventDefault();
    evenement.stopPropagation();
    appliquer(video, intention.commande);
  };

  document.addEventListener("keydown", surTouche, true);
  return () => document.removeEventListener("keydown", surTouche, true);
}

function appliquer(video: HTMLVideoElement, commande: TransportCommande): void {
  switch (commande) {
    case "lecture":
      // Volontairement une bascule et non un simple `play()` : sur certaines
      // télécommandes, lecture et pause partagent la même touche.
      if (video.paused) void video.play();
      else video.pause();
      return;

    case "pause":
      video.pause();
      return;

    case "arret":
      video.pause();
      // Le retour à l'écran précédent revient au routeur : l'historique du
      // navigateur est ce que `App` connaît, et lui seul sait d'où l'on vient.
      window.history.back();
      return;

    case "avance":
      deplacer(video, PAS_SECONDES);
      return;

    case "retour":
      deplacer(video, -PAS_SECONDES);
      return;
  }
}

/**
 * Déplacement borné.
 *
 * Écrire un `currentTime` négatif ou au-delà de la durée déclenche un `seeked`
 * sur une position que le serveur refuse ; sur un flux transcodé, cela suffit
 * à interrompre la session. Le dernier instant est écarté d'une seconde pour
 * ne pas provoquer la fin de lecture par mégarde.
 */
function deplacer(video: HTMLVideoElement, secondes: number): void {
  const duree = Number.isFinite(video.duration) ? video.duration : null;
  const cible = video.currentTime + secondes;
  video.currentTime = Math.max(0, duree === null ? cible : Math.min(cible, duree - 1));
}
