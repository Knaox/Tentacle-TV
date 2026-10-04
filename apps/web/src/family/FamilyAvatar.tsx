import { memo } from "react";
import type { FamilyProfileColor } from "@tentacle-tv/shared";
import { UserAvatar } from "../components/ui/UserAvatar";
import { profileGradient } from "./profileColors";

interface FamilyAvatarProps {
  userId: string;
  name: string;
  color: FamilyProfileColor;
  /** La photo Jellyfin du compte ; null : l'initiale sur la couleur du profil
   *  (toujours le cas d'un invité, qui n'a pas de photo). */
  imageTag: string | null;
  size?: number;
}

/** L'avatar d'un profil de la Famille : sa photo s'il en a une, sinon son
 *  initiale sur SA couleur — celle que la TV montre aussi. */
export const FamilyAvatar = memo(function FamilyAvatar({ userId, name, color, imageTag, size = 36 }: FamilyAvatarProps) {
  if (imageTag) return <UserAvatar userId={userId} name={name} hasAvatar imageTag={imageTag} size={size} />;
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <div
      aria-hidden="true"
      className="flex flex-shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: profileGradient(color) }}
    >
      <span className="font-bold leading-none text-white" style={{ fontSize: Math.max(10, Math.round(size * 0.42)) }}>
        {initial}
      </span>
    </div>
  );
});
