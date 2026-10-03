import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as Back from "@bench/BackScope";

/**
 * Le banc de traces du Retour : la portée que le navigateur pose autour de
 * chaque écran (`redesignWiring/back/BackScope`, importée par AppNavigator,
 * partagé avec Android TV), montée sans DOM ni simulateur, des couches
 * inscrites comme le font les écrans, des appuis Menu simulés.
 *
 * Une trace dit, pas à pas : la vue native rendue et son `enabled` (la
 * décision d'AVANCE de tvOS), puis à chaque appui qui le reçoit — l'app
 * (l'intercepteur était pris) ou la plateforme (UIKit, qui quitte) — et ce qui
 * s'est passé (couche appelée, `goBack`). `bench.mjs` rejoue les mêmes
 * scénarios sur le SHA de référence et sur l'arbre courant, pour iOS et pour
 * Android, et compare.
 */

type Kind = "menu" | "overlay" | "page" | "rail";
interface LayerProps {
  name: string;
  kind: Kind;
  active: boolean;
  /** Le nom inscrit dans la trace quand la couche répond (son gestionnaire du moment). */
  handler?: string;
}
type Step = { render: LayerProps[] } | { press: string } | { stalePress: string; then: LayerProps[] } | { unmount: true };
interface Scenario {
  route: string;
  canGoBack: boolean;
  steps: Step[];
}

