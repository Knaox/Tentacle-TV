import { forwardRef, memo, type CSSProperties, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { profileColorStops } from "@tentacle-tv/shared";
import { FamilyAvatar } from "../../family/FamilyAvatar";
import type { PickerProfile } from "./pickerTypes";

/** Le rond d'une tuile : grand à partir de `md`, un peu moins dessous. */
export const TILE_AVATAR = 132;

/** Le rôle d'une tuile pendant l'entrée dans un profil. */
export type TileRole = "idle" | "chosen" | "receding";

interface ProfileTileProps {
  profile: PickerProfile;
  role: TileRole;
  /** Le choisi glisse au centre de la rangée (px) pendant l'entrée. */
  shiftX: number;
  /** Tabulation itinérante : une seule tuile est dans l'ordre de tabulation. */
  tabbable: boolean;
  disabled: boolean;
  onPick: (id: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onFocus: (id: string) => void;
}

/**
 * Un profil de « Qui regarde ? » : son rond (portrait, ou initiale sur sa
 * couleur), son nom dessous, et ce qu'il faut savoir avant d'y entrer — le
 * cadenas d'un code PIN, « Invité », un blocage et son heure de fin. Au survol
 * comme au focus : le rond s'élève, un halo de SA couleur s'allume dessous ;
 * au focus clavier, un anneau l'entoure. Halo et anneau sont des calques en
 * fondu d'opacité : jamais une ombre animée (`theme/cards.css`). Seuls
 * `transform` et `opacity` bougent.
 *
 * L'entrée (`role`) : le choisi glisse au centre et grandit, les autres
 * reculent et s'effacent — `transform` et `opacity` seuls ; mouvement réduit :
 * les autres s'effacent seulement (`motion-reduce.css` coupe les durées).
 */
export const ProfileTile = memo(forwardRef<HTMLButtonElement, ProfileTileProps>(function ProfileTile(
  { profile, role, shiftX, tabbable, disabled, onPick, onKeyDown, onFocus },
  ref,
) {
  const { t } = useTranslation(["profilePicker", "family"]);
  const [glowFrom] = profileColorStops(profile.color);
  const locked = profile.lockedLabel !== null;
  // Pas de « Vous » : devant l'écran, ce n'est pas forcément le compte (comme sur la TV).
  const caption = locked ? profile.lockedLabel : profile.guest ? t("family:kindGuest") : null;
  const label = profile.hasPin
    ? t("profilePicker:tileLabelPin", { name: profile.name })
    : t("profilePicker:tileLabel", { name: profile.name });

  const motionStyle: CSSProperties =
    role === "chosen"
      ? { transform: `translateX(${shiftX}px) scale(1.1)`, transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)" }
      : role === "receding"
        ? { transform: "scale(0.92)", opacity: 0, transition: "transform 300ms cubic-bezier(0.4, 0, 1, 1), opacity 260ms linear" }
        : {};

  return (
    <li className="list-none" style={motionStyle}>
      <button
        ref={ref}
        type="button"
        tabIndex={tabbable ? 0 : -1}
        disabled={disabled}
        aria-label={[label, caption].filter(Boolean).join(", ")}
        onClick={() => onPick(profile.id)}
        onKeyDown={onKeyDown}
        onFocus={() => onFocus(profile.id)}
        className="group flex w-[9.5rem] flex-col items-center gap-3 rounded-2xl p-2 outline-none disabled:cursor-default"
      >
        <span className="relative block transition-transform duration-200 ease-out group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5 group-disabled:translate-y-0">
          {/* Le halo : peint une fois, seule son opacité varie. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-7 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
            style={{ background: `radial-gradient(circle, ${glowFrom}8c 0%, ${glowFrom}26 45%, transparent 70%)` }}
          />
          {/* L'anneau du focus clavier : un calque peint une fois, seule son
              opacité varie — jamais une ombre (`box-shadow`) animée (règle
              « Coût GPU » 3, comme `theme/cards.css`). */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1.5 rounded-full opacity-0 ring-2 ring-line-focus transition-opacity duration-150 group-focus-visible:opacity-100"
          />
          <span className={`relative block rounded-full ${locked ? "opacity-55" : ""}`}>
            <FamilyAvatar userId={profile.id} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={TILE_AVATAR} />
          </span>
          {profile.hasPin && (
            <span
              aria-hidden
              className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border border-line-subtle bg-surface-2 text-content-primary"
            >
              <Lock size={15} strokeWidth={2.4} />
            </span>
          )}
        </span>
        <span className="flex w-full flex-col items-center">
          <span className="w-full truncate text-center text-base font-semibold text-content-secondary group-hover:text-content-primary group-focus-visible:text-content-primary">
            {profile.name}
          </span>
          <span className={`mt-0.5 h-4 text-xs ${locked ? "text-status-error-fg" : "text-content-tertiary"}`}>{caption ?? ""}</span>
        </span>
      </button>
    </li>
  );
}));
