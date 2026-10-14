import { memo, useMemo } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { FamilyProfileDto } from "@tentacle-tv/shared";
import { AvatarGallerySheet } from "@/avatars/gallery/AvatarGallerySheet";
import type { GalleryTarget } from "@/avatars/guestPhoto";

interface GuestPhotoGalleryProps {
  /** L'invité à habiller ; gardé pendant la sortie de la feuille. */
  guest: FamilyProfileDto;
  visible: boolean;
  onClose: () => void;
}

/**
 * La galerie des avatars ouverte POUR un invité de la Famille (Réglages ›
 * Famille) : son titre le nomme, sa photo actuelle est au pied, et le
 * personnage ou la photo choisis deviennent SA photo, posée par le serveur
 * (`setGuestPhoto`) — ses TV et « Qui regarde ? » la montrent.
 */
export const GuestPhotoGallery = memo(function GuestPhotoGallery({ guest, visible, onClose }: GuestPhotoGalleryProps) {
  const client = useJellyfinClient();
  const { userId, name, imageTag } = guest;
  const target = useMemo<GalleryTarget>(() => ({ kind: "guest", userId, name }), [userId, name]);
  const current = useMemo(() => ({
    uri: imageTag
      ? `${client.getBaseUrl()}/Users/${encodeURIComponent(userId)}/Images/Primary?maxWidth=168&quality=85&tag=${encodeURIComponent(imageTag)}`
      : null,
    initial: Array.from(name.trim())[0]?.toUpperCase() ?? "?",
  }), [client, userId, name, imageTag]);

  return <AvatarGallerySheet visible={visible} mode="change" target={target} current={current} onClose={onClose} />;
});
