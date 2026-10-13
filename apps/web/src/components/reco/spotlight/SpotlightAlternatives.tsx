import { memo } from "react";
import { useTranslation } from "react-i18next";
import { recoAmbilightSourceUrl, useJellyfinClient, type RecoRowItem } from "@tentacle-tv/api-client";

interface SpotlightAlternativesProps {
  /** La une d'abord, puis les suivantes de « Pour vous » — l'ordre du moteur. */
  items: readonly RecoRowItem[];
  selectedKey: string | undefined;
  reasonOf: (item: RecoRowItem) => string | null;
  onSelect: (key: string) => void;
}

/**
 * « Ou bien » : les meilleures suivantes, à portée d'un clic — on hésite entre
 * cinq titres, pas entre trente. Un clic met le titre à la une (un geste :
 * le fond et le texte changent, rien d'autre). Aucune rotation automatique :
 * ce qui est à l'écran n'y bouge que si on le demande.
 *
 * Vignettes en `w300` (la plus petite image large de TMDB) : une liste de
 * choix n'a pas besoin de plus. Bureau large seulement — plus étroit, les
 * rangées en dessous font ce travail.
 */
export const SpotlightAlternatives = memo(function SpotlightAlternatives({
  items,
  selectedKey,
  reasonOf,
  onSelect,
}: SpotlightAlternativesProps) {
  const { t } = useTranslation("reco");
  const client = useJellyfinClient();
  if (items.length < 2) return null;

  return (
    // Voile sombre posé sur l'image (sans backdrop-filter : derrière 0,72
    // d'alpha, un flou ne se verrait pas) — la liste reste lisible sur
    // n'importe quel fond.
    <div
      className="hidden w-[320px] shrink-0 flex-col gap-1.5 rounded-2xl bg-[rgba(var(--scrim-media-rgb),0.72)] p-2.5 ring-1 ring-white/10 lg:flex"
      role="group"
      aria-label={t("spotlightAlternatives")}
    >
      <p className="mb-0.5 px-1.5 text-xs font-semibold text-on-media-secondary">{t("spotlightAlternatives")}</p>
      {items.map((item) => {
        const selected = item.key === selectedKey;
        const thumb = recoAmbilightSourceUrl(item, (id) => client.getImageUrl(id, "Backdrop", { width: 300, quality: 80 }));
        const reason = reasonOf(item);
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={selected}
            aria-label={t("spotlightPickAria", { title: item.title })}
            onClick={() => onSelect(item.key)}
            className={`group flex items-center gap-3 rounded-xl p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.8)] ${
              selected ? "bg-[rgba(var(--brand-rgb),0.28)] ring-1 ring-[rgba(var(--brand-rgb),0.7)]" : "hover:bg-[rgba(var(--scrim-media-rgb),0.55)]"
            }`}
          >
            <span className="relative aspect-video w-[112px] shrink-0 overflow-hidden rounded-lg bg-[rgba(var(--scrim-media-rgb),0.6)]">
              {thumb && <img src={thumb} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />}
            </span>
            <span className="min-w-0">
              <span className="line-clamp-1 text-sm font-semibold text-on-media-primary">{item.title}</span>
              {reason && <span className="mt-0.5 line-clamp-2 text-xs text-on-media-secondary">{reason}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
});
