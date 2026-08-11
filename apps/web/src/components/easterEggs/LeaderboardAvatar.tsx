import { useState } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";

interface Props {
  userId: string;
  name: string;
  hasAvatar: boolean;
  taille?: number;
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
export function LeaderboardAvatar({ userId, name, hasAvatar, taille = 36 }: Props) {
  const client = useJellyfinClient();
  const [echoue, setEchoue] = useState(false);
  const initiale = (name || "?").charAt(0).toUpperCase();

  const montrerImage = hasAvatar && !echoue;

  return (
    <div
      className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: taille,
        height: taille,
        background: montrerImage
          ? undefined
          : "linear-gradient(135deg, var(--brand-dark), var(--brand))",
      }}
    >
      {montrerImage ? (
        <img
          src={`${client.getBaseUrl()}/Users/${userId}/Images/Primary?maxWidth=96&quality=85`}
          alt=""
          loading="lazy"
          onError={() => setEchoue(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-sm font-bold text-cta-brand-fg">{initiale}</span>
      )}
    </div>
  );
}
