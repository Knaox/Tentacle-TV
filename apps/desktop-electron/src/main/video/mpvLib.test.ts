import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";

/**
 * Quelle libmpv on charge, et quel pilote Vulkan on lui donne.
 *
 * Deux propriétés se paient cher quand elles cèdent, et aucune ne se voit dans
 * l'interface :
 *
 *  - **le développement doit jouer la chaîne LIVRÉE.** Juger le rendu, le HDR ou
 *    la composition sur la mpv de Homebrew ne dit rien de ce que l'utilisateur
 *    recevra : ce n'est ni la même version, ni la même licence, ni le même
 *    FFmpeg, ni le même MoltenVK ;
 *  - **`VK_DRIVER_FILES` ne se pose QUE si le pilote existe.** Le poser
 *    REMPLACE la recherche du chargeur : un ICD qui désigne une dylib absente
 *    ne donne pas un pilote de moins, il n'en donne AUCUN. Le symptôme est
 *    l'écran noir avec le son — celui qui a coûté une journée le 2026-07-30.
 *
 * Le système de fichiers est simulé : ces dylibs ne sont pas versionnées, le
 * test passerait ou non selon la machine.
 */

const { files } = vi.hoisted(() => ({ files: new Set<string>() }));
const { state } = vi.hoisted(() => ({ state: { isPackaged: false } }));

vi.mock("node:fs", () => ({ existsSync: (p: string) => files.has(p) }));
vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return state.isPackaged;
    },
  },
}));

const ROOT = path.resolve(__dirname, "../../..");
const SHIPPED_LIB = path.resolve(ROOT, "lib/mpv/libmpv.2.dylib");
const MOLTENVK = path.resolve(ROOT, "lib/mpv/libMoltenVK.dylib");
const ICD_DEV = path.resolve(ROOT, "dev/MoltenVK_icd.json");
const HOMEBREW = "/opt/homebrew/lib/libmpv.2.dylib";

const realPlatform = process.platform;
const realEnv = { ...process.env };

/** `LIB_NAME` est figé à l'import : la plateforme se pose AVANT. */
async function loadFor(platform: string) {
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
  vi.resetModules();
  return import("./mpvLib");
}

beforeEach(() => {
  files.clear();
  state.isPackaged = false;
  delete process.env["TENTACLE_MPV_LIB"];
  delete process.env["VK_DRIVER_FILES"];
  delete process.env["VK_ICD_FILENAMES"];
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
  process.env = { ...realEnv };
  vi.restoreAllMocks();
});

