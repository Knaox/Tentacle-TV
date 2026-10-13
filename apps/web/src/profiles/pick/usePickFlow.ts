import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TentacleApiError } from "@tentacle-tv/api-client";
import {
  PIN_ENTRY_START,
  erasePinDigit,
  isPickerProfileLocked,
  pinEntryFor,
  pinLockLapsed,
  pinLockRemainingMs,
  pinRefused,
  pressPinDigit,
  profileRefusalOf,
  type PickedProfileDto,
  type PickerProfileDto,
  type PinDigit,
  type PinEntry,
  type ProfileRefusal,
} from "@tentacle-tv/shared";
import { beginProfileSwitch, cancelProfileSwitch } from "../../auth/profileEnded";
import { pickProfile } from "../api/pickerGateway";

/**
 * Choisir un profil de la famille — sur « Qui regarde ? » comme dans le menu
 * de l'avatar : le pavé du code PIN si le profil en a un (ou s'il est bloqué),
 * l'ouverture par le serveur, et ce qu'on dit d'un refus. Rien n'est comparé
 * ici : le quatrième chiffre part au serveur (règle du pavé : shared
 * `familyPinEntry.ts` ; lecture des refus : `familyProfileRefusal.ts`).
 */

export interface PickPin {
  profile: PickerProfileDto;
  entry: PinEntry;
  message: string | null;
}

export interface PickFlow {
  /** Le pavé ouvert, ou null : la rangée. */
  pin: PickPin | null;
  /** Le profil en cours d'ouverture (le serveur répond). */
  opening: string | null;
  /** Un refus à dire sur la rangée (profil retiré, familles coupées, serveur muet). */
  notice: string | null;
  choose: (profileId: string) => void;
  digit: (digit: string) => void;
  erase: () => void;
  back: () => void;
}

export interface PickFlowOptions {
  profiles: readonly PickerProfileDto[];
  deviceName: string;
  /** La réponse du serveur : la suite (rester, ou recharger au nom du profil). */
  onPicked: (picked: PickedProfileDto) => Promise<void>;
  /** La liste a changé sous nos pieds : la relire. */
  onStale: () => void;
  /** La session personnelle n'est plus (401) : tout reprendre à la connexion. */
  onAccountLost: () => void;
}

function refusalOf(error: unknown): { refusal: ProfileRefusal; status: number } {
  if (error instanceof TentacleApiError) return { refusal: profileRefusalOf(error.status, error.message), status: error.status };
  return { refusal: { kind: "offline" }, status: 0 };
}

export function usePickFlow({ profiles, deviceName, onPicked, onStale, onAccountLost }: PickFlowOptions): PickFlow {
  const { t, i18n } = useTranslation("profilePicker");
  const [pin, setPin] = useState<PickPin | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);

  const timeOf = useCallback(
    (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" }) : ""),
    [i18n.language],
  );

  const open = useCallback(async (profile: PickerProfileDto, code?: string) => {
    if (busy.current) return;
    busy.current = true;
    setNotice(null);
    setOpening(profile.userId);
    beginProfileSwitch();
    try {
      const picked = await pickProfile(profile.userId, code, deviceName);
      await onPicked(picked);
    } catch (error) {
      cancelProfileSwitch();
      const { refusal, status } = refusalOf(error);
      if (status === 401) {
        onAccountLost();
        return;
      }
      setOpening(null);
      switch (refusal.kind) {
        case "pinInvalid":
        case "locked": {
          const entry = pinRefused(pinEntryFor(null, Date.now()), refusal);
          const message = refusal.kind === "pinInvalid"
            ? t("pin.wrong", { count: refusal.attemptsLeft })
            : t("pin.locked", { time: timeOf(refusal.until) });
          setPin({ profile, entry, message });
          break;
        }
        case "pinRequired":
          setPin({ profile, entry: PIN_ENTRY_START, message: null });
          onStale();
          break;
        case "unavailable":
        case "disabled":
          setPin(null);
          setNotice(refusal.kind === "unavailable" ? t("refusal.unavailable")
            : refusal.code === "family.guests_disabled" ? t("refusal.guestsDisabled") : t("refusal.disabled"));
          onStale();
          break;
        case "offline":
          if (code !== undefined) setPin({ profile, entry: PIN_ENTRY_START, message: t("refusal.offline") });
          else setNotice(t("refusal.offline"));
          break;
        default:
          if (code !== undefined) setPin({ profile, entry: PIN_ENTRY_START, message: t("refusal.failed") });
          else setNotice(t("refusal.failed"));
      }
    } finally {
      busy.current = false;
    }
  }, [deviceName, onPicked, onStale, onAccountLost, t, timeOf]);

  const choose = useCallback((profileId: string) => {
    const profile = profiles.find((candidate) => candidate.userId === profileId);
    if (!profile || busy.current) return;
    const locked = isPickerProfileLocked(profile, Date.now());
    if (profile.hasPin || locked) {
      setNotice(null);
      const entry = pinEntryFor(profile.lockedUntil, Date.now());
      setPin({ profile, entry, message: locked ? t("pin.locked", { time: timeOf(profile.lockedUntil) }) : null });
      return;
    }
    void open(profile);
  }, [profiles, open, t, timeOf]);

  const digit = useCallback((value: string) => {
    if (!pin || busy.current) return;
    const { entry, submit } = pressPinDigit(pin.entry, value as PinDigit);
    if (entry === pin.entry) return;
    setPin({ ...pin, entry, message: entry.phase === "checking" ? null : pin.entry.phase === "wrong" ? null : pin.message });
    if (submit !== null) void open(pin.profile, submit);
  }, [pin, open]);

  const erase = useCallback(() => {
    if (!pin) return;
    const entry = erasePinDigit(pin.entry);
    if (entry !== pin.entry) setPin({ ...pin, entry, message: pin.entry.phase === "wrong" ? null : pin.message });
  }, [pin]);

  const back = useCallback(() => {
    if (busy.current) return;
    setPin(null);
  }, []);

  // Un blocage échu rouvre le pavé de lui-même.
  const lockedEntry = pin?.entry.phase === "locked" ? pin.entry : null;
  useEffect(() => {
    if (!lockedEntry) return;
    const remaining = pinLockRemainingMs(lockedEntry, Date.now());
    if (remaining === null) return;
    const timer = window.setTimeout(() => {
      setPin((current) => {
        if (!current) return current;
        const lapsed = pinLockLapsed(current.entry, Date.now());
        return lapsed ? { ...current, entry: lapsed, message: null } : current;
      });
    }, remaining + 250);
    return () => window.clearTimeout(timer);
  }, [lockedEntry]);

  return { pin, opening, notice, choose, digit, erase, back };
}
