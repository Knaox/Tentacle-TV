import { useTranslation } from "react-i18next";
import { useSetFamilyMemberRights } from "@tentacle-tv/api-client";
import type { FamilyProfileDto } from "@tentacle-tv/shared";
import { BrandSwitch, SettingsRow, SettingsSection } from "@/components/settings";
import { useFamilyText } from "@/family/useFamilyText";
import { showToast } from "@/notices/toastStore";

/**
 * Les droits d'un MEMBRE, réglés par le propriétaire : « Peut créer des
 * invités », coupé par défaut. Retirer le droit ne supprime rien — il ne peut
 * plus en créer, et garde la main sur ceux qu'il a créés. La valeur vient de
 * la famille relue (le panneau ne garde aucun instantané).
 */
export function MemberRightsSection({ member }: { member: FamilyProfileDto }) {
  const { t } = useTranslation(["family", "familyWeb"]);
  const { errorText } = useFamilyText();
  const setRights = useSetFamilyMemberRights();
  const value = member.rights?.createGuests === true;

  const toggle = (next: boolean) => {
    setRights.mutate(
      { userId: member.userId, rights: { createGuests: next } },
      {
        onSuccess: () => showToast({ title: t("familyWeb:rights.saved"), tone: "success" }),
        onError: (failure) => showToast({ title: errorText(failure) }),
      },
    );
  };

  return (
    <SettingsSection caption={t("family:rights.createGuestsHint")}>
      <SettingsRow
        icon="user-plus"
        label={t("family:rights.createGuests")}
        last
        trailing={
          <BrandSwitch
            value={setRights.isPending ? setRights.variables?.rights.createGuests === true : value}
            onValueChange={toggle}
            disabled={setRights.isPending}
            accessibilityLabel={`${t("family:rights.createGuests")} — ${member.name}`}
          />
        }
      />
    </SettingsSection>
  );
}
