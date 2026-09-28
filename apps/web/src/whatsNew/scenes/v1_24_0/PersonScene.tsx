import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { creditRoleKey, normalizeCreditRole } from "@tentacle-tv/shared";
import type { SceneProps } from "../../types";
import { FauxCursor, Place, SceneStage, sceneSpring, sceneTween, useSceneClock } from "..";
import { FauxDetailBackdrop } from "./FauxDetailStage";
import { FauxPersonPage } from "./FauxPersonPage";
import { FauxPortrait } from "./FauxPortrait";
import { useFauxDetail } from "./useFauxDetail";
import { useScenePerson } from "./useScenePerson";

const STEPS = [800, 700, 300, 1100, 2000] as const;
const CAST = { x: 28, y: 176, w: 74, gap: 26 } as const;

/**
 * Le générique mène aux gens : sous la fiche, « Casting et équipe ». Le
 * curseur choisit la première personne — la carte monte, son liseré de marque
 * paraît — et sa page s'ouvre : portrait, métiers, vie, puis ses titres dans
 * la bibliothèque.
 */
export function PersonScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["media", "whatsNew"]);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const page = useScenePerson();
  const fiche = useFauxDetail();
  const fallbackName = t("whatsNew:scenePersonName");
  const cast = page.cast.length > 0 ? page.cast : [{ id: "scene", name: fallbackName, role: null, kind: "Actor", portraitUrl: null }];
  const aiming = step >= 1;
  const open = step >= 3;
  const target = { x: CAST.x + CAST.w * 0.6, y: CAST.y + 60 };
  return (
    <SceneStage cycle={cycle}>
      <div className="absolute inset-x-0 top-0 h-[150px]">
        <FauxDetailBackdrop url={fiche.backdropUrl} />
      </div>
      <Place x={28} y={70} w={240} h={48}>
        {fiche.logoUrl ? (
          <img src={fiche.logoUrl} alt="" draggable={false} className="h-full w-auto max-w-full object-contain object-left-bottom" />
        ) : (
          <p className="flex h-full items-end truncate text-[20px] font-bold tracking-tight text-on-media-primary">{fiche.title}</p>
        )}
      </Place>
      <Place x={28} y={150} w={400}>
        <span className="text-[13px] font-semibold tracking-tight text-content-primary">{t("media:castAndCrew")}</span>
      </Place>
      {cast.map((person, i) => {
        const role = normalizeCreditRole(person.kind);
        const subtitle = role && role !== "Actor" && role !== "Other" ? t(creditRoleKey(role)) : person.role;
        const hovered = i === 0 && aiming;
        return (
          <Place key={person.id} x={CAST.x + i * (CAST.w + CAST.gap)} y={CAST.y} w={CAST.w} dy={hovered ? -3 : 0} transition={sceneSpring}>
            <div className="relative">
              <FauxPortrait name={person.name} url={person.portraitUrl} className="rounded-[var(--radius-md)] ring-1 ring-line-subtle" />
              <motion.span
                className="absolute inset-0 rounded-[var(--radius-md)] ring-2 ring-[rgba(var(--brand-rgb),0.7)]"
                initial={false}
                animate={{ opacity: hovered ? 1 : 0 }}
                transition={sceneTween}
              />
            </div>
            <p className="mt-1.5 truncate text-[10px] font-medium text-content-primary">{person.name}</p>
            {subtitle && <p className={`truncate text-[9px] ${role && role !== "Actor" ? "text-brand-light" : "text-content-tertiary"}`}>{subtitle}</p>}
          </Place>
        );
      })}
      <FauxPersonPage page={page} name={page.person?.name ?? fallbackName} visible={open} filmography={step >= 4} />
      <FauxCursor x={aiming ? target.x : 540} y={aiming ? target.y : 330} pressed={step === 2} hidden={open} reduced={reduced} />
    </SceneStage>
  );
}
