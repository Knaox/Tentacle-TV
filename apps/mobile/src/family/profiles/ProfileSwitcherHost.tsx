import { useCallback, useEffect } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { PickedProfileDto } from "@tentacle-tv/shared";
import { showToast } from "@/notices/toastStore";
import { whenNoModal } from "@/components/ui/modalGate";
import { useCanSwitchProfile } from "../useCanSwitchProfile";
import { useActiveProfile } from "./profileSessionState";
import { closeProfileSwitcher, useProfileSwitcherOpen } from "./profileSwitcherStore";
import { useCommitPick } from "./useCommitPick";
import { usePickerListing } from "./usePickerListing";
import { ProfileSwitcherSheet } from "./view/ProfileSwitcherSheet";

/**
 * L'hôte de la feuille « Changer de profil », monté une fois à la racine :
 * `openProfileSwitcher()` l'ouvre d'où qu'on soit. Une demande sans objet
 * (serveur sans `family.mobileProfiles`, famille d'une personne, hors ligne)
 * se referme sans rien montrer. Après la bascule, l'app repart à l'accueil au
 * nom du profil choisi et le dit (« Vous regardez sur le profil de … »).
 */
export function ProfileSwitcherHost() {
  const { t } = useTranslation("familyMobile");
  const open = useProfileSwitcherOpen();
  const canSwitch = useCanSwitchProfile();
  const listing = usePickerListing();
  const held = useActiveProfile();
  const commit = useCommitPick();
  const router = useRouter();

  useEffect(() => {
    if (open && !canSwitch && (listing.data || listing.isError || !listing.enabled)) closeProfileSwitcher();
  }, [open, canSwitch, listing.data, listing.isError, listing.enabled]);

  const { refetch } = listing;
  const onStale = useCallback(() => void refetch(), [refetch]);
  const onPicked = useCallback((picked: PickedProfileDto) => {
    const result = commit(picked);
    if (result === "failed") return;
    closeProfileSwitcher();
    if (result === "switched") {
      router.replace("/(tabs)" as never);
      showToast({ title: t("switcher.switched", { name: picked.profile.name }), tone: "success" });
    }
  }, [commit, router, t]);
  const onManage = useCallback(() => {
    closeProfileSwitcher();
    // La page Famille s'ouvre une fois la feuille retirée : rien ne s'y présente par-dessus une sortie.
    whenNoModal(() => router.push("/family" as never));
  }, [router]);

  if (!open || !canSwitch) return null;
  return (
    <ProfileSwitcherSheet
      listing={listing.data}
      // La gestion des profils : en session PERSONNELLE seulement (gestes personnels de la Famille).
      onManage={held ? undefined : onManage}
      onPicked={onPicked}
      onStale={onStale}
      onClose={closeProfileSwitcher}
    />
  );
}
