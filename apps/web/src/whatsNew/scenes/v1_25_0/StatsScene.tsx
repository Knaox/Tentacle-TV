import { useTranslation } from "react-i18next";
import { Info, Link2, Share2 } from "lucide-react";
import { heroFigure } from "@tentacle-tv/shared";
import type { SceneProps } from "../../types";
import { HBarList } from "../../../components/stats/HBarList";
import { useStatsFormat } from "../../../components/stats/useStatsFormat";
import { FauxCursor, Place, SceneStage, sceneTween, useSceneClock } from "..";
import { Shrink } from "./Shrink";

const STEPS = [1100, 1100, 1300, 700, 500, 900, 600, 1500, 1800] as const;
/** 412 heures : le chiffre de la carte d'ouverture, 17 journées pleines. */
const SECONDS = 412 * 3600 + 25 * 60;
const COUNTS = { movies: 96, episodes: 1204, series: 38, days: 211 } as const;
/** Les genres et leurs parts — les libellés sont ceux de la scène (clés `sceneGenre*`). */
const GENRES = [
  { key: "sceneGenreScifi", share: 0.34 },
  { key: "sceneGenreDrama", share: 0.27 },
  { key: "sceneGenreAnimation", share: 0.18 },
  { key: "sceneGenreThriller", share: 0.12 },
] as const;
const VERSIONS = [
  { key: "original", share: 0.63 },
  { key: "local", share: 0.37 },
] as const;
const SHARE_BUTTON = { x: 522, y: 16 } as const;
/** La fenêtre de partage, au centre, sur un voile : une modale, comme dans l'app. */
const PANEL = { x: 190, y: 104, w: 260 } as const;

/**
 * « Vos statistiques » : le temps devant l'écran, puis les genres et « VF ou
 * VO ? » qui arrivent en barres — les VRAIES barres de la page (`HBarList`),
 * montées à leur pas pour jouer leur entrée. Le curseur ouvre « Partager »,
 * crée le lien : il est actif, pour la période choisie. Puis la fenêtre se
 * referme sur la page.
 */
export function StatsScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation("whatsNew");
  const { t: tShare } = useTranslation("statsShare");
  const f = useStatsFormat();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const figure = heroFigure(SECONDS, f.locale);
  // La fenêtre se referme au dernier pas : l'image finale (mouvement réduit) est la page, entière.
  const panel = step >= 4 && step <= 7;
  const linked = step >= 6;
  const cursor = step >= 5 ? { x: PANEL.x + 130, y: PANEL.y + 100 } : step >= 3 ? { x: SHARE_BUTTON.x + 44, y: SHARE_BUTTON.y + 16 } : { x: 560, y: 340 };
  return (
    <SceneStage cycle={cycle}>
      <Place x={40} y={18} w={440}>
        <p className="text-[20px] font-bold tracking-tight text-content-primary">{f.t("title")}</p>
      </Place>
      <Place x={SHARE_BUTTON.x} y={SHARE_BUTTON.y}>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-subtle bg-fill-soft px-3 text-[11px] font-semibold text-content-primary">
          <Share2 size={12} aria-hidden />
          {tShare("button")}
        </span>
      </Place>

      <Place x={40} y={56} w={560}>
        <div className="flex items-center justify-between gap-6 rounded-2xl bg-[color:var(--surface-1)] px-5 py-2.5 ring-1 ring-line-subtle">
          <div className="min-w-0">
            <p className="text-[10px] text-content-secondary">{f.t("heroLead_all")}</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[34px] font-extrabold leading-none tracking-[-0.03em] text-content-primary">{figure.value}</span>
              <span className="text-[14px] font-semibold text-content-secondary">{f.t("unitHours", { count: figure.count })}</span>
            </p>
            <p className="mt-1.5 text-[10px] text-content-secondary">{f.t("heroDays", { count: Math.floor(SECONDS / 86_400) })}</p>
            <p className="mt-1.5 flex items-center gap-1 text-[8px] text-content-tertiary"><Info size={9} aria-hidden />{f.t("sourceEstimated")}</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-xl bg-line-subtle">
            {(Object.entries(COUNTS) as [keyof typeof COUNTS, number][]).map(([key, value]) => (
              <span key={key} className="w-[110px] bg-[color:var(--surface-1)] px-3 py-2">
                <span className="block text-[15px] font-bold leading-none text-content-primary">{f.number(value)}</span>
                <span className="mt-1 block truncate text-[8px] font-medium text-content-tertiary">
                  {f.t(`kpi${key[0].toUpperCase()}${key.slice(1)}`, { count: value })}
                </span>
              </span>
            ))}
          </div>
        </div>
      </Place>

      <Place x={40} y={184} w={270} visible={step >= 1} transition={sceneTween}>
        <div className="rounded-2xl bg-[color:var(--surface-1)] px-4 py-2.5 ring-1 ring-line-subtle">
          <p className="mb-2 text-[11px] font-semibold text-content-primary">{f.t("genresTitle")}</p>
          {step >= 1 && (
            <Shrink width={238} scale={0.6}>
              <HBarList
                ariaLabel={f.t("genresTitle")}
                max={1}
                items={GENRES.map((g) => ({ key: g.key, label: t(g.key), value: g.share, display: f.percent(g.share) }))}
              />
            </Shrink>
          )}
        </div>
      </Place>

      <Place x={330} y={184} w={270} visible={step >= 2} transition={sceneTween}>
        <div className="rounded-2xl bg-[color:var(--surface-1)] px-4 py-2.5 ring-1 ring-line-subtle">
          <p className="text-[11px] font-semibold text-content-primary">{f.t("listeningTitle")}</p>
          <p className="mb-2 text-[9px] text-content-tertiary">{f.t("listeningHint")}</p>
          <p className="text-[11px] font-semibold text-content-primary">{f.t("listeningHeadline_original")}</p>
          {step >= 2 && (
            <div className="mt-1.5">
              <Shrink width={238} scale={0.6}>
                <HBarList
                  ariaLabel={f.t("listeningTitle")}
                  max={1}
                  items={VERSIONS.map((v) => ({ key: v.key, label: f.t(`version_${v.key}`), value: v.share, display: f.percent(v.share) }))}
                />
              </Shrink>
            </div>
          )}
        </div>
      </Place>

      <Place x={0} y={0} w={640} h={360} visible={panel} transition={sceneTween} className="bg-black/55" />
      <Place x={PANEL.x} y={PANEL.y} w={PANEL.w} visible={panel} dy={panel ? 0 : 10} transition={sceneTween}>
        <div className="rounded-2xl border border-line-subtle bg-[color:var(--surface-2)] p-3.5 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.7)]">
          <p className="text-[12px] font-semibold text-content-primary">{tShare("title")}</p>
          <p className="mt-1 text-[8.5px] leading-snug text-content-secondary">{tShare("lead")}</p>
          <div className="mt-3 flex justify-center">
            {linked ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-3 text-[10px] font-semibold text-[var(--brand-light)] ring-1 ring-inset ring-[rgba(var(--brand-rgb),0.5)]">
                <Link2 size={11} aria-hidden />
                {tShare("linkActive", { period: tShare("period_all") })}
              </span>
            ) : (
              <span className="inline-flex h-7 items-center rounded-full border border-cta-primary-border bg-cta-primary-bg px-3.5 text-[10px] font-bold text-cta-primary-fg">
                {tShare("create")}
              </span>
            )}
          </div>
        </div>
      </Place>

      <FauxCursor x={cursor.x} y={cursor.y} pressed={step === 3 || step === 5} hidden={step < 3 || step >= 7} reduced={reduced} />
    </SceneStage>
  );
}
