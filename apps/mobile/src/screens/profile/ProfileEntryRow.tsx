import { Linking, StyleSheet } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SettingsRow, type SettingsIcon } from "@/components/settings";
import { useOfflineActivity } from "@/hooks/offline/useOfflineList";
import { setManualOffline } from "@/offline/connectivityStore";
import { spacing, useTheme } from "@/theme";
import { usePendingFamilyInvitationCount } from "./familyEntryHooks";
import { ProfileBlock } from "./ProfileBlock";
import { ProfileControlRow } from "./ProfileControlRow";
import { ProfilePaneRow } from "./ProfilePaneRow";
import type { ActionEntry, ProfileEntry, ScreenEntry } from "./profileStructure";
import { useProfileEntryActions } from "./ProfileEntryActions";
import { PANE_SCOPES } from "./settingsScopes";

const PRIVACY_POLICY_URL = "https://github.com/Knaox/Tentacle-TV/blob/main/PRIVACY.md";

interface Props {
  entry: ProfileEntry;
  last: boolean;
}

/**
 * Une entrée de la structure du profil, rendue selon son genre : un réglage
 * sur place (`ProfileControlRow`), une page (volet ou écran), une action, un
 * bloc. Les rares entrées qui montrent un état (« 12 titres », « 2
 * invitations ») ont leur composant, pour que leurs crochets ne tournent que
 * là où elles paraissent.
 */
export function ProfileEntryRow({ entry, last }: Props) {
  const { t } = useTranslation();
  switch (entry.kind) {
    case "control":
      return <ProfileControlRow id={entry.id} last={last} />;
    case "pane":
      return (
        <ProfilePaneRow
          pane={entry.id}
          icon={entry.icon as SettingsIcon}
          label={t(entry.label.key, { ns: entry.label.ns })}
          scope={PANE_SCOPES[entry.id] ?? undefined}
          last={last}
        />
      );
    case "screen":
      if (entry.id === "offlineTitles") return <OfflineTitlesRow entry={entry} last={last} />;
      if (entry.id === "family") return <FamilyRow entry={entry} last={last} />;
      return <ScreenRow entry={entry} last={last} />;
    case "action":
      return <ActionRow entry={entry} last={last} />;
    case "block":
      return <ProfileBlock id={entry.id} />;
  }
}

function ScreenRow({ entry, last, description, value }: { entry: ScreenEntry; last: boolean; description?: string; value?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <SettingsRow
      icon={entry.icon as SettingsIcon}
      label={t(entry.label.key, { ns: entry.label.ns })}
      description={description}
      value={value}
      chevron
      last={last}
      onPress={() => router.push(entry.href as Href)}
    />
  );
}

/** « Mes titres hors ligne » : « 12 titres · 1 en cours ». */
function OfflineTitlesRow({ entry, last }: { entry: ScreenEntry; last: boolean }) {
  const { t } = useTranslation("offline");
  const { active, total } = useOfflineActivity();
  const parts = [t("countTitles", { count: total })];
  if (active > 0) parts.push(t("countActive", { count: active }));
  return <ScreenRow entry={entry} last={last} description={parts.join(" · ")} />;
}

/** « Famille » : le nombre d'invitations reçues qui attendent une réponse. */
function FamilyRow({ entry, last }: { entry: ScreenEntry; last: boolean }) {
  const { t } = useTranslation("settingsMobile");
  const count = usePendingFamilyInvitationCount();
  return <ScreenRow entry={entry} last={last} value={count > 0 ? t("account.familyInvitesBadge", { count }) : undefined} />;
}

function ActionRow({ entry, last }: { entry: ActionEntry; last: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const actions = useProfileEntryActions();
  const label = t(entry.label.key, { ns: entry.label.ns });
  const common = { icon: entry.icon as SettingsIcon, label, last, destructive: entry.destructive };
  switch (entry.id) {
    case "changeServer":
      return <SettingsRow {...common} description={actions.serverUrl || undefined} chevron onPress={actions.handleChangeServer} />;
    case "goOffline":
      return <SettingsRow {...common} description={t("offline:goOfflineHint")} onPress={() => setManualOffline(true)} />;
    case "clearCache":
      return <SettingsRow {...common} onPress={actions.handleClearCache} />;
    case "deleteAccount":
      return <SettingsRow {...common} disabled={actions.deleting} onPress={actions.handleDeleteAccount} />;
    case "privacyPolicy":
      return (
        <SettingsRow
          {...common}
          // L'icône « sortie » dit que la page s'ouvre hors de l'app.
          trailing={<Feather name="external-link" size={16} color={theme.colors.text.quaternary} style={styles.external} />}
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
        />
      );
  }
}

const styles = StyleSheet.create({
  external: { paddingLeft: spacing.xs },
});
