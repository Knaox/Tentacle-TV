import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { CARD_TONES, Place, SceneStage, STAGE_H, STAGE_W, useSceneClock } from "..";
import { FauxOmnibox } from "./FauxOmnibox";
import { sceneQueryFor } from "./sceneQuery";

const STEPS = [900, 500, 700, 2100] as const;
const BOX = { x: 70, y: 22, w: 500, h: 262 } as const;

/**
 * La recherche malgré la faute : un VRAI titre de la bibliothèque, tapé avec
 * deux lettres inversées (`sceneQueryFor`), et le meilleur résultat qui
 * arrive quand même — « Résultats pour … » au-dessus, le temps du moteur en
 * pied. La frappe se fait en deux temps : la moitié, puis tout. Derrière,
 * l'accueil sous le voile de l'omnibox (le fond de la sélection du bandeau).
 */
export function SearchScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const media = useSceneMedia();
  const poster = posterAt(media, 0);
  const title = poster?.title ?? media.backdrop?.title ?? t("whatsNew:sceneNowPlaying");
  const query = useMemo(() => sceneQueryFor(title), [title]);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const typed = step === 0 ? "" : step === 1 ? query.typed.slice(0, Math.ceil(query.typed.length / 2)) : query.typed;
  return (
    <SceneStage cycle={cycle}>
      <Place x={0} y={0} w={STAGE_W} h={STAGE_H}>
        {media.backdrop ? (
          <img src={media.backdrop.url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: CARD_TONES[1] }} />
        )}
        <div className="absolute inset-0 bg-[rgba(var(--scrim-page-rgb),0.62)]" />
      </Place>
      <FauxOmnibox
        x={BOX.x}
        y={BOX.y}
        w={BOX.w}
        h={BOX.h}
        typed={typed}
        corrected={query.corrected}
        terms={query.terms}
        hit={poster}
        answered={step === 3}
      />
    </SceneStage>
  );
}
