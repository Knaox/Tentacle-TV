import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * La politique de permissions de la coquille : tout refusé, sauf l'écriture du
 * presse-papiers pour la page de l'application. Sans cette exception,
 * `navigator.clipboard.writeText` rejetait et aucun bouton « Copier » ne
 * copiait — mesuré sous Electron 43. Ce sont les gestionnaires RÉELLEMENT
 * posés sur la session qui répondent ici, pas une copie de leur règle.
 */

interface RequestDetails {
  requestingUrl: string;
  isMainFrame: boolean;
}
type RequestHandler = (
  wc: unknown,
  permission: string,
  callback: (granted: boolean) => void,
  details: RequestDetails,
) => void;
type CheckHandler = (wc: unknown, permission: string, requestingOrigin: string, details: { isMainFrame: boolean }) => boolean;

const handlers = vi.hoisted(() => ({
  request: null as RequestHandler | null,
  check: null as CheckHandler | null,
  device: null as (() => boolean) | null,
}));

vi.mock("electron", () => ({
  app: {},
  net: {},
  protocol: {},
  shell: {},
  session: {
    defaultSession: {
      setPermissionRequestHandler: (handler: RequestHandler) => {
        handlers.request = handler;
      },
      setPermissionCheckHandler: (handler: CheckHandler) => {
        handlers.check = handler;
      },
      setDevicePermissionHandler: (handler: () => boolean) => {
        handlers.device = handler;
      },
    },
  },
}));

import { restrictPermissions } from "./security";

beforeAll(() => restrictPermissions());

/** Rejoue une demande (`writeText`) et rend la réponse donnée au rappel. */
function requested(permission: string, requestingUrl: string, isMainFrame = true): boolean {
  if (!handlers.request) throw new Error("aucun gestionnaire de demande posé");
  let granted: boolean | undefined;
  handlers.request(null, permission, (value) => {
    granted = value;
  }, { requestingUrl, isMainFrame });
  if (granted === undefined) throw new Error(`demande « ${permission} » restée sans réponse`);
  return granted;
}

/** Rejoue un contrôle (`navigator.permissions.query`), qui reçoit l'origine. */
function checked(permission: string, requestingOrigin: string, isMainFrame = true): boolean {
  if (!handlers.check) throw new Error("aucun gestionnaire de contrôle posé");
  return handlers.check(null, permission, requestingOrigin, { isMainFrame });
}

describe("restrictPermissions", () => {
  it("laisse la page de l'application écrire dans le presse-papiers", () => {
    expect(requested("clipboard-sanitized-write", "tentacle://app/watchlist")).toBe(true);
    expect(requested("clipboard-sanitized-write", "tentacle://app/favorites?group=all")).toBe(true);
    expect(checked("clipboard-sanitized-write", "tentacle://app/")).toBe(true);
  });

  it("refuse toujours de LIRE le presse-papiers", () => {
    expect(requested("clipboard-read", "tentacle://app/watchlist")).toBe(false);
    expect(checked("clipboard-read", "tentacle://app/")).toBe(false);
  });

  it("n'étend l'écriture ni aux greffons, ni aux cadres, ni à une autre origine", () => {
    expect(requested("clipboard-sanitized-write", "tentacle://plugin/vigie")).toBe(false);
    expect(requested("clipboard-sanitized-write", "tentacle://local/cover.jpg")).toBe(false);
    expect(requested("clipboard-sanitized-write", "tentacle://app/watchlist", false)).toBe(false);
    expect(requested("clipboard-sanitized-write", "https://www.youtube-nocookie.com/embed/abc", false)).toBe(false);
    expect(requested("clipboard-sanitized-write", "https://ailleurs.example/")).toBe(false);
    expect(checked("clipboard-sanitized-write", "tentacle://plugin/")).toBe(false);
    expect(checked("clipboard-sanitized-write", "")).toBe(false);
  });

  it("refuse tout le reste, périphériques compris", () => {
    for (const permission of ["media", "notifications", "geolocation", "display-capture", "openExternal", "midiSysex"]) {
      expect(requested(permission, "tentacle://app/"), permission).toBe(false);
      expect(checked(permission, "tentacle://app/"), permission).toBe(false);
    }
    expect(handlers.device?.()).toBe(false);
  });
});
