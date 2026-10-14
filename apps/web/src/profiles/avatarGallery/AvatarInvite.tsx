import { useEffect, useState } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { useActiveProfile } from "../../auth/profileSession";
import { useAvatarUpload } from "../../hooks/useAvatarUpload";
import { useConnectivity } from "../../offline/useConnectivity";
import { markAccountInvited, readInvitedAccounts, shouldInviteToAvatars } from "./inviteRule";
import { useAvatarGallery } from "./useAvatarGallery";

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
 * L'invitation unique à choisir un personnage (`inviteRule.ts`) : la galerie
 * elle-même, en mode « invite », un peu après que tout s'est calmé. Le compte
 * est noté invité dès l'ouverture — fermer, choisir ou importer, c'est pareil.
 */
export function AvatarInvite({ desktop, busy, onOpenChange }: AvatarInviteProps) {
  const userId = useUserId();
  const personalSession = useActiveProfile() === null;
  const online = useConnectivity().state === "online";
  const { hasPhoto } = useAvatarUpload();
  const [invited, setInvited] = useState(readInvitedAccounts);
  const { openGallery, isOpen, dialog } = useAvatarGallery("invite");

  useEffect(() => {
    onOpenChange(isOpen);
  }, [isOpen, onOpenChange]);

  const due = shouldInviteToAvatars({ desktop, userId, personalSession, online, hasPhoto, busy, invited });

  useEffect(() => {
    if (!due || !userId) return;
    const timer = setTimeout(() => {
      setInvited(markAccountInvited(userId));
      openGallery();
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [due, userId, openGallery]);

  return dialog;
}
