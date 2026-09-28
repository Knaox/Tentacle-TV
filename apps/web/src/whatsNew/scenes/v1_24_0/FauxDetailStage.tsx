import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatCommunityRating, STAR_PATH, STAR_VIEWBOX, type CardStatusKind } from "@tentacle-tv/shared";
import { BookmarkGlyph, HeartGlyph, WatchedGlyph } from "../../../components/cards/cardGlyphs";
import { ArrowLeftIcon } from "../../../components/media/MediaDetailIcons";
import { Place } from "../Place";
import { sceneTween } from "../sceneMotion";
import { FauxPlayButton } from "./FauxPlayButton";

/**
 * Les voiles de la scène de fiche (`DETAIL_STAGE_LAYERS`), aux mêmes jetons ;
 * seules les hauteurs sont ramenées au canevas. Le fondu vers la page, qui
 * vit sous la ligne de flottaison, n'a pas de place ici.
 */
const LAYERS = [
  { background: "var(--detail-scrim-diagonal)", className: "inset-0" },
  { background: "var(--detail-brand-wash)", className: "inset-0" },
  { background: "var(--detail-scrim-top)", className: "inset-x-0 top-0 h-[22%]" },
  { background: "var(--detail-scrim-bottom)", className: "inset-x-0 bottom-0 h-[70%]" },
  { background: "var(--detail-stage-focus)", className: "inset-0" },
] as const;

const GLYPH = { watchlist: BookmarkGlyph, favorite: HeartGlyph, watched: WatchedGlyph } as const;

export interface FauxDetailData {
  backdropUrl: string | null;
  title: string;
  logoUrl: string | null;
  kicker: string;
  rating: number | null;
  statuses: readonly CardStatusKind[];
  play: { label: string; remaining: string | null; progress: number | null };
}

/** Le décor seul, plein cadre, cadré un peu au-dessus du centre comme la fiche. */
export function FauxDetailBackdrop({ url }: { url: string | null }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-surface-1">
      {url && <img src={url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 30%" }} />}
      {LAYERS.map((layer) => <div key={layer.background} className={`absolute ${layer.className}`} style={{ background: layer.background }} />)}
    </div>
  );
}

/** Le bouton de coin de la scène (Retour, Voir les images), en jetons `on-media`. */
export function FauxStageButton({ x, y, label, icon }: { x: number; y: number; label?: string; icon: ReactNode }) {
  return (
    <Place x={x} y={y}>
      <span className={`flex h-7 items-center gap-1.5 rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.42)] text-[11px] font-medium text-on-media-secondary [&_svg]:h-3.5 [&_svg]:w-3.5 ${label ? "px-3" : "w-7 justify-center"}`}>
        {icon}
        {label}
      </span>
    </Place>
  );
}

/**
 * La scène de la fiche (`DetailStage` + `DetailTitle` + `DetailScoreline` +
 * `DetailActions`) : le décor plein cadre, le bloc titre posé en bas à gauche.
 * `logo` révèle le lettrage du titre, `meta` la note et les actions — dans
 * cet ordre, comme la vraie cascade.
 */
export function FauxDetailStage({ data, logo, meta }: { data: FauxDetailData; logo: boolean; meta: boolean }) {
  const { t } = useTranslation(["common", "cards"]);
  const gradientId = useId();
  return (
    <>
      <FauxDetailBackdrop url={data.backdropUrl} />
      <FauxStageButton x={18} y={16} label={t("common:back")} icon={<ArrowLeftIcon />} />
      <Place x={28} y={132} w={400}>
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-on-media-secondary">
          <span className="mr-1.5 inline-block h-1 w-1 -translate-y-px rounded-full align-middle" style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }} />
          {data.kicker}
        </p>
      </Place>
      <Place x={28} y={150} w={260} h={62} visible={logo} dy={logo ? 0 : 6} scale={logo ? 1 : 0.94} transition={sceneTween} style={{ transformOrigin: "left bottom" }}>
        {data.logoUrl ? (
          <img src={data.logoUrl} alt="" draggable={false} className="h-full w-auto max-w-full object-contain object-left-bottom" />
        ) : (
          <p className="flex h-full items-end text-[28px] font-bold leading-[1.02] tracking-tight text-on-media-primary line-clamp-2">{data.title}</p>
        )}
      </Place>
      <Place x={28} y={224} w={420} visible={meta} dy={meta ? 0 : 8} transition={sceneTween}>
        <div className="flex items-center gap-3">
          {data.rating !== null && (
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" viewBox={STAR_VIEWBOX}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="var(--brand-light)" />
                    <stop offset="1" stopColor="var(--brand-accent)" />
                  </linearGradient>
                </defs>
                <path d={STAR_PATH} fill={`url(#${gradientId})`} />
              </svg>
              <span className="text-[19px] font-bold leading-none tabular-nums tracking-tight text-on-media-primary">{formatCommunityRating(data.rating)}</span>
              <span className="self-end text-[9px] font-medium text-on-media-muted">/10</span>
            </span>
          )}
          {data.statuses.map((kind) => {
            const Glyph = GLYPH[kind];
            return (
              <span key={kind} className="flex items-center gap-1 rounded-full border border-on-media-muted px-2 py-0.5 text-[9px] font-medium text-on-media-secondary" style={{ background: "rgba(var(--scrim-media-rgb), 0.35)" }}>
                <Glyph filled className={`h-2.5 w-2.5 ${kind === "favorite" ? "text-[var(--brand-accent)]" : "text-[var(--brand-light)]"}`} />
                {t(`cards:status.${kind}`)}
              </span>
            );
          })}
        </div>
      </Place>
      <Place x={28} y={262} w={460} visible={meta} dy={meta ? 0 : 8} transition={{ ...sceneTween, delay: meta ? 0.08 : 0 }}>
        <div className="flex items-center gap-2">
          <FauxPlayButton {...data.play} />
          <span className="flex h-10 items-center gap-0.5 rounded-full border border-on-media-muted px-1" style={{ background: "rgba(var(--scrim-media-rgb), 0.38)" }}>
            {(["watchlist", "favorite", "watched"] as const).map((kind) => {
              const Glyph = GLYPH[kind];
              const on = data.statuses.includes(kind);
              const tone = on ? (kind === "favorite" ? "text-[var(--brand-accent)]" : "text-[var(--brand-light)]") : "text-on-media-secondary";
              return <span key={kind} className={`flex h-8 w-8 items-center justify-center ${tone}`}><Glyph filled={on} className="h-4 w-4" /></span>;
            })}
          </span>
        </div>
      </Place>
    </>
  );
}
