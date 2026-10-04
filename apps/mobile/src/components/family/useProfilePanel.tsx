import { useCallback, useState, type ReactNode } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useDeleteFamilyGuest, useRemoveFamilyMember } from "@tentacle-tv/api-client";
import type { FamilyProfileDto } from "@tentacle-tv/shared";
import { whenNoModal } from "@/components/ui/modalGate";
import { useFamilyText } from "@/family/useFamilyText";
import { showToast } from "@/notices/toastStore";
import { haptic } from "@/utils/haptics";
import { FamilyProfileSheet } from "./FamilyProfileSheet";
import { GuestPinSheet } from "./PinSheet";

/** Ce que le panneau d'un profil permet ici (la page le décide d'après le serveur). */
export interface ProfilePanelRights {
  pin: boolean;
  remove: boolean;
}

/**
 * Le panneau d'un profil et ses suites : la feuille du code PIN s'ouvre une
 * fois le panneau retiré (une modale à la fois, `modalGate`), et le geste qui
 * retire se confirme en disant ce qu'il coûte avant de partir.
 */
export function useProfilePanel(rightsOf: (profile: FamilyProfileDto) => ProfilePanelRights) {
  const { t } = useTranslation("familyWeb");
  const { errorText } = useFamilyText();
  const removeMember = useRemoveFamilyMember();
  const deleteGuest = useDeleteFamilyGuest();
  const [open, setOpen] = useState<FamilyProfileDto | null>(null);
  const [pinGuest, setPinGuest] = useState<FamilyProfileDto | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const failed = useCallback((error: unknown) => showToast({ title: errorText(error) }), [errorText]);

  const openPin = useCallback((profile: FamilyProfileDto) => {
    setOpen(null);
    whenNoModal(() => setPinGuest(profile));
  }, []);

  const confirmRemove = useCallback((profile: FamilyProfileDto) => {
    const guest = profile.kind === "guest";
    const name = profile.name;
    const done = { onSuccess: () => setOpen(null), onError: failed };
    Alert.alert(
      guest ? t("confirm.deleteGuestTitle", { name }) : t("confirm.removeTitle", { name }),
      guest ? t("confirm.deleteGuestBody") : t("confirm.removeBody"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: guest ? t("confirm.deleteGuestAction") : t("confirm.removeAction"),
          style: "destructive",
          onPress: () => {
            haptic("destructive");
            if (guest) deleteGuest.mutate(profile.userId, done);
            else removeMember.mutate(profile.userId, done);
          },
        },
      ],
    );
  }, [t, deleteGuest, removeMember, failed]);

  const rights = open ? rightsOf(open) : null;
  const element: ReactNode = (
    <>
      {open && rights ? (
        <FamilyProfileSheet
          profile={open}
          onPin={rights.pin ? () => openPin(open) : undefined}
          onRemove={rights.remove ? () => confirmRemove(open) : undefined}
          onClose={close}
        />
      ) : null}
      {pinGuest ? <GuestPinSheet guest={pinGuest} onClose={() => setPinGuest(null)} /> : null}
    </>
  );

  return { open: setOpen as (profile: FamilyProfileDto) => void, element };
}
