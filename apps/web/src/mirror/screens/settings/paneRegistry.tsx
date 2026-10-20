import type { ComponentType } from "react";
import { DevicesPane } from "./panes/DevicesPane";
import { InvitesPane } from "./panes/InvitesPane";
import { LibraryPrefsSection } from "./panes/LibraryPrefsSection";
import { PasswordPane } from "./panes/PasswordPane";
import { PersonalizationPane } from "./panes/PersonalizationPane";
import type { WebPaneId } from "./catalog/webCatalog";

interface PaneEntry {
  Component: ComponentType;
  /** Le titre du volet : celui de son écran plein écran, espace i18n compris. */
  title: { ns: string; key: string };
  /** Colonne plus étroite sur grand écran (le mot de passe : 560, comme l'app). */
  maxWidth?: number;
}

/**
 * Le composant web de chaque VOLET du catalogue partagé des réglages
 * (`profilePaneRegistry.tsx` du mobile). Le type force une entrée pour chaque
 * volet que le web ne déclare pas réservé au mobile (`WEB_UNRENDERED`).
 */
export const PANE_REGISTRY: Readonly<Record<WebPaneId, PaneEntry>> = {
  password: { Component: PasswordPane, title: { ns: "preferences", key: "changePasswordTitle" }, maxWidth: 560 },
  mediaLanguages: { Component: LibraryPrefsSection, title: { ns: "settingsMobile", key: "playback.mediaLanguages" } },
  personalization: { Component: PersonalizationPane, title: { ns: "profile", key: "homeAndRecommendations" } },
  devices: { Component: DevicesPane, title: { ns: "settingsMobile", key: "sections.tv" } },
  invites: { Component: InvitesPane, title: { ns: "profile", key: "invitations" } },
};
