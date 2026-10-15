import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { usePathname, useSegments } from "expo-router";
import { useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import { shouldInviteToAvatars } from "@tentacle-tv/shared";
import { useAccountHasPhoto } from "@/auth/useAccountHasPhoto";
import { useStoredUser } from "@/auth/useStoredUser";
import { whenNoModal } from "@/components/ui/modalGate";
import { useConnectivity } from "@/offline/useConnectivity";
import { useReportStartupOverlay, useStartupOverlaysQuiet } from "@/startup/useStartupOverlay";
import { AvatarGallerySheet } from "../gallery/AvatarGallerySheet";
import { inviteBusy, markSubjectInvited, readInvitedSubjects } from "./inviteGate";

/** Le calme exigé avant d'inviter : l'app s'installe, un recouvrement qui se referme laisse la place. */
const SETTLE_MS = 1500;

/** L'application au premier plan — une fenêtre du système (permission) la fait passer en arrière. */
function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => subscription.remove();
  }, []);
  return active;
}

/**
 * L'invitation unique à choisir un personnage (règle partagée : `shared` ›
 * `avatarInvite`) : la galerie elle-même, en mode « invite », pour un compte
 * SANS photo d'après Jellyfin (`useAccountHasPhoto`), en ligne, une fois par
 * compte et par appareil — au lancement comme juste après la première
 * connexion. Jamais par-dessus un autre recouvrement du démarrage : elle
 * attend qu'ils aient tous tranché et se soient tus (`startup/`), que
 * l'application soit au premier plan, hors du lecteur et de la connexion,
 * puis qu'aucune modale ne soit à l'écran (`whenNoModal`). Le compte est
 * noté invité dès l'ouverture — fermer, choisir ou importer, c'est pareil.
 * Monté une fois, à la racine.
 */
export function AvatarInviteHost() {
  const userId = useUserId();
  const user = useStoredUser();
  const { storage } = useTentacleConfig();
  const online = useConnectivity().state === "online";
  const hasPhoto = useAccountHasPhoto();
  // Elle attend les recouvrements d'avant elle, jamais le code PIN, qui la suit.
  const overlaysQuiet = useStartupOverlaysQuiet("avatars");
  const pathname = usePathname();
  const [rootSegment] = useSegments();
  const appActive = useAppActive();
  const [invited, setInvited] = useState(() => readInvitedSubjects(storage));
  const [open, setOpen] = useState(false);

  const busy = inviteBusy({ overlaysQuiet, pathname, rootSegment, appActive, galleryOpen: open });
  const due = shouldInviteToAvatars({
    eligible: true,
    subjectId: userId,
    // Le mobile n'ouvre que des sessions personnelles : le jeton est celui du compte.
    canChangePhoto: !!storage.getItem("tentacle_token"),
    online,
    hasPhoto,
    busy,
    invited,
  });

  // Ce qu'elle dit au registre, pour le code PIN qui passe après elle : active
  // si elle va paraître (dès que le reste se tait) ou est ouverte, « pas
  // tranché » tant que la photo du compte n'est pas connue.
  const awaited = shouldInviteToAvatars({
    eligible: true, subjectId: userId, canChangePhoto: !!storage.getItem("tentacle_token"),
    online, hasPhoto, busy: false, invited,
  });
  const undecided = online && !!userId && hasPhoto === undefined && !invited.includes(userId);
  useReportStartupOverlay("avatars", open || awaited ? "active" : undecided ? "pending" : "quiet");

  useEffect(() => {
    if (!due || !userId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      whenNoModal(() => {
        if (cancelled) return;
        setInvited(markSubjectInvited(storage, userId));
        setOpen(true);
      });
    }, SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [due, userId, storage]);

  const close = useCallback(() => setOpen(false), []);
  const current = useMemo(() => ({ uri: null, initial: (user?.Name ?? "?").charAt(0).toUpperCase() }), [user?.Name]);

  return <AvatarGallerySheet visible={open} mode="invite" current={current} onClose={close} />;
}