const bench = globalThis as unknown as {
  __native: Record<string, { enabled?: boolean; onMenuPress?: () => void }>;
  __calls: string[];
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
bench.IS_REACT_ACT_ENVIRONMENT = true;
// react-dom lit `window.event` : le banc n'a pas de fenêtre, il en tient lieu.
(globalThis as unknown as { window: unknown }).window = globalThis;

let effects: string[] = [];

function Layer({ name, kind, active, handler }: LayerProps) {
  Back.useBackLayer(kind, active, () => effects.push(`layer:${handler ?? name}`));
  return null;
}

/** Les mêmes couches, déclarées en une liste (API nouvelle, `useBackLayers`). */
function Specs({ layers }: { layers: LayerProps[] }) {
  const useBackLayers = (Back as { useBackLayers?: (specs: unknown[], actions: Record<string, () => void>) => void }).useBackLayers;
  const actions: Record<string, () => void> = {};
  for (const layer of layers) actions[layer.name] = () => effects.push(`layer:${layer.handler ?? layer.name}`);
  useBackLayers?.(layers.map((layer) => ({ id: layer.name, kind: layer.kind, active: layer.active, action: layer.name })), actions);
  return null;
}

function fakeContainer() {
  const listen = { addEventListener() {}, removeEventListener() {} };
  const document = { nodeType: 9, activeElement: null, ...listen, defaultView: { HTMLIFrameElement: class {}, ...listen } } as Record<string, unknown>;
  (document.defaultView as Record<string, unknown>).document = document;
  return {
    nodeType: 1,
    tagName: "DIV",
    nodeName: "DIV",
    namespaceURI: "http://www.w3.org/1999/xhtml",
    ownerDocument: document,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Element;
}

function nativeState() {
  const interceptor = bench.__native.TVMenuPressInterceptor;
  return interceptor ? { interceptor: { enabled: !!interceptor.enabled } } : { interceptor: null };
}

function run({ route, canGoBack, steps }: Scenario, asSpecs = false): unknown[] {
  const trace: unknown[] = [];
  const root: Root = createRoot(fakeContainer());
  const navigation = { canGoBack: () => canGoBack, goBack: () => effects.push("goBack") };
  const view = (layers: LayerProps[]) => (
    <Back.BackScope route={{ name: route }} navigation={navigation}>
      {asSpecs ? <Specs layers={layers} /> : layers.map((layer) => <Layer key={layer.name} {...layer} />)}
    </Back.BackScope>
  );
  const press = (label: string, onMenuPress: (() => void) | undefined, taken: boolean) => {
    effects = [];
    if (taken && onMenuPress) act(() => onMenuPress());
    trace.push({ press: label, to: taken ? "app" : "platform", effects });
  };
  for (const step of steps) {
    if ("render" in step) {
      act(() => root.render(view(step.render)));
      trace.push({ render: step.render.map((l) => `${l.name}:${l.kind}:${l.active ? "on" : "off"}`), ...nativeState() });
    } else if ("press" in step) {
      const interceptor = bench.__native.TVMenuPressInterceptor;
      press(step.press, interceptor?.onMenuPress, !!interceptor?.enabled);
    } else if ("stalePress" in step) {
      // Pris à l'enfoncement (enabled vrai), relâché après un rendu qui change les couches.
      const interceptor = bench.__native.TVMenuPressInterceptor;
      const taken = !!interceptor?.enabled;
      act(() => root.render(view(step.then)));
      press(step.stalePress, bench.__native.TVMenuPressInterceptor?.onMenuPress ?? interceptor?.onMenuPress, taken);
    } else {
      act(() => root.render(view([])));
      trace.push({ unmountLayers: true, ...nativeState() });
    }
  }
  act(() => root.unmount());
  trace.push({ end: true, ...nativeState() });
  return trace;
}

const L = (name: string, kind: Kind, active: boolean, handler?: string): LayerProps => ({ name, kind, active, handler });

const SCENARIOS: Record<string, Scenario> = {
  "accueil-racine": {
    route: "Home",
    canGoBack: false,
    steps: [
      { render: [] },
      { press: "sans couche" },
      { render: [L("ouvrirRail", "page", true), L("versReglages", "rail", false)] },
      { press: "focus dans la page" },
      { render: [L("ouvrirRail", "page", false), L("versReglages", "rail", true)] },
      { press: "rail ouvert" },
      { render: [L("ouvrirRail", "page", false), L("versReglages", "rail", false)] },
      { press: "sur le profil" },
    ],
  },
  "bibliotheque-sur-accueil": {
    route: "Library",
    canGoBack: true,
    steps: [{ render: [] }, { press: "page du rail, sans couche" }, { render: [L("ouvrirRail", "page", true)] }, { press: "focus dans la page" }],
  },
  "fiche-poussee": {
    route: "MediaDetail",
    canGoBack: true,
    steps: [
      { render: [] },
      { press: "sans couche" },
      { render: [L("panneau", "menu", true)] },
      { press: "panneau ouvert" },
      { render: [L("panneau", "menu", false)] },
      { press: "panneau fermé" },
    ],
  },
  "etagere-poussee-avec-rail": {
    route: "SearchBrowse",
    canGoBack: true,
    steps: [{ render: [L("deplacement", "menu", false), L("menuEntree", "menu", false)] }, { press: "rail ouvert ou non" }],
  },
  lecteur: {
    route: "Player",
    canGoBack: true,
    steps: [
      { render: [L("pistes", "menu", true), L("habillage", "overlay", true), L("quitter", "page", true)] },
      { press: "pistes ouvertes" },
      { render: [L("pistes", "menu", false), L("habillage", "overlay", true), L("quitter", "page", true)] },
      { press: "habillage" },
      { render: [L("pistes", "menu", false), L("habillage", "overlay", false), L("quitter", "page", true)] },
      { press: "rien à l'écran" },
    ],
  },
  "rang-egal": {
    route: "Home",
    canGoBack: false,
    steps: [
      { render: [L("a", "menu", false), L("b", "menu", false)] },
      { render: [L("a", "menu", false), L("b", "menu", true)] },
      { render: [L("a", "menu", true), L("b", "menu", true)] },
      { press: "a activée en dernier" },
      { render: [L("a", "menu", true, "a2"), L("b", "menu", true)] },
      { press: "a mise à jour garde son rang" },
      { render: [L("a", "menu", true), L("b", "menu", false)] },
      { render: [L("a", "menu", true), L("b", "menu", true)] },
      { press: "b réactivée" },
    ],
  },
  "jumelage-racine": {
    route: "PairCode",
    canGoBack: false,
    steps: [{ render: [L("etape", "page", true)] }, { press: "étape intermédiaire" }, { render: [L("etape", "page", false)] }, { press: "accueil du jumelage" }],
  },
  "appui-avale": {
    route: "Home",
    canGoBack: false,
    steps: [{ render: [L("ouvrirRail", "page", true)] }, { stalePress: "couche désactivée avant le relâchement", then: [L("ouvrirRail", "page", false)] }],
  },
  demontage: {
    route: "MediaDetail",
    canGoBack: true,
    steps: [{ render: [L("panneau", "menu", true)] }, { unmount: true }, { press: "couche démontée" }],
  },
};

const scenarios: Record<string, unknown[]> = {};
for (const [name, scenario] of Object.entries(SCENARIOS)) scenarios[name] = run(scenario);

// L'API nouvelle : les mêmes couches déclarées en liste donnent la même trace.
const specsEquivalent: Record<string, boolean> | null = "useBackLayers" in Back
  ? Object.fromEntries(Object.entries(SCENARIOS).map(([name, scenario]) => [name, JSON.stringify(run(scenario, true)) === JSON.stringify(scenarios[name])]))
  : null;

process.stdout.write(JSON.stringify({ scenarios, calls: bench.__calls, specsEquivalent }));
process.exit(0);
