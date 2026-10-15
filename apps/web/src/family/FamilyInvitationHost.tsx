import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useFamilyLive,
  useFamilyOverview,
  useJellyfinClient,
  useSnoozeFamilyInvitation,
} from "@tentacle-tv/api-client";
import { pickPosterInvitation } from "@tentacle-tv/shared";
import type { StartupWindowState } from "../startup/startupOrder";
import { useStartupMayShow, usePublishStartupWindow } from "../startup/startupStore";
import { clearFamilyPosterRequest, useFamilyPosterRequest } from "./familyPosterStore";
import { FamilyInvitationPoster } from "./FamilyInvitationPoster";
import { FamilyPinJoined } from "./pinSuggest/FamilyPinJoined";
import { useFamilyAvailability } from "./useFamilyAvailability";

/** La page de la Famille, où mène une invitation qui n'attend plus de réponse. */
export const FAMILY_SETTINGS_PATH = "/settings/family";

/**
 * L'hôte de l'AFFICHE d'invitation — monté une fois par la coquille
 * (`AppLayout`, bureau comme miroir), donc jamais par-dessus le lecteur.
 *
 * Au lancement, la Famille se lit : une invitation en attente, ni remise à
 * plus tard ni écartée dans cette session, fait paraître l'affiche. En
 * direct, `family:update` (`useFamilyLive`, monté ICI et nulle part ailleurs)
 * relit la Famille : une invitation reçue l'app ouverte paraît sans
 * rechargement. La cloche demande une invitation précise
 * (`requestFamilyPoster`) : déjà répondue, annulée ou échue, elle mène à la
 * page de la Famille.
 *
 * Le serveur ne rend d'invitations qu'aux sessions PERSONNELLES : en
 * « Voir en tant que », la liste est vide et rien ne paraît.
 *
 * Acceptée, l'affiche laisse la place à « Bienvenue dans la famille de … »
 * (`FamilyPinJoined`) si le profil n'a pas de code PIN.
 *
 * Une fenêtre du démarrage (`startup/startupOrder.ts`) : après « Qui regarde ? »
 * et le code PIN conseillé, avant les nouveautés. Reçue en direct pendant qu'une
 * autre fenêtre est ouverte, elle attend sa fermeture — jamais par-dessus.
 */
export function FamilyInvitationHost() {
  const { available, settled } = useFamilyAvailability();
  const client = useJellyfinClient();
  const token = client.getAccessToken() || localStorage.getItem("tentacle_token");
  useFamilyLive({ token, enabled: available });

  const overview = useFamilyOverview({ enabled: available });
  const requestedId = useFamilyPosterRequest();
  const navigate = useNavigate();
  const snooze = useSnoozeFamilyInvitation();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [joinedOwner, setJoinedOwner] = useState<string | null>(null);
  const closeJoined = useCallback(() => setJoinedOwner(null), []);

  const incoming = overview.data?.incoming;
  const invitation = useMemo(
    () => (incoming ? pickPosterInvitation(incoming, { now: Date.now(), dismissed, requestedId }) : null),
    [incoming, dismissed, requestedId],
  );

  // La cloche a demandé une invitation : la Famille se relit d'abord (elle a
  // pu être répondue ailleurs). Introuvable une fois relue → sa page.
  const { refetch } = overview;
  useEffect(() => {
    if (!requestedId || !available) return;
    let cancelled = false;
    void refetch().then((result) => {
      if (cancelled) return;
      const found = result.data?.incoming.some((item) => item.id === requestedId);
      if (!found) {
        clearFamilyPosterRequest();
        navigate(FAMILY_SETTINGS_PATH);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [requestedId, available, refetch, navigate]);

  const dismiss = useCallback((id: string) => {
    setDismissed((previous) => new Set(previous).add(id));
    clearFamilyPosterRequest();
  }, []);

  // « Plus tard » (et la fermeture sans réponse) : l'affiche se tait 24 h,
  // la cloche garde l'invitation. Écartée tout de suite, même si l'appel échoue.
  const later = useCallback(
    (id: string) => {
      dismiss(id);
      snooze.mutate(id);
    },
    [dismiss, snooze],
  );

  // « Bienvenue » suit une acceptation : déjà à l'écran, il garde la place.
  const turn = useStartupMayShow("familyInvitation");
  const decided = settled && (!available || overview.data !== undefined || overview.isError);
  const shown = available && (joinedOwner !== null || (invitation !== null && turn));
  const state: StartupWindowState = shown ? "open" : available && invitation ? "pending" : decided ? "done" : "undecided";
  usePublishStartupWindow("familyInvitation", "familyInvitation", state);

  if (!available) return null;
  if (joinedOwner !== null) return <FamilyPinJoined owner={joinedOwner} onClose={closeJoined} />;
  if (!invitation || !turn) return null;
  return (
    <FamilyInvitationPoster
      key={invitation.id}
      invitation={invitation}
      onLater={later}
      onDone={dismiss}
      onAccepted={setJoinedOwner}
    />
  );
}
