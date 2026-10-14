import { memo } from "react";
import { Check } from "lucide-react";
import type { AvatarCharacter } from "@tentacle-tv/shared";
import { avatarThumbUrl } from "./avatarImages";

/** Le rond d'un personnage dans la grille. */
export const TILE_ART = 84;

interface AvatarTileProps {
  avatar: AvatarCharacter;
  name: string;
  chosen: boolean;
  /** Tabulation itinérante : une seule tuile de la grille est dans l'ordre de tabulation. */
  tabbable: boolean;
  disabled: boolean;
  onChoose: (id: string) => void;
  onPreview: (id: string | null) => void;
}

/**
 * Un personnage de la troupe : son portrait rond (sur la couleur de son fond
 * le temps que l'image arrive), son nom dessous. Au survol comme au focus, il
 * bouge selon son tempérament (`avatarGallery.css`) et son histoire s'affiche
 * au pied de la galerie (`onPreview`). Un clic le désigne ; sur le désigné, il
 * le prend (`onChoose` en décide). Les anneaux (choisi, focus) sont des calques en fondu
 * d'opacité : jamais une ombre animée.
 */
export const AvatarTile = memo(function AvatarTile({
  avatar,
  name,
  chosen,
  tabbable,
  disabled,
  onChoose,
  onPreview,
}: AvatarTileProps) {
  return (
    <button
      type="button"
      data-avatar-tile={avatar.id}
      data-temperament={avatar.temperament}
      aria-pressed={chosen}
      aria-label={name}
      tabIndex={tabbable ? 0 : -1}
      disabled={disabled}
      onClick={() => onChoose(avatar.id)}
      onMouseEnter={() => onPreview(avatar.id)}
      onMouseLeave={() => onPreview(null)}
      onFocus={() => onPreview(avatar.id)}
      onBlur={() => onPreview(null)}
      className="avatar-tile flex w-[96px] flex-col items-center gap-2 rounded-2xl pb-1 pt-2 outline-none disabled:cursor-wait"
    >
      <span className="relative block" style={{ width: TILE_ART, height: TILE_ART }}>
        <span
          aria-hidden="true"
          className="avatar-tile__ring avatar-tile__ring--focus absolute -inset-[6px] rounded-full"
          style={{ boxShadow: "0 0 0 2px var(--text-primary)" }}
        />
        <span
          aria-hidden="true"
          className="avatar-tile__ring avatar-tile__ring--chosen absolute -inset-[5px] rounded-full"
          style={{ boxShadow: "0 0 0 3px var(--brand)" }}
        />
        <span className="avatar-tile__art block h-full w-full overflow-hidden rounded-full" style={{ background: avatar.tone }}>
          <img
            src={avatarThumbUrl(avatar.id)}
            alt=""
            width={TILE_ART}
            height={TILE_ART}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
          />
        </span>
        {chosen && (
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--surface-modal)] bg-[var(--brand)] text-cta-brand-fg">
            <Check size={13} strokeWidth={3} aria-hidden />
          </span>
        )}
      </span>
      <span className={`max-w-full truncate text-xs font-medium ${chosen ? "text-content-primary" : "text-content-tertiary"}`}>
        {name}
      </span>
    </button>
  );
});
