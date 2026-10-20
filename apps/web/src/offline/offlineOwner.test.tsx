import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Bureau : le hors ligne appartient au COMPTE de l'appareil, et ses droits
 * s'appliquent toujours — un compte à qui le serveur refuse `keepOffline` ne
 * voit rien, même avec des titres déjà gardés (ils restent sur la machine) ;
 * hors ligne, le dernier mot retenu fait foi ; jamais su, ce qui est déjà là
 * reste lisible, sans bouton. Les droits lus pendant un profil ne comptent pas.
 */

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
  removeItem(key: string) { this.map.delete(key); }
}

type Abilities = { kind: "legacy" } | { kind: "pending" } | { kind: "known"; abilities: { keepOffline: boolean } };

const state = vi.hoisted(() => ({
  profile: null as null | { id: string; kind: string },
  abilities: { kind: "pending" } as Abilities,
  sessionUser: "owner",
  entries: [{ status: "complete" }] as Array<{ status: string }>,
}));

vi.mock("../auth/profileSession", () => ({ useActiveProfile: () => state.profile }));
vi.mock("../desktop/bridge", () => ({ supportsDownloads: () => true }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: state.entries, isFetched: true }) }));
vi.mock("@tentacle-tv/offline-core/react", () => ({ LOCAL_QUERY: {} }));
vi.mock("@tentacle-tv/api-client", () => ({
  useUserId: () => state.sessionUser,
  useAccountAbilities: () => state.abilities,
}));
vi.mock("../downloads/api", () => ({}));
vi.mock("../downloads/useDownloadCapabilities", () => ({
  useDownloadCapabilities: () => ({ capabilities: { downloads: true, lightDownloads: true } }),
}));

const { useDownloadsVisibility } = await import("../downloads/useDownloadState");
const { readOfflineOwner } = await import("./offlineOwner");

function visibility(): { visible: boolean; canDownload: boolean } {
  function Probe() {
    return <pre>{JSON.stringify(useDownloadsVisibility())}</pre>;
  }
  return JSON.parse(renderToStaticMarkup(<Probe />).replace(/<\/?pre>/g, "").replace(/&quot;/g, '"'));
}

const OWNER_USER = JSON.stringify({ Id: "owner", Name: "Damien" });
let local: MemoryStorage;

beforeEach(() => {
  local = new MemoryStorage();
  vi.stubGlobal("localStorage", local);
  local.setItem("tentacle_token", "jeton-compte");
  local.setItem("tentacle_user", OWNER_USER);
  state.profile = null;
  state.abilities = { kind: "pending" };
  state.sessionUser = "owner";
  state.entries = [{ status: "complete" }];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("le hors ligne du bureau suit le droit du compte de l'appareil", () => {
  it("le compte avec le droit : tout", () => {
    state.abilities = { kind: "known", abilities: { keepOffline: true } };
    expect(visibility()).toMatchObject({ visible: true, canDownload: true });
  });

  it("le compte sans le droit : rien, même avec des titres déjà gardés", () => {
    state.abilities = { kind: "known", abilities: { keepOffline: false } };
    expect(visibility()).toMatchObject({ visible: false, canDownload: false });
  });

  it("hors ligne, le dernier mot retenu fait foi (refusé : rien)", () => {
    local.setItem("tentacle_offline_keep_right", JSON.stringify({ owner: false }));
    expect(visibility()).toMatchObject({ visible: false, canDownload: false });
  });

  it("droit jamais su (titres gardés avant la mise à jour) : ils restent lisibles, sans bouton", () => {
    expect(visibility()).toMatchObject({ visible: true, canDownload: false });
  });

  it("serveur d'avant les droits : le comportement d'avant", () => {
    state.abilities = { kind: "legacy" };
    expect(visibility()).toMatchObject({ visible: true, canDownload: true });
  });

  it("pendant un profil : rien, et le propriétaire reste le compte", () => {
    local.setItem("tentacle_account_session", JSON.stringify({ token: "jeton-compte", user: OWNER_USER, deviceId: null }));
    local.setItem("tentacle_token", "jeton-lea");
    local.setItem("tentacle_user", JSON.stringify({ Id: "lea", Name: "Léa" }));
    local.setItem("tentacle_profile_session", JSON.stringify({ id: "lea", name: "Léa", kind: "member", color: "pink", imageTag: null, hasPin: true }));
    state.profile = { id: "lea", kind: "member" };
    state.sessionUser = "lea";
    // Les droits du PROFIL (le serveur lui refuse le hors ligne) ne disent rien du compte.
    state.abilities = { kind: "known", abilities: { keepOffline: false } };
    expect(visibility()).toMatchObject({ visible: false, canDownload: false });
    expect(readOfflineOwner()).toEqual({ userId: "owner", token: "jeton-compte" });
  });
});
