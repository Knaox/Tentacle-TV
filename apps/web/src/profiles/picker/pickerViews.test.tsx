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
  // Le cadenas fermé suit le code PIN, sauf mention contraire (le profil en cours).
  return { id, name: id, color: "teal", imageTag: null, hasPin: false, pinLock: patch.hasPin ?? false, current: false, guest: false, own: false, lockedLabel: null, ...patch };
}

function view(model: WhoIsWatchingModel, onCancel?: () => void): string {
  return renderToStaticMarkup(
    <WhoIsWatchingView model={model} onPick={noop} onManage={noop} onRetry={noop} onDigit={noop} onErase={noop} onBack={noop} onCancel={onCancel} />,
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

  it("le profil en cours (« Changer de profil ») : ni cadenas fermé ni « bloqué », « Profil actuel » et son anneau", () => {
    const current = profile("zoe", { hasPin: true, pinLock: false, current: true });
    const html = view({ kind: "picker", profiles: [FAMILY[0]!, current, FAMILY[2]!], canManage: true, notice: null, entering: null });
    // Seule Léa, qui demandera vraiment son code, garde le cadenas fermé.
    expect(html.match(/lucide-lock/g)?.length).toBe(1);
    expect(html).toContain('aria-label="profilePicker:tileLabelCurrent{&quot;name&quot;:&quot;zoe&quot;}, profilePicker:current"');
    expect(html).not.toContain("profilePicker:tileLabelPin{&quot;name&quot;:&quot;zoe&quot;}");
    expect(html.match(/ring-content-primary/g)?.length).toBe(1);
  });

  it("un profil sans code : ni cadenas ni anneau", () => {
    const html = view({ kind: "picker", profiles: [FAMILY[0]!, profile("max")], canManage: true, notice: null, entering: null });
    expect(html).not.toContain("lucide-lock");
    expect(html).not.toContain("ring-content-primary");
    expect(html).not.toContain("profilePicker:current");
  });

  it("tabulation itinérante : un seul profil dans l'ordre de tabulation, le premier", () => {
    const html = view({ kind: "picker", profiles: FAMILY, canManage: false, notice: null, entering: null });
    expect(html.match(/tabindex="0"/g)?.length).toBe(1);
    expect(html.match(/tabindex="-1"/g)?.length).toBe(2);
    expect(html).not.toContain("manageProfiles");
  });

  it("le pavé refermé, le focus revient au profil d'où l'on venait", () => {
    const html = view({ kind: "picker", profiles: FAMILY, canManage: false, notice: null, entering: null, focusId: "zoe" });
    const tabbable = html.match(/<button[^>]*tabindex="0"[^>]*>/)?.[0] ?? "";
    expect(tabbable).toContain("zoe");
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

describe("« Qui regarde ? » — « Ne plus proposer sur cet appareil »", () => {
  const base = { kind: "picker" as const, profiles: FAMILY, canManage: true, notice: null, entering: null };

  it("absente quand le compte ne demande pas qui regarde (stay null ou absent)", () => {
    expect(view(base)).not.toContain("stayOnDevice");
    expect(view({ ...base, stay: null })).not.toContain('type="checkbox"');
  });

  it("une vraie case à cocher, nommée par son libellé, entre la rangée et « Gérer les profils »", () => {
    const html = view({ ...base, stay: false });
    expect(html).toMatch(/<label[^>]*><input type="checkbox"/);
    expect(html).toContain("stayOnDevice");
    expect(html).not.toContain('checked=""');
    // Décochée : la phrase n'est pas dite, mais sa place est réservée (rien ne saute).
    expect(html).not.toContain("stayOnDeviceHint");
    expect(html).toContain("min-h-[2.5rem]");
    expect(html.indexOf("stayOnDevice")).toBeGreaterThan(html.indexOf("tileLabel"));
    expect(html.indexOf("stayOnDevice")).toBeLessThan(html.indexOf("manageProfiles"));
  });

  it("cochée : la case se remplit, la phrase dit comment en revenir et décrit la case", () => {
    const html = view({ ...base, stay: true });
    expect(html).toContain('checked=""');
    expect(html).toContain("stayOnDeviceHint");
    const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1] ?? "";
    expect(describedBy).not.toBe("");
    expect(html).toContain(`id="${describedBy}"`);
  });

  it("pendant l'entrée dans un profil, elle ne se coche plus et s'efface", () => {
    const html = view({ ...base, stay: true, entering: { id: "zoe", label: null } });
    expect(html).toMatch(/<input type="checkbox"[^>]*disabled=""/);
    expect(html).toContain("pointer-events-none opacity-0");
  });
});

describe("« Qui regarde ? » — le retour du pavé", () => {
  it("« Retour aux profils » passe au-dessus de la colonne animée (sinon elle avale le clic)", () => {
    const html = view({ kind: "pin", pad: { profile: FAMILY[1]!, typed: 0, phase: "typing", message: null } });
    // Le conteneur positionné du bouton porte un z-index ; <main> vient après et s'anime.
    const back = html.match(/<div class="([^"]*)"><button[^>]*>.*?pin\.back/)?.[1] ?? "";
    expect(back).toContain("absolute");
    expect(back).toContain("z-10");
    expect(html.indexOf("pin.back")).toBeLessThan(html.indexOf("<main"));
  });
});

describe("« Qui regarde ? » ouvert par « Changer de profil » — Annuler", () => {
  const row = { kind: "picker" as const, profiles: FAMILY, canManage: true, notice: null, entering: null };

  it("à l'ouverture de l'application, nulle part où revenir : pas d'« Annuler »", () => {
    expect(view(row)).not.toContain("switcher.cancel");
  });

  it("« Annuler » en haut à gauche, au-dessus de la colonne animée, avant la rangée", () => {
    const html = view(row, noop);
    const corner = html.match(/<div class="([^"]*)"><button[^>]*>.*?switcher\.cancel/)?.[1] ?? "";
    expect(corner).toContain("absolute");
    expect(corner).toContain("z-10");
    expect(html.indexOf("switcher.cancel")).toBeLessThan(html.indexOf("<main"));
  });

  it("aussi pendant l'attente et après un échec de lecture", () => {
    expect(view({ kind: "loading" }, noop)).toContain("switcher.cancel");
    expect(view({ kind: "error", message: "Le serveur ne répond pas." }, noop)).toContain("switcher.cancel");
  });

  it("le pavé garde sa flèche « Retour aux profils » : Annuler n'y est pas", () => {
    const html = view({ kind: "pin", pad: { profile: FAMILY[1]!, typed: 0, phase: "typing", message: null } }, noop);
    expect(html).toContain("pin.back");
    expect(html).not.toContain("switcher.cancel");
  });

  it("pendant l'entrée dans un profil, plus rien ne s'annule : le bouton se tait et s'efface", () => {
    const html = view({ ...row, entering: { id: "zoe", label: null } }, noop);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*class="[^"]*disabled:opacity-0[^"]*"[^>]*>.*?switcher\.cancel/);
  });
});

describe("« Qui regarde ? » — le pavé du code PIN", () => {
  function pad(model: Partial<PinPadModel>): string {
    const base: PinPadModel = { profile: profile("zoe", { hasPin: true }), typed: 0, phase: "typing", message: null, ...model };
    return renderToStaticMarkup(<ProfilePinPad pad={base} onDigit={noop} onErase={noop} onBack={noop} />);
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
    // Le point plein est posé sur chaque point vide ; seuls les tapés sont opaques.
    expect(pad({ typed: 3 }).match(/bg-content-primary[^"]*opacity-100/g)?.length).toBe(3);
    expect(pad({ typed: 3 }).match(/bg-content-primary[^"]*opacity-0/g)?.length).toBe(1);
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
