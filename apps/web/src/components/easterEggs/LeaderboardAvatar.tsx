import { useState } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";

interface Props {
  userId: string;
  name: string;
  hasAvatar: boolean;
  /**
   * Étiquette de la photo (`PrimaryImageTag` de Jellyfin). Elle change avec la
   * photo : passée dans l'adresse, elle en fait une clé de cache — le proxy
   * garde alors l'image (cf. `imageCacheControl`) au lieu de la redemander à
   * chaque affichage.
   */
  imageTag?: string | null;
  size?: number;
}

/**
 * Deux définitions seulement, pour que les tailles voisines partagent la même
 * image en cache : 96 px couvre une vignette jusqu'à 48 px en densité 2, 192 px
 * le grand format d'une fiche.
 */
function requestedWidth(size: number): number {
  return size <= 48 ? 96 : 192;
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
 * pas, ne doit pas laisser un trou dans la ligne. L'échec est retenu PAR
 * ADRESSE : le même composant, réutilisé pour un autre compte ou une nouvelle
 * photo, retente sa chance au lieu de garder l'initiale du précédent.
 */
export function LeaderboardAvatar({ userId, name, hasAvatar, imageTag, size = 36 }: Props) {
  const client = useJellyfinClient();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initial = (name || "?").charAt(0).toUpperCase();

  const tag = imageTag ? `&tag=${encodeURIComponent(imageTag)}` : "";
  const src = `${client.getBaseUrl()}/Users/${userId}/Images/Primary?maxWidth=${requestedWidth(size)}&quality=85${tag}`;
  const showImage = hasAvatar && failedSrc !== src;

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
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="text-sm font-bold text-cta-brand-fg"
          // Au-delà de la vignette, l'initiale grandit avec le disque : un
          // `text-sm` au centre d'une photo de fiche se perdait.
          style={size > 36 ? { fontSize: Math.round(size * 0.4) } : undefined}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
