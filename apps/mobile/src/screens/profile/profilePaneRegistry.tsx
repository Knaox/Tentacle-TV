import type { ComponentType } from "react";
import { DataPane } from "@/screens/settings/DataSettingsScreen";
import { DevicesPane } from "@/screens/settings/DevicesScreen";
import { InvitesPane } from "@/screens/settings/InvitesScreen";
import { NotificationsPane } from "@/screens/settings/NotificationsScreen";
import { OnDeviceSettingsPane } from "@/screens/settings/OnDeviceSettingsScreen";
import { PasswordPane } from "@/screens/settings/PasswordScreen";
import { PersonalizationPane } from "@/screens/settings/PersonalizationScreen";
import { PlaybackPane } from "@/screens/settings/PlaybackScreen";
import type { ProfilePaneId } from "./profilePanes";

interface PaneEntry {
  Component: ComponentType;
  /** Le titre du volet : celui de son écran plein écran, espace i18n compris. */
  title: { ns: string; key: string };
}

export const PROFILE_PANE_REGISTRY: Record<ProfilePaneId, PaneEntry> = {
  personalization: { Component: PersonalizationPane, title: { ns: "preferences", key: "sectionPersonalization" } },
  playback: { Component: PlaybackPane, title: { ns: "profile", key: "playback" } },
  notifications: { Component: NotificationsPane, title: { ns: "notifications", key: "title" } },
  data: { Component: DataPane, title: { ns: "offline", key: "dataTitle" } },
  onDevice: { Component: OnDeviceSettingsPane, title: { ns: "offline", key: "settingsTitle" } },
  devices: { Component: DevicesPane, title: { ns: "profile", key: "pairedDevices" } },
  invites: { Component: InvitesPane, title: { ns: "profile", key: "invitations" } },
  password: { Component: PasswordPane, title: { ns: "preferences", key: "changePasswordTitle" } },
};
