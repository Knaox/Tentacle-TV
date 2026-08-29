import { useState } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";

interface Props {
  userId: string;
  name: string;
  hasAvatar: boolean;
  size?: number;
}

/**
 * Avatar d'un AUTRE utilisateur.
 *
 * `client.getImageUrl()` ne sait construire que des images de médias
 * (`/Items/…`) : il n'existe aucun assistant pour la photo d'un compte, et
 * `useAvatarUpload` ne s'occupe que de la sienne. On reprend donc le même
 * gabarit d'adresse, qui transite par le proxy — ce chemin y est déjà autorisé.
 *
 * Repli sur l'initiale : un compte sans photo, ou une image qui ne se charge
 * pas, ne doit pas laisser un trou dans la ligne.
 */
export function LeaderboardAvatar({ userId, name, hasAvatar, size = 36 }: Props) {
  const client = useJellyfinClient();
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").charAt(0).toUpperCase();

  const showImage = hasAvatar && !failed;

  return (
    <div
      className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
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
          src={`${client.getBaseUrl()}/Users/${userId}/Images/Primary?maxWidth=96&quality=85`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-sm font-bold text-cta-brand-fg">{initial}</span>
      )}
    </div>
  );
}
