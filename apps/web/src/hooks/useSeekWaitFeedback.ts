import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TranscodeSeek } from "@tentacle-tv/api-client";
import type { PlaybackFailure } from "@tentacle-tv/shared";

/**
 * Ce que le lecteur web et le bureau montrent d'un saut pendant un
 * transcodage (`useTranscodeSeek`) : l'indicateur tant qu'on attend, la phrase
 * passé 5 s, et au délai dépassé le modèle d'erreur unique (`seekTimeout`,
 * « Réessayer » reprend au passage visé). L'atterrissage se lit sur les
 * relevés du moteur : la position, et s'il charge.
 */
export function useSeekWaitFeedback(seekWait: TranscodeSeek, sample: {
  position: number;
  buffering: boolean;
  onFailure?: (failure: PlaybackFailure) => void;
}): { waiting: boolean; hint: string | undefined } {
  const { t } = useTranslation("player");
  const { observe, reset, phase } = seekWait;
  const { position, buffering, onFailure } = sample;

  useEffect(() => { observe(position, buffering); }, [observe, position, buffering]);

  useEffect(() => {
    if (phase !== "failed") return;
    reset();
    onFailure?.({ from: "marker", marker: "seekTimeout" });
  }, [phase, reset, onFailure]);

  return {
    waiting: phase === "loading" || phase === "slow",
    hint: phase === "slow" ? t("seekPreparing") : undefined,
  };
}
