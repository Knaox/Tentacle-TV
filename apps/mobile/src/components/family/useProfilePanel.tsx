import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useDeleteFamilyGuest, useRemoveFamilyMember } from "@tentacle-tv/api-client";
import type { FamilyProfileDto, ProfileActions } from "@tentacle-tv/shared";
import { whenNoModal } from "@/components/ui/modalGate";
import { useFamilyText } from "@/family/useFamilyText";
import { showToast } from "@/notices/toastStore";
import { haptic } from "@/utils/haptics";
import { FamilyProfileSheet } from "./FamilyProfileSheet";
import { GuestRightsSection } from "./GuestRightsSection";
import { MemberRightsSection } from "./MemberRightsSection";
import { GuestPinSheet } from "./PinSheet";

/**
 * Le panneau d'un profil et ses suites. Le panneau retient l'IDENTIFIANT du
 * profil et le relit dans la famille à chaque rendu : un droit réglé, un PIN
 * posé s'y voient aussitôt ; un profil disparu (retiré ailleurs) le referme.
 * La feuille du code PIN s'ouvre une fois le panneau retiré (une modale à la
 * fois, `modalGate`) ; le geste qui retire se confirme en disant ce qu'il coûte.
 */
export function useProfilePanel(
  profiles: readonly FamilyProfileDto[],
  actionsOf: (profile: FamilyProfileDto) => ProfileActions,
) {
  const { t } = useTranslation("familyWeb");
  const { errorText } = useFamilyText();
  const removeMember = useRemoveFamilyMember();
  const deleteGuest = useDeleteFamilyGuest();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pinGuestId, setPinGuestId] = useState<string | null>(null);
  const open = openId ? profiles.find((p) => p.userId === openId) ?? null : null;
  const pinGuest = pinGuestId ? profiles.find((p) => p.userId === pinGuestId) ?? null : null;

  // Retiré ailleurs (autre appareil, départ) : le panneau se referme.
  useEffect(() => {
    if (openId && !open) setOpenId(null);
  }, [openId, open]);

  const close = useCallback(() => setOpenId(null), []);
  const failed = useCallback((error: unknown) => showToast({ title: errorText(error) }), [errorText]);

  const openPin = useCallback((profile: FamilyProfileDto) => {
    setOpenId(null);
    whenNoModal(() => setPinGuestId(profile.userId));
  }, []);

  const confirmRemove = useCallback((profile: FamilyProfileDto) => {
    const guest = profile.kind === "guest";
    const name = profile.name;
    const done = { onSuccess: () => setOpenId(null), onError: failed };
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

  const rights = open ? actionsOf(open) : null;
  const element: ReactNode = (
    <>
      {open && rights ? (
        <FamilyProfileSheet
          profile={open}
          onPin={rights.pin ? () => openPin(open) : undefined}
          onRemove={rights.remove ? () => confirmRemove(open) : undefined}
          onClose={close}
        >
          {rights.right === "createGuests" ? <MemberRightsSection member={open} /> : null}
          {rights.right === "requestTitles" ? <GuestRightsSection guest={open} /> : null}
        </FamilyProfileSheet>
      ) : null}
      {pinGuest ? <GuestPinSheet guest={pinGuest} onClose={() => setPinGuestId(null)} /> : null}
    </>
  );

  const openProfile = useCallback((profile: FamilyProfileDto) => setOpenId(profile.userId), []);
  return { open: openProfile, element };
}
