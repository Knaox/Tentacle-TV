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

/**
 * Choisir un profil sur « Qui regarde ? » du mobile — le jumeau du bureau
 * (`apps/web/src/profiles/pick/usePickFlow.ts`), sur les MÊMES règles
 * partagées : le pavé (`familyPinEntry`), la lecture des refus
 * (`familyProfileRefusal`). Rien n'est comparé ici : le quatrième chiffre part
 * au serveur, seul juge du code.
 */

export interface PickPin {
  profile: PickerProfileDto;
  entry: PinEntry;
  message: string | null;
}

export interface PickFlow {
  pin: PickPin | null;
  opening: string | null;
  notice: string | null;
  /** Le dernier choix a échoué faute de serveur : « Qui regarde ? » offre ses sorties (`pickerUnreachable`). */
  unreachable: boolean;
  choose: (profileId: string) => void;
  digit: (digit: PinDigit) => void;
  erase: () => void;
  back: () => void;
}

export interface PickFlowOptions {
  profiles: readonly PickerProfileDto[];
  /** Les profils qui s'ouvrent sans le pavé (le profil en cours, depuis « Changer de profil »). */
  opensWithoutPin: readonly string[];
  pick: (profileId: string, pin: string | undefined) => Promise<PickedProfileDto>;
  onPicked: (picked: PickedProfileDto) => void;
  /** La liste a changé sous nos pieds : la relire. */
  onStale: () => void;
}

function refusalOf(error: unknown): { refusal: ProfileRefusal; status: number } {
  if (error instanceof TentacleApiError) return { refusal: profileRefusalOf(error.status, error.message), status: error.status };
  return { refusal: { kind: "offline" }, status: 0 };
}

export function usePickFlow({ profiles, opensWithoutPin, pick, onPicked, onStale }: PickFlowOptions): PickFlow {
  const { t, i18n } = useTranslation("profilePicker");
  const [pin, setPin] = useState<PickPin | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
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
    setUnreachable(false);
    try {
      const picked = await pick(profile.userId, code);
      setOpening(null);
      setPin(null);
      onPicked(picked);
    } catch (error) {
      setOpening(null);
      const { refusal } = refusalOf(error);
      switch (refusal.kind) {
        case "pinInvalid":
        case "locked": {
          const entry = pinRefused(pinEntryFor(null, Date.now()), refusal);
          const message = refusal.kind === "pinInvalid"
            ? t("pin.wrong", { count: refusal.attemptsLeft })
            : t("pin.locked", { time: timeOf(refusal.until) });
          setPin({ profile, entry, message });
          if (refusal.kind === "locked") onStale();
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
          setUnreachable(true);
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
  }, [pick, onPicked, onStale, t, timeOf]);

  const choose = useCallback((profileId: string) => {
    const profile = profiles.find((candidate) => candidate.userId === profileId);
    if (!profile || busy.current) return;
    const locked = isPickerProfileLocked(profile, Date.now());
    if ((profile.hasPin && !opensWithoutPin.includes(profile.userId)) || locked) {
      setNotice(null);
      setPin({ profile, entry: pinEntryFor(profile.lockedUntil, Date.now()), message: locked ? t("pin.locked", { time: timeOf(profile.lockedUntil) }) : null });
      return;
    }
    void open(profile);
  }, [profiles, opensWithoutPin, open, t, timeOf]);

  const digit = useCallback((value: PinDigit) => {
    if (!pin || busy.current) return;
    const { entry, submit } = pressPinDigit(pin.entry, value);
    if (entry === pin.entry) return;
    setPin({ ...pin, entry, message: entry.phase === "checking" || pin.entry.phase === "wrong" ? null : pin.message });
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
    const timer = setTimeout(() => {
      setPin((current) => {
        if (!current) return current;
        const lapsed = pinLockLapsed(current.entry, Date.now());
        return lapsed ? { ...current, entry: lapsed, message: null } : current;
      });
    }, remaining + 250);
    return () => clearTimeout(timer);
  }, [lockedEntry]);

  return { pin, opening, notice, unreachable, choose, digit, erase, back };
}
