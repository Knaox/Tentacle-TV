import type { ComponentType } from "react";
import { DevicesPane } from "@/screens/settings/DevicesScreen";
import { InvitesPane } from "@/screens/settings/InvitesScreen";
import { MediaLanguagesPane } from "@/screens/settings/MediaLanguagesScreen";
import { NotificationsPane } from "@/screens/settings/NotificationsScreen";
import { PasswordPane } from "@/screens/settings/PasswordScreen";
import { PersonalizationPane } from "@/screens/settings/PersonalizationScreen";
import type { SettingsPaneId } from "@tentacle-tv/shared";

interface PaneEntry {
  Component: ComponentType;
  /** Le titre du volet : celui de sa ligne et de son écran plein écran, espace i18n compris. */
  title: { ns: string; key: string };
}

export const PROFILE_PANE_REGISTRY: Record<SettingsPaneId, PaneEntry> = {
  password: { Component: PasswordPane, title: { ns: "preferences", key: "changePasswordTitle" } },
  mediaLanguages: { Component: MediaLanguagesPane, title: { ns: "settingsMobile", key: "playback.mediaLanguages" } },
  personalization: { Component: PersonalizationPane, title: { ns: "profile", key: "homeAndRecommendations" } },
  devices: { Component: DevicesPane, title: { ns: "settingsMobile", key: "sections.tv" } },
  notifications: { Component: NotificationsPane, title: { ns: "notifications", key: "title" } },
  invites: { Component: InvitesPane, title: { ns: "profile", key: "invitations" } },
};
