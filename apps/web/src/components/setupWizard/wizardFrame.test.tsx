import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

/**
 * Le cadre pleine page, rendu à plat : l'action principale dans le pied (et
 * reliée au formulaire de l'écran), « Retour » seulement quand le parcours le
 * permet, l'attente partagée, les grandes étapes dites en toutes lettres.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}${JSON.stringify(opts)}` : key),
    i18n: { language: "fr", changeLanguage: async () => undefined },
  }),
}));
vi.mock("../../pages/adminUtils", () => ({
  cls: new Proxy({}, { get: (_target, name) => `cls-${String(name)}` }),
  BACKEND: "",
  creds: () => undefined,
  hdrs: () => ({}),
}));
vi.mock("../auth/LanguageToggle", () => ({ LanguageToggle: () => <div>langues</div> }));

const { WizardFrame } = await import("./WizardFrame");
const { SetupWaiting } = await import("./SetupWaiting");
type FrameState = import("./WizardFrame").WizardFrameState;

const state = (over: Partial<FrameState> = {}): FrameState => ({
  step: "libraries",
  position: 4,
  total: 9,
  back: () => undefined,
  server: null,
  data: { context: null },
  ...over,
});
const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>).replaceAll("&quot;", '"');

describe("le cadre de l'assistant", () => {
  it("l'action principale est au pied, reliée au formulaire de l'écran ; les secondaires à côté", () => {
    const out = html(
      <WizardFrame wizard={state()} title="Titre" primary={{ label: "Envoyer", form: "f1", disabled: true }} secondary={[{ label: "Passer", onClick: () => undefined }]}>
        <form id="f1" />
      </WizardFrame>,
    );
    expect(out).toMatch(/<footer[\s\S]*<button type="submit" disabled="" form="f1"[^>]*>Envoyer<\/button>[\s\S]*<\/footer>/);
    expect(out).toMatch(/<footer[\s\S]*<button type="button"[^>]*>Passer<\/button>[\s\S]*<\/footer>/);
    expect(out).toContain(">back<");
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain('data-testid="setup-help"');
  });

  it("en cours : le bouton se désactive et le dit ; sans retour possible, pas de « Retour »", () => {
    const out = html(
      <WizardFrame wizard={state({ back: undefined })} title="Titre" primary={{ label: "Envoyer", onClick: () => undefined, pending: true, pendingLabel: "Envoi…" }}>
        contenu
      </WizardFrame>,
    );
    expect(out).toMatch(/<button type="button" disabled=""[^>]*aria-busy="true"[^>]*>.*Envoi…<\/button>/);
    expect(out).not.toContain(">back<");
  });

  it("les grandes étapes : faites, en cours (aria-current), à venir — et la progression de l'écran", () => {
    const out = html(<WizardFrame wizard={state()} title="Titre">contenu</WizardFrame>);
    expect(out).toMatch(/aria-current="step"[^>]*>[\s\S]*?phase_content/);
    expect(out).toContain('phaseDone{"phase":"phase_start"}');
    expect(out).toContain('phaseDone{"phase":"phase_jellyfin"}');
    expect(out).not.toContain('phaseDone{"phase":"phase_install"}');
    expect(out).toContain('role="progressbar"');
    expect(out).toContain('aria-valuenow="4"');
  });

  it("rien à gauche : une seule colonne centrée ; une explication : deux colonnes", () => {
    const single = html(<WizardFrame wizard={state()} title="Titre">contenu</WizardFrame>);
    expect(single).toContain("max-w-3xl");
    expect(single).not.toContain("lg:grid-cols-");
    const split = html(<WizardFrame wizard={state()} title="Titre" aside={<p>pourquoi</p>}>contenu</WizardFrame>);
    expect(split).toContain("lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]");
    expect(split).toContain("pourquoi");
    const wide = html(<WizardFrame wizard={state()} title="Titre" layout="wide">contenu</WizardFrame>);
    expect(wide).toContain("lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]");
  });

  it("la progression inconnue (accueil) n'est pas dite", () => {
    const out = html(<WizardFrame wizard={state({ step: "welcome", position: 1 })} title="Titre" hideProgress>contenu</WizardFrame>);
    expect(out).not.toContain("progress{");
    expect(out).not.toContain("aria-valuenow");
  });
});

describe("l'attente partagée", () => {
  it("annoncée, en mots ; une barre seulement quand on sait mesurer", () => {
    const ring = html(<SetupWaiting title="Recherche…" detail="Quelques secondes." />);
    expect(ring).toContain('role="status"');
    expect(ring).toContain("Recherche…");
    expect(ring).toContain("Quelques secondes.");
    expect(ring).not.toContain('role="progressbar"');
    const bar = html(<SetupWaiting title="Téléchargement" progress={0.42} />);
    expect(bar).toContain('role="progressbar"');
    expect(bar).toContain('aria-valuenow="42"');
    expect(bar).toContain("scaleX(0.42)");
  });
});
