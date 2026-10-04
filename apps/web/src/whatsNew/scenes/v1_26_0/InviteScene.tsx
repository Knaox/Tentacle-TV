import { useTranslation } from "react-i18next";
import { Check, DoorOpen, Tv, Users } from "lucide-react";
import type { SceneProps } from "../../types";
import { FamilyAvatar } from "../../../family/FamilyAvatar";
import { FauxCursor, FauxRow, Place, SceneStage, useSceneClock } from "..";

/** L'accueil, l'affiche qui paraît, « Accepter », la famille rejointe. */
const STEPS = [1300, 2200, 900, 1800] as const;
const POSTER_X = 176;
const POSTER_Y = 46;
const POSTER_W = 288;
/** Le centre de « Accepter », mesuré au banc. */
const ACCEPT = { x: 320, y: 232 };

/**
 * L'AFFICHE d'une invitation : par-dessus l'accueil (ses vraies affiches),
 * « Alex vous invite à rejoindre sa famille », ce qu'accepter implique — son
 * profil s'ouvrira sur les TV de la famille sans mot de passe, sauf code
 * PIN ; on peut quitter à tout moment —, puis Accepter / Refuser / Plus tard.
 * Les mots sont ceux de l'affiche (`family:poster`), au mot près.
 */
export function InviteScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["whatsNew", "family", "familyWeb", "common"]);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const owner = t("whatsNew:sceneFamilyOwner");
  const posterShown = step === 1 || step === 2;

  return (
    <SceneStage cycle={cycle}>
      <FauxRow x={40} y={40} title={t("common:resumeWatching")} count={6} cardW={82} gap={16} />
      <FauxRow x={40} y={200} title={t("common:latestAdditionsShort")} count={6} cardW={82} gap={16} offset={6} />
      <Place x={0} y={0} w={640} h={360} visible={posterShown}>
        <div className="h-full w-full bg-black/60" />
      </Place>
      <Place x={POSTER_X} y={POSTER_Y} w={POSTER_W} visible={posterShown} scale={posterShown ? 1 : 0.96}>
        <div className="rounded-2xl border border-line-subtle bg-surface-modal p-4 text-center shadow-2xl">
          <div className="relative mx-auto w-fit">
            <FamilyAvatar userId={owner} name={owner} color="violet" imageTag={null} size={40} />
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-cta-brand-fg" style={{ backgroundImage: "var(--cta-brand-gradient)" }}>
              <Users size={10} aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-[13px] font-bold leading-tight text-content-primary">{t("family:poster.title", { owner })}</p>
          <ul className="mt-3 space-y-1.5 rounded-lg border border-line-subtle bg-fill-subtle p-2.5 text-left">
            <li className="flex gap-2 text-[9.5px] leading-snug text-content-secondary">
              <Tv size={11} aria-hidden="true" className="mt-px flex-shrink-0 text-[var(--brand-light)]" />
              {t("family:poster.profile", { owner })}
            </li>
            <li className="flex gap-2 text-[9.5px] leading-snug text-content-secondary">
              <DoorOpen size={11} aria-hidden="true" className="mt-px flex-shrink-0 text-[var(--brand-light)]" />
              {t("family:poster.leave")}
            </li>
          </ul>
          <div className="mt-3 flex h-8 items-center justify-center rounded-lg text-[11px] font-bold text-cta-brand-fg" style={{ backgroundImage: "var(--cta-brand-gradient)" }}>
            {t("family:poster.accept")}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[10px] font-semibold">
            <span className="flex h-7 items-center justify-center rounded-lg border border-line-subtle bg-fill-soft text-content-primary">{t("family:poster.decline")}</span>
            <span className="flex h-7 items-center justify-center text-content-secondary">{t("family:poster.later")}</span>
          </div>
        </div>
      </Place>
      <Place x={170} y={300} w={300} visible={step === 3} dy={step === 3 ? 0 : 8}>
        <div className="flex items-center justify-center gap-2 rounded-full border border-line-subtle bg-surface-3 px-3 py-2 text-[11px] font-medium text-content-primary shadow-xl">
          <Check size={13} aria-hidden="true" className="text-status-success-fg" />
          {t("familyWeb:poster.accepted", { owner })}
        </div>
      </Place>
      <FauxCursor x={ACCEPT.x} y={ACCEPT.y} pressed={step === 2} hidden={step !== 2} reduced={reduced} />
    </SceneStage>
  );
}
