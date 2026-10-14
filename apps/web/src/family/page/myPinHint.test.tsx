import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * « Mon code PIN » dit où le code est demandé : sur les TV, et — seulement si
 * le serveur sait « Qui regarde ? » sur le bureau (`family.desktopProfiles`) —
 * sur un ordinateur aussi. Jamais une fonction que le serveur ne sait pas faire.
 */

const state = vi.hoisted(() => ({ desktopProfiles: false }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@tentacle-tv/api-client", () => ({
  useServerCapability: () => state.desktopProfiles,
  useDissolveFamily: () => ({ mutate: () => undefined, isPending: false }),
}));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => ({ show: () => undefined }) }));
vi.mock("./PinEditors", () => ({ OwnPinDialog: () => null }));

const { MyPinSection } = await import("./AccountSections");

describe("« Mon code PIN » — où il est demandé", () => {
  beforeEach(() => {
    state.desktopProfiles = false;
  });

  it("serveur sans « Qui regarde ? » sur le bureau : les TV seulement", () => {
    const html = renderToStaticMarkup(<MyPinSection hasPin={false} />);
    expect(html).toContain("myPin.hint");
    expect(html).not.toContain("myPin.hintDesktop");
  });

  it("serveur qui le sait : les TV et l'ordinateur", () => {
    state.desktopProfiles = true;
    expect(renderToStaticMarkup(<MyPinSection hasPin />)).toContain("myPin.hintDesktop");
  });
});
