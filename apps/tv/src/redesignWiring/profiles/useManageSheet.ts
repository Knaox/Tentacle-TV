import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSetFamilyGuestPin, useSetFamilyGuestRights, useSetFamilyMemberRights, useSetFamilyMemberRole } from "@tentacle-tv/api-client";
import {
  PIN_ENTRY_START,
  confirmBlur,
  confirmPress,
  erasePinDigit,
  manageGestureKeys,
  ownPinEntered,
  ownPinStart,
  pressPinDigit,
  type ManageGesture,
  type ManageRowModel,
  type OwnPinFlow,
  type PinDigit,
  type PinEntry,
} from "@tentacle-tv/tv-core";
import type { PendingRight } from "./manageModel";
import { refusalMessage } from "./profilesModel";
import type { ManageActions } from "./useManageActions";

type ToggleKind = "requestTitles" | "parentRole" | "createGuests";

const TOGGLE_NOTICES: Record<ToggleKind, { on: string; off: string }> = {
  requestTitles: { on: "familyTv:manage.requestOn", off: "familyTv:manage.requestOff" },
  parentRole: { on: "familyTv:sheet.parentOn", off: "familyTv:sheet.parentOff" },
  createGuests: { on: "familyTv:manage.rightOn", off: "familyTv:manage.rightOff" },
};

/**
 * Les GESTES de la fiche d'un profil (« Gérer les profils », TV) : chaque
 * ligne part au serveur, qui juge ; un refus se dit sous les lignes. Les
 * réglages oui/non (« peut demander », « parent », « peut créer des
 * invités ») montrent leur nouvel état pendant l'envoi ; retirer le code,
 * supprimer, retirer de la famille se font à double appui (tv-core
 * `confirmPress`). Le code d'un invité : le nouveau, puis sa confirmation
 * (tv-core `ownPin`, sans code actuel — c'est le gérant qui le pose). La photo
 * et le contrôle parental ouvrent les pages d'autres chantiers (`onPhoto`,
 * `onParental`).
 */
export function useManageSheet({ row, actions, onPhoto, onParental }: {
  row: ManageRowModel | null;
  actions: ManageActions;
  onPhoto: (row: ManageRowModel) => void;
  onParental: (row: ManageRowModel) => void;
}) {
  const { t } = useTranslation(["familyTv", "family"]);
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRight>(null);
  const [pinFlow, setPinFlow] = useState<OwnPinFlow>(() => ownPinStart("create"));
  const [pinEntry, setPinEntry] = useState<PinEntry>(PIN_ENTRY_START);
  const [pinNote, setPinNote] = useState<string | null>(null);
  // La dernière ligne pressée : le focus y revient (même rangée si elle change de forme).
  const lastKey = useRef<string | null>(null);

  const setGuestRights = useSetFamilyGuestRights();
  const setMemberRights = useSetFamilyMemberRights();
  const setMemberRole = useSetFamilyMemberRole();
  const setGuestPin = useSetFamilyGuestPin();

  function failed(error: unknown): void {
    actions.say({ text: refusalMessage(actions.refused(error), t), tone: "error" });
  }

  async function toggle(target: ManageRowModel, kind: ToggleKind, key: string, current: boolean): Promise<void> {
    if (pending) return;
    const on = !current;
    setPending({ key, on });
    try {
      if (kind === "requestTitles") await setGuestRights.mutateAsync({ userId: target.userId, rights: { requestTitles: on } });
      else if (kind === "createGuests") await setMemberRights.mutateAsync({ userId: target.userId, rights: { createGuests: on } });
      else await setMemberRole.mutateAsync({ userId: target.userId, parent: on });
      actions.say({ text: t(on ? TOGGLE_NOTICES[kind].on : TOGGLE_NOTICES[kind].off, { name: target.name }), tone: "success" });
    } catch (error) {
      failed(error);
    } finally {
      setPending(null);
    }
  }

  async function savePin(target: ManageRowModel, pin: string | null): Promise<void> {
    try {
      await setGuestPin.mutateAsync({ userId: target.userId, pin });
      actions.say({ text: t(pin ? "familyTv:sheet.pinSet" : "familyTv:sheet.pinRemoved", { name: target.name }), tone: "success" });
      setArmedKey(null);
      if (pin) actions.toSheet();
    } catch (error) {
      if (pin) {
        // Le pavé se remet à zéro et dit pourquoi ; la fiche le redira si l'on y revient.
        setPinFlow(ownPinStart("create"));
        setPinEntry(PIN_ENTRY_START);
        setPinNote(refusalMessage(actions.refused(error), t));
      } else failed(error);
    }
  }

  function run(target: ManageRowModel, gesture: ManageGesture, key: string): void {
    switch (gesture.kind) {
      case "photo":
        return onPhoto(target);
      case "parental":
        return onParental(target);
      case "pin":
        if (key.endsWith(":remove")) {
          const step = confirmPress(armedKey, key);
          setArmedKey(step.armed);
          if (step.run) void savePin(target, null);
          return;
        }
        setPinFlow(ownPinStart("create"));
        setPinEntry(PIN_ENTRY_START);
        setPinNote(null);
        return actions.openGuestPin();
      case "requestTitles":
      case "parentRole":
      case "createGuests":
        return void toggle(target, gesture.kind, key, gesture.on);
      case "delete":
      case "remove": {
        const step = confirmPress(armedKey, key);
        setArmedKey(step.armed);
        if (step.run) void actions.runRow(target, gesture.kind);
      }
    }
  }

  return {
    armedKey,
    pending,
    pin: { flow: pinFlow, entry: pinEntry, note: pinNote },
    lastKey,
    /** Une nouvelle fiche s'ouvre : rien d'armé, le focus sur son premier geste. */
    reset: () => {
      setArmedKey(null);
      lastKey.current = null;
    },
    press: (key: string) => {
      if (!row) return;
      const gesture = row.gestures.find((candidate) => manageGestureKeys(candidate).includes(key));
      if (!gesture) return;
      lastKey.current = key;
      if (gesture.kind !== "delete" && gesture.kind !== "remove" && !key.endsWith(":remove")) setArmedKey(null);
      run(row, gesture, key);
    },
    blur: (key: string) => setArmedKey((current) => confirmBlur(current, key)),
    /** Un chiffre du code de l'invité : quatre tapés, l'étape suivante ; confirmé, il part au serveur. */
    digit: (digit: string) => {
      if (!row) return;
      const { entry: next, submit } = pressPinDigit(pinEntry, digit as PinDigit);
      if (!submit) return setPinEntry(next);
      const step = ownPinEntered(pinFlow, submit);
      setPinFlow(step.flow);
      setPinNote(null);
      if (step.submit) {
        setPinEntry(next);
        void savePin(row, step.submit.pin);
      } else setPinEntry(PIN_ENTRY_START);
    },
    erase: () => setPinEntry((current) => erasePinDigit(current)),
  };
}

export type ManageSheet = ReturnType<typeof useManageSheet>;
