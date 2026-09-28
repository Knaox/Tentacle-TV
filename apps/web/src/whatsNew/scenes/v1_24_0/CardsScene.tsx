import type { CardStatusKind } from "@tentacle-tv/shared";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxCursor, SceneStage, useSceneClock } from "..";
import { FauxMarkedCard } from "./FauxMarkedCard";

const STEPS = [1300, 700, 600, 400, 600, 400, 800, 1700] as const;
const CARD = { x: 64, y: 78, w: 110, gap: 24 } as const;
/** La carte visée : la deuxième. Ses cibles, en px du canevas (étoiles `sm`, plateau `sm`). */
const TARGET = CARD.x + (CARD.w + CARD.gap);
const AIM = {
  poster: { x: TARGET + 70, y: CARD.y + 60 },
  fourthStar: { x: TARGET + 71, y: CARD.y + 109 },
  bookmark: { x: TARGET + 24, y: CARD.y + 139 },
  away: { x: 560, y: 330 },
} as const;

/** Les états des quatre cartes au repos — la deuxième gagne une note et le signet. */
const REST: ReadonlyArray<{ userScore: number | null; statuses: CardStatusKind[] }> = [
  { userScore: 9, statuses: ["watchlist"] },
  { userScore: null, statuses: ["favorite"] },
  { userScore: null, statuses: ["watched"] },
  { userScore: 7, statuses: ["watchlist", "watched"] },
];

/**
 * Les cartes au repos disent tout : la note du public et la vôtre dans la
 * même pastille, et les états — signet, cœur, coche — dans une capsule
 * d'angle. Au survol : les étoiles, puis le plateau d'actions, « Lire » en tête.
 * Le curseur note la deuxième, l'ajoute à Ma liste, puis la quitte : ses
 * marqueurs ont changé.
 */
export function CardsScene({ active, reduced }: SceneProps) {
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const media = useSceneMedia();
  const hovered = step >= 1 && step <= 5;
  const rated = step >= 3;
  const listed = step >= 5;
  const aim = step >= 6 ? AIM.away : step >= 4 ? AIM.bookmark : step >= 2 ? AIM.fourthStar : step >= 1 ? AIM.poster : AIM.away;
  return (
    <SceneStage cycle={cycle}>
      {REST.map((rest, i) => {
        const target = i === 1;
        const statuses: CardStatusKind[] = target && listed ? ["watchlist", ...rest.statuses] : rest.statuses;
        return (
          <FauxMarkedCard
            key={i}
            x={CARD.x + i * (CARD.w + CARD.gap)}
            y={CARD.y}
            w={CARD.w}
            poster={posterAt(media, i)}
            tone={i}
            userScore={target && rated ? 8 : rest.userScore}
            statuses={statuses}
            hovered={target && hovered}
            hoverable={target}
          />
        );
      })}
      <FauxCursor x={aim.x} y={aim.y} pressed={step === 3 || step === 5} reduced={reduced} />
    </SceneStage>
  );
}
