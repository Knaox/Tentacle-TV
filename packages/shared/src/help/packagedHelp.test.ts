import { describe, expect, it } from "vitest";
import fr from "../i18n/locales/fr";
import en from "../i18n/locales/en";
import { REMOTE_ACCESS_GUIDE } from "./remoteAccessGuide";
import {
  WINDOWS_APP_HELP,
  WINDOWS_APP_SUFFIX,
  isHelpHidden,
  packagedHelpKey,
  packagedHelpKeys,
  packagingOfInstall,
  type PackagedHelpNamespace,
} from "./packagedHelp";

/**
 * Les aides par livraison : l'app Windows a ses phrases, un serveur qui ne
 * dit rien garde celles d'avant, et chaque variante a ses mots dans les deux
 * langues — une clé absente s'afficherait telle quelle.
 */
const namespaces = Object.keys(WINDOWS_APP_HELP) as PackagedHelpNamespace[];
const ports = REMOTE_ACCESS_GUIDE.find((section) => section.id === "ports")?.paragraphKeys ?? [];

describe("les aides de l'app Windows", () => {
  it("chaque clé de la liste existe, et chaque variante a ses mots en français et en anglais", () => {
    for (const namespace of namespaces) {
      for (const [key, treatment] of Object.entries(WINDOWS_APP_HELP[namespace])) {
        for (const locale of [fr, en]) {
          const words: Record<string, unknown> = locale[namespace];
          expect(words[key], `${namespace}:${key}`).toEqual(expect.any(String));
          if (treatment === "variant") expect(words[`${key}${WINDOWS_APP_SUFFIX}`], `${namespace}:${key}${WINDOWS_APP_SUFFIX}`).toEqual(expect.any(String));
        }
      }
    }
  });

  it("aucune variante ne parle encore de Docker, de Portainer ni d'un conteneur", () => {
    for (const namespace of namespaces) {
      for (const [key, treatment] of Object.entries(WINDOWS_APP_HELP[namespace])) {
        if (treatment !== "variant") continue;
        for (const locale of [fr, en]) {
          const words: Record<string, string> = locale[namespace];
          expect(words[`${key}${WINDOWS_APP_SUFFIX}`]).not.toMatch(/docker|portainer|conteneur|container|TENTACLE_WEB_UI/i);
        }
      }
    }
  });

  it("windows-app : la variante, ou rien pour une phrase qui se tait", () => {
    expect(packagedHelpKey("adminPlugins", "restartConfirmBody", "windows-app")).toBe("restartConfirmBody_windowsApp");
    expect(isHelpHidden("remoteAccessHelp", "ports_p4", "windows-app")).toBe(true);
    expect(packagedHelpKeys("remoteAccessHelp", ports, "windows-app")).toEqual(["ports_p1", "ports_p2", "ports_p3"]);
  });

  it("une clé hors de la liste reste telle quelle, même pour l'app Windows", () => {
    expect(packagedHelpKey("adminPlugins", "restartNow", "windows-app")).toBe("restartNow");
    expect(packagedHelpKey("setupWizard", "help_code_why_a", "windows-app")).toBe("help_code_why_a");
  });

  it("serveur qui ne dit rien de sa livraison (Docker, à la main, d'avant) : les phrases d'avant", () => {
    for (const packaging of [null, undefined]) {
      expect(packagedHelpKey("setupWizard", "doneWebUiOff", packaging)).toBe("doneWebUiOff");
      expect(isHelpHidden("remoteAccessHelp", "ports_p4", packaging)).toBe(false);
      expect(packagedHelpKeys("remoteAccessHelp", ports, packaging)).toEqual([...ports]);
    }
  });

  it("la livraison lue sur la carte du serveur : seul le Microsoft Store dit l'app Windows", () => {
    expect(packagingOfInstall({ channel: "microsoft-store" })).toBe("windows-app");
    expect(packagingOfInstall({})).toBeNull();
    expect(packagingOfInstall(null)).toBeNull();
    expect(packagingOfInstall(undefined)).toBeNull();
  });
});
