import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { unlockTvManage, useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import type { TvProfilesDto } from "@tentacle-tv/shared";
import {
  PIN_ENTRY_START,
  confirmPress,
  erasePinDigit,
  findProfile,
  isProfileLocked,
  pinEntryFor,
  pinLockLapsed,
  pinLockRemainingMs,
  pinRefused,
  planProfileLaunch,
  planProfilePick,
  pressPinDigit,
  refusalReloadsProfiles,
  type PinDigit,
  type PinEntry,
  type ProfileIntent,
  type ProfileLaunch,
  type ProfileRefusal,
} from "@tentacle-tv/tv-core";
import { loadProfiles, openProfile } from "../../auth/profileOpening";
import { leaveProfile } from "../../auth/profileSession";
import { unpairDevice } from "../../auth/unpair";

/**
 * L'AUTOMATE de « Qui regarde ? » (Apple TV, Famille) : lire les profils,
 * ouvrir celui qui s'ouvre seul (« Rester », le seul profil), sinon montrer la
 * rangée ; le pavé du PIN d'un profil protégé ; « Gérer les profils » par la
 * session du propriétaire. Les décisions sont celles de tv-core
 * (`session/profileLaunch`, `session/profileRefusal`, `session/pinEntry`) ;
 * le serveur juge tout — PIN compris, que la TV ne fait que transmettre.
 */

export type ProfilesPhase =
  | { kind: "loading"; opening: string | null }
  | { kind: "error"; refusal: ProfileRefusal }
  | { kind: "picker" }
  | { kind: "pin"; profileId: string; purpose: "open" | "manage"; remember: boolean; launch: ProfileLaunch };

interface OpenRequest {
  pin?: string;
  remember: boolean;
  launch: ProfileLaunch;
}

export function useProfilesFlow(intent: ProfileIntent, go: { home: () => void; manage: () => void }) {
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  const context = useMemo(() => ({ jfClient, storage, queryClient }), [jfClient, storage, queryClient]);

  const [listing, setListing] = useState<TvProfilesDto | null>(null);
  const [phase, setPhase] = useState<ProfilesPhase>({ kind: "loading", opening: null });
  const [remember, setRemember] = useState(false);
  const [notice, setNotice] = useState<ProfileRefusal | null>(null);
  const [entry, setEntry] = useState<PinEntry>(PIN_ENTRY_START);
  const [unpairArmed, setUnpairArmed] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  function showPin(list: TvProfilesDto, profileId: string, purpose: "open" | "manage", keep: boolean, launch: ProfileLaunch): void {
    const profile = findProfile(list, profileId);
    setEntry(pinEntryFor(profile?.lockedUntil ?? null, Date.now()));
    setPhase({ kind: "pin", profileId, purpose, remember: keep, launch });
  }

  async function load(planIntent: ProfileIntent | null): Promise<void> {
    setPhase({ kind: "loading", opening: null });
    const loaded = await loadProfiles(context);
    if (!alive.current) return;
    if (!loaded.ok) {
      if (loaded.refusal.kind === "unpaired") unpairDevice(context, "revoked");
      else setPhase({ kind: "error", refusal: loaded.refusal });
      return;
    }
    setListing(loaded.listing);
    const plan = planIntent ? planProfileLaunch(loaded.listing, planIntent, Date.now()) : { kind: "picker" as const };
    if (plan.kind === "open") return open(loaded.listing, plan.profileId, { remember: plan.remember, launch: plan.launch }, "open");
    if (plan.kind === "pin") return showPin(loaded.listing, plan.profileId, "open", false, plan.launch);
    setPhase({ kind: "picker" });
  }

  /** « Gérer les profils » : la session du propriétaire s'ouvre, puis la gestion (PIN redemandé par le serveur). */
  async function unlockManage(pin: string | undefined): Promise<boolean> {
    const serverUrl = storage.getItem("tentacle_server_url");
    const token = storage.getItem("tentacle_token");
    if (!serverUrl || !token) return false;
    try {
      await unlockTvManage({ serverUrl, token }, pin ? { pin } : {});
      return true;
    } catch {
      return false;
    }
  }

  async function open(list: TvProfilesDto, profileId: string, request: OpenRequest, purpose: "open" | "manage"): Promise<void> {
    const profile = findProfile(list, profileId);
    if (!profile) return;
    if (!request.pin) setPhase({ kind: "loading", opening: profile.name });
    const result = await openProfile(context, list, { profileId: profile.userId, ...request });
    if (!alive.current) return;
    if (!result.ok) return refused(result.refusal, list, profile.userId, purpose, request);
    if (purpose === "open") return go.home();
    if (await unlockManage(request.pin)) {
      if (alive.current) go.manage();
      return;
    }
    // La gestion refusée : la session du propriétaire, ouverte pour elle, se referme.
    if (alive.current) leaveProfile(context, "switch");
  }

  function refused(refusal: ProfileRefusal, list: TvProfilesDto, profileId: string, purpose: "open" | "manage", request: OpenRequest): void {
    if (refusal.kind === "unpaired") return unpairDevice(context, "revoked");
    if (refusal.kind === "pinInvalid" || refusal.kind === "locked") {
      if (request.pin) {
        setEntry((current) => pinRefused(current, refusal));
        return;
      }
      return showPin(list, profileId, purpose, request.remember, request.launch);
    }
    if (refusal.kind === "pinRequired") return showPin(list, profileId, purpose, request.remember, request.launch);
    setNotice(refusal);
    setEntry(PIN_ENTRY_START);
    if (refusalReloadsProfiles(refusal)) void load(null);
    else setPhase({ kind: "picker" });
  }

  // Un blocage échu rouvre le pavé, à l'heure dite par le serveur.
  useEffect(() => {
    const remaining = pinLockRemainingMs(entry, Date.now());
    if (remaining === null) return undefined;
    const timer = setTimeout(() => setEntry((current) => pinLockLapsed(current, Date.now()) ?? current), remaining);
    return () => clearTimeout(timer);
  }, [entry]);

  // Une fois, à l'arrivée : le profil qui s'ouvre seul, sinon la rangée.
  useEffect(() => {
    void load(intent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = phase.kind === "loading" || entry.phase === "checking";

  return {
    listing,
    phase,
    remember,
    notice,
    entry,
    unpairArmed,
    retry: () => void load(intent),
    pick: (index: number) => {
      const profile = listing?.profiles[index];
      if (!listing || !profile || busy) return;
      setNotice(null);
      const plan = planProfilePick(profile, listing, remember, Date.now());
      if (plan.kind === "locked") return setNotice({ kind: "locked", until: plan.until });
      if (plan.kind === "pin") return showPin(listing, profile.userId, "open", plan.remember, plan.launch);
      void open(listing, profile.userId, { remember: plan.remember, launch: plan.launch }, "open");
    },
    manage: () => {
      const owner = listing?.profiles.find((profile) => profile.kind === "owner");
      if (!listing || !owner || busy || !listing.canManage) return;
      setNotice(null);
      if (isProfileLocked(owner, Date.now())) return setNotice({ kind: "locked", until: owner.lockedUntil });
      if (owner.hasPin) return showPin(listing, owner.userId, "manage", false, "picked");
      void open(listing, owner.userId, { remember: false, launch: "picked" }, "manage");
    },
    toggleRemember: () => setRemember((current) => !current),
    digit: (digit: string) => {
      if (phase.kind !== "pin" || !listing) return;
      const { entry: next, submit } = pressPinDigit(entry, digit as PinDigit);
      setEntry(next);
      if (submit) void open(listing, phase.profileId, { pin: submit, remember: phase.remember, launch: phase.launch }, phase.purpose);
    },
    erase: () => setEntry((current) => erasePinDigit(current)),
    closePin: () => {
      // Bloqué en route : la rangée se relit, et dit jusqu'à quand.
      const locked = entry.phase === "locked";
      setEntry(PIN_ENTRY_START);
      if (locked) void load(null);
      else setPhase({ kind: "picker" });
    },
    /** « Déjumeler cet appareil » sous une erreur : double appui (tv-core `confirmPress`). */
    unpairFromError: () => {
      const step = confirmPress(unpairArmed ? "unpair" : null, "unpair");
      setUnpairArmed(step.armed !== null);
      if (step.run) unpairDevice(context, "settings");
    },
  };
}

export type ProfilesFlow = ReturnType<typeof useProfilesFlow>;
