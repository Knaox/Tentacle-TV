import { Redirect, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useProfileActions } from "@/hooks/useProfileActions";
import { SettingsScaffold } from "@/screens/settings/SettingsScaffold";
import { ProfileActionsProvider } from "./ProfileEntryActions";
import { PROFILE_PANE_REGISTRY } from "./profilePaneRegistry";
import { ProfileSectionBody } from "./ProfileSectionBody";
import { findSection, sectionTarget, visibleGroups } from "./profileStructure";
import { useProfileContext } from "./useProfileContext";

/**
 * La page d'une rubrique sur téléphone (`/profile/<rubrique>`) — le premier
 * niveau sous le profil. Une rubrique inconnue, ou vidée par le hors ligne,
 * renvoie au profil ; une rubrique d'un seul volet le montre directement.
 */
export function ProfileSectionScreen() {
  const { section: id } = useLocalSearchParams<{ section: string }>();
  const { t } = useTranslation();
  const ctx = useProfileContext();
  const actions = useProfileActions();
  const section = id ? findSection(id) : undefined;
  if (!section || visibleGroups(section, ctx).length === 0) return <Redirect href="/profile" />;

  const target = sectionTarget(section, ctx);
  const Pane = target.kind === "pane" ? PROFILE_PANE_REGISTRY[target.id].Component : null;
  return (
    <SettingsScaffold title={t(section.label.key, { ns: section.label.ns })}>
      <ProfileActionsProvider value={actions}>
        {Pane ? <Pane /> : <ProfileSectionBody section={section} ctx={ctx} />}
      </ProfileActionsProvider>
    </SettingsScaffold>
  );
}
