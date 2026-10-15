import { useTranslation } from "react-i18next";
import { Bookmark, Check, Clapperboard, PlayCircle, Shuffle, Sparkles, Tv, type LucideIcon } from "lucide-react";
import { HERO_MODES, heroModeHintKey, heroModeLabelKey, recoHeroKindOf, type HeroMode } from "@tentacle-tv/shared";
import { Place } from "..";

/**
 * Réglages › Personnalisation › « Bandeau principal », RECOPIÉ (balisage de
 * `components/settings/personalization/HeroSourcePicker`) sur une grille FIXE
 * de trois colonnes : la scène ne dépend pas de la largeur de la fenêtre, et
 * le pointeur tombe toujours sur sa carte. Les mots sont ceux de l'app
 * (espace `homeSettings`).
 */

const ICONS: Readonly<Record<HeroMode, LucideIcon>> = {
  resume: PlayCircle,
  random: Shuffle,
  reco: Sparkles,
  recoMovies: Clapperboard,
  recoSeries: Tv,
  fixed: Bookmark,
};

/** La grille, en px logiques : trois colonnes, deux rangées. */
export const SOURCES_X = 24;
export const SOURCES_Y = 84;
export const CARD_W = 190;
export const CARD_H = 104;
export const GAP = 8;

/** Le centre de la carte d'une source : là où le pointeur clique. */
export function sourceCenter(mode: HeroMode): { x: number; y: number } {
  const index = HERO_MODES.indexOf(mode);
  const column = index % 3;
  const row = Math.floor(index / 3);
  return { x: SOURCES_X + column * (CARD_W + GAP) + CARD_W / 2, y: SOURCES_Y + row * (CARD_H + GAP) + CARD_H / 2 };
}

export function FauxHeroSources({ value }: { value: HeroMode }) {
  const { t } = useTranslation("homeSettings");
  return (
    <>
      <Place x={SOURCES_X} y={20} w={590}>
        <p className="text-base font-semibold text-content-primary">{t("heroTitle")}</p>
        <p className="mt-1 text-xs text-content-tertiary">{t("heroCaption")}</p>
      </Place>
      {HERO_MODES.map((mode, index) => {
        const Icon = ICONS[mode];
        const checked = mode === value;
        return (
          <Place
            key={mode}
            x={SOURCES_X + (index % 3) * (CARD_W + GAP)}
            y={SOURCES_Y + Math.floor(index / 3) * (CARD_H + GAP)}
            w={CARD_W}
            h={CARD_H}
            className={`flex items-start gap-2 rounded-xl border p-3 transition-colors duration-150 ${
              checked ? "border-brand bg-tentacle-surface" : "border-line-subtle"
            }`}
          >
            <Icon aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${checked ? "text-brand" : "text-content-tertiary"}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium leading-tight text-content-primary">{t(heroModeLabelKey(mode))}</span>
              <span className="mt-1 block text-[11px] leading-snug text-content-tertiary">{t(heroModeHintKey(mode))}</span>
            </span>
            {checked && <Check aria-hidden className="h-4 w-4 shrink-0 text-brand" />}
          </Place>
        );
      })}
      <Place x={SOURCES_X} y={SOURCES_Y + 2 * (CARD_H + GAP) + 4} w={590} visible={recoHeroKindOf(value) !== null}>
        <p className="text-xs text-content-tertiary">{t("heroFallbackNote")}</p>
      </Place>
    </>
  );
}
