import { useTranslation } from "react-i18next";
import { useSetFamilyGuestRights } from "@tentacle-tv/api-client";
import { guestCanRequest, type FamilyProfileDto } from "@tentacle-tv/shared";
import { BrandSwitch, SettingsRow, SettingsSection } from "@/components/settings";
import { useFamilyText } from "@/family/useFamilyText";
import { showToast } from "@/notices/toastStore";

/**
 * Le droit d'un INVITÉ, réglé par le propriétaire seul : « Peut demander des
 * films », coupé par défaut. Ses demandes partent au nom du propriétaire — la
 * légende le dit, avec son nom. La valeur vient de la famille relue.
 */
export function GuestRightsSection({ guest, ownerName }: { guest: FamilyProfileDto; ownerName: string }) {
  const { t } = useTranslation(["family", "familyWeb"]);
  const { errorText } = useFamilyText();
  const setRights = useSetFamilyGuestRights();
  const value = setRights.isPending ? setRights.variables?.rights.requestTitles === true : guestCanRequest(guest);

  const toggle = (next: boolean) => {
    setRights.mutate(
      { userId: guest.userId, rights: { requestTitles: next } },
      {
        onSuccess: () => showToast({ title: t("familyWeb:rights.saved") }),
        onError: (failure) => showToast({ title: errorText(failure) }),
      },
    );
  };

  return (
    <SettingsSection caption={t("family:rights.requestTitlesHint", { owner: ownerName })}>
      <SettingsRow
        icon="film"
        label={t("family:rights.requestTitles")}
        last
        trailing={
          <BrandSwitch
            value={value}
            onValueChange={toggle}
            disabled={setRights.isPending}
            accessibilityLabel={`${t("family:rights.requestTitles")} — ${guest.name}`}
          />
        }
      />
    </SettingsSection>
  );
}
