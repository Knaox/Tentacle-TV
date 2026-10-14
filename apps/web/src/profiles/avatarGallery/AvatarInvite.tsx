import { useEffect, useState } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { useActiveProfile } from "../../auth/profileSession";
import { useAvatarUpload } from "../../hooks/useAvatarUpload";
import { useConnectivity } from "../../offline/useConnectivity";
import { shouldInviteToAvatars } from "@tentacle-tv/shared";
import { markSubjectInvited, readInvitedSubjects } from "./inviteRule";
import { useAvatarGallery } from "./useAvatarGallery";
import { useGuestSessionPhoto } from "./useGuestSessionPhoto";

/** Le temps de laisser l'application s'installer (et un autre recouvrement se refermer). */
const SETTLE_MS = 1200;

interface AvatarInviteProps {
  /** Bureau, ou sa préviz forcée en développement (`?whatsnewgate=1`). */
  desktop: boolean;
  /** Un autre recouvrement de démarrage occupe l'écran (ou n'a pas encore tranché), ou l'on est sur le lecteur. */
  busy: boolean;
  /** L'invitation ouverte ou refermée : les autres recouvrements attendent qu'elle se taise. */
  onOpenChange: (open: boolean) => void;
}

/**
 * L'invitation unique à choisir un personnage (règle partagée : `shared` ›
 * `avatarInvite`) — pour le compte, ou pendant la session d'un invité que
 * l'appareil peut habiller, pour lui (`useGuestSessionPhoto`) : la galerie
 * elle-même, en mode « invite », un peu après que tout s'est calmé. Le compte
 * est noté invité dès l'ouverture — fermer, choisir ou importer, c'est pareil.
 */
export function AvatarInvite({ desktop, busy, onOpenChange }: AvatarInviteProps) {
  const userId = useUserId();
  const profile = useActiveProfile();
  const guestTarget = useGuestSessionPhoto();
  const online = useConnectivity().state === "online";
  const { hasPhoto: accountHasPhoto } = useAvatarUpload();
  // Le sujet : le compte en session personnelle ; le profil sinon (un invité
  // seulement, et si l'appareil peut l'habiller — un membre change la sienne
  // depuis ses appareils).
  const subjectId = profile ? profile.id : userId;
  const hasPhoto = profile ? profile.imageTag !== null : accountHasPhoto;
  const [invited, setInvited] = useState(readInvitedSubjects);
  const { openGallery, isOpen, dialog } = useAvatarGallery("invite");

  useEffect(() => {
    onOpenChange(isOpen);
  }, [isOpen, onOpenChange]);

  const due = shouldInviteToAvatars({
    eligible: desktop,
    subjectId,
    canChangePhoto: profile ? guestTarget !== null : true,
    online,
    hasPhoto,
    busy,
    invited,
  });

  useEffect(() => {
    if (!due || !subjectId) return;
    const timer = setTimeout(() => {
      setInvited(markSubjectInvited(subjectId));
      openGallery(guestTarget ?? undefined);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [due, subjectId, guestTarget, openGallery]);

  return dialog;
}
