// La pilule « Passer l'intro » et le pavé (retour d'essai, Apple TV 1.10.1) :
// OK sur la pilule lançait une recherche dans la vidéo, ou ouvrait la barre
// de lecture — le doigt qui se pose puis s'enfonce glisse toujours un peu.
// Vérifié par assertions : la référence (`84f3cedd0`) avait le défaut, aucune
// trace ne peut le dire (`trace.test.ts` garde, lui, les 33 autres gestes).
import { describe, expect, it } from "vitest";
import { run, type Step } from "./driver";
import type { Entry } from "./rig";

const W = (ms: number): Step => ({ wait: ms });
const HIDE = W(5600);
const skip = (auto: boolean) => ({
  kind: "skip", auto, dismissible: true, labelKey: "skipIntro", countdownSeconds: auto ? 8 : null,
  action: { kind: "seek", toSeconds: 1290 }, segmentType: "Intro",
}) as never;

/** Le doigt glisse de `from` à `to` en `ms`, par pas de 16 ms (sans se lever). */
function glide(from: number, to: number, ms: number): Step[] {
  const steps: Step[] = [];
  const n = Math.max(1, Math.round(ms / 16));
  const vx = (Math.abs(to - from) / ms) * 1000;
  for (let i = 1; i <= n; i++) steps.push(W(16), { pan: "Changed", x: Math.round(from + ((to - from) * i) / n), vx });
  return steps;
}

/** Un clic « réel » : le doigt se pose, dérive 700 ms, glisse de 120 points en
 *  s'enfonçant, OK (le press du bouton focalisé et le « select » global),
 *  puis glisse encore de 200 points avant de se lever. */
const sloppyClick = (button: string | null): Step[] => [
  { pan: "Began", x: 0, vx: 0 },
  ...glide(0, 20, 700),
  ...glide(20, 140, 150),
  ...(button ? [{ button, twin: "after" } as Step] : [{ key: "select", a: 1 } as Step]),
  ...glide(140, 340, 300),
  { pan: "Ended", x: 340, vx: 0 },
];

const scrubbed = (entries: Entry[]) => entries.some((e) => e.ev === "state" && (e.v as { scrub?: boolean }).scrub === true);
const logged = (entries: Entry[], ev: string) => entries.some((e) => e.ev === ev);

describe.runIf(process.env.TRACE_PLATFORM !== "androidtv")("pilule de saut : un clic n'est pas un glisser", () => {
  it("témoin, sans pilule : le même geste SANS clic défile (le banc voit le glisser)", async () => {
    const entries = await run({ id: "pill-witness", title: "", steps: [HIDE, { pan: "Began", x: 0, vx: 0 }, ...glide(0, 20, 700), ...glide(20, 340, 450), { pan: "Ended", x: 340, vx: 0 }, W(500)] });
    expect(scrubbed(entries)).toBe(true);
  });

  it("habillage caché, « Passer » focalisé : OK passe l'intro, rien ne défile", async () => {
    const entries = await run({ id: "pill-hidden", title: "", env: { overlay: skip(false) }, steps: [HIDE, ...sloppyClick("onSkip"), W(1000)] });
    expect(logged(entries, "skipSegment")).toBe(true);
    expect(scrubbed(entries)).toBe(false);
    expect(logged(entries, "scrubPause")).toBe(false);
  });

  it("pilule automatique (« Masquer » focalisé) : OK la met en sourdine, rien ne défile", async () => {
    const entries = await run({ id: "pill-auto", title: "", env: { overlay: skip(true) }, steps: [HIDE, ...sloppyClick("onDismissSkip"), W(1000)] });
    expect(logged(entries, "dismissSegment")).toBe(true);
    expect(scrubbed(entries)).toBe(false);
  });

  it("habillage affiché, la pilule garde le focus : rien ne défile non plus", async () => {
    const entries = await run({ id: "pill-shown", title: "", env: { overlay: skip(false) }, steps: [W(500), ...sloppyClick("onSkip"), W(1000)] });
    expect(logged(entries, "skipSegment")).toBe(true);
    expect(scrubbed(entries)).toBe(false);
  });

  it("le passage passé, la pilule partie, le même doigt qui glisse encore ne défile pas", async () => {
    const entries = await run({
      id: "pill-after", title: "", env: { overlay: skip(false) },
      steps: [HIDE, { pan: "Began", x: 0, vx: 0 }, ...glide(0, 20, 300), { button: "onSkip", twin: "after" },
        { patch: { overlay: { kind: "none" } as never } }, ...glide(20, 420, 500), { pan: "Ended", x: 420, vx: 0 }, W(1000)],
    });
    expect(logged(entries, "skipSegment")).toBe(true);
    expect(scrubbed(entries)).toBe(false);
  });

  it("une fois le doigt levé, un vrai glisser défile de nouveau", async () => {
    const entries = await run({
      id: "pill-then-drag", title: "", env: { overlay: skip(false) },
      steps: [HIDE, ...sloppyClick("onSkip"), { patch: { overlay: { kind: "none" } as never } }, W(1500),
        { pan: "Began", x: 0, vx: 0 }, ...glide(0, 400, 600), { pan: "Ended", x: 400, vx: 0 }, W(500)],
    });
    expect(scrubbed(entries)).toBe(true);
  });
});
