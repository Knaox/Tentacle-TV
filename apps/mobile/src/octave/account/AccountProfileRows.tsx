/**
 * Octave (mobile) — le groupe « Profil » du hub « Compte » : changer de profil (la feuille de la Famille, code
 * PIN compris), SON code PIN (la feuille de la page Famille), « Gérer les profils » (la page Famille, DANS
 * Octave). Ce qui paraît vient de `accountHubRows.ts` (catalogue partagé + Famille) ; chaque geste est celui de
 * Tentacle, jamais une copie.
 */

import { memo, useMemo, useState } from "react";
import { useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { useFamilyOverview } from "@tentacle-tv/api-client";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { OwnPinSheet } from "@/components/family/PinSheet";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { SwitchProfileRow } from "@/components/settings/controls/AccountRows";
import { familyScreenModel } from "@/family/familyScreenModel";
import { useFamilyAvailability } from "@/family/useFamilyAvailability";
import { usePendingFamilyInvitationCount } from "@/screens/profile/familyEntryHooks";
import { useProfileContext } from "@/screens/profile/useProfileContext";
import { accountCatalogIds, accountProfileRows, type AccountProfileRow } from "./accountHubRows";

/** Son code PIN : `null` tant que la Famille n'a pas répondu (rien ne paraît, rien ne clignote). */
function useOwnPin(): { shown: boolean; hasPin: boolean } | null {
  const { available } = useFamilyAvailability();
  const overview = useFamilyOverview({ enabled: available });
  return useMemo(() => {
    if (!overview.data) return null;
    return { shown: familyScreenModel(overview.data).showMyPin, hasPin: overview.data.account.hasPin };
  }, [overview.data]);
}

export const AccountProfileRows = memo(function AccountProfileRows() {
  const { t } = useTranslation("octaveShell");
  const ctx = useProfileContext();
  const pin = useOwnPin();
  const online = !ctx.offline;
  const rows = useMemo(() => accountProfileRows({ catalogIds: accountCatalogIds(ctx), pin, online }), [ctx, pin, online]);
  if (rows.length === 0) return null;
  return (
    <SettingsSection title={t("account.profileGroup")}>
      {rows.map((row, i) => (
        <ProfileRow key={row} row={row} hasPin={pin?.hasPin ?? false} last={i === rows.length - 1} />
      ))}
    </SettingsSection>
  );
});

function ProfileRow({ row, hasPin, last }: { row: AccountProfileRow; hasPin: boolean; last: boolean }) {
  switch (row) {
    case "switchProfile":
      return <SwitchProfileRow scope={null} last={last} />;
    case "pin":
      return <PinRow hasPin={hasPin} last={last} />;
    case "manageProfiles":
      return <ManageProfilesRow last={last} />;
  }
}

function PinRow({ hasPin, last }: { hasPin: boolean; last: boolean }) {
  const { t } = useTranslation(["octaveShell", "familyWeb"]);
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsRow
        icon={hasPin ? "lock" : "unlock"}
        label={t("octaveShell:account.pin")}
        description={hasPin ? t("octaveShell:account.pinOn") : t("octaveShell:account.pinOff")}
        value={hasPin ? t("familyWeb:myPin.change") : t("familyWeb:myPin.set")}
        chevron
        last={last}
        onPress={() => setOpen(true)}
      />
      {open ? <OwnPinSheet hasPin={hasPin} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** « Gérer les profils » : la page Famille, DANS Octave ; le nombre d'invitations reçues en attente. */
function ManageProfilesRow({ last }: { last: boolean }) {
  const { t } = useTranslation(["octaveShell", "settingsMobile"]);
  const router = useRouter();
  const count = usePendingFamilyInvitationCount();
  return (
    <SettingsRow
      icon="users"
      label={t("octaveShell:profile.manage")}
      description={t("octaveShell:account.manageHint")}
      value={count > 0 ? t("settingsMobile:account.familyInvitesBadge", { count }) : undefined}
      chevron
      last={last}
      onPress={() => router.push(octavePaths.profiles as Href)}
    />
  );
}
