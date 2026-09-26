import type { ComponentType } from "react";
import { DataPane } from "./panes/DataPane";
import { DevicesPane } from "./panes/DevicesPane";
import { InvitesPane } from "./panes/InvitesPane";
import { PasswordPane } from "./panes/PasswordPane";
import { PersonalizationPane } from "./panes/PersonalizationPane";
import { PlaybackPane } from "./panes/PlaybackPane";
import type { MirrorPaneId } from "./panes";

interface PaneEntry {
  Component: ComponentType;
  /** Le titre du volet : celui de son écran plein écran, espace i18n compris. */
  title: { ns: string; key: string };
  /** Colonne plus étroite sur grand écran (le mot de passe : 560, comme l'app). */
  maxWidth?: number;
}

/** `profilePaneRegistry.tsx` de l'app, réduit aux volets que le web sait servir. */
export const PANE_REGISTRY: Record<MirrorPaneId, PaneEntry> = {
  personalization: { Component: PersonalizationPane, title: { ns: "preferences", key: "sectionPersonalization" } },
  playback: { Component: PlaybackPane, title: { ns: "profile", key: "playback" } },
  data: { Component: DataPane, title: { ns: "offline", key: "dataTitle" } },
  devices: { Component: DevicesPane, title: { ns: "profile", key: "pairedDevices" } },
  invites: { Component: InvitesPane, title: { ns: "profile", key: "invitations" } },
  password: { Component: PasswordPane, title: { ns: "preferences", key: "changePasswordTitle" }, maxWidth: 560 },
};
