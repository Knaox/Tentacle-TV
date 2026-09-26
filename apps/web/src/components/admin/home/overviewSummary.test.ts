import { describe, expect, it } from "vitest";
import {
  readServicesHealth,
  summarizeAccounts,
  summarizeDownloads,
  summarizeInvites,
  summarizePlugins,
  summarizeSessions,
  ticketTotal,
} from "./overviewSummary";
import { activeAdminSection, adminSectionPath } from "../adminSections";

const NOW = Date.parse("2026-09-26T12:00:00Z");

describe("l'état des services", () => {
  it("lit Jellyfin et la base, versions raccourcies", () => {
    expect(
      readServicesHealth({
        jellyfin: { status: "connected", version: "10.10.7", url: "http://jf:8096" },
        database: { status: "connected", version: "11.4.4-MariaDB-ubu2404", fromEnv: true },
      }),
    ).toEqual({
      jellyfin: { state: "connected", version: "10.10.7" },
      database: { state: "connected", version: "11.4.4" },
    });
  });

  it("« disconnected » veut dire « rien de configuré », pas une panne", () => {
    const health = readServicesHealth({ jellyfin: { status: "disconnected", version: "" }, database: { status: "disconnected" } });
    expect(health?.jellyfin).toEqual({ state: "not_configured", version: null });
    expect(health?.database.state).toBe("not_configured");
  });

  it("une panne reste une panne, un statut inconnu reste inconnu", () => {
    const health = readServicesHealth({ jellyfin: { status: "error" }, database: { status: "starting" } });
    expect(health?.jellyfin.state).toBe("error");
    expect(health?.database.state).toBe("unknown");
  });

  it("une réponse d'une autre forme ne se lit pas", () => {
    expect(readServicesHealth(null)).toBeNull();
    expect(readServicesHealth({ jellyfin: "ok" })).toBeNull();
  });
});

describe("les comptes", () => {
  it("compte le total, les administrateurs et les comptes désactivés", () => {
    expect(
      summarizeAccounts([
        { id: "a", isAdministrator: true, isDisabled: false },
        { id: "b", isAdministrator: false, isDisabled: true },
        { id: "c", isAdministrator: false, isDisabled: false },
      ]),
    ).toEqual({ total: 3, admins: 1, disabled: 1 });
  });

  it("une réponse paginée ou d'erreur ne donne pas de faux chiffres", () => {
    expect(summarizeAccounts({ message: "Jellyfin non configuré" })).toBeNull();
  });
});

describe("les invitations actives", () => {
  it("une invitation vaut tant qu'il lui reste une place et que son échéance n'est pas passée", () => {
    expect(
      summarizeInvites(
        [
          { maxUses: 3, currentUses: 1, expiresAt: "2026-09-27T12:00:00Z" },
          { maxUses: 1, currentUses: 0, expiresAt: null },
          { maxUses: 2, currentUses: 2, expiresAt: null },
          { maxUses: 5, currentUses: 0, expiresAt: "2026-09-25T12:00:00Z" },
        ],
        NOW,
      ),
    ).toEqual({ active: 2, seatsLeft: 3 });
  });

  it("le serveur accepte encore à l'échéance exacte", () => {
    expect(summarizeInvites([{ maxUses: 1, currentUses: 0, expiresAt: "2026-09-26T12:00:00Z" }], NOW)).toEqual({
      active: 1,
      seatsLeft: 1,
    });
  });
});

describe("les plugins", () => {
  it("les mises à jour se lisent dans le catalogue, parmi les installés seulement", () => {
    expect(
      summarizePlugins(
        [{ id: "1", pluginId: "seer" }, { id: "2", pluginId: "vigie", restartRequired: true }],
        [
          { pluginId: "seer", installed: true, updateAvailable: true },
          { pluginId: "vigie", installed: true, updateAvailable: false },
          { pluginId: "autre", installed: false, updateAvailable: true },
        ],
      ),
    ).toEqual({ installed: 2, updates: 1, restartRequired: 1 });
  });

  it("sans catalogue, le nombre de mises à jour est inconnu — pas zéro", () => {
    expect(summarizePlugins([{ id: "1" }], undefined)).toEqual({ installed: 1, updates: null, restartRequired: 0 });
  });
});

describe("les sessions en direct", () => {
  it("compte les lectures, celles en pause, et les salles", () => {
    expect(
      summarizeSessions({
        sessions: [
          { id: "1", nowPlaying: { id: "x" }, isPaused: false },
          { id: "2", nowPlaying: { id: "y" }, isPaused: true },
          { id: "3", nowPlaying: null, isPaused: false },
        ],
        groups: [{ groupId: "g" }],
      }),
    ).toEqual({ playing: 2, paused: 1, groups: 1 });
  });
});

describe("les téléchargements et les tickets", () => {
  it("compte les comptes autorisés à télécharger", () => {
    expect(
      summarizeDownloads([
        { id: "a", enableContentDownloading: true },
        { id: "b", enableContentDownloading: false },
      ]),
    ).toEqual({ allowed: 1, total: 2 });
  });

  it("le total d'une page de tickets, sans lire la liste", () => {
    expect(ticketTotal({ results: [], total: 4, page: 1, totalPages: 4 })).toBe(4);
    expect(ticketTotal(undefined)).toBeNull();
  });
});

describe("les sections du rail", () => {
  it("l'index est la vue d'ensemble, l'écran d'un plugin garde « Plugins »", () => {
    expect(activeAdminSection("/admin")).toBe("overview");
    expect(activeAdminSection("/admin/")).toBe("overview");
    expect(activeAdminSection("/admin/users")).toBe("users");
    expect(activeAdminSection("/admin/plugins/seer")).toBe("plugins");
  });

  it("la vue d'ensemble mène à l'index, les autres à leur route", () => {
    expect(adminSectionPath("overview")).toBe("/admin");
    expect(adminSectionPath("tickets")).toBe("/admin/tickets");
  });
});
