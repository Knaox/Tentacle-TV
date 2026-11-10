/**
 * Ce que lisent les RÉGLAGES (`/settings/*`) : la configuration du serveur AVEC la Famille, ce
 * que la session peut faire, Octave, les comptes externes — puis les préférences du compte
 * (`settingsPreferences.ts`), les bibliothèques et favoris de Jellyfin (`settingsJellyfin.ts`)
 * et la Famille (`settingsFamily.ts`).
 */

import type { AccountAbilitiesDto } from "@tentacle-tv/shared";
import type { MusicStatus } from "@tentacle-tv/shared/music";
import type { ExternalAccountsStatus } from "@tentacle-tv/api-client";
import type { LabRoute } from "../labFetch";
import type { LabView } from "../labViews";
import { baseRoutes } from "./base";
import { LAB_FAMILY_CAPABILITY } from "./familySeed";
import { familyRoutes } from "./settingsFamily";
import { jellyfinSettingsRoutes } from "./settingsJellyfin";
import { preferencesRoutes } from "./settingsPreferences";
import { record, type Json } from "./settingsShared";

/**
 * La configuration du socle (`base.ts`), la Famille en plus — et le lien public du serveur, sans
 * lequel « Jumeler un appareil » n'a aucune adresse à donner à une TV (l'origine du banc est
 * `reglages.localhost`). Cette route passe avant celle du socle.
 */
function configWithFamily(): Json {
  const base = record(baseRoutes.find((route) => route.path === "/api/config")?.reply);
  return { ...base, publicUrl: "https://tentacle.example.org", features: { ...record(base.features), family: LAB_FAMILY_CAPABILITY } };
}

/** Une session personnelle d'administrateur : tout est permis. */
const ABILITIES: AccountAbilitiesDto = {
  session: "personal",
  administrator: true,
  playback: true,
  keepOffline: true,
  watchTogether: "full",
  publicSharing: true,
  deleteTitles: true,
  tickets: true,
  extensions: true,
  manageAccount: true,
  pairDevices: true,
  push: true,
  invites: true,
};

const MUSIC_STATUS: MusicStatus = { available: true, libraryId: "lib-musique", indexReady: true, trackCount: 4812, octaveAccess: true };

let externalAccounts: ExternalAccountsStatus = {
  tmdb: { configured: true, linked: true, linkedAt: "2026-06-14T19:42:00.000Z" },
  sync: { pending: 2, failed: 1, synced: 148 },
};

export function settingsRoutes(_view: LabView): readonly LabRoute[] {
  return [
    { path: "/api/config", reply: configWithFamily },
    { path: "/api/account/abilities", reply: ABILITIES },
    { path: "/api/music/status", reply: MUSIC_STATUS },
    // Ce que le serveur sait préparer pour le hors ligne (coquille de bureau : `useDownloadCapabilities`).
    {
      path: "/api/downloads/capabilities",
      reply: { downloads: true, remuxDownloads: true, lightDownloads: true, audioConversion: true, lightPresets: ["p1080", "p720", "p480"] },
    },

    // ── Compte et sécurité : le compte TMDB lié, la file de synchronisation des notes ──
    { path: "/api/external/accounts", reply: () => externalAccounts },
    {
      method: "POST",
      path: "/api/external/tmdb/guest-session",
      reply: () => {
        externalAccounts = { ...externalAccounts, tmdb: { configured: true, linked: true, linkedAt: new Date().toISOString() } };
        return { guestSessionId: "lab-guest-session" };
      },
    },
    {
      method: "DELETE",
      path: "/api/external/tmdb/guest-session",
      reply: () => {
        externalAccounts = { ...externalAccounts, tmdb: { configured: true, linked: false, linkedAt: null } };
        return { ok: true };
      },
    },
    {
      method: "POST",
      path: "/api/external/resync",
      reply: () => {
        const requeued = externalAccounts.sync.failed;
        externalAccounts = { ...externalAccounts, sync: { ...externalAccounts.sync, pending: externalAccounts.sync.pending + requeued, failed: 0 } };
        return { requeued };
      },
    },

    ...preferencesRoutes(),
    ...jellyfinSettingsRoutes(),
    ...familyRoutes(),
  ];
}
