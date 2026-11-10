/**
 * Octave — la tête d'un album, d'une playlist, des titres likés ou d'un
 * artiste : grande image, surtitre, titre, une ligne de métadonnées, puis
 * les actions.
 *
 * La couleur vient de la POCHETTE : sa teinte, lue une fois (`useArtworkTint`), se pose en lavis
 * derrière la tête et fond vers la page (octave.css, `.octave-hero`) — plus de voile de marque.
 * Sous une rangée « Retour » (`OctaveSubview`), la tête resserre sa marge et le lavis la couvre.
 *
 * Les actions sont celles de la FAMILLE Tentacle, pas un rond vert : « Lecture »
 * en pilule au dégradé du logo, étiquetée (la seule en couleur, comme sur la
 * fiche d'un film), puis « Aléatoire » en pilule neutre — deux mots qu'on lit,
 * jamais deux pictogrammes à deviner. La pression répond à 97 % ; rien ne grossit au survol. Verre natif sous `data-liquid-glass`
 * (`PressableGlass`), la peau d'avant ailleurs.
 *
 * Le titre prend une taille selon sa LONGUEUR : un nom court s'affiche en
 * grand, un titre de vingt mots reste lisible sans écraser la page.
 *
 * Liquid Glass (mode natif) : les deux capsules prennent le verre de la maquette
 * (`material: "pane"` du socle ; « Lecture » `prominent`, la marque dans le verre),
 * aux MÊMES tailles ; la pochette et les textes ne changent pas.
 */

import type { CSSProperties, ReactNode } from "react";
import { PlayIcon as Play } from "../../../components/icons/transport";
import { ShuffleIcon as Shuffle } from "@phosphor-icons/react/dist/csr/Shuffle";
import { useTranslation } from "react-i18next";
import { totalDurationParts } from "@tentacle-tv/shared/octave";
import { PressableGlass } from "../../../components/ui/glass/PressableGlass";
import { useArtworkTint } from "../motion/useArtworkTint";
import { useOctaveSubview } from "../shell/OctaveBackButton";
import { Artwork } from "./Artwork";

interface CollectionHeaderProps {
  kicker: string;
  title: string;
  artworkUrl?: string | null;
  /** Remplace la pochette (titres likés : un emblème et un cœur ; playlist : sa mosaïque). */
  art?: ReactNode;
  /** L'image dont la tête prend la teinte quand `art` remplace la pochette (la première jaquette d'une playlist). */
  tintUrl?: string | null;
  round?: boolean;
  /** La ligne de détails ; `null` pendant l'attente (sa place reste réservée). */
  meta: ReactNode;
  canPlay: boolean;
  onPlay: () => void;
  onShuffle: () => void;
  onPress?: () => void;
  extra?: ReactNode;
  /** Une description (playlist) : deux lignes au plus, le texte entier au survol. */
  description?: string | null;
}

/** La taille du titre selon sa longueur (caractères). */
export function titleSizeClass(title: string): string {
  const n = [...title].length;
  if (n <= 16) return "text-4xl md:text-6xl";
  if (n <= 32) return "text-3xl md:text-5xl";
  if (n <= 64) return "text-2xl md:text-4xl";
  return "text-xl md:text-3xl";
}

const PLAY_PROPS = {
  appearance: { material: "pane", level: "prominent", tint: "brand", shape: "capsule" },
  className: "octave-cta flex h-12 items-center gap-2.5 pl-5 pr-7 text-base font-semibold disabled:cursor-default disabled:opacity-40",
  fallbackClassName: "hero-cta-primary rounded-full",
  fallbackStyle: { boxShadow: "var(--oc-shadow-play)" },
} as const;

/** La capsule SECONDAIRE de l'en-tête (« Aléatoire ») : un geste de plus dans `extra` la reprend. */
export const SECONDARY_CAPSULE_PROPS = {
  appearance: { material: "pane", level: "regular", shape: "capsule" },
  className: "flex h-12 items-center gap-2 px-5 text-sm font-semibold disabled:cursor-default disabled:opacity-40",
  fallbackClassName:
    "rounded-full bg-fill-soft text-content-primary transition-colors duration-150 hover:bg-fill-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus",
} as const;

export function CollectionHeader({ kicker, title, artworkUrl = null, art, tintUrl, round = false, meta, canPlay, onPlay, onShuffle, onPress, extra, description = null }: CollectionHeaderProps) {
  const { t } = useTranslation("music");
  const tint = useArtworkTint(tintUrl === undefined ? artworkUrl : tintUrl);
  const sub = useOctaveSubview();
  return (
    <header
      className={`octave-hero px-4 pb-6 md:px-8 ${sub ? "octave-hero-sub pt-4" : "pt-8"}`}
      data-tinted={tint ? "true" : undefined}
      style={tint ? ({ "--oc-hero-tint-rgb": tint } as CSSProperties) : undefined}
    >
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-end">
        {art ?? (
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
        )}
        <div className="min-w-0 flex-1">
          <p className="oc-eyebrow">{kicker}</p>
          <h1 className={`oc-display mt-2 break-words text-content-primary ${titleSizeClass(title)}`}>{title}</h1>
          {description && (
            <p title={description} className="mt-2 line-clamp-2 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-content-tertiary">
              {description}
            </p>
          )}
          <div className="mt-3 flex min-h-5 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-content-secondary">{meta}</div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <PressableGlass {...PLAY_PROPS} tapScale={0.97} disabled={!canPlay} onClick={onPlay} onPointerDown={onPress}>
          <Play className="h-5 w-5" aria-hidden />
          <span className="relative">{t("common.playAll")}</span>
        </PressableGlass>
        <PressableGlass {...SECONDARY_CAPSULE_PROPS} tapScale={0.97} disabled={!canPlay} onClick={onShuffle}>
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
