import { useEffect, useMemo, type MutableRefObject } from "react";
import { useSetItemTrackPreference } from "@tentacle-tv/api-client";
import type { MediaItem, MediaStream as JfStream } from "@tentacle-tv/shared";
import { rememberItemTracks } from "../offline/localItemTracks";

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
}: {
  item: MediaItem | undefined;
  streams: JfStream[];
  audioIndex: number;
  subtitleIndex: number | null;
  audioOverrideRef: MutableRefObject<boolean>;
  subtitleOverrideRef: MutableRefObject<boolean>;
}): void {
  const setPref = useSetItemTrackPreference();
  const itemId = item?.Id;

  /**
   * Langues courantes, plus le MODE de sous-titres déduit de la piste choisie.
   *
   * Le mode est conservé dans toute sa finesse — `forced` et `signs` compris.
   * La case « Appliquer à cette série » le réduit, elle, à `none | always`, si
   * bien qu'un utilisateur en mode « forcés » qui touchait à une piste voyait son
   * réglage se transformer en « toujours ». Ici la piste retenue dit d'elle-même
   * ce qu'elle est.
   */
  const choix = useMemo(() => {
    const audioLang =
      streams.find((s) => s.Type === "Audio" && s.Index === audioIndex)?.Language ?? null;
    if (subtitleIndex === null) {
      return { audioLang, subtitleLang: null, subtitleMode: "none" as const };
    }
    const sub = streams.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex);
    const titre = [sub?.Title, sub?.DisplayTitle].filter(Boolean).join(" ");
    const forcee = !!sub?.IsForced || /\bforc(ed|é)e?s?\b/i.test(titre);
    const signes = /\b(sign|songs)\b/i.test(titre);
    return {
      audioLang,
      subtitleLang: sub?.Language ?? null,
      subtitleMode: (signes ? "signs" : forcee ? "forced" : "always") as "signs" | "forced" | "always",
    };
  }, [streams, audioIndex, subtitleIndex]);

  useEffect(() => {
    if (!itemId || setPref.isPending) return;
    if (!audioOverrideRef.current && !subtitleOverrideRef.current) return;
    // Miroir local d'abord : la lecture hors ligne n'a pas de backend à
    // interroger, et le cache est borné (cf. `localItemTracks`).
    rememberItemTracks(itemId, choix);
    setPref.mutate({ itemId, ...choix });
    // Les refs d'override sont volontairement absentes des dépendances : ce sont
    // des refs, elles ne déclenchent pas de rendu. Ce sont les index qui portent
    // le signal, et ils changent au moment même où l'utilisateur agit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, choix]);
}
