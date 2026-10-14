/**
 * Les images de la troupe, servies par le client web lui-même (`public/avatars/`,
 * écrites par `brand/avatars/`) : la vignette de la grille (192 px) et l'image
 * entière (512 px), celle qu'on envoie à Jellyfin. Chemins absolus : le bureau
 * les lit sur `tentacle://app/`, le web sur l'origine du serveur.
 */

export function avatarThumbUrl(id: string): string {
  return `/avatars/thumbs/${id}.webp`;
}

export function avatarImageUrl(id: string): string {
  return `/avatars/${id}.webp`;
}

/** L'image entière d'un personnage, prête à envoyer comme photo de profil. */
export async function fetchAvatarImage(id: string, fetcher: typeof fetch = fetch): Promise<Blob> {
  const response = await fetcher(avatarImageUrl(id));
  if (!response.ok) throw new Error(`avatar ${id} ${response.status}`);
  return response.blob();
}
