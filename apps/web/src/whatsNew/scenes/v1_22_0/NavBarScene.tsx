import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { CARD_TONES, FauxCard, FauxCursor, Place, SceneStage, STAGE_H, STAGE_W, useSceneClock } from "..";
import { FauxNavBar, tabCenter } from "./FauxNavBar";
import { FauxNavPanel, MY_LIST_PIN } from "./FauxNavPanel";

const STEPS = [700, 600, 750, 600, 750, 600, 1600] as const;
const REST = { x: 520, y: 300 } as const;
const POSTERS = [0, 1, 2, 3, 4, 5] as const;

/**
 * La nouvelle barre : un clic sur « Pour vous », l'indicateur change
 * d'onglet et la page avec lui ; « Plus » s'ouvre, et « Ma liste »
 * s'épingle — son onglet prend place après « Pour vous », les suivants se
 * décalent. L'accueil est le vrai fond de la sélection du bandeau.
 */
export function NavBarScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const media = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const onForYou = step >= 2;
  const open = step >= 4;
  const pinned = step >= 6;
  const target = step >= 5 ? MY_LIST_PIN : step >= 3 ? tabCenter(4) : step >= 1 ? tabCenter(1) : REST;
  return (
    <SceneStage cycle={cycle}>
      <Place x={0} y={0} w={STAGE_W} h={STAGE_H} visible={!onForYou}>
        {media.backdrop ? (
          <img src={media.backdrop.url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: CARD_TONES[1] }} />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.2) 55%, rgba(0, 0, 0, 0.4) 100%)" }}
        />
        <p className="absolute bottom-10 left-8 max-w-[440px] truncate text-[26px] font-bold tracking-tight text-white">
          {media.backdrop?.title ?? " "}
        </p>
      </Place>

      <Place x={24} y={84} w={592} visible={onForYou}>
        <p className="text-[14px] font-semibold text-content-primary">{t("reco:rowForYou")}</p>
      </Place>
      {/* Isolées : leurs badges de note ont un `z-index`, « Plus » s'ouvre par-dessus. */}
      <div className="absolute inset-0 isolate">
        {POSTERS.map((i) => (
          <FauxCard key={i} x={24 + i * 100} y={112} w={88} poster={posterAt(media, i + 1)} tone={i} visible={onForYou} dy={onForYou ? 0 : 8} />
        ))}
      </div>

      <FauxNavBar active={onForYou ? "forYou" : "home"} pinned={pinned} moreOpen={open} />
      <FauxNavPanel open={open} pinned={pinned} />
      <FauxCursor x={target.x} y={target.y} pressed={step === 2 || step === 4 || step === 6} reduced={reduced} />
    </SceneStage>
  );
}
