import { act } from "react";
import { BackScope } from "@bench/src/redesignWiring/back/BackScope";
import { AbsentSheetRedesign } from "@bench/src/redesignWiring/vigie/AbsentSheetRedesign";
import { api, resetApi } from "../stubs/api-client";
import { hosts, note } from "../stubs/record";
import { showSheetTargets } from "../stubs/views";
import { mount, take } from "./root";

/**
 * Le grand panneau d'un titre ABSENT (`AbsentSheetRedesign`) dans la portée du
 * Retour d'un écran : quand la Modal se présente (état du titre su, ou filet
 * de 900 ms), son entrée et ses verrous (cibles montées par la doublure de la
 * vue), « Demander » — noté, jamais envoyé : la demande est le geste de
 * l'appelant, après la sortie —, Menu par la Modal, par la portée, la croix ;
 * puis le titre déjà demandé par le compte, arrivé, ou dont l'état échoue.
 */

type Sheet = { closing?: boolean; header?: unknown; actions?: unknown; rating?: unknown; onAction?: (kind: string) => void; onClose?: () => void; onClosed?: () => void };
type Binding = { onFocus?: () => void; onBlur?: () => void };
type Step = [string, (b: ReturnType<typeof mount>) => void | Promise<void>];

const GATE = { provider: { pluginId: "seer", statePath: "/titles/state" }, lang: "fr" };
const TITLE = { key: "movie:603", title: "Film absent", year: 1999, imageUrl: "https://image.tmdb.org/t/p/w342/affiche.jpg" };
const OFFER = { badge: { label: "Demandé par un autre", tone: "info" }, request: { mode: "direct", label: "Demander", href: null } };
const NO_OFFER = { badge: null, request: null };
const MINE = { key: TITLE.key, mediaType: "movie", tmdbId: 603, title: TITLE.title, year: 1999, imageUrl: null, seasons: null, state: "arriving", percent: 42, etaSeconds: 600 };
const navigation = { canGoBack: () => false, goBack: () => note({ goBack: true }) };

function snap() {
  const modal = hosts.get("Modal") as { visible?: boolean } | undefined;
  const sheet = hosts.get("sheet") as Sheet | undefined;
  const query = hosts.get("query") as { queryKey?: unknown; staleTime?: unknown; retry?: unknown } | undefined;
  const keys = [...hosts]
    .filter(([name]) => name.startsWith("key:"))
    .map(([name, value]) => [name.slice(4), { selectable: value.selectable, guard: value.guard }] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    modal: modal ? modal.visible === true : null,
    closing: sheet ? sheet.closing === true : null,
    header: sheet?.header ?? null,
    actions: sheet?.actions ?? null,
    rating: sheet ? sheet.rating ?? null : null,
    keys: Object.fromEntries(keys),
    takesMenu: (hosts.get("TVMenuPressInterceptor") as { enabled?: boolean } | undefined)?.enabled ?? null,
    query: query ? { key: query.queryKey, staleTime: query.staleTime, retry: query.retry } : null,
    live: (hosts.get("liveRefresh") as { active?: boolean } | undefined)?.active ?? null,
  };
}

export async function runAbsentSheet(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  const scenario = async (name: string, steps: Step[]) => {
    const bench = mount();
    resetApi();
    showSheetTargets(true);
    const trace: unknown[] = [];
    const view = () => (
      <BackScope route={{ name: "Search" } as never} navigation={navigation as never}>
        <AbsentSheetRedesign gate={GATE as never} title={TITLE as never} onRequest={(title) => note({ request: title.key })} onClose={() => note({ closed: true })} />
      </BackScope>
    );
    for (const [label, fn] of steps) {
      await fn(bench);
      bench.render(view());
      await act(async () => {
        for (let i = 0; i < 5; i++) await Promise.resolve();
      });
      trace.push({ step: label, ...snap(), events: take() });
    }
    bench.unmount();
    showSheetTargets(false);
    out[name] = trace;
  };
  const known = (data: unknown) => () => {
    api.query = { data, isFetched: true };
  };
  const sheet = () => hosts.get("sheet") as Sheet | undefined;
  const focus = (b: ReturnType<typeof mount>, key: string, on = true) =>
    b.run(() => {
      const binding = (hosts.get(`key:${key}`) as { binding?: Binding } | undefined)?.binding;
      if (on) binding?.onFocus?.();
      else binding?.onBlur?.();
    });
  const modalMenu = (b: ReturnType<typeof mount>) => b.run(() => (hosts.get("Modal") as { onRequestClose?: () => void } | undefined)?.onRequestClose?.());
  const scopeMenu = (b: ReturnType<typeof mount>) => b.run(() => (hosts.get("TVMenuPressInterceptor") as { onMenuPress?: () => void } | undefined)?.onMenuPress?.());
  const readState = async () => {
    const query = hosts.get("query") as { queryFn?: () => Promise<unknown> } | undefined;
    await act(async () => {
      note({ read: await query?.queryFn?.() });
    });
  };

  await scenario("état su : entrée sur « Demander », la demande après la sortie", [
    ["état su (offre)", known(OFFER)],
    ["la lecture de l'état", readState],
    ["premier focus sur « Demander »", (b) => focus(b, "sheet:action:request")],
    ["« Demander »", (b) => b.run(() => sheet()?.onAction?.("request"))],
    ["un autre picto : rien", (b) => b.run(() => sheet()?.onAction?.("play"))],
    ["fin de la sortie", (b) => b.run(() => sheet()?.onClosed?.())],
  ]);
  await scenario("état en route : le filet de 900 ms, puis l'offre (entrée figée)", [
    ["état en route", () => {}],
    ["899 ms", (b) => b.advance(899)],
    ["900 ms", (b) => b.advance(1)],
    ["l'offre arrive", known(OFFER)],
    ["799 ms", (b) => b.advance(799)],
    ["800 ms : le verrou tombe", (b) => b.advance(1)],
  ]);
  await scenario("Menu dans la Modal, puis par la portée pendant la sortie", [
    ["état su (offre)", known(OFFER)],
    ["Menu (Modal)", modalMenu],
    ["Menu (portée) pendant la sortie", scopeMenu],
    ["fin de la sortie", (b) => b.run(() => sheet()?.onClosed?.())],
  ]);
  await scenario("Menu par la portée pendant l'attente", [
    ["état en route", () => {}],
    ["Menu (portée)", scopeMenu],
    ["900 ms", (b) => b.advance(900)],
  ]);
  await scenario("déjà demandé par le compte : la croix, l'affiche qui arrive", [
    ["sa demande en cours", () => {
      api.myTitles = [MINE];
      known(OFFER)();
    }],
    ["premier focus sur la croix", (b) => focus(b, "sheet:close")],
    ["l'app en arrière-plan", () => {
      api.appActive = false;
    }],
    ["la croix", (b) => b.run(() => sheet()?.onClose?.())],
    ["fin de la sortie", (b) => b.run(() => sheet()?.onClosed?.())],
  ]);
  await scenario("arrivé : rien à demander", [
    ["arrivé, l'offre encore dite", () => {
      api.arrivals = [TITLE.key];
      known(OFFER)();
    }],
  ]);
  await scenario("rien à dire du titre : la croix", [
    ["état su sans offre", known(NO_OFFER)],
  ]);
  await scenario("l'état échoue", [
    ["échec", () => {
      api.query = { isError: true };
    }],
    ["premier focus sur la croix", (b) => focus(b, "sheet:close")],
  ]);
  return out;
}
