import { useEffect, useState } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { useActiveProfile } from "../../auth/profileSession";
import { useAvatarUpload } from "../../hooks/useAvatarUpload";
import { useConnectivity } from "../../offline/useConnectivity";
import { shouldInviteToAvatars } from "@tentacle-tv/shared";
import { useStartupTurn } from "../../startup/startupStore";
import { markSubjectInvited, readInvitedSubjects } from "./inviteRule";
import { useAvatarGallery } from "./useAvatarGallery";
import { useGuestSessionPhoto } from "./useGuestSessionPhoto";

/** Le temps de laisser l'application s'installer (et la fenêtre d'avant se refermer). */
const SETTLE_MS = 1200;

interface AvatarInviteProps {
  /** Bureau, ou sa préviz forcée en développement (`?whatsnewgate=1`). */
  desktop: boolean;
}

/**
 * L'invitation unique à choisir un personnage (règle partagée : `shared` ›
 * `avatarInvite`) — pour le compte, ou pendant la session d'un invité que
 * l'appareil peut habiller, pour lui (`useGuestSessionPhoto`) : la galerie
 * elle-même, en mode « invite », un peu après que tout s'est calmé. Le compte
 * est noté invité dès l'ouverture — fermer, choisir ou importer, c'est pareil.
 *
 * La DERNIÈRE fenêtre du démarrage (`startup/startupOrder.ts`) : elle publie
 * qu'elle va paraître, et n'ouvre qu'à son tour.
 */
export function AvatarInvite({ desktop }: AvatarInviteProps) {
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

  // Ce qu'elle VEUT, indépendamment de son tour : c'est ce que les autres fenêtres lisent.
  const wanted = shouldInviteToAvatars({
    eligible: desktop,
    subjectId,
    canChangePhoto: profile ? guestTarget !== null : true,
    online,
    hasPhoto,
    busy: false,
    invited,
  });
  const turn = useStartupTurn("avatarInvite", isOpen ? "open" : wanted ? "pending" : "done");
  const due = wanted && turn;

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
