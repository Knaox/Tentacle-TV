import { STILL_WATCHING_COUNTDOWN_DEFAULT_MS } from "@tentacle-tv/shared";
import type { SceneProps } from "../../types";
import { formatDuration } from "../../../components/playerControls/utils";
import { useSceneMedia } from "../../sceneMedia";
import { CARD_TONES, SceneStage, useSceneClock } from "..";
import { FauxPlayerChrome, PLAYER_BOTTOM_BAR_H } from "./FauxPlayerChrome";
import { FauxStillWatchingCard } from "./FauxStillWatchingCard";

/** Les secondes du décompte par défaut (Réglages › Lecture › « Temps pour répondre »). */
const COUNT = Math.round(STILL_WATCHING_COUNTDOWN_DEFAULT_MS / 1000);
/**
 * Le film tourne, sans contrôles ; l'encart paraît ; le décompte file — la
 * scène resserre les dix secondes, une par battement — ; personne ne répond,
 * la lecture se met en pause et l'image finale la montre.
 */
const STEPS: readonly number[] = [1300, 650, ...Array.from({ length: COUNT - 1 }, () => 300), 3200];
const ASK = 1;
const PAUSED = COUNT + 1;
/** La place de l'encart : le coin bas-droit, celle de « Passer l'intro ». */
const CARD = { right: 624, bottom: 334, w: 238 };
/** Contrôles à l'écran (la pause les fait paraître) : l'encart monte au-dessus, sans les cacher. */
const LIFT = PLAYER_BOTTOM_BAR_H - 8;
/** 1 h 31 : passé le délai par défaut (1 h 30 sans le moindre geste). */
const POSITION_S = 91 * 60 + 4;

/**
 * « Vous regardez encore ? » : un vrai décor de titre plein cadre — le film —,
 * aucun pointeur (personne ne touche à rien), l'encart qui paraît dans le
 * coin, son décompte et sa barre qui se vident, puis « Lecture en pause » :
 * les contrôles reparaissent, l'encart monte au-dessus d'eux et propose
 * « Reprendre ».
 */
export function StillWatchingScene({ active, reduced }: SceneProps) {
  const media = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  // Le décor du titre du bandeau ; à défaut, celui d'une affiche de l'accueil — jamais un aplat tant qu'une image existe.
  const fallback = media.posters.find((p) => p.backdropUrl);
  const backdrop = media.backdrop ?? (fallback?.backdropUrl ? { url: fallback.backdropUrl, title: fallback.title } : null);
  const detail = media.backdrop ? media.detail : null;
  const runtimeS = detail?.type === "Movie" && detail.runtimeMinutes && detail.runtimeMinutes * 60 > POSITION_S
    ? detail.runtimeMinutes * 60
    : null;
  const time = runtimeS ? `${formatDuration(POSITION_S)} / ${formatDuration(runtimeS)}` : formatDuration(POSITION_S);
  const paused = step >= PAUSED;
  const asking = step >= ASK && !paused;
  const left = asking ? COUNT - (step - ASK) : COUNT;

  return (
    <SceneStage cycle={cycle}>
      {backdrop ? (
        <img src={backdrop.url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: CARD_TONES[1] }} />
      )}
      <FauxPlayerChrome
        title={backdrop?.title ?? ""} time={time} progress={runtimeS ? POSITION_S / runtimeS : 0.7} visible={paused}
      />
      <FauxStillWatchingCard
        right={CARD.right} bottom={CARD.bottom} w={CARD.w}
        phase={paused ? "paused" : asking ? "asking" : "hidden"}
        seconds={left}
        fraction={asking ? (left - 1) / COUNT : 1}
        fractionS={(STEPS[step] ?? 0) / 1000}
        lift={paused ? LIFT : 0}
        reduced={reduced}
      />
    </SceneStage>
  );
}
