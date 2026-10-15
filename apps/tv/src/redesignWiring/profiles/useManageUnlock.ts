import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FAMILY_OVERVIEW_KEY, unlockTvManage, useTentacleConfig } from "@tentacle-tv/api-client";
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
 * L'ouverture de « Gérer les profils » — la session du profil qui gère (le
 * propriétaire, un parent, un membre, chacun avec SES droits), derrière SON
 * code PIN. Décisions du 16/10 : la page lit d'abord la famille — un profil
 * ouvert par son code a déjà la gestion ouverte, dix minutes prolongées à
 * chaque geste —, et le pavé ne paraît que si le serveur répond
 * `family.manage_locked` (`relock`) ; le code tapé part à
 * `POST /api/family/tv/manage/unlock`. Sans code (`family.manage_pin_required`,
 * `needsPin`) : la page invite à en poser un.
 */

export type UnlockPhase = "pin" | "ready" | "needsPin" | "error";

/** `family.manage_pin_required` : ce profil gérerait avec un code PIN. */
export function isManagePinRequired(refusal: ProfileRefusal): boolean {
  return refusal.kind === "failed" && refusal.code === "family.manage_pin_required";
}

export function useManageUnlock() {
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<UnlockPhase>("ready");
  const [entry, setEntry] = useState<PinEntry>(PIN_ENTRY_START);
  const [failure, setFailure] = useState<ProfileRefusal | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  async function unlock(pin: string): Promise<void> {
    const serverUrl = storage.getItem("tentacle_server_url");
    const token = storage.getItem("tentacle_token");
    if (!serverUrl || !token) return;
    try {
      await unlockTvManage({ serverUrl, token }, { pin });
      if (!alive.current) return;
      // Le refus d'avant s'efface : la famille se relit, sans montrer l'erreur qui a mené au pavé.
      await queryClient.resetQueries({ queryKey: [...FAMILY_OVERVIEW_KEY] });
      if (!alive.current) return;
      setEntry(PIN_ENTRY_START);
      setPhase("ready");
    } catch (error) {
      if (!alive.current) return;
      const refusal = refusalOfError(error);
      if (refusal.kind === "pinInvalid" || refusal.kind === "locked") {
        setEntry((current) => pinRefused(current, refusal));
      } else if (refusal.kind === "pinRequired") {
        setEntry(PIN_ENTRY_START);
      } else if (isManagePinRequired(refusal)) {
        setPhase("needsPin");
      } else {
        setFailure(refusal);
        setPhase("error");
      }
    }
  }

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
    /** Le serveur a répondu `family.manage_locked` : le pavé, pour SON code. */
    relock: () => {
      setFailure(null);
      setEntry(PIN_ENTRY_START);
      setPhase("pin");
    },
    /** Le serveur a répondu `family.manage_pin_required` : poser un code d'abord. */
    needsPin: () => setPhase("needsPin"),
    /** Relire la famille (après une erreur, ou un code posé) : le serveur redira ce qu'il faut. */
    retry: () => {
      setFailure(null);
      setPhase("ready");
      void queryClient.resetQueries({ queryKey: [...FAMILY_OVERVIEW_KEY] });
    },
    digit: (digit: string) => {
      const { entry: next, submit } = pressPinDigit(entry, digit as PinDigit);
      setEntry(next);
      // Le pavé reste là pendant la vérification (« Vérification… ») : un code faux s'y redit.
      if (submit) void unlock(submit);
    },
    erase: () => setEntry((current) => erasePinDigit(current)),
  };
}
