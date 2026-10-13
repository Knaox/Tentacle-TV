import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia, type ScenePoster } from "../../sceneMedia";
import { FauxCard, FauxCursor, Place, SceneStage, useSceneClock } from "..";

/** L'arrivée sur la une, le pointeur qui va vers « Ou bien », le clic, la nouvelle une. */
const STEPS = [1400, 900, 500, 2400] as const;
const FRAME = { x: 20, y: 14, w: 600, h: 206 };
const ALT = { x: FRAME.x + FRAME.w - 196, y: FRAME.y + 38, w: 180, pitch: 50 };
const PICKED = 1;
const ROW_Y = 236;
const CARD_W = 72;
const CARD_PITCH = 84;

/** Le décor d'un titre : son image large, sinon son affiche — jamais un aplat inventé. */
function backdropOf(poster: ScenePoster | null): string | null {
  return poster?.backdropUrl ?? poster?.url ?? null;
}

/** Le texte de la une, posé sur son décor (tokens `on-media-*`, voiles noirs constants). */
function SpotlightText({ title, reason, match }: { title: string; reason: string; match: number }) {
  const { t } = useTranslation(["reco", "common"]);
  return (
    <div className="flex h-full max-w-[330px] flex-col justify-end gap-2 px-6 pb-5">
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-3 w-[3px] rounded-full" style={{ background: "linear-gradient(180deg, var(--brand-light), var(--brand-accent))" }} />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-media-primary">{t("reco:spotlightKicker")}</span>
        <span className="rounded-full bg-[rgba(var(--brand-rgb),0.9)] px-1.5 py-px text-[9px] font-bold text-cta-brand-fg">{t("reco:spotlightMatch", { match })}</span>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-on-media-primary">
        <Sparkles size={11} aria-hidden className="text-[var(--brand-accent-light)]" />
        {reason}
      </p>
      <p className="line-clamp-2 text-[22px] font-bold leading-tight text-on-media-primary">{title}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="hero-cta-primary rounded-full px-3.5 py-1 text-[11px] font-bold">{t("reco:spotlightPlay")}</span>
        <span className="rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.45)] px-3 py-1 text-[11px] font-semibold text-on-media-primary">{t("common:trailer")}</span>
      </div>
    </div>
  );
}

/**
 * « Pour vous », refaite : la page s'ouvre sur « À la une ce soir » — le
 * meilleur titre, sa raison, sa correspondance, Lire et la bande-annonce —,
 * « Ou bien » à côté pour qui hésite (un clic le met à la une), et dessous
 * « Films pour vous ». De vraies affiches et de vrais décors de la
 * bibliothèque (sceneMedia), les vrais mots de la page.
 */
export function ForYouScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["reco"]);
  const media = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const switched = step >= 2;
  const first = posterAt(media, 0);
  const second = posterAt(media, 2);
  const choices = [posterAt(media, 1), second, posterAt(media, 3)];
  const reason = (seed: ScenePoster | null) => t("reco:whySimilar", { titles: seed?.title ?? "" });

  return (
    <SceneStage cycle={cycle}>
      <Place x={FRAME.x} y={FRAME.y} w={FRAME.w} h={FRAME.h} className="overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-white/10">
        {[first, second].map((poster, i) => {
          const url = backdropOf(poster);
          return (
            <Place key={i} x={0} y={0} w={FRAME.w} h={FRAME.h} visible={i === 0 ? !switched : switched}>
              {url && <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-transparent" />
              <div className="absolute inset-0">
                <SpotlightText title={poster?.title ?? ""} reason={reason(posterAt(media, i === 0 ? 4 : 5))} match={i === 0 ? 96 : 91} />
              </div>
            </Place>
          );
        })}
        <Place x={ALT.x - FRAME.x} y={ALT.y - FRAME.y - 22} w={ALT.w} h={ALT.pitch * 3 + 28} className="rounded-xl bg-[rgba(var(--scrim-media-rgb),0.72)] ring-1 ring-white/10">
          <span className="absolute left-2.5 top-1.5 text-[9px] font-semibold text-on-media-secondary">{t("reco:spotlightAlternatives")}</span>
        </Place>
        {choices.map((poster, i) => {
          const url = backdropOf(poster);
          const selected = switched ? i === PICKED : false;
          return (
            <Place key={i} x={ALT.x - FRAME.x + 6} y={ALT.y - FRAME.y + i * ALT.pitch} w={ALT.w - 12} h={ALT.pitch - 6}
              className={`flex items-center gap-2 rounded-lg p-1 ${selected ? "bg-[rgba(var(--brand-rgb),0.3)] ring-1 ring-[rgba(var(--brand-rgb),0.7)]" : ""}`}>
              <span className="h-[34px] w-[60px] shrink-0 overflow-hidden rounded-md bg-fill-strong">
                {url && <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />}
              </span>
              <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-on-media-primary">{poster?.title ?? ""}</span>
            </Place>
          );
        })}
      </Place>
      <Place x={FRAME.x} y={ROW_Y} w={FRAME.w}>
        <span className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-content-primary">
          <span aria-hidden className="h-3.5 w-[3px] rounded-full" style={{ background: "linear-gradient(180deg, var(--brand), var(--brand-accent))" }} />
          {t("reco:rowForYouMovies")}
        </span>
      </Place>
      {Array.from({ length: 7 }, (_, i) => (
        <FauxCard key={i} x={FRAME.x + i * CARD_PITCH} y={ROW_Y + 20} w={CARD_W} poster={posterAt(media, i + 6)} tone={i} />
      ))}
      <FauxCursor
        x={step === 0 ? 300 : ALT.x + 40}
        y={step === 0 ? 300 : ALT.y + PICKED * ALT.pitch + 18}
        pressed={step === 2} reduced={reduced}
      />
    </SceneStage>
  );
}
