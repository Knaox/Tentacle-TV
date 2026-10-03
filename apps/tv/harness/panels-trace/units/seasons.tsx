import { act } from "react";
import { BackScope } from "@bench/src/redesignWiring/back/BackScope";
import { SeasonsSheetRedesign } from "@bench/src/redesignWiring/vigie/SeasonsSheetRedesign";
import { api, resetApi } from "../stubs/api-client";
import { hosts, note, plain } from "../stubs/record";
import { mount, take } from "./root";

/**
 * La feuille des saisons (`SeasonsSheetRedesign`) : quand elle se présente,
 * son entrée et ses verrous, cocher, Lecture/Pause (appui simple, jamais le
 * maintien) qui demande, Menu, la fermeture avant présentation.
 */

type Binding = { onFocus?: () => void; onBlur?: () => void };
const emitTv = (globalThis as unknown as { __emitTv: (event: Record<string, unknown>) => void }).__emitTv;

const GATE = { provider: { id: "seer", seasonsPath: "/titles/seasons" }, lang: "fr", origin: "tv:tvos" };
const TITLE = { key: "tv:100", title: "Série", year: 2020, imageUrl: null };
const ANSWER = {
  seasons: [
    { number: 1, name: "Season 1", episodeCount: 10, status: null, requestable: true },
    { number: 2, name: "Season 2", episodeCount: 8, status: null, requestable: true },
    { number: 3, name: "Season 3", episodeCount: 6, status: null, requestable: true },
  ],
};
const navigation = { canGoBack: () => false, goBack: () => note({ goBack: true }) };

function snap() {
  const fading = hosts.get("fading") as { open?: boolean } | undefined;
  const sheet = hosts.get("seasons") as { sheet?: unknown } | undefined;
  const keys: Record<string, unknown> = {};
  for (const [name, value] of hosts) if (name.startsWith("key:")) keys[name.slice(4)] = (value as { selectable: unknown }).selectable;
  return { open: fading ? fading.open === true : null, sheet: sheet ? plain(sheet.sheet as Record<string, unknown>) : null, keys, takesMenu: (hosts.get("TVMenuPressInterceptor") as { enabled?: boolean } | undefined)?.enabled ?? null };
}

export async function runSeasons(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  const scenario = async (name: string, props: { focus?: number }, steps: Array<[string, (b: ReturnType<typeof mount>) => void]>) => {
    const bench = mount();
    resetApi();
    const trace: unknown[] = [];
    const view = () => (
      <BackScope route={{ name: "Home" } as never} navigation={navigation as never}>
        <SeasonsSheetRedesign
          gate={GATE as never}
          title={TITLE as never}
          focus={props.focus}
          onAnswer={(_t, outcome, seasons) => note({ answer: outcome, seasons })}
          onClose={() => note({ closed: true })}
        />
      </BackScope>
    );
    for (const [label, fn] of steps) {
      fn(bench);
      bench.render(view());
      await act(async () => {
        for (let i = 0; i < 5; i++) await Promise.resolve();
      });
      bench.render(view());
      trace.push({ step: label, ...snap(), events: take() });
    }
    bench.unmount();
    out[name] = trace;
  };
  const focus = (b: ReturnType<typeof mount>, key: string) => b.run(() => (hosts.get(`key:${key}`) as { binding?: Binding } | undefined)?.binding?.onFocus?.());
  const blur = (b: ReturnType<typeof mount>, key: string) => b.run(() => (hosts.get(`key:${key}`) as { binding?: Binding } | undefined)?.binding?.onBlur?.());
  const sheet = () => hosts.get("seasons") as Record<string, ((n?: number) => void) | undefined> | undefined;
  const tv = (b: ReturnType<typeof mount>, event: Record<string, unknown>) => b.run(() => emitTv(event));
  const answered = () => {
    api.seasonsAnswer = ANSWER;
  };

  await scenario("saisons sues, cocher, Lecture/Pause demande ce qui est coché", {}, [
    ["saisons en route", () => {}],
    ["Lecture/Pause avant la présentation", (b) => tv(b, { eventType: "playPause", eventKeyAction: 1 })],
    ["saisons sues", answered],
    ["premier focus sur l'entrée", (b) => focus(b, "sheet:season:1")],
    ["focus sur la saison 2", (b) => { blur(b, "sheet:season:1"); focus(b, "sheet:season:2"); }],
    ["coche la 3", (b) => b.run(() => sheet()?.onToggle?.(3))],
    ["Lecture/Pause maintenu : rien", (b) => { tv(b, { eventType: "longPlayPause", eventKeyAction: 0 }); tv(b, { eventType: "longPlayPause", eventKeyAction: 1 }); }],
    ["Lecture/Pause", (b) => tv(b, { eventType: "playPause", eventKeyAction: 1 })],
  ]);
  await scenario("rien de coché : la saison focalisée ; « Toutes »", { focus: 2 }, [
    ["saisons sues, entrée sur la 2", answered],
    ["focus sur « Toutes »", (b) => { focus(b, "sheet:season:2"); blur(b, "sheet:season:2"); focus(b, "sheet:season:all"); }],
    ["OK sur « Toutes »", (b) => b.run(() => sheet()?.onToggleAll?.())],
    ["OK de nouveau", (b) => b.run(() => sheet()?.onToggleAll?.())],
    ["Lecture/Pause sur « Toutes »", (b) => tv(b, { eventType: "playPause", eventKeyAction: 1 })],
  ]);
  await scenario("Menu dans la feuille", {}, [
    ["saisons sues", answered],
    ["Menu (Modal)", (b) => b.run(() => (hosts.get("fading") as { onRequestClose?: () => void } | undefined)?.onRequestClose?.())],
  ]);
  await scenario("fermée avant d'avoir paru", {}, [
    ["saisons en route", () => {}],
    ["Menu par la portée", (b) => b.run(() => (hosts.get("TVMenuPressInterceptor") as { onMenuPress?: () => void } | undefined)?.onMenuPress?.())],
  ]);
  await scenario("filet : les saisons tardent", {}, [
    ["saisons en route", () => {}],
    ["1 499 ms", (b) => b.advance(1499)],
    ["1 500 ms", (b) => b.advance(1)],
  ]);
  await scenario("la pilule demande les saisons cochées", {}, [
    ["saisons sues", answered],
    ["coche 2 et 1", (b) => b.run(() => { sheet()?.onToggle?.(2); })],
    ["coche 1", (b) => b.run(() => sheet()?.onToggle?.(1))],
    ["Demander", (b) => b.run(() => sheet()?.onSubmit?.())],
  ]);
  return out;
}
