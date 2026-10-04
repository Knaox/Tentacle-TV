import { useEffect, useRef, useState } from "react";
import { unlockTvManage, useTentacleConfig } from "@tentacle-tv/api-client";
import {
  PIN_ENTRY_START,
  erasePinDigit,
  pinLockLapsed,
  pinLockRemainingMs,
  pinRefused,
  pressPinDigit,
  type PinDigit,
  type PinEntry,
  type ProfileRefusal,
} from "@tentacle-tv/tv-core";
import { refusalOfError } from "../../auth/profileOpening";

/**
 * L'ouverture de « Gérer les profils » (`POST /api/family/tv/manage/unlock`) :
 * la session du PROPRIÉTAIRE seulement, son PIN s'il en a un — le serveur
 * l'exige, le vérifie, et ouvre la gestion pour dix minutes. Venue de « Qui
 * regarde ? », elle l'est déjà ; venue des réglages, elle s'ouvre ici ;
 * refermée en route (`family.manage_locked`), elle se rouvre (`relock`).
 */

export type UnlockPhase = "unlocking" | "pin" | "ready" | "error";

export function useManageUnlock(origin: "profiles" | "settings", ownerHasPin: boolean) {
  const { storage } = useTentacleConfig();
  const [phase, setPhase] = useState<UnlockPhase>(origin === "profiles" ? "ready" : "unlocking");
  const [entry, setEntry] = useState<PinEntry>(PIN_ENTRY_START);
  const [failure, setFailure] = useState<ProfileRefusal | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  async function unlock(pin?: string): Promise<void> {
    const serverUrl = storage.getItem("tentacle_server_url");
    const token = storage.getItem("tentacle_token");
    if (!serverUrl || !token) return;
    try {
      await unlockTvManage({ serverUrl, token }, pin ? { pin } : {});
      if (!alive.current) return;
      setEntry(PIN_ENTRY_START);
      setPhase("ready");
    } catch (error) {
      if (!alive.current) return;
      const refusal = refusalOfError(error);
      if (refusal.kind === "pinInvalid" || refusal.kind === "locked") {
        setEntry((current) => pinRefused(pin ? current : PIN_ENTRY_START, refusal));
        setPhase("pin");
      } else if (refusal.kind === "pinRequired") {
        setEntry(PIN_ENTRY_START);
        setPhase("pin");
      } else {
        setFailure(refusal);
        setPhase("error");
      }
    }
  }

  function open(): void {
    setFailure(null);
    if (ownerHasPin) {
      setEntry(PIN_ENTRY_START);
      setPhase("pin");
      return;
    }
    setPhase("unlocking");
    void unlock();
  }

  // Venue des réglages : la gestion s'ouvre en arrivant.
  useEffect(() => {
    if (origin === "settings") open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Un blocage échu rouvre le pavé, à l'heure dite par le serveur.
  useEffect(() => {
    const remaining = pinLockRemainingMs(entry, Date.now());
    if (remaining === null) return undefined;
    const timer = setTimeout(() => setEntry((current) => pinLockLapsed(current, Date.now()) ?? current), remaining);
    return () => clearTimeout(timer);
  }, [entry]);

  return {
    phase,
    entry,
    failure,
    /** La gestion s'est refermée (dix minutes) : la rouvrir. */
    relock: open,
    retry: open,
    digit: (digit: string) => {
      const { entry: next, submit } = pressPinDigit(entry, digit as PinDigit);
      setEntry(next);
      if (submit) void unlock(submit);
    },
    erase: () => setEntry((current) => erasePinDigit(current)),
  };
}
