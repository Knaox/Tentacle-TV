import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSetFamilyGuestPin, useSetOwnFamilyPin } from "@tentacle-tv/api-client";
import type { FamilyProfileDto, SetOwnPinBody } from "@tentacle-tv/shared";
import { useToast } from "../../contexts/ToastContext";
import { useFamilyText } from "../useFamilyText";
import { PinDialog } from "./PinDialog";

/**
 * Les deux portes du code PIN : le sien (`PUT /api/family/pin`) et celui
 * d'un invité, posé par le propriétaire. Poser, changer ou retirer un code
 * ferme le profil sur les TV où il est ouvert — le serveur s'en charge avant
 * de répondre.
 */
function usePinFlow<T>(mutate: (vars: T, options: { onSuccess: (r: { hasPin: boolean }) => void; onError: (e: unknown) => void }) => void, onClose: () => void) {
  const { t } = useTranslation("familyWeb");
  const { errorText } = useFamilyText();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  return {
    error,
    run: (vars: T) => {
      setError(null);
      mutate(vars, {
        onSuccess: (result) => {
          toast.show("success", t(result.hasPin ? "pin.saved" : "pin.removed"));
          onClose();
        },
        onError: (failure) => setError(errorText(failure)),
      });
    },
  };
}

export function OwnPinDialog({ hasPin, onClose }: { hasPin: boolean; onClose: () => void }) {
  const { t } = useTranslation("familyWeb");
  const setPin = useSetOwnFamilyPin();
  const flow = usePinFlow<SetOwnPinBody>(setPin.mutate, onClose);
  // Un code déjà posé ne se change ni ne se retire sans l'actuel.
  return (
    <PinDialog
      open
      title={t("pin.titleSelf")}
      pending={setPin.isPending}
      error={flow.error}
      requireCurrent={hasPin}
      onSubmit={(pin, currentPin) => flow.run({ pin, currentPin })}
      onRemove={hasPin ? (currentPin) => flow.run({ pin: null, currentPin }) : undefined}
      onClose={onClose}
    />
  );
}

export function GuestPinDialog({ guest, onClose }: { guest: FamilyProfileDto; onClose: () => void }) {
  const { t } = useTranslation("familyWeb");
  const setPin = useSetFamilyGuestPin();
  const flow = usePinFlow<{ userId: string; pin: string | null }>(setPin.mutate, onClose);
  return (
    <PinDialog
      open
      title={t("pin.titleGuest", { name: guest.name })}
      pending={setPin.isPending}
      error={flow.error}
      onSubmit={(pin) => flow.run({ userId: guest.userId, pin })}
      onRemove={guest.hasPin ? () => flow.run({ userId: guest.userId, pin: null }) : undefined}
      onClose={onClose}
    />
  );
}
