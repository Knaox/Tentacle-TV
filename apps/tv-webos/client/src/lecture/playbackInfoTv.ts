import { useEffect, useState } from "react";
import { usePlaybackInfo as socleWeb } from "@/hooks/usePlaybackInfo?original";
import { estManifesteMaitre, resoudreVarianteDovi } from "./varianteDovi";

/**
 * Le lecteur reçoit la variante Dolby Vision, pas le manifeste maître.
 *
 * On enveloppe le hook du web plutôt que de le recopier : tout ce qui décide de
 * la lecture directe, du repli et du journal reste sa propriété. La seule chose
 * qu'on lui prend est le CHOIX DE LA VARIANTE, que le téléviseur fait mal
 * (cf. `varianteDovi.ts`).
 *
 * **On ne rend jamais une source vide**, et c'est tout le sujet de ce fichier.
 * La première version masquait l'URL le temps de l'aller-retour, pour que le
 * lecteur ne se saisisse pas du manifeste maître. Le raisonnement était juste,
 * la conséquence désastreuse : `WatchWeb` monte le lecteur sous condition de
 * `streamUrl`, si bien qu'une source vide le DÉMONTE. Il y perd les repères qui
 * vivent en lui — la dernière position lue, le fait que la lecture avait
 * commencé — et au remontage il repart de zéro. Pire, `CopyTimestamps` rend des
 * PTS absolus : le lecteur, sans point de comparaison, les prend pour un
 * décalage de conteneur, affiche 0, et RAPPORTE 0 à Jellyfin. Changer de piste
 * audio effaçait donc le point de reprise du film.
 *
 * D'où la règle : tant que la nouvelle variante n'est pas connue, on continue
 * de rendre la PRÉCÉDENTE. Le lecteur ne recharge rien — sa source n'a pas
 * changé — et quand la variante arrive, le changement se fait normalement, avec
 * ses repères intacts. Le prix est de quelques centaines de millisecondes sur
 * l'ancienne piste audio, invisible à côté du remontage.
 *
 * L'état retient l'URL POUR LAQUELLE il a été calculé. Sans cela, un changement
 * de piste audio — qui produit un nouveau manifeste — se verrait servir la
 * variante du précédent, définitivement.
 */
export function usePlaybackInfo(lecteurNatif = false) {
  const socle = socleWeb(lecteurNatif);
  const brute = socle.streamUrl;
  const [resolue, setResolue] = useState<{ pour: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!brute || !estManifesteMaitre(brute)) return;
    let vivant = true;
    void resoudreVarianteDovi(brute).then((url) => {
      // `vivant` : la source a pu changer pendant l'aller-retour. Écrire ici
      // remplacerait la variante courante par celle d'une source abandonnée.
      if (vivant) setResolue({ pour: brute, url });
    });
    return () => {
      vivant = false;
    };
  }, [brute]);

  if (!brute || !estManifesteMaitre(brute)) return socle;

  // Résolue pour CETTE source : `url` à `null` signifie « pas de variante Dolby
  // Vision ici », le cas de tous les remux ordinaires, et le manifeste maître
  // convient. Résolue pour une AUTRE : on tient la précédente le temps de
  // l'aller-retour plutôt que de faire démonter le lecteur.
  if (resolue) return resolue.url ? { ...socle, streamUrl: resolue.url } : socle;

  // Tout premier manifeste de la session : il n'y a pas de source antérieure à
  // tenir. `null` est ce que le lecteur voit avant toute lecture — il n'est pas
  // encore monté, l'écran de chargement est le comportement attendu.
  return { ...socle, streamUrl: null, isLoading: true };
}
