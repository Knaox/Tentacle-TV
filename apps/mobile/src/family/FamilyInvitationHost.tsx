import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "expo-router";
import {
  FAMILY_ROUTE,
  useFamilyLive,
  useFamilyOverview,
  useSnoozeFamilyInvitation,
  useTentacleConfig,
} from "@tentacle-tv/api-client";
import { pickPosterInvitation } from "@tentacle-tv/shared";
import { whenNoModal } from "@/components/ui/modalGate";
import { clearFamilyPosterRequest, useFamilyPosterRequest } from "./familyPosterStore";
import { FamilyInvitationPoster } from "./FamilyInvitationPoster";
import { useFamilyAvailability } from "./useFamilyAvailability";

/**
 * L'hôte de l'AFFICHE d'invitation — monté une fois, à la racine, jamais
 * par-dessus le lecteur (`/watch` : l'affiche attend sa sortie).
 *
 * Au lancement, la Famille se lit : une invitation en attente, ni remise à
 * plus tard ni écartée pendant cette session, fait paraître l'affiche. En
 * direct, `family:update` (`useFamilyLive`, monté ICI et nulle part ailleurs)
 * relit la Famille : une invitation reçue l'app ouverte paraît sans geste. La
 * cloche ou un push demandent une invitation précise (`requestFamilyPoster`) :
 * la Famille se relit d'abord — déjà répondue, annulée ou échue, elle mène à
 * la page de la Famille. Le push ne fait qu'OUVRIR l'affiche : ce qu'elle
 * montre vient du serveur, lu avec la session de l'utilisateur.
 *
 * Une modale à la fois : l'affiche attend que la feuille ouverte (cloche,
 * carte, réglage) se soit retirée (`whenNoModal`).
 */
export function FamilyInvitationHost() {
  const { available } = useFamilyAvailability();
  const { storage } = useTentacleConfig();
  useFamilyLive({ token: storage.getItem("tentacle_token"), enabled: available });

  const overview = useFamilyOverview({ enabled: available });
  const requestedId = useFamilyPosterRequest();
  const router = useRouter();
  const pathname = usePathname();
  const snooze = useSnoozeFamilyInvitation();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [shownId, setShownId] = useState<string | null>(null);
  const inPlayer = pathname.startsWith("/watch");
  // Lue par l'effet de la demande sans le relancer à chaque navigation.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const incoming = overview.data?.incoming;
  const invitation = useMemo(
    () => (incoming ? pickPosterInvitation(incoming, { now: Date.now(), dismissed, requestedId }) : null),
    [incoming, dismissed, requestedId],
  );

  // La demande d'une invitation précise : la Famille se relit d'abord (elle a
  // pu être répondue ailleurs). Introuvable une fois relue → sa page (sans
  // l'empiler une seconde fois si on y est déjà).
  const { refetch } = overview;
  useEffect(() => {
    if (!requestedId || !available) return;
    let cancelled = false;
    void refetch().then((result) => {
      if (cancelled) return;
      if (!result.data?.incoming.some((item) => item.id === requestedId)) {
        clearFamilyPosterRequest();
        if (pathnameRef.current !== FAMILY_ROUTE) router.push(FAMILY_ROUTE as never);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [requestedId, available, refetch, router]);

  // Montrer l'invitation choisie dès qu'aucune autre modale n'est à l'écran.
  const candidateId = invitation && !inPlayer ? invitation.id : null;
  useEffect(() => {
    if (!candidateId) {
      setShownId(null);
      return;
    }
    let cancelled = false;
    whenNoModal(() => {
      if (!cancelled) setShownId(candidateId);
    });
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  const dismiss = useCallback((id: string) => {
    setDismissed((previous) => new Set(previous).add(id));
    setShownId(null);
    clearFamilyPosterRequest();
  }, []);

  // « Plus tard » (et la fermeture sans réponse) : l'affiche se tait 24 h, la
  // cloche garde l'invitation. Écartée tout de suite, même si l'appel échoue.
  const later = useCallback(
    (id: string) => {
      dismiss(id);
      snooze.mutate(id);
    },
    [dismiss, snooze],
  );

  if (!available || !invitation || shownId !== invitation.id || inPlayer) return null;
  return <FamilyInvitationPoster key={invitation.id} invitation={invitation} onLater={later} onDone={dismiss} />;
}
