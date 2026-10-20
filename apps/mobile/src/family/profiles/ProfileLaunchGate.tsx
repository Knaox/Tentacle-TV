import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSegments } from "expo-router";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { MOBILE_PROFILE_STAY_KEY, readMobileStay, type PickedProfileDto } from "@tentacle-tv/shared";
import { retainModal } from "@/components/ui/modalGate";
import { BootAwareModal } from "@/bootIntro/BootAwareModal";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { useReportStartupOverlay } from "@/startup/useStartupOverlay";
import { MODAL_ORIENTATIONS } from "../modalOrientations";
import { launchGateState, launchStayToForget } from "./launchGate";
import { useActiveProfile, useAccountUserId } from "./profileSessionState";
import { clearProfilePickerRequest, useProfilePickerRequest } from "./sessionEpoch";
import { forgetMobileStay } from "./switchSession";
import { useCommitPick } from "./useCommitPick";
import { usePickerListing } from "./usePickerListing";
import { WhoIsWatchingView } from "./view/WhoIsWatchingView";

/** Une modale plein écran tant qu'elle est montrée : les autres attendent (`modalGate`). */
function Retained() {
  useEffect(() => retainModal(), []);
  return null;
}

/**
 * « Qui regarde ? » à l'OUVERTURE du mobile (serveur 1.31.1,
 * `family.mobileProfiles`) : plein écran, si la famille compte plus d'une
 * personne et qu'aucun choix retenu ne vaut — puis plus jamais sur cet
 * appareil, sauf si le choix ne vaut plus ou si une session de profil a pris
 * fin. Décidé UNE fois par compte et par session (l'app ne se referme pas sur
 * l'utilisateur parce que la liste se relit). Un recouvrement ordinaire du
 * démarrage : l'invitation aux avatars et le reste l'attendent. Jamais sur la
 * connexion. Monté une fois, à la racine.
 */
export function ProfileLaunchGate() {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  const router = useRouter();
  const [rootSegment] = useSegments();
  const listing = usePickerListing();
  const held = useActiveProfile();
  const accountId = useAccountUserId();
  const request = useProfilePickerRequest();
  const commit = useCommitPick();
  // La décision, figée par compte (et rouverte par une fin de session de profil).
  const [decided, setDecided] = useState<{ account: string | null; show: boolean } | null>(null);

  // Relu à chaque rendu (préchargé) : la liste qui répond, ou une fin de session, le relisent.
  const stayRaw = serverUrl && accountId ? storage.getItem(MOBILE_PROFILE_STAY_KEY) : null;
  const stay = useMemo(
    () => (serverUrl && accountId ? readMobileStay(stayRaw, serverUrl, accountId) : null),
    [stayRaw, serverUrl, accountId],
  );
  const state = launchGateState({
    enabled: listing.enabled && rootSegment !== "(auth)",
    data: listing.data,
    isError: listing.isError,
    request,
    held: held ? { profileId: held.id } : null,
    stay,
    now: Date.now(),
  });

  useEffect(() => {
    if (serverUrl && launchStayToForget({ data: listing.data, stay, now: Date.now() })) forgetMobileStay({ storage, serverUrl });
  }, [listing.data, stay, storage, serverUrl]);

  useEffect(() => {
    if (state === "pending") return;
    setDecided((previous) => {
      if (request !== null && state === "picker") return { account: accountId, show: true };
      if (previous && previous.account === accountId) return previous;
      return { account: accountId, show: state === "picker" };
    });
  }, [state, accountId, request]);

  const show = decided?.account === accountId && decided.show && listing.enabled;
  useReportStartupOverlay("profiles", show ? "active" : state === "pending" && decided?.account !== accountId ? "pending" : "quiet");

  const { refetch } = listing;
  const onStale = useCallback(() => void refetch(), [refetch]);
  const onPicked = useCallback((picked: PickedProfileDto) => {
    const result = commit(picked);
    if (result === "failed") return;
    clearProfilePickerRequest();
    setDecided({ account: accountId, show: false });
    if (result === "switched") router.replace("/(tabs)" as never);
  }, [commit, accountId, router]);

  if (!show) return null;
  return (
    // Né pendant l'ouverture, « Qui regarde ? » est LE premier écran : rendu dans l'écran du poulpe.
    <BootAwareModal bootOverlay="profiles" animationType="fade" statusBarTranslucent supportedOrientations={[...MODAL_ORIENTATIONS]} onRequestClose={noop}>
      <Retained />
      <WhoIsWatchingView listing={listing.data} mode="launch" onPicked={onPicked} onStale={onStale} />
    </BootAwareModal>
  );
}

const noop = () => undefined;
