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

const { fichiers } = vi.hoisted(() => ({ fichiers: new Set<string>() }));
const { etat } = vi.hoisted(() => ({ etat: { isPackaged: false } }));

vi.mock("node:fs", () => ({ existsSync: (p: string) => fichiers.has(p) }));
vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return etat.isPackaged;
    },
  },
}));

const RACINE = path.resolve(__dirname, "../../..");
const LIB_LIVREE = path.resolve(RACINE, "lib/mpv/libmpv.2.dylib");
const MOLTENVK = path.resolve(RACINE, "lib/mpv/libMoltenVK.dylib");
const ICD_DEV = path.resolve(RACINE, "dev/MoltenVK_icd.json");
const HOMEBREW = "/opt/homebrew/lib/libmpv.2.dylib";

const plateformeReelle = process.platform;
const envReel = { ...process.env };

/** `NOM_LIB` est figé à l'import : la plateforme se pose AVANT. */
async function chargerPour(plateforme: string) {
  Object.defineProperty(process, "platform", { value: plateforme, configurable: true });
  vi.resetModules();
  return import("./mpvLib");
}

beforeEach(() => {
  fichiers.clear();
  etat.isPackaged = false;
  delete process.env["TENTACLE_MPV_LIB"];
  delete process.env["VK_DRIVER_FILES"];
  delete process.env["VK_ICD_FILENAMES"];
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  Object.defineProperty(process, "platform", { value: plateformeReelle, configurable: true });
  process.env = { ...envReel };
  vi.restoreAllMocks();
});

describe("libmpvPath — développement macOS", () => {
  it("vise la chaîne livrée quand elle est construite, et déclare SON MoltenVK", async () => {
    fichiers.add(LIB_LIVREE).add(MOLTENVK).add(ICD_DEV);
    const { libmpvPath } = await chargerPour("darwin");

    expect(libmpvPath()).toBe(LIB_LIVREE);
    expect(process.env["VK_DRIVER_FILES"]).toBe(ICD_DEV);
    expect(process.env["VK_ICD_FILENAMES"]).toBe(ICD_DEV);
  });

  it("ne pose AUCUN pilote quand la MoltenVK vendorée manque — sinon écran noir", async () => {
    fichiers.add(LIB_LIVREE).add(ICD_DEV);
    const { libmpvPath } = await chargerPour("darwin");

    expect(libmpvPath()).toBe(LIB_LIVREE);
    expect(process.env["VK_DRIVER_FILES"]).toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it("retombe sur Homebrew si la chaîne livrée n'est pas construite, et le DIT", async () => {
    const { libmpvPath } = await chargerPour("darwin");

    expect(libmpvPath()).toBe(HOMEBREW);
    expect(console.warn).toHaveBeenCalled();
  });

  it("n'écrase jamais un pilote posé par celui qui déboguait", async () => {
    process.env["VK_DRIVER_FILES"] = "/ailleurs/icd.json";
    fichiers.add(LIB_LIVREE).add(MOLTENVK).add(ICD_DEV);
    const { libmpvPath } = await chargerPour("darwin");

    libmpvPath();
    expect(process.env["VK_DRIVER_FILES"]).toBe("/ailleurs/icd.json");
  });
});

describe("libmpvPath — les échappatoires", () => {
  it("`homebrew` rend le développement à la mpv du système, sans pilote posé", async () => {
    process.env["TENTACLE_MPV_LIB"] = "homebrew";
    fichiers.add(LIB_LIVREE).add(MOLTENVK).add(ICD_DEV);
    const { libmpvPath } = await chargerPour("darwin");

    expect(libmpvPath()).toBe(HOMEBREW);
    expect(process.env["VK_DRIVER_FILES"]).toBeUndefined();
  });

  it("`livree` force la chaîne vendorée", async () => {
    process.env["TENTACLE_MPV_LIB"] = "livree";
    fichiers.add(LIB_LIVREE).add(MOLTENVK).add(ICD_DEV);
    const { libmpvPath } = await chargerPour("darwin");

    expect(libmpvPath()).toBe(LIB_LIVREE);
  });

  it("un chemin absolu est rendu tel quel", async () => {
    process.env["TENTACLE_MPV_LIB"] = "/essai/libmpv.2.dylib";
    const { libmpvPath } = await chargerPour("darwin");

    expect(libmpvPath()).toBe("/essai/libmpv.2.dylib");
  });
});

describe("libmpvPath — le paquet", () => {
  it("macOS empaqueté cherche dans Frameworks, JAMAIS chez Homebrew", async () => {
    etat.isPackaged = true;
    Object.defineProperty(process, "resourcesPath", {
      value: "/Applications/Tentacle TV.app/Contents/Resources",
      configurable: true,
    });
    const { libmpvPath } = await chargerPour("darwin");

    expect(libmpvPath()).toBe(
      "/Applications/Tentacle TV.app/Contents/Frameworks/libmpv.2.dylib",
    );
  });

  it("aucune libmpv connue hors macOS, Windows et Linux", async () => {
    const { libmpvPath } = await chargerPour("freebsd");

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
  const VENDOREE = path.resolve(RACINE, "lib/mpv-linux/libmpv.so.2");

  it("le paquet prend la libmpv qu'il embarque", async () => {
    etat.isPackaged = true;
    Object.defineProperty(process, "resourcesPath", { value: "/opt/tentacle/resources", configurable: true });
    fichiers.add("/opt/tentacle/resources/lib/libmpv.so.2").add("/usr/lib64/libmpv.so.2");
    const { libmpvPath } = await chargerPour("linux");

    expect(libmpvPath()).toBe("/opt/tentacle/resources/lib/libmpv.so.2");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("un paquet sans la sienne se rabat sur le système, et le dit", async () => {
    etat.isPackaged = true;
    Object.defineProperty(process, "resourcesPath", { value: "/opt/tentacle/resources", configurable: true });
    fichiers.add("/usr/lib/x86_64-linux-gnu/libmpv.so.2");
    const { libmpvPath } = await chargerPour("linux");

    expect(libmpvPath()).toBe("/usr/lib/x86_64-linux-gnu/libmpv.so.2");
    expect(console.warn).toHaveBeenCalled();
  });

  it("en développement, la chaîne construite passe avant celle du système", async () => {
    fichiers.add(VENDOREE).add("/usr/lib64/libmpv.so.2");
    const { libmpvPath } = await chargerPour("linux");

    expect(libmpvPath()).toBe(VENDOREE);
  });

  it("sans aucun fichier connu, le nom nu laisse chercher le chargeur dynamique", async () => {
    const { libmpvPath } = await chargerPour("linux");

    expect(libmpvPath()).toBe("libmpv.so.2");
  });

  it("ne pose aucun pilote Vulkan : le chargeur du système fait l'affaire", async () => {
    fichiers.add(VENDOREE);
    const { libmpvPath } = await chargerPour("linux");

    libmpvPath();
    expect(process.env["VK_DRIVER_FILES"]).toBeUndefined();
    expect(process.env["VK_ICD_FILENAMES"]).toBeUndefined();
  });
});
