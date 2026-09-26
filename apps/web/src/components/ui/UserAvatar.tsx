import { useState } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";

interface UserAvatarProps {
  userId: string;
  name: string;
  hasAvatar: boolean;
  /** Diamètre en pixels CSS. */
  size?: number;
  /**
   * L'étiquette d'image Jellyfin (`PrimaryImageTag`). Posée dans l'adresse, elle
   * change quand la photo change : le navigateur ne ressert plus l'ancienne
   * depuis son cache.
   */
  imageTag?: string | null;
  className?: string;
}

/** Paliers de largeur demandés à Jellyfin : peu d'adresses distinctes, donc un cache qui sert. */
const WIDTH_STEPS = [64, 96, 128, 192, 256] as const;

function requestedWidth(size: number): number {
  const wanted = size * 2;
  return WIDTH_STEPS.find((step) => step >= wanted) ?? WIDTH_STEPS[WIDTH_STEPS.length - 1];
}

/**
 * Avatar d'un compte Jellyfin — le sien comme celui d'un autre.
 *
 * `client.getImageUrl()` ne sait construire que des images de médias
 * (`/Items/…`) : il n'existe aucun assistant pour la photo d'un compte, et
 * `useAvatarUpload` ne s'occupe que de la sienne. On reprend donc le même
 * gabarit d'adresse, qui transite par le proxy — ce chemin y est déjà autorisé.
 *
 * Repli sur l'initiale : un compte sans photo, ou une image qui ne se charge
 * pas, ne doit pas laisser un trou dans la ligne. L'image est demandée au
 * double du diamètre (écrans haute densité), arrondie à un palier.
 *
 * Né dans les easter eggs (le classement) sous le nom `LeaderboardAvatar`,
 * qui reste exporté depuis son ancien chemin.
 */
export function UserAvatar({ userId, name, hasAvatar, size = 36, imageTag, className }: UserAvatarProps) {
  const client = useJellyfinClient();
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").charAt(0).toUpperCase();

  const showImage = hasAvatar && !failed;
  const tag = imageTag ? `&tag=${encodeURIComponent(imageTag)}` : "";

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: showImage
          ? undefined
          : "linear-gradient(135deg, var(--brand-dark), var(--brand))",
      }}
    >
      {showImage ? (
        <img
          src={`${client.getBaseUrl()}/Users/${userId}/Images/Primary?maxWidth=${requestedWidth(size)}&quality=85${tag}`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="font-bold leading-none text-cta-brand-fg"
          style={{ fontSize: Math.max(10, Math.round(size * 0.42)) }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
