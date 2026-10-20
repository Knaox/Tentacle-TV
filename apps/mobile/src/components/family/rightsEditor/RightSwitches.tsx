import { useTranslation } from "react-i18next";
import { useSetFamilyGuestRights, useSetFamilyMemberRights, useSetFamilyMemberRole } from "@tentacle-tv/api-client";
import { guestCanRequest, type FamilyProfileDto, type FamilySimpleEditing } from "@tentacle-tv/shared";
import { BrandSwitch, SettingsRow, SettingsSection } from "@/components/settings";
import { useFamilyText } from "@/family/useFamilyText";
import { showToast } from "@/notices/toastStore";

/**
 * Les droits de la Famille en interrupteurs (règle `familySimpleEditing`) :
 * « Peut demander des films » d'un invité, « Peut créer des invités » et le rôle
 * de parent d'un membre. Mêmes routes que le bureau ; la valeur vient de la
 * famille relue (le geste en vol fait foi le temps de la réponse).
 */
export function RightSwitches({ profile, editing }: { profile: FamilyProfileDto; editing: FamilySimpleEditing }) {
  const { t } = useTranslation(["family", "familyWeb"]);
  const { errorText } = useFamilyText();
  const guestRights = useSetFamilyGuestRights();
  const memberRights = useSetFamilyMemberRights();
  const role = useSetFamilyMemberRole();
  const done = { onSuccess: () => showToast({ title: t("familyWeb:rights.saved"), tone: "success" as const }), onError: (e: unknown) => showToast({ title: errorText(e) }) };

  const rows: Array<{ key: string; icon: "film" | "user-plus" | "users"; label: string; hint: string; value: boolean; disabled: boolean; set: (next: boolean) => void }> = [];
  if (editing.requestTitles) {
    rows.push({
      key: "request", icon: "film", label: t("family:rights.requestTitles"),
      hint: profile.guestRights?.suspended ? t("family:rights.requestTitlesSuspended") : t("family:rights.requestTitlesHint"),
      value: guestRights.isPending ? guestRights.variables?.rights.requestTitles === true : guestCanRequest(profile),
      disabled: guestRights.isPending,
      set: (next) => guestRights.mutate({ userId: profile.userId, rights: { requestTitles: next } }, done),
    });
  }
  if (editing.createGuests) {
    rows.push({
      key: "create", icon: "user-plus", label: t("family:rights.createGuests"), hint: t("family:rights.createGuestsHint"),
      value: memberRights.isPending ? memberRights.variables?.rights.createGuests === true : profile.rights?.createGuests === true,
      disabled: memberRights.isPending,
      set: (next) => memberRights.mutate({ userId: profile.userId, rights: { createGuests: next } }, done),
    });
  }
  if (editing.parent) {
    rows.push({
      key: "parent", icon: "users", label: t("familyWeb:roles.parent"),
      hint: editing.parentBlocked ? t("familyWeb:roles.parentBlocked") : t("familyWeb:roles.parentHint"),
      value: role.isPending ? role.variables?.parent === true : profile.parent === true,
      disabled: role.isPending || (editing.parentBlocked && profile.parent !== true),
      set: (next) => role.mutate({ userId: profile.userId, parent: next }, done),
    });
  }
  if (rows.length === 0) return null;

  return (
    <SettingsSection>
      {rows.map((row, index) => (
        <SettingsRow
          key={row.key}
          icon={row.icon}
          label={row.label}
          description={row.hint}
          last={index === rows.length - 1}
          trailing={
            <BrandSwitch
              value={row.value}
              onValueChange={row.set}
              disabled={row.disabled}
              accessibilityLabel={`${row.label} — ${profile.name}`}
            />
          }
        />
      ))}
    </SettingsSection>
  );
}
