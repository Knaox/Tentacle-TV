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
 * **L'URL est masquée pendant la résolution**, et c'est le point délicat. Rendre
 * le manifeste maître en attendant paraîtrait plus doux, mais le lecteur s'en
 * saisirait aussitôt : la lecture démarrerait sur la variante que le téléviseur
 * aurait choisie — celle qu'on cherche justement à éviter — et changer de source
 * ensuite couperait l'image. Le spinner du lecteur couvre l'attente, qui est
 * d'un aller-retour sur un fichier de quelques kilo-octets.
 *
 * L'état retient l'URL POUR LAQUELLE il a été calculé. Sans cela, un changement
 * de piste audio — qui produit un nouveau manifeste — se verrait servir la
 * variante du précédent.
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

  if (resolue && resolue.pour === brute) {
    // `url` à `null` signifie « pas de variante Dolby Vision ici » : c'est le
    // cas de tous les remux ordinaires, et le manifeste maître convient.
    return resolue.url ? { ...socle, streamUrl: resolue.url } : socle;
  }

  // Résolution en cours. `isLoading` garde le spinner et empêche le lecteur de
  // conclure à une source manquante.
  return { ...socle, streamUrl: "", isLoading: true };
}
