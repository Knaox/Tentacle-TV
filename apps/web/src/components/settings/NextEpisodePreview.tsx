/**
 * L'aperçu de la fin d'épisode : la VRAIE fiche « à suivre ».
 *
 * Les trois réglages de fin d'épisode sont strictement indépendants, et c'est
 * précisément ce qui se comprend mal à la lecture — « proposer la fiche »,
 * « montrer le décompte », « enchaîner tout seul » se ressemblent en mots. Ils
 * ne se ressemblent pas à l'écran : sans fiche il n'y a rien, sans décompte la
 * fiche attend, sans enchaînement le décompte va au bout et il ne se passe rien.
 *
 * `UpNextCard` est montée telle quelle — même image, même badge, même barre de
 * progression. Elle est large de 420 px et le cadre en fait 460 : elle y tient
 * à sa taille réelle, sans transformée d'échelle.
 *
 * ⚠️ PAS d'`AnimatePresence` autour d'elle : sa sortie animée n'a pas de sens
 * dans un aperçu qu'on règle, et la faire disparaître en fondu à chaque clic
 * donnerait un panneau qui clignote.
 *
 * # Pourquoi une échelle mesurée, et pas une largeur imposée
 *
 * La carte se dimensionne sur le VIEWPORT (`min(420px, 100vw - 2rem)`), pas sur
 * son conteneur : dans une fenêtre étroite, le cadre rétrécit et elle non — elle
 * en sortait par la gauche. Plutôt que de lui apprendre une largeur d'aperçu —
 * un composant du lecteur n'a pas à connaître les réglages —, on mesure le cadre
 * et on l'y ramène par une transformée. C'est aussi la propriété la moins chère.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NextEpisodeSettings } from "@tentacle-tv/shared";
import { UpNextCard } from "../player/UpNextCard";
import { PreviewStage } from "./PreviewStage";
import { usePreviewCountdown } from "./usePreviewCountdown";

/** Ce que la phrase doit dire, selon la combinaison des trois réglages. */
function captionKey(next: NextEpisodeSettings): string {
  if (!next.nextCard) return "previewNextCaptionOff";
  if (!next.nextCountdown) return "previewNextCaptionCard";
  return next.nextAutoPlay ? "previewNextCaptionAuto" : "previewNextCaptionCountdown";
}

/** Largeur réelle de `UpNextCard`, plus la marge qu'elle garde à droite. */
const CARD_WIDTH = 420 + 16;

export function NextEpisodePreview({ next }: { next: NextEpisodeSettings }) {
  const { t } = useTranslation("preferences");
  const counting = next.nextCard && next.nextCountdown;
  const { seconds, cycle, ref, element } = usePreviewCountdown(counting, next.nextCountdownMs);
  const scale = useFitScale(element, CARD_WIDTH);

  return (
    <PreviewStage
      width="card"
      stageRef={ref}
      caption={t(captionKey(next), { seconds: Math.round(next.nextCountdownMs / 100) / 10 })}
    >
      {next.nextCard && (
        <div
          className="absolute inset-0 origin-bottom-right"
          style={{ transform: `scale(${String(scale)})` }}
        >
            <UpNextCard
            key={String(cycle)}
            countdown={counting ? seconds : null}
            totalSeconds={next.nextCountdownMs / 1000}
            episodeLabel={t("previewNextEpisodeLabel")}
            episodeTitle={t("previewNextEpisodeTitle")}
            onPlay={() => undefined}
            onDismiss={() => undefined}
          />
        </div>
      )}
    </PreviewStage>
  );
}

/**
 * Le facteur qui fait tenir un objet de `naturalWidth` dans le cadre mesuré.
 *
 * Jamais au-dessus de 1 : on rétrécit ce qui déborde, on n'agrandit rien — un
 * aperçu grossi ne montrerait plus la taille réelle du texte.
 */
function useFitScale(
  // L'ÉLÉMENT, pas un ref : l'effet se rejoue quand le cadre est remplacé —
  // un `.current` lu à dépendances figées ratait tout remontage.
  stage: HTMLDivElement | null,
  naturalWidth: number,
): number {
  const [scale, setScale] = useState(1);
  const naturalRef = useRef(naturalWidth);
  naturalRef.current = naturalWidth;

  useEffect(() => {
    if (!stage || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setScale(width > 0 ? Math.min(1, width / naturalRef.current) : 1);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stage]);

  return scale;
}
