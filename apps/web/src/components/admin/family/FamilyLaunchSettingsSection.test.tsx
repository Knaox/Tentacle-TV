import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FamilyLaunchPolicy } from "@tentacle-tv/shared";

/**
 * Admin › Famille : « Qui regarde ? à l'ouverture » (`family.launchPlatforms`) —
 * l'interrupteur, quatre cases, « Enregistrer » grisé tant que rien n'a changé.
 */
const h = vi.hoisted(() => ({ policy: undefined as FamilyLaunchPolicy | undefined, isError: false }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// Le module des pages d'administration emporte toute l'app : ses jetons de boutons suffisent.
vi.mock("../../../pages/adminUtils", () => ({ cls: { bp: "bp" } }));
vi.mock("@tentacle-tv/api-client", () => ({
  useFamilyLaunchPolicy: () => ({ data: h.policy, isError: h.isError }),
  useSetFamilyLaunchPolicy: () => ({ mutate: () => undefined, isPending: false, isError: false }),
}));

const { FamilyLaunchSettingsSection } = await import("./FamilyLaunchSettingsSection");
const render = () => renderToStaticMarkup(<FamilyLaunchSettingsSection />);
const checkboxes = (html: string) => [...html.matchAll(/<input type="checkbox"[^>]*>/g)].map((m) => m[0].includes("checked"));

beforeEach(() => {
  h.isError = false;
  h.policy = {
    desktop: { mode: "choice", defaultOn: true }, tv: { mode: "off" }, enabled: true,
    platforms: { desktop: true, web: true, mobile: true, tv: false },
  };
});

describe("FamilyLaunchSettingsSection", () => {
  it("rend la réponse du serveur : l'interrupteur, les quatre plateformes dans l'ordre, la TV décochée", () => {
    const html = render();
    expect(html).toContain('role="switch"');
    expect(checkboxes(html)).toEqual([true, true, true, false]);
    const order = ["platform_desktop", "platform_web", "platform_mobile", "platform_tv"].map((key) => html.indexOf(`launchSettings.${key}`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain("launchSettings.platformHint_tv");
  });

  it("rien n'a changé : « Enregistrer » est grisé", () => {
    expect(render()).toMatch(/<button[^>]*disabled=""[^>]*>launchSettings\.save</);
  });

  it("interrupteur coupé : les cases sont grisées (fieldset désactivé), pas effacées", () => {
    h.policy = { ...h.policy!, enabled: false };
    const html = render();
    expect(html).toMatch(/<fieldset disabled=""/);
    expect(checkboxes(html)).toEqual([true, true, true, false]);
  });

  it("lecture impossible : le dit, sans formulaire", () => {
    h.policy = undefined;
    h.isError = true;
    const html = render();
    expect(html).toContain("adminPolicy.loadError");
    expect(html).not.toContain("checkbox");
  });
});
