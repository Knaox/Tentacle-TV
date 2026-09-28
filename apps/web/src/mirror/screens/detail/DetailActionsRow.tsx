import { memo, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Check, CircleCheck, Heart, Plus, type LucideProps } from "lucide-react";
import { useCardToggles } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { PLAY_MAX_WIDTH } from "./detailMetrics";

/**
 * `DetailActionsRow` de l'app : Favoris / Ma liste / Vu, en colonnes fixes de
 * 25 % réparties d'un bord à l'autre, 20 au-dessus, marges 16, alignée sur le
 * bouton Lecture (420 + 2 × 16 au plus).
 *
 * L'état et les gestes sont ceux de toutes les cartes (`useCardToggles`) :
 * Ma liste et Favoris au niveau SÉRIE par les Sets partagés — la fiche d'un
 * épisode et les pastilles de ses cartes ne peuvent plus se contredire —,
 * « Vu » sur le titre montré (jamais toute la série d'un épisode).
 *
 * La quatrième cellule de l'app, « Garder hors ligne », n'existe pas dans un
 * navigateur : l'app la retire elle-même quand l'action n'est pas offerte
 * (`entry.visible` faux → `null`), et la rangée garde alors ses trois
 * cellules de 25 % en `space-between`. C'est ce qui est reproduit ici.
 */
export const DetailActionsRow = memo(function DetailActionsRow({ item }: { item: MediaItem }) {
  const { t } = useTranslation("common");
  const toggles = useCardToggles(item);
  return (
    <div className="mt-5 flex items-start justify-between px-4" style={{ maxWidth: PLAY_MAX_WIDTH + 32 }}>
      <ActionButton
        Icon={Heart}
        label={t("actionFavorite")}
        active={toggles.favorite}
        activeColor="var(--status-error)"
        onPress={toggles.toggleFavorite}
      />
      <ActionButton
        Icon={Plus}
        IconActive={Check}
        label={t("actionMyList")}
        active={toggles.watchlist}
        activeColor="var(--brand)"
        onPress={toggles.toggleList}
      />
      <ActionButton
        Icon={CircleCheck}
        label={t("actionWatched")}
        active={toggles.watched}
        activeColor="var(--brand)"
        onPress={toggles.toggleWatched}
      />
    </div>
  );
});

/**
 * `DetailActionButton` de l'app : cellule 25 % × 88, anneau 52 bordé, icône 22,
 * libellé 11,5 semi-gras sur une ligne (80 au plus). Actif : fond à 13 % et
 * filet à 33 % de la couleur, icône et libellé dans la couleur ; le libellé,
 * lui, ne change pas (seule la couleur dit l'état).
 */
function ActionButton({ Icon, IconActive, label, active, activeColor, onPress }: {
  Icon: ComponentType<LucideProps>;
  IconActive?: ComponentType<LucideProps>;
  label: string;
  active: boolean;
  activeColor: string;
  onPress: () => void;
}) {
  const Glyph = active && IconActive ? IconActive : Icon;
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      aria-pressed={active}
      className="mirror-detail-fade-press flex h-[88px] w-1/4 flex-col items-center gap-2 pt-0.5"
    >
      <span
        className={`flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-full border ${
          active ? "" : "border-line-subtle bg-fill-subtle"
        }`}
        style={
          active
            ? {
                background: `color-mix(in srgb, ${activeColor} 13%, transparent)`,
                borderColor: `color-mix(in srgb, ${activeColor} 33%, transparent)`,
              }
            : undefined
        }
      >
        <Glyph size={22} strokeWidth={2} style={{ color: active ? activeColor : "var(--text-primary)" }} aria-hidden />
      </span>
      <span
        className="max-w-[80px] truncate text-center text-[11.5px] font-semibold tracking-[0.2px]"
        style={{ color: active ? activeColor : "var(--text-secondary)" }}
      >
        {label}
      </span>
    </button>
  );
}
