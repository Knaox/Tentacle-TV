/**
 * Octave — la tête d'un album, d'une playlist, des titres likés ou d'un
 * artiste : grande image, surtitre, titre, une ligne de métadonnées, puis
 * les actions.
 *
 * Les actions sont celles de la FAMILLE Tentacle, pas un rond vert : « Lecture »
 * en capsule au dégradé de marque, étiquetée (la seule en couleur, comme sur la
 * fiche d'un film), puis « Aléatoire » en capsule de verre — deux mots qu'on lit,
 * jamais deux pictogrammes à deviner. Verre natif sous `data-liquid-glass`
 * (`PressableGlass`), la peau d'avant ailleurs.
 *
 * Le titre prend une taille selon sa LONGUEUR : un nom court s'affiche en
 * grand, un titre de vingt mots reste lisible sans écraser la page.
 *
 * Liquid Glass (mode natif) : la tête de la maquette « Octave · Playlist » — la
 * pochette dans un cadre de verre, le surtitre en pastille, le titre jusqu'à
 * 76 px, deux capsules de 56 (`glass/octaveHeader.css`). Ailleurs, rien ne change.
 */

import type { ReactNode } from "react";
import { Play, Shuffle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { totalDurationParts } from "@tentacle-tv/shared/octave";
import { PressableGlass } from "../../../components/ui/glass/PressableGlass";
import { useLiquidGlassMode } from "../../../theme/glass";
import { Artwork } from "./Artwork";

interface CollectionHeaderProps {
  kicker: string;
  title: string;
  artworkUrl?: string | null;
  /** Remplace la pochette (titres likés : un dégradé et un cœur). */
  art?: ReactNode;
  round?: boolean;
  /** La ligne de détails ; `null` pendant l'attente (sa place reste réservée). */
  meta: ReactNode;
  canPlay: boolean;
  onPlay: () => void;
  onShuffle: () => void;
  onPress?: () => void;
  extra?: ReactNode;
}

/** La taille du titre selon sa longueur (caractères). */
export function titleSizeClass(title: string): string {
  const n = [...title].length;
  if (n <= 16) return "text-4xl md:text-6xl";
  if (n <= 32) return "text-3xl md:text-5xl";
  if (n <= 64) return "text-2xl md:text-4xl";
  return "text-xl md:text-3xl";
}

/** La même échelle en mot, que lit la tête en verre (`octaveHeader.css`). */
export function titleLength(title: string): "short" | "medium" | "long" | "huge" {
  const n = [...title].length;
  if (n <= 16) return "short";
  if (n <= 32) return "medium";
  if (n <= 64) return "long";
  return "huge";
}

const PLAY_PROPS = {
  appearance: { material: "pane", level: "prominent", tint: "brand", shape: "capsule" },
  className: "octave-cta octave-cta-play flex h-12 items-center gap-2.5 pl-5 pr-7 text-base font-bold disabled:cursor-default disabled:opacity-40",
  fallbackClassName: "hero-cta-primary rounded-full",
  fallbackStyle: { boxShadow: "var(--oc-shadow-play)" },
} as const;

const SHUFFLE_PROPS = {
  appearance: { material: "pane", level: "regular", shape: "capsule" },
  className: "octave-cta octave-cta-shuffle flex h-12 items-center gap-2 px-5 text-sm font-semibold disabled:cursor-default disabled:opacity-40",
  fallbackClassName:
    "rounded-full border border-octave-line bg-octave-hover text-content-primary transition-colors duration-150 hover:bg-octave-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus",
} as const;

export function CollectionHeader({ kicker, title, artworkUrl = null, art, round = false, meta, canPlay, onPlay, onShuffle, onPress, extra }: CollectionHeaderProps) {
  const { t } = useTranslation("music");
  const native = useLiquidGlassMode() === "native";
  const cover = art ?? (
    <Artwork
      url={artworkUrl}
      alt={title}
      label={title}
      round={round}
      kind={round ? "artist" : "album"}
      radius="lg"
      className="h-44 w-44 shadow-[var(--oc-shadow-art-lg)] md:h-56 md:w-56"
      eager
    />
  );
  return (
    <header className="octave-hero px-4 pb-6 pt-8 md:px-8">
      <div className="octave-hero-main flex flex-col items-start gap-6 md:flex-row md:items-end">
        {/* En verre : la pochette posée dans un cadre de verre (rayon 30, 10 de marge). */}
        {native ? (
          <div className="octave-art-frame lg-pane" data-round={round ? "true" : undefined}>
            {cover}
          </div>
        ) : (
          cover
        )}
        <div className="min-w-0 flex-1">
          <p className={native ? "oc-eyebrow lg-bead" : "oc-eyebrow"}>{kicker}</p>
          <h1 className={`oc-display mt-2 break-words text-content-primary ${titleSizeClass(title)}`} data-title-length={native ? titleLength(title) : undefined}>{title}</h1>
          <div className="mt-3 flex min-h-5 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-content-secondary">{meta}</div>
        </div>
      </div>
      <div className="octave-hero-actions mt-6 flex flex-wrap items-center gap-3">
        <PressableGlass {...PLAY_PROPS} hoverScale={1.03} tapScale={0.97} disabled={!canPlay} onClick={onPlay} onPointerDown={onPress}>
          <Play className="h-5 w-5" fill="currentColor" aria-hidden />
          <span className="relative">{t("common.playAll")}</span>
        </PressableGlass>
        <PressableGlass {...SHUFFLE_PROPS} hoverScale={1.03} tapScale={0.97} disabled={!canPlay} onClick={onShuffle}>
          <Shuffle className="h-4 w-4" aria-hidden />
          <span className="relative">{t("common.shuffle")}</span>
        </PressableGlass>
        {extra}
      </div>
    </header>
  );
}

/** « 12 titres · 47 min » */
export function useCountAndDuration(count: number, durationMs: number | null): string {
  const { t } = useTranslation("music");
  const parts = [t("count.tracks", { count })];
  if (durationMs && durationMs > 0) {
    const { hours, minutes } = totalDurationParts(durationMs);
    parts.push(hours > 0 ? t("count.hoursMinutes", { hours, minutes }) : t("count.minutes", { minutes }));
  }
  return parts.join(" · ");
}

export function Dot() {
  return <span aria-hidden>·</span>;
}
