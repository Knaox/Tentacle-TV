import { useTranslation } from "react-i18next";
import { BookmarkSimpleIcon as Bookmark } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { FilmSlateIcon as Clapperboard } from "@phosphor-icons/react/dist/csr/FilmSlate";
import { PlayCircleIcon as PlayCircle } from "@phosphor-icons/react/dist/csr/PlayCircle";
import { ShuffleIcon as Shuffle } from "@phosphor-icons/react/dist/csr/Shuffle";
import { SparkleIcon as Sparkles } from "@phosphor-icons/react/dist/csr/Sparkle";
import { TelevisionIcon as Tv } from "@phosphor-icons/react/dist/csr/Television";
import type { Icon as IconType } from "@phosphor-icons/react";
import type { MediaItem } from "@tentacle-tv/shared";
import { heroModeHintKey, heroModeLabelKey, recoHeroKindOf, type HeroMode } from "@tentacle-tv/shared";
import { SETTING_FIELD } from "../SettingToggleRow";

/**
 * « Bandeau principal » : la source du grand carrousel de l'accueil, dite par
 * ce qu'elle MONTRE. Chaque source est une carte — son signe, son nom, sa
 * phrase — et la retenue porte la coche et le liseré de marque : on lit
 * l'effet AVANT de choisir, ce que les quatre mots d'un segmenté ne disaient
 * pas (« Recommandation », « Aléatoire »…). Un groupe de boutons radio pour
 * les lecteurs d'écran.
 *
 * Les sources arrivent déjà réduites à ce que le serveur sait servir (shared
 * `heroModesOffered`). « Un titre choisi » déplie le choix du favori dessous ;
 * les sources « Pour vous » rappellent leur repli.
 */

const ICONS: Readonly<Record<HeroMode, IconType>> = {
  resume: PlayCircle,
  random: Shuffle,
  reco: Sparkles,
  recoMovies: Clapperboard,
  recoSeries: Tv,
  fixed: Bookmark,
};

interface HeroSourcePickerProps {
  modes: readonly HeroMode[];
  value: HeroMode;
  onChange: (mode: HeroMode) => void;
  /** Les favoris où choisir le titre fixe ; `undefined` tant qu'ils ne sont pas lus. */
  favorites: readonly Pick<MediaItem, "Id" | "Name">[] | undefined;
  fixedItemId: string | null;
  onFixedItemChange: (id: string | null) => void;
}

export function HeroSourcePicker({ modes, value, onChange, favorites, fixedItemId, onFixedItemChange }: HeroSourcePickerProps) {
  const { t } = useTranslation("homeSettings");
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={t("heroTitle")} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {modes.map((mode) => {
          const Icon = ICONS[mode];
          const checked = mode === value;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(mode)}
              className="ui-tile flex min-w-0 items-start gap-3 p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              <Icon aria-hidden weight={checked ? "fill" : "regular"} className={`mt-0.5 h-5 w-5 shrink-0 ${checked ? "text-accent" : "text-content-tertiary"}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug text-content-primary">{t(heroModeLabelKey(mode))}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-content-secondary">{t(heroModeHintKey(mode))}</span>
              </span>
            </button>
          );
        })}
      </div>

      {recoHeroKindOf(value) && <p className="text-[13px] text-content-tertiary">{t("heroFallbackNote")}</p>}

      {value === "fixed" && (
        favorites && favorites.length > 0 ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-content-tertiary">{t("heroFixedPickTitle")}</span>
            <select
              className={`${SETTING_FIELD} max-w-sm`}
              value={fixedItemId ?? ""}
              onChange={(e) => onFixedItemChange(e.target.value || null)}
            >
              <option value="">{t("heroFixedPickContext")}</option>
              {favorites.map((f) => (
                <option key={f.Id} value={f.Id}>
                  {f.Name}
                </option>
              ))}
            </select>
          </label>
        ) : favorites ? (
          <p className="text-[13px] text-content-tertiary">{t("heroFixedNoFavorites")}</p>
        ) : null
      )}
    </div>
  );
}
