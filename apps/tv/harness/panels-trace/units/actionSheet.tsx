import { act } from "react";
import { BackScope } from "@bench/src/redesignWiring/back/BackScope";
import { ActionSheetRedesign } from "@bench/src/redesignWiring/sheet/ActionSheetRedesign";
import { api, resetApi } from "../stubs/api-client";
import { hosts, note } from "../stubs/record";
import { mount, take } from "./root";

/**
 * Le cycle du grand panneau (`ActionSheetRedesign`) dans la portée du Retour
 * d'un écran : quand la Modal se présente (note sue, ou filet), si la portée
 * prend Menu d'avance (sa couche « menu »), la sortie, la fermeture, le mode
 * « Noter » — et Menu par la Modal, par la portée, la croix.
 */

type Sheet = { closing?: boolean; onClosed?: () => void; onClose?: () => void; onRate?: (s: number | null) => void; rating?: unknown; actions?: Array<{ kind: string }> };

const ITEM = { Id: "m1", Name: "Film", Type: "Movie" };
const PICTOS = [{ kind: "play", label: "play" }, { kind: "watchlist", label: "watchlist" }];
const navigation = { canGoBack: () => false, goBack: () => note({ goBack: true }) };

function snap() {
  const modal = hosts.get("Modal") as { visible?: boolean } | undefined;
  const sheet = hosts.get("sheet") as Sheet | undefined;
  const scope = hosts.get("TVMenuPressInterceptor") as { enabled?: boolean } | undefined;
  return {
    modal: modal ? modal.visible === true : null,
    closing: sheet ? sheet.closing === true : null,
    rating: sheet?.rating ?? null,
    actions: sheet?.actions?.map((a) => a.kind) ?? null,
    takesMenu: scope ? scope.enabled === true : null,
    mode: (hosts.get("sheetModelInput") as { mode?: string } | undefined)?.mode ?? null,
  };
}

export async function runActionSheet(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  const scenario = async (name: string, mode: "actions" | "rate", steps: Array<[string, (b: ReturnType<typeof mount>) => void]>) => {
    const bench = mount();
    resetApi();
    const trace: unknown[] = [];
    const view = () => (
      <BackScope route={{ name: "Home" } as never} navigation={navigation as never}>
        <ActionSheetRedesign target={{ kind: "media", item: ITEM as never, variant: "poster" }} mode={mode} onClose={() => note({ closed: true })} />
      </BackScope>
    );
    for (const [label, fn] of steps) {
      fn(bench);
      bench.render(view());
      await act(async () => {
        await Promise.resolve();
      });
      trace.push({ step: label, ...snap(), events: take() });
    }
    bench.unmount();
    out[name] = trace;
  };
  const model = (rating: unknown, actions = PICTOS) => () => {
    api.sheetModel = { rating, actions };
  };
  const sheet = () => hosts.get("sheet") as Sheet | undefined;
  const modal = () => hosts.get("Modal") as { onRequestClose?: () => void } | undefined;
  const scope = () => hosts.get("TVMenuPressInterceptor") as { onMenuPress?: () => void } | undefined;

  await scenario("note qui se résout, Menu dans la Modal", "actions", [
    ["note en attente", model({ current: null, pending: true })],
    ["note sue", model({ current: null })],
    ["Menu (Modal)", (b) => b.run(() => modal()?.onRequestClose?.())],
    ["fin de la sortie", (b) => b.run(() => sheet()?.onClosed?.())],
  ]);
  await scenario("filet : la note tarde", "actions", [
    ["note en attente", model({ current: null, pending: true })],
    ["1 199 ms", (b) => b.advance(1199)],
    ["1 200 ms", (b) => b.advance(1)],
    ["la note arrive (entrée figée)", model({ current: 6 })],
  ]);
  await scenario("la croix", "actions", [
    ["note 8", model({ current: 8 })],
    ["croix", (b) => b.run(() => sheet()?.onClose?.())],
    ["fin de la sortie", (b) => b.run(() => sheet()?.onClosed?.())],
  ]);
  await scenario("rien à noter, Menu par la portée pendant l'attente", "actions", [
    ["attente (pending)", model({ current: null, pending: true })],
    ["Menu (portée)", (b) => b.run(() => scope()?.onMenuPress?.())],
    ["la note arrive", model({ current: null })],
  ]);
  await scenario("« Noter » : OK note et ferme", "rate", [
    ["note sue", model({ current: null }, [])],
    ["OK sur 6", (b) => b.run(() => sheet()?.onRate?.(6))],
    ["fin de la sortie", (b) => b.run(() => sheet()?.onClosed?.())],
  ]);
  await scenario("grand panneau : OK note sans fermer", "actions", [
    ["note sue", model({ current: 4 })],
    ["OK sur 9", (b) => b.run(() => sheet()?.onRate?.(9))],
  ]);
  return out;
}
