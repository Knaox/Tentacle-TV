import { useEffect, useMemo, type MutableRefObject } from "react";
import { useSetItemTrackPreference } from "@tentacle-tv/api-client";
import type { MediaItem, MediaStream as JfStream } from "@tentacle-tv/shared";
import { rememberItemTracks } from "../offline/localItemTracks";
import { trackChoiceOf } from "./trackChoice";

/**
 * Mémorise, pour CE contenu, les langues choisies dans les réglages du lecteur.
 *
 * Automatique et silencieux : dès que l'utilisateur change de piste audio ou de
 * sous-titre, le choix est enregistré pour ce film ou cet épisode, et réappliqué
 * au visionnage suivant du même contenu — en priorité sur ses préférences
 * globales de langue (la résolution s'arrête au premier niveau trouvé, cf.
 * `preferences.resolve.ts`).
 *
 * # Ce qui le distingue de « Appliquer à cette série »
 *
 * Cette case-là reste, et elle garde son rôle : porter un choix sur les épisodes
 * PAS ENCORE regardés d'une série. Elle est explicite, opt-in, et ne couvre que
 * les épisodes. Ici, rien à cocher, et les films sont inclus.
 *
 * # Deux règles qui ne se voient pas mais qui décident de tout
 *
 * 1. On enregistre des LANGUES, jamais des index de piste. Ceux des pistes
 *    externes sont décalés de +1000 en lecture locale, et ceux de Jellyfin
 *    changent entre lecture directe et transcodage : un index mémorisé
 *    désignerait la mauvaise piste, ou aucune.
 * 2. Rien n'est écrit sans geste EXPLICITE de l'utilisateur. Les drapeaux
 *    d'override sont posés par les gestionnaires de changement de piste du
 *    lecteur ; sans eux, la piste courante n'est qu'un défaut de conteneur ou le
 *    résultat de la résolution — l'enregistrer figerait un choix que personne n'a
 *    fait, et pire, écraserait le vrai à la première lecture où la piste préférée
 *    est absente du média.
 */
export function useRememberItemTracks({
  item,
  streams,
  audioIndex,
  subtitleIndex,
  audioOverrideRef,
  subtitleOverrideRef,
  sideCars,
}: {
  item: MediaItem | undefined;
  streams: JfStream[];
  audioIndex: number;
  subtitleIndex: number | null;
  audioOverrideRef: MutableRefObject<boolean>;
  subtitleOverrideRef: MutableRefObject<boolean>;
  /** Side-cars de la lecture locale : la langue d'un sous-titre externe (+1000). */
  sideCars?: ReadonlyArray<{ fileName: string }>;
}): void {
  const setPref = useSetItemTrackPreference();
  const itemId = item?.Id;

  /**
   * Langues courantes, plus le MODE de sous-titres déduit de la piste choisie.
   *
   * Le mode est conservé dans toute sa finesse — `forced` et `signs` compris :
   * la piste retenue dit d'elle-même ce qu'elle est (`trackChoiceOf`, la règle
   * que « Appliquer à cette série » suit aussi).
   */
  const choice = useMemo(
    () => trackChoiceOf({ streams, audioIndex, subtitleIndex, sideCars }),
    [streams, audioIndex, subtitleIndex, sideCars],
  );

  useEffect(() => {
    if (!itemId || setPref.isPending) return;
    if (!audioOverrideRef.current && !subtitleOverrideRef.current) return;
    // Miroir local d'abord : la lecture hors ligne n'a pas de backend à
    // interroger, et le cache est borné (cf. `localItemTracks`).
    rememberItemTracks(itemId, choice);
    setPref.mutate({ itemId, ...choice });
    // Les refs d'override sont volontairement absentes des dépendances : ce sont
    // des refs, elles ne déclenchent pas de rendu. Ce sont les index qui portent
    // le signal, et ils changent au moment même où l'utilisateur agit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, choice]);
}
