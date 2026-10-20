import { createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { useFamilyOverview } from "@tentacle-tv/api-client";
import {
  SETTINGS_PANE_SCOPES, answerableInvitations, pendingInvitationCount, settingScopeOf,
  type SettingsActionEntry, type SettingsCatalogEntry, type SettingsScreenEntry,
} from "@tentacle-tv/shared";
import { useFamilySettingsAvailability } from "../../../../family/useFamilyAvailability";
import { AdminSessionsRow } from "../../profile/AdminSessionsRow";
import { ProfilePaneRow } from "../../profile/ProfilePaneRow";
import type { ProfileActions } from "../../profile/useProfileActions";
import { SettingsRow } from "../ui/SettingsRow";
import { catalogIcon } from "./catalogIcons";
import {
  WEB_SCREEN_ROUTES, WEB_UNRENDERED, entryKey, type WebActionId, type WebControlId, type WebPaneId, type WebScreenId,
} from "./webCatalog";
import { WEB_CONTROL_RENDERERS } from "./webControlRegistry";

const PRIVACY_POLICY_URL = "https://github.com/Knaox/Tentacle-TV/blob/main/PRIVACY.md";

/** Les gestes du compte (confirmations comprises), fournis par le profil. */
export const CatalogActionsContext = createContext<ProfileActions | null>(null);

/**
 * Une entrée du catalogue partagé, rendue par le web selon son genre — le
 * jumeau de `ProfileEntryRow` du mobile. Une entrée réservée au mobile
 * (`WEB_UNRENDERED`) ne rend rien : le catalogue la retire déjà par son champ
 * `platforms`, ceci n'est que la ceinture.
 */
export function CatalogEntryRow({ entry, last }: { entry: SettingsCatalogEntry; last: boolean }) {
  const { t } = useTranslation();
  if (entryKey(entry) in WEB_UNRENDERED) return null;
  switch (entry.kind) {
    case "control": {
      const Control = WEB_CONTROL_RENDERERS[entry.id as WebControlId];
      return <Control scope={settingScopeOf(entry.id)} last={last} />;
    }
    case "pane":
      return (
        <ProfilePaneRow
          pane={entry.id as WebPaneId}
          icon={catalogIcon(entry.icon)}
          label={t(entry.label.key, { ns: entry.label.ns })}
          scope={SETTINGS_PANE_SCOPES[entry.id]}
          last={last}
        />
      );
    case "screen":
      if (entry.id === "sessions") return <AdminSessionsRow last={last} />;
      if (entry.id === "family") return <FamilyRow entry={entry} last={last} />;
      return <ScreenRow entry={entry} last={last} />;
    case "action":
      return <ActionRow entry={entry} last={last} />;
    case "block":
      return <ScopeIntro />;
  }
}

function ScreenRow({ entry, last, value }: { entry: SettingsScreenEntry; last: boolean; value?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <SettingsRow
      icon={catalogIcon(entry.icon)}
      label={t(entry.label.key, { ns: entry.label.ns })}
      value={value}
      chevron
      last={last}
      onPress={() => navigate(WEB_SCREEN_ROUTES[entry.id as WebScreenId])}
    />
  );
}

/** « Famille » : le nombre d'invitations reçues qui attendent une réponse (la règle partagée du mobile). */
function FamilyRow({ entry, last }: { entry: SettingsScreenEntry; last: boolean }) {
  const { t } = useTranslation("settingsMobile");
  const { available } = useFamilySettingsAvailability();
  const overview = useFamilyOverview({ enabled: available });
  const count = available ? pendingInvitationCount(answerableInvitations(overview.data), Date.now()) : 0;
  return <ScreenRow entry={entry} last={last} value={count > 0 ? t("account.familyInvitesBadge", { count }) : undefined} />;
}

function ActionRow({ entry, last }: { entry: SettingsActionEntry; last: boolean }) {
  const { t } = useTranslation();
  const actions = useContext(CatalogActionsContext);
  const common = { icon: catalogIcon(entry.icon), label: t(entry.label.key, { ns: entry.label.ns }), last, destructive: entry.destructive };
  switch (entry.id as WebActionId) {
    case "clearCache":
      return <SettingsRow {...common} onPress={actions?.askClearCache} />;
    case "deleteAccount":
      return <SettingsRow {...common} disabled={actions?.busy} onPress={actions?.askDeleteAccount} />;
    case "privacyPolicy":
      return (
        <SettingsRow
          {...common}
          // L'icône « sortie » dit que la page s'ouvre hors de l'app.
          trailing={<ExternalLink size={16} className="shrink-0 pl-1 text-content-quaternary" aria-hidden />}
          onPress={() => window.open(PRIVACY_POLICY_URL, "_blank", "noopener,noreferrer")}
        />
      );
  }
}

/** « Les réglages marqués Compte vous suivent… » : la règle des pastilles, dite une fois. */
function ScopeIntro() {
  const { t } = useTranslation("settingsMobile");
  return <p className="mx-1 mb-4 text-[13px] leading-[19px] text-content-secondary">{t("scope.intro")}</p>;
}
