import { memo, useState } from "react";
import { Check } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { cardRatingFor, type MediaItem } from "@tentacle-tv/shared";
import { CardMarkerLayer } from "../../../components/cards/CardMarkerLayer";
import { cardProgress } from "../../cards/cardProgress";
import { Pressable } from "../../ui/Pressable";
import { ProgressBar } from "../../ui/ProgressBar";

/**
 * La carte de grille de Ma liste et Mes favoris (`watchlist/SelectableGridCard`
 * de l'app) : affiche 2:3 au rayon 12, `surface.s2` bordée d'un filet, et les
 * MARQUEURS de toutes les cartes (`CardMarkerLayer`) — la note globale et la
 * vôtre en bas à gauche, la pastille Ma liste / favori / vu en haut à droite ;
 * progression 3 au ras du bas (jamais sur un titre vu). En sélection, un voile
 * avec une case ronde de 24 à la place de la pastille — cochée, liseré violet
 * de 2 et teinte violette. Titre 11 semi-gras à 6, année 10.
 */
export const SelectableGridCard = memo(function SelectableGridCard({
  item, width, selectable, selected, onPress, onLongPress,
}: {
  item: MediaItem;
  width: number;
  selectable?: boolean;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const client = useJellyfinClient();
  const [broken, setBroken] = useState(false);
  const progress = cardProgress(item.UserData);
  const title = item.Name;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width }}
      aria-label={title}
      aria-pressed={selectable ? selected === true : undefined}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line-subtle bg-surface-2">
        {!broken ? (
          <img
            src={client.getImageUrl(item.Id, "Primary", { width: 300, quality: 80 })}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setBroken(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-4xl font-extrabold text-content-disabled">
            {title.charAt(0).toUpperCase() || "?"}
          </span>
        )}
        {progress !== null && <ProgressBar progress={progress} className="absolute inset-x-0 bottom-0" />}
        {/* La pastille d'états cède son coin à la case de sélection. */}
        <CardMarkerLayer
          item={item}
          communityRating={cardRatingFor(item, "series").rating}
          hideStatus={selectable === true}
          ratingClassName="bottom-1.5 left-1.5"
          statusClassName="right-[7px] top-[7px]"
        />
        {selectable && (
          <div
            className="absolute inset-0 z-30 flex items-start justify-end rounded-xl p-1"
            style={
              selected
                ? { border: "2px solid var(--brand)", background: "rgba(var(--brand-rgb), 0.18)" }
                : { background: "rgba(0, 0, 0, 0.35)" }
            }
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full border-2"
              style={
                selected
                  ? { background: "var(--brand-soft)", borderColor: "rgba(var(--brand-rgb), 0.5)" }
                  : { background: "rgba(0, 0, 0, 0.35)", borderColor: "var(--cta-brand-fg)" }
              }
            >
              {selected && <Check size={14} className="text-brand-light" aria-hidden />}
            </span>
          </div>
        )}
      </div>
      <p className="mt-1.5 truncate text-[11px] font-semibold tracking-[-0.1px] text-content-primary">{title}</p>
      {item.ProductionYear != null && (
        <p className="mt-0.5 text-[10px] font-medium tracking-[0.3px] text-content-tertiary">{item.ProductionYear}</p>
      )}
    </Pressable>
  );
});
