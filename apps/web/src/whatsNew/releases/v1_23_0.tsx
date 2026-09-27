import type { WhatsNewRelease } from "../types";
import {
  AdminInvitesScene, AdminMetadataScene, AdminOverviewScene, AdminPluginsScene, AdminUsersScene, OutlinesScene,
} from "../scenes/v1_23_0";

/**
 * 1.23.0 — l'administration refaite. Cinq nouveautés sur six ne parlent
 * qu'aux administrateurs (`audience`), toujours sans lien profond : jamais une
 * route admin (cf. docs/NOUVEAUTES.md). En tête, ce qu'on voit en ouvrant
 * l'administration — la vue d'ensemble et le rail —, puis les pages les plus
 * utilisées. La page Services et le bandeau de clé Jellyfin revenu restent au
 * changelog : un état de service ou un bandeau d'erreur ne se montrent pas.
 *
 * Pour tout le monde, les contours revenus. La refonte du site web sur
 * téléphone et iPad part aussi dans cette version, mais elle ne change rien
 * sur le bureau : l'écran n'en dit rien.
 *
 * Les textes vivent dans l'espace i18n `whatsNew` (v1_23_0_<id>_title / _body).
 */
export const RELEASE_1_23_0: WhatsNewRelease = {
  version: "1.23.0",
  features: [
    {
      id: "adminOverview",
      kind: "new",
      titleKey: "v1_23_0_adminOverview_title",
      bodyKey: "v1_23_0_adminOverview_body",
      Scene: AdminOverviewScene,
      audience: "admin",
    },
    {
      id: "adminUsers",
      kind: "improved",
      titleKey: "v1_23_0_adminUsers_title",
      bodyKey: "v1_23_0_adminUsers_body",
      Scene: AdminUsersScene,
      audience: "admin",
    },
    {
      id: "adminInvites",
      kind: "improved",
      titleKey: "v1_23_0_adminInvites_title",
      bodyKey: "v1_23_0_adminInvites_body",
      Scene: AdminInvitesScene,
      audience: "admin",
    },
    {
      id: "adminPlugins",
      kind: "improved",
      titleKey: "v1_23_0_adminPlugins_title",
      bodyKey: "v1_23_0_adminPlugins_body",
      Scene: AdminPluginsScene,
      audience: "admin",
    },
    {
      id: "adminMetadata",
      kind: "improved",
      titleKey: "v1_23_0_adminMetadata_title",
      bodyKey: "v1_23_0_adminMetadata_body",
      Scene: AdminMetadataScene,
      audience: "admin",
    },
    { id: "outlines", kind: "fixed", titleKey: "v1_23_0_outlines_title", bodyKey: "v1_23_0_outlines_body", Scene: OutlinesScene },
  ],
};
