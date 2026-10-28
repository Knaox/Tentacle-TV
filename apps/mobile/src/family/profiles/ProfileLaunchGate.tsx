import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSegments } from "expo-router";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { MOBILE_PROFILE_STAY_KEY, mobileStayInitial, readMobileStay, type PickedProfileDto } from "@tentacle-tv/shared";
import { retainModal } from "@/components/ui/modalGate";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { useReportStartupOverlay } from "@/startup/useStartupOverlay";
import { MODAL_ORIENTATIONS } from "../modalOrientations";
import { BootAwareModal } from "@/bootIntro/BootAwareModal";
import { readLaunchChoice, subscribeLaunchChoice } from "./launchChoice";
import { useMobileLaunchAsked } from "./useMobileLaunchAsked";
import { launchGateState, launchStayToForget, nextLaunchDecision, type LaunchDecision } from "./launchGate";
import { useActiveProfile, useAccountUserId } from "./profileSessionState";
import { clearProfilePickerRequest, useProfilePickerRequest } from "./sessionEpoch";
import { forgetMobileStay } from "./switchSession";
import { useCommitPick } from "./useCommitPick";
import { usePickerListing } from "./usePickerListing";
import { WhoIsWatchingView } from "./view/WhoIsWatchingView";
import { accountFallbackHappened } from "@/offline/rights/accountFallbackNotice";
import { octaveLaunchAsked } from "@tentacle-tv/shared/octave";
import { octaveLaunch } from "@/octave/launch/octaveLaunch";
import { octaveSkipLaunchPin } from "@/octave/settings/octaveSettings";
import { isOctaveMode } from "@/octave/mode/octaveModeStore";
import { homeAfterProfileSwitch } from "@/octave/mode/profileSwitchPaths";

const noop = () => undefined;

/** Une modale plein écran tant qu'elle est montrée : les autres attendent (`modalGate`). */
function Retained() {
  useEffect(() => retainModal(), []);
  return null;
}

/**
 * « Qui regarde ? » à l'OUVERTURE du mobile (serveur 1.31.1,
 * `family.mobileProfiles`) : plein écran, à CHAQUE démarrage à froid si la
 * famille compte plus d'une personne — sauf « Ne plus proposer au
 * démarrage » (la case de l'écran, ou Réglages › Compte), qui ouvre le
 * dernier profil choisi tant qu'il vaut (règle partagée
 * `familyMobileLaunch.ts`). L'administration peut ne pas le proposer d'office
 * sur le mobile (`useMobileLaunchAsked`) : il ne vient alors que pour une
 * session de profil terminée, sans la case. Décidé UNE fois par compte et par processus
 * (`nextLaunchDecision`) : un retour d'arrière-plan, la liste qui se relit,
 * ne le rouvrent pas ; une session de profil terminée, si. Un recouvrement
 * ordinaire du démarrage : l'invitation aux avatars et le reste l'attendent.
 * Jamais sur la connexion. Monté une fois, à la racine.
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
  const [decided, setDecided] = useState<LaunchDecision | null>(null);
  const readChoice = useCallback(() => readLaunchChoice({ storage, serverUrl: serverUrl ?? "" }), [storage, serverUrl]);
  const choice = useSyncExternalStore(subscribeLaunchChoice, readChoice, readChoice);
  const asked = useMobileLaunchAsked();
  // Rouvert dans Octave, « Ne pas demander le code PIN au démarrage » allumé : l'identité gardée, sans l'écran
  // proposé d'office — la sécurité du serveur et une session de profil close le ramènent (`octaveLaunchPin.ts`).
  const skipPin = octaveSkipLaunchPin.use();
  const gateAsked = octaveLaunchAsked(asked, { inOctave: octaveLaunch().inOctave, skipPin, request });

  // Relu à chaque rendu (préchargé) : la liste qui répond, ou une fin de session, le relisent.
  const stayRaw = serverUrl && accountId ? storage.getItem(MOBILE_PROFILE_STAY_KEY) : null;
  const stay = useMemo(
    () => (serverUrl && accountId ? readMobileStay(stayRaw, serverUrl, accountId) : null),
    [stayRaw, serverUrl, accountId],
  );
  const asLaunched = launchGateState({
    // Sur la connexion, rien à attendre : jamais « Qui regarde ? » là.
    configSettled: listing.configSettled || rootSegment === "(auth)",
    enabled: listing.enabled && rootSegment !== "(auth)",
    data: listing.data,
    isError: listing.isError,
    request,
    held: held ? { profileId: held.id } : null,
    choice,
    stay,
    now: Date.now(),
    asked: gateAsked,
  });
  // Une session de profil revenue au compte faute de connexion (`OfflineAccountFallback`) : au
  // retour du réseau, rien ne s'impose — « Qui regarde ? » suit sa règle au prochain démarrage.
  const state = accountFallbackHappened() && request === null ? "none" : asLaunched;

  useEffect(() => {
    if (serverUrl && launchStayToForget({ data: listing.data, stay, now: Date.now() })) forgetMobileStay({ storage, serverUrl });
  }, [listing.data, stay, storage, serverUrl]);

  useEffect(() => {
    setDecided((previous) => nextLaunchDecision(previous, { state, account: accountId, request }));
  }, [state, accountId, request]);

  const show = decided?.account === accountId && decided.show && listing.enabled;
  useReportStartupOverlay("profiles", show ? "active" : state === "pending" && decided?.account !== accountId ? "pending" : "quiet");

  const { refetch } = listing;
  const onStale = useCallback(() => void refetch(), [refetch]);
  const onPicked = useCallback((picked: PickedProfileDto, stayChecked: boolean) => {
    // Sans la case (l'administration ne propose pas d'office), le choix de l'appareil reste tel quel.
    const result = commit(picked, !asked ? undefined : stayChecked ? "stay" : "ask");
    if (result === "failed") return;
    clearProfilePickerRequest();
    setDecided({ account: accountId, show: false });
    if (result === "switched") router.replace(homeAfterProfileSwitch(isOctaveMode()) as never);
  }, [commit, accountId, router, asked]);

  // « Continuer hors ligne » (serveur muet) : l'écran se referme, au nom du compte.
  const onLeave = useCallback(() => {
    clearProfilePickerRequest();
    setDecided({ account: accountId, show: false });
  }, [accountId]);

  if (!show) return null;
  const stayInitial = listing.data ? mobileStayInitial(listing.data, choice, stay, Date.now(), asked) : false;
  return (
    <BootAwareModal bootOverlay="profiles" animationType="fade" statusBarTranslucent supportedOrientations={[...MODAL_ORIENTATIONS]} onRequestClose={noop}>
      <Retained />
      <WhoIsWatchingView listing={listing.data} mode="launch" stayOffered={asked} stayInitial={stayInitial} onPicked={onPicked} onStale={onStale} listingFailed={listing.isError} onLeave={onLeave} />
    </BootAwareModal>
  );
}
