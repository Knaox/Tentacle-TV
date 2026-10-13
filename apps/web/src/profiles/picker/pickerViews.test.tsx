import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PickerProfile, PinPadModel, WhoIsWatchingModel } from "./pickerTypes";

/**
 * « Qui regarde ? » rendu à plat, comme les autres bancs de composants : ce
 * qui s'affiche et quels gestes s'offrent. `t()` rend la clé suivie de ses
 * valeurs ; un nom piégé y passe tel quel, et c'est React qui doit l'échapper.
 * L'avatar est remplacé (l'api-client tirerait une seconde copie de React).
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}${JSON.stringify(options)}` : key),
    i18n: { language: "fr" },
  }),
}));
vi.mock("../../family/FamilyAvatar", () => ({ FamilyAvatar: ({ name }: { name: string }) => <span data-avatar={name} /> }));

const { WhoIsWatchingView } = await import("./WhoIsWatchingView");
const { ProfilePinPad } = await import("./ProfilePinPad");

const TRAP = "<b>Léa</b><img src=x onerror=alert(1)>";
const noop = () => {};

function profile(id: string, patch: Partial<PickerProfile> = {}): PickerProfile {
  return { id, name: id, color: "teal", imageTag: null, hasPin: false, guest: false, own: false, lockedLabel: null, ...patch };
}

function view(model: WhoIsWatchingModel): string {
  return renderToStaticMarkup(
    <WhoIsWatchingView model={model} onPick={noop} onManage={noop} onRetry={noop} onDigit={noop} onErase={noop} onBack={noop} />,
  );
}

const FAMILY = [profile("damien", { own: true }), profile("zoe", { hasPin: true }), profile("lea", { guest: true, hasPin: true })];

describe("« Qui regarde ? » — la rangée", () => {
  it("le titre, chaque profil en bouton nommé, le cadenas d'un code PIN, « Invité »", () => {
    const html = view({ kind: "picker", profiles: FAMILY, canManage: true, notice: null, entering: null });
    expect(html).toContain("whoIsWatching");
    expect(html).toContain('aria-label="profilePicker:tileLabel{&quot;name&quot;:&quot;damien&quot;}"');
    expect(html).toContain("profilePicker:tileLabelPin{&quot;name&quot;:&quot;zoe&quot;}");
    expect(html).toContain("family:kindGuest");
    expect(html.match(/lucide-lock/g)?.length).toBe(2);
    expect(html).toContain("manageProfiles");
  });

  it("tabulation itinérante : un seul profil dans l'ordre de tabulation, le premier", () => {
    const html = view({ kind: "picker", profiles: FAMILY, canManage: false, notice: null, entering: null });
    expect(html.match(/tabindex="0"/g)?.length).toBe(1);
    expect(html.match(/tabindex="-1"/g)?.length).toBe(2);
    expect(html).not.toContain("manageProfiles");
  });

  it("pendant l'entrée dans un profil, plus rien ne se choisit ; le refus se dit", () => {
    const entering = view({ kind: "picker", profiles: FAMILY, canManage: true, notice: null, entering: { id: "zoe", label: "Ouverture" } });
    expect(entering.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
    expect(entering).toContain("Ouverture");
    const refused = view({ kind: "picker", profiles: FAMILY, canManage: true, notice: "Ce profil n'est plus disponible.", entering: null });
    expect(refused).toContain("Ce profil n&#x27;est plus disponible.");
  });

  it("un profil bloqué le dit, et son nom piégé reste du texte", () => {
    const html = view({ kind: "picker", profiles: [profile(TRAP, { lockedLabel: "Bloqué jusqu'à 22:15" }), profile("b")], canManage: false, notice: null, entering: null });
    expect(html).toContain("Bloqué jusqu&#x27;à 22:15");
    expect(html).toContain("&lt;b&gt;Léa&lt;/b&gt;&lt;img");
    expect(html).not.toContain("<img");
  });

  it("chargement et erreur : un message, et Réessayer", () => {
    expect(view({ kind: "loading" })).toContain("loading");
    const error = view({ kind: "error", message: "Le serveur ne répond pas." });
    expect(error).toContain('role="alert"');
    expect(error).toContain("retry");
  });
});

describe("« Qui regarde ? » — le pavé du code PIN", () => {
  function pad(model: Partial<PinPadModel>, compact = false): string {
    const base: PinPadModel = { profile: profile("zoe", { hasPin: true }), typed: 0, phase: "typing", message: null, ...model };
    return renderToStaticMarkup(<ProfilePinPad pad={base} onDigit={noop} onErase={noop} onBack={noop} compact={compact} />);
  }

  it("le nom en titre, le groupe nommé, dix chiffres et Effacer, chacun son nom", () => {
    const html = pad({});
    expect(html).toContain('aria-label="pin.title{&quot;name&quot;:&quot;zoe&quot;}"');
    expect(html).toContain(">zoe</h2>");
    for (const digit of ["0", "1", "9"]) expect(html).toContain(`pin.digit{&quot;digit&quot;:&quot;${digit}&quot;}`);
    expect(html).toContain('aria-label="pin.erase"');
    expect(html).toContain("pin.prompt");
  });

  it("les points pleins suivent les chiffres tapés ; Effacer s'éteint sans rien à effacer", () => {
    expect(pad({ typed: 3 }).match(/bg-content-primary/g)?.length).toBe(3);
    expect(pad({ typed: 3 })).toContain("pin.progress{&quot;count&quot;:3}");
    expect(pad({ typed: 0 })).toMatch(/aria-label="pin.erase"[^>]*disabled=""|disabled=""[^>]*aria-label="pin.erase"/);
  });

  it("vérification et blocage : le pavé se tait ; un refus se dit et fait trembler les points", () => {
    const checking = pad({ typed: 4, phase: "checking" });
    expect(checking).toContain("pin.checking");
    expect(checking.match(/disabled=""/g)?.length).toBe(11);
    const wrong = pad({ phase: "wrong", message: "Code incorrect." });
    expect(wrong).toContain("Code incorrect.");
    expect(wrong).toContain("animate-shake");
    expect(pad({ phase: "locked", message: "Trop d'essais." }).match(/disabled=""/g)?.length).toBe(11);
  });
});
