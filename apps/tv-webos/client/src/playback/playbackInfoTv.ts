import { useEffect, useMemo, useState } from "react";
import { usePlaybackInfo as webBase } from "@/hooks/usePlaybackInfo?original";
import { isMasterManifest, resolveDoviVariant } from "./doviVariant";
import { withShortSegments } from "./segmentLength";

/**
 * Le lecteur reçoit la variante Dolby Vision, pas le manifeste maître.
 *
 * On enveloppe le hook du web plutôt que de le recopier : tout ce qui décide de
 * la lecture directe, du repli et du journal reste sa propriété. La seule chose
 * qu'on lui prend est le CHOIX DE LA VARIANTE, que le téléviseur fait mal
 * (cf. `doviVariant.ts`).
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
export function usePlaybackInfo(nativePlayer = false) {
  const webInfo = webBase(nativePlayer);
  const raw = useMemo(() => withShortSegments(webInfo.streamUrl), [webInfo.streamUrl]);
  const [resolvedVariant, setResolvedVariant] = useState<{ forUrl: string; url: string | null } | null>(null);
  const served = resolvedVariant?.url ?? raw;

  /**
   * Le verdict, rendu juste par l'URL qu'on sert réellement.
   *
   * `usePlaybackInfo` l'évalue sur le manifeste MAÎTRE, qui ne dit rien du sort
   * de l'image : le seul indice y est `VideoRangeTypeNotSupported`, classé raison
   * de ré-encodage — à raison dans le cas général, celui d'un tone mapping. Mais
   * c'est aussi la raison que produit le mécanisme qui va CHERCHER le remux, si
   * bien que le verdict annonçait « recompressée » sur une image copiée.
   *
   * La variante, elle, tranche : Jellyfin marque `AllowVideoStreamCopy=false`
   * sur les replis ré-encodés, et sur eux seuls. Et si une variante Dolby Vision
   * est servie, il n'y a pas de tone mapping — le serveur ne l'aurait pas
   * produite.
   */
  const verdict = useMemo(() => {
    const base = webInfo.verdict;
    if (!base || !base.videoReencoded || !resolvedVariant?.url) return base;
    if (/[?&]AllowVideoStreamCopy=false/i.test(resolvedVariant.url)) return base;
    return { ...base, mode: "Remux" as const, videoReencoded: false };
  }, [webInfo.verdict, resolvedVariant]);

  // Relevé pour la surcouche de diagnostic — DÉVELOPPEMENT UNIQUEMENT.
  // `import.meta.env.DEV` est remplacé littéralement par Vite : en build livré,
  // la branche entière est du code mort, et l'import dynamique qu'elle contient
  // n'entraîne rien dans le fragment servi au téléviseur.
  useEffect(() => {
    if (!import.meta.env.DEV && !__TV_DEBUG__) return;
    const sample = verdict;
    void import("../debug/playbackOverlay").then(({ publishPlayback }) => {
      const streams = webInfo.mediaSource?.MediaStreams?.find((s) => s.Type === "Video");
      publishPlayback(
        sample
          ? {
              mode: sample.mode,
              videoReencoded: sample.videoReencoded,
              reasons: sample.reasons,
              videoCodec: streams?.Codec,
              range: streams?.VideoRangeType,
              url: served,
            }
          : null,
      );
    });
  }, [verdict, webInfo.mediaSource, served]);

  useEffect(() => {
    if (!raw || !isMasterManifest(raw)) return;
    let alive = true;
    void resolveDoviVariant(raw).then((url) => {
      // `alive` : la source a pu changer pendant l'aller-retour. Écrire ici
      // remplacerait la variante courante par celle d'une source abandonnée.
      if (alive) setResolvedVariant({ forUrl: raw, url });
    });
    return () => {
      alive = false;
    };
  }, [raw]);

  // `raw`, et non `webInfo.streamUrl` : la longueur de segment imposée doit
  // survivre à ce chemin-là aussi.
  if (!raw || !isMasterManifest(raw)) return { ...webInfo, streamUrl: raw };

  // Résolue pour CETTE source : `url` à `null` signifie « pas de variante Dolby
  // Vision ici », le cas de tous les remux ordinaires, et le manifeste maître
  // convient. Résolue pour une AUTRE : on tient la précédente le temps de
  // l'aller-retour plutôt que de faire démonter le lecteur.
  if (resolvedVariant) return { ...webInfo, streamUrl: served, verdict };

  // Tout premier manifeste de la session : il n'y a pas de source antérieure à
  // tenir. `null` est ce que le lecteur voit avant toute lecture — il n'est pas
  // encore monté, l'écran de chargement est le comportement attendu.
  return { ...webInfo, streamUrl: null, isLoading: true };
}
