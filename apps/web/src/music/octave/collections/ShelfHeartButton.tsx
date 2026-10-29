/**
 * Octave — le cœur d'un album, d'un artiste ou d'une playlist, dans l'en-tête de sa page : plein AU CLIC
 * (optimiste), le même favori que le menu (`useToggleShelfFavorite`). Absent face à un serveur qui ne le garde pas.
 */

import { memo } from "react";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { shelfFavoriteOf, useMusicShelves, useToggleShelfFavorite, type MusicShelfSubject } from "@tentacle-tv/api-client";

export const ShelfHeartButton = memo(function ShelfHeartButton({ subject, className = "h-12 w-12" }: { subject: MusicShelfSubject; className?: string }) {
  const { t } = useTranslation("musicFavorites");
  const { capable, shelves } = useMusicShelves();
  const toggle = useToggleShelfFavorite();
  const favorite = shelfFavoriteOf(subject, shelves, capable);
  if (favorite === undefined) return null;
  const label = t(favorite ? "actions.unfavorite" : "actions.favorite");
  return (
    <button
      type="button"
      aria-pressed={favorite}
      aria-label={label}
      title={label}
      onClick={() => toggle.mutate({ subject, favorite: !favorite })}
      className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-[color,transform] duration-150 hover:bg-fill-subtle active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${favorite ? "text-octave-accent-text" : "text-content-secondary hover:text-content-primary"} ${className}`}
    >
      <Heart className="h-6 w-6" fill={favorite ? "currentColor" : "none"} aria-hidden />
    </button>
  );
});
