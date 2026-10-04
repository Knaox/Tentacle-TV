import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useReducedMotion } from "react-native-reanimated";
import { TV_MOTION } from "@tentacle-tv/theme";
import { unlockTvManage, useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import type { TvProfilesDto } from "@tentacle-tv/shared";
import {
  PIN_ENTRY_START,
  confirmPress,
  erasePinDigit,
  findProfile,
  isProfileLocked,
  manageEntryProfile,
  pinEntryFor,
  pinLockLapsed,
  pinLockRemainingMs,
  pinRefused,
  pickerOrder,
  pickerRemembers,
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
import { lastLeftRemembered, leaveProfile } from "../../auth/profileSession";
import { unpairDevice } from "../../auth/unpair";
import { MOTION_ENABLED } from "../../redesign/motion/motion";

/**
 * L'AUTOMATE de « Qui regarde ? » (Apple TV, Famille) : lire les profils,
 * ouvrir le profil retenu (« Ne plus proposer à l'ouverture »), sinon montrer
 * la rangée ; le pavé du PIN d'un profil protégé ; « Gérer les profils » par la
 * session de qui gère. Les décisions sont celles de tv-core
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
  // Le profil qui a ouvert le pavé : la rangée y rend le focus en revenant.
  const [lastPicked, setLastPicked] = useState<string | null>(null);
  // L'entrée dans le profil choisi (`ProfilesPicker`) : il s'avance pendant que sa session s'ouvre.
  const [entering, setEntering] = useState<string | null>(null);
  const reduced = useReducedMotion();
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
    // Le compte de la TV en tête (tv-core `pickerOrder`) : la rangée, ses index et son focus d'entrée suivent cet ordre.
    const ordered = pickerOrder(loaded.listing);
    setListing(ordered);
    // À l'arrivée seulement : une relecture après un refus garde la case telle que laissée.
    if (planIntent) setRemember(pickerRemembers(ordered, lastLeftRemembered()));
    const plan = planIntent ? planProfileLaunch(ordered, planIntent, Date.now()) : { kind: "picker" as const };
    if (plan.kind === "open") return open(ordered, plan.profileId, { remember: plan.remember, launch: plan.launch }, "open");
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

  /**
   * OK sur un profil qui s'ouvre sans code : l'ENTRÉE. La session s'ouvre
   * PENDANT que le profil s'avance ; l'accueil vient quand les deux ont fini
   * (sa pile native fond alors vers lui, qui charge déjà). Refusée, le profil
   * revient à sa place et le refus se dit comme ailleurs.
   */
  async function enter(list: TvProfilesDto, profileId: string, request: OpenRequest): Promise<void> {
    setEntering(profileId);
    const advanceMs = reduced || !MOTION_ENABLED ? 0 : TV_MOTION.profile.advanceMs;
    const [result] = await Promise.all([
      openProfile(context, list, { profileId, ...request }),
      new Promise((resolve) => setTimeout(resolve, advanceMs)),
    ]);
    if (!alive.current) return;
    if (result.ok) return go.home();
    setEntering(null);
    refused(result.refusal, list, profileId, "open", request);
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

  const busy = phase.kind === "loading" || entry.phase === "checking" || entering !== null;

  return {
    listing,
    phase,
    remember,
    notice,
    entry,
    unpairArmed,
    lastPicked,
    entering,
    retry: () => void load(intent),
    pick: (index: number) => {
      const profile = listing?.profiles[index];
      if (!listing || !profile || busy) return;
      setNotice(null);
      setLastPicked(profile.userId);
      const plan = planProfilePick(profile, listing, remember, Date.now());
      if (plan.kind === "locked") return setNotice({ kind: "locked", until: plan.until });
      if (plan.kind === "pin") return showPin(listing, profile.userId, "open", plan.remember, plan.launch);
      void enter(listing, profile.userId, { remember: plan.remember, launch: plan.launch });
    },
    /** « Gérer les profils » : qui gère (tv-core `manageEntryProfile` — v2 : le compte de la TV s'il gère, sinon le propriétaire), derrière SON PIN. */
    manage: () => {
      const manager = listing ? manageEntryProfile(listing) : null;
      if (!listing || !manager || busy) return;
      setNotice(null);
      setLastPicked(manager.userId);
      if (isProfileLocked(manager, Date.now())) return setNotice({ kind: "locked", until: manager.lockedUntil });
      if (manager.hasPin) return showPin(listing, manager.userId, "manage", false, "picked");
      void open(listing, manager.userId, { remember: false, launch: "picked" }, "manage");
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