describe("libmpvPath — développement macOS", () => {
  it("vise la chaîne livrée quand elle est construite, et déclare SON MoltenVK", async () => {
    files.add(SHIPPED_LIB).add(MOLTENVK).add(ICD_DEV);
    const { libmpvPath } = await loadFor("darwin");

    expect(libmpvPath()).toBe(SHIPPED_LIB);
    expect(process.env["VK_DRIVER_FILES"]).toBe(ICD_DEV);
    expect(process.env["VK_ICD_FILENAMES"]).toBe(ICD_DEV);
  });

  it("ne pose AUCUN pilote quand la MoltenVK vendorée manque — sinon écran noir", async () => {
    files.add(SHIPPED_LIB).add(ICD_DEV);
    const { libmpvPath } = await loadFor("darwin");

    expect(libmpvPath()).toBe(SHIPPED_LIB);
    expect(process.env["VK_DRIVER_FILES"]).toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it("retombe sur Homebrew si la chaîne livrée n'est pas construite, et le DIT", async () => {
    const { libmpvPath } = await loadFor("darwin");

    expect(libmpvPath()).toBe(HOMEBREW);
    expect(console.warn).toHaveBeenCalled();
  });

  it("n'écrase jamais un pilote posé par celui qui déboguait", async () => {
    process.env["VK_DRIVER_FILES"] = "/ailleurs/icd.json";
    files.add(SHIPPED_LIB).add(MOLTENVK).add(ICD_DEV);
    const { libmpvPath } = await loadFor("darwin");

    libmpvPath();
    expect(process.env["VK_DRIVER_FILES"]).toBe("/ailleurs/icd.json");
  });
});

describe("libmpvPath — les échappatoires", () => {
  it("`homebrew` rend le développement à la mpv du système, sans pilote posé", async () => {
    process.env["TENTACLE_MPV_LIB"] = "homebrew";
    files.add(SHIPPED_LIB).add(MOLTENVK).add(ICD_DEV);
    const { libmpvPath } = await loadFor("darwin");

    expect(libmpvPath()).toBe(HOMEBREW);
    expect(process.env["VK_DRIVER_FILES"]).toBeUndefined();
  });

  it("`livree` force la chaîne vendorée", async () => {
    process.env["TENTACLE_MPV_LIB"] = "livree";
    files.add(SHIPPED_LIB).add(MOLTENVK).add(ICD_DEV);
    const { libmpvPath } = await loadFor("darwin");

    expect(libmpvPath()).toBe(SHIPPED_LIB);
  });

  it("un chemin absolu est rendu tel quel", async () => {
    process.env["TENTACLE_MPV_LIB"] = "/essai/libmpv.2.dylib";
    const { libmpvPath } = await loadFor("darwin");

    expect(libmpvPath()).toBe("/essai/libmpv.2.dylib");
  });
});

describe("libmpvPath — le paquet", () => {
  it("macOS empaqueté cherche dans Frameworks, JAMAIS chez Homebrew", async () => {
    state.isPackaged = true;
    Object.defineProperty(process, "resourcesPath", {
      value: "/Applications/Tentacle TV.app/Contents/Resources",
      configurable: true,
    });
    const { libmpvPath } = await loadFor("darwin");

    expect(libmpvPath()).toBe(
      "/Applications/Tentacle TV.app/Contents/Frameworks/libmpv.2.dylib",
    );
  });

  it("aucune libmpv connue hors macOS, Windows et Linux", async () => {
    const { libmpvPath } = await loadFor("freebsd");

    expect(() => libmpvPath()).toThrow(/TENTACLE_MPV_LIB/);
  });
});

/**
 * Sous Linux, le repli sur la distribution n'est PAS équivalent : `mpv-libs` y
 * est bâtie contre un FFmpeg amputé, sans décodeur HEVC (mesuré sur Fedora 44,
 * cf. `docs/LINUX-FENETRE-VIDEO.md`). Le paquet doit donc préférer la sienne, et
 * le dire quand il ne l'a pas.
 */
describe("libmpvPath — Linux", () => {
  const VENDORED = path.resolve(ROOT, "lib/mpv-linux/libmpv.so.2");

  it("le paquet prend la libmpv qu'il embarque", async () => {
    state.isPackaged = true;
    Object.defineProperty(process, "resourcesPath", { value: "/opt/tentacle/resources", configurable: true });
    files.add("/opt/tentacle/resources/lib/libmpv.so.2").add("/usr/lib64/libmpv.so.2");
    const { libmpvPath } = await loadFor("linux");

    expect(libmpvPath()).toBe("/opt/tentacle/resources/lib/libmpv.so.2");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("un paquet sans la sienne se rabat sur le système, et le dit", async () => {
    state.isPackaged = true;
    Object.defineProperty(process, "resourcesPath", { value: "/opt/tentacle/resources", configurable: true });
    files.add("/usr/lib/x86_64-linux-gnu/libmpv.so.2");
    const { libmpvPath } = await loadFor("linux");

    expect(libmpvPath()).toBe("/usr/lib/x86_64-linux-gnu/libmpv.so.2");
    expect(console.warn).toHaveBeenCalled();
  });

  it("en développement, la chaîne construite passe avant celle du système", async () => {
    files.add(VENDORED).add("/usr/lib64/libmpv.so.2");
    const { libmpvPath } = await loadFor("linux");

    expect(libmpvPath()).toBe(VENDORED);
  });

  it("sans aucun fichier connu, le nom nu laisse chercher le chargeur dynamique", async () => {
    const { libmpvPath } = await loadFor("linux");

    expect(libmpvPath()).toBe("libmpv.so.2");
  });

  it("ne pose aucun pilote Vulkan : le chargeur du système fait l'affaire", async () => {
    files.add(VENDORED);
    const { libmpvPath } = await loadFor("linux");

    libmpvPath();
    expect(process.env["VK_DRIVER_FILES"]).toBeUndefined();
    expect(process.env["VK_ICD_FILENAMES"]).toBeUndefined();
  });
});

/**
 * `libmpvCandidates` rend la LISTE à essayer : l'existence d'un fichier ne dit
 * pas qu'il s'ouvre (la chaîne vendorée a été inchargeable un jour entier —
 * libbz2, SONAME Debian-only — pendant qu'`existsSync` répondait oui).
 */
describe("candidatsLibmpv — l'ordre des replis Linux", () => {
  const VENDORED = path.resolve(ROOT, "lib/mpv-linux/libmpv.so.2");

  it("vendorée d'abord, distribution ensuite, nom nu en dernier", async () => {
    files.add(VENDORED).add("/usr/lib64/libmpv.so.2");
    const { libmpvCandidates } = await loadFor("linux");

    expect(libmpvCandidates()).toEqual([VENDORED, "/usr/lib64/libmpv.so.2", "libmpv.so.2"]);
  });

  it("sans aucun fichier connu, le nom nu seul — pas de doublon", async () => {
    const { libmpvCandidates } = await loadFor("linux");

    expect(libmpvCandidates()).toEqual(["libmpv.so.2"]);
  });

  it("TENTACLE_MPV_LIB est un choix explicite : une seule candidate, aucun repli", async () => {
    process.env["TENTACLE_MPV_LIB"] = "/essai/libmpv.so.2";
    files.add(VENDORED);
    const { libmpvCandidates } = await loadFor("linux");

    expect(libmpvCandidates()).toEqual(["/essai/libmpv.so.2"]);
  });

  it("un paquet sans la sienne le dit, et propose la distribution", async () => {
    state.isPackaged = true;
    Object.defineProperty(process, "resourcesPath", { value: "/opt/tentacle/resources", configurable: true });
    files.add("/usr/lib64/libmpv.so.2");
    const { libmpvCandidates } = await loadFor("linux");

    expect(libmpvCandidates()).toEqual(["/usr/lib64/libmpv.so.2", "libmpv.so.2"]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("hors Linux, le chemin unique de libmpvPath", async () => {
    files.add(SHIPPED_LIB).add(MOLTENVK).add(ICD_DEV);
    const { libmpvCandidates } = await loadFor("darwin");

    expect(libmpvCandidates()).toEqual([SHIPPED_LIB]);
  });
});
