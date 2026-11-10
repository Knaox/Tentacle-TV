/**
 * Le socle du faux serveur : ce que TOUT écran lit (la configuration du serveur et ses
 * capacités, la session, les extensions actives). Les données sont factices ; leurs formes
 * sont celles des contrats (`@tentacle-tv/shared`, `@tentacle-tv/api-client`).
 */

import { SERVER_CAPABILITY_KEYS } from "@tentacle-tv/shared";
import type { LabRoute } from "../labFetch";

export const LAB_USER = { Id: "u-camille", Name: "Camille", Policy: { IsAdministrator: true } };

export const baseRoutes: readonly LabRoute[] = [
  {
    path: "/api/config",
    reply: {
      version: "1.41.0",
      brandName: "Tentacle TV",
      features: { downloads: true, demo: false, sharedWatchlists: true },
      capabilities: SERVER_CAPABILITY_KEYS,
    },
  },
  { path: "/api/plugins/active", reply: [] },
];
