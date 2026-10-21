/**
 * Les gestes de chaque scénario du banc GPU, rejoués par CDP (événements de
 * souris de Chromium : `:hover` et `:active` réagissent comme à la main).
 * `setup(physics)` pose la passe, `start()` lance le geste et rend de quoi
 * l'arrêter.
 */

const FRAME_MS = 16;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function scenarioDriver(scenario, send, evaluate) {
  const mouse = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, button: "none", ...extra });
  let target = { x: 0, y: 0, w: 0, h: 0 };

  const prepare = async (physics, { reduce = false, selector = ".bench-glass" } = {}) => {
    const html = "document.documentElement";
    await evaluate(reduce ? `${html}.setAttribute("data-lg-motion", "reduce")` : `${html}.removeAttribute("data-lg-motion")`);
    await evaluate(`window.__bench.set({ physics: ${physics}, fused: false })`);
    await sleep(300);
    const r = (await evaluate(`JSON.stringify(document.querySelector("${selector}").getBoundingClientRect())`)).result.result.value;
    const rect = JSON.parse(r);
    target = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, w: rect.width, h: rect.height };
    await mouse("mouseMoved", 4, 4);
  };

  const loop = (everyMs, step) => {
    let running = true;
    let i = 0;
    const done = (async () => {
      while (running) {
        await step(i);
        i += 1;
        await sleep(everyMs);
      }
    })();
    return async () => {
      running = false;
      await done;
    };
  };

  const idle = () => async () => undefined;

  switch (scenario) {
    case "idle":
      return { setup: (p) => prepare(p), start: idle };
    case "hoverStill":
      return {
        setup: async (p) => {
          await prepare(p);
          await mouse("mouseMoved", target.x, target.y);
        },
        start: idle,
      };
    case "pointerSweep":
    case "reducedSweep":
    case "sheenSweep":
      return {
        setup: (p) =>
          prepare(p, {
            reduce: scenario === "reducedSweep",
            selector: scenario === "sheenSweep" ? ".bench-sheen" : ".bench-glass",
          }),
        start: () =>
          loop(FRAME_MS, (i) => {
            const t = (i * FRAME_MS) / 1000;
            return mouse("mouseMoved", target.x + Math.sin(t * 2.1) * target.w * 0.45, target.y + Math.sin(t * 3.3) * target.h * 0.4);
          }),
      };
    case "pressPulse":
      return {
        setup: async (p) => {
          await prepare(p);
          await mouse("mouseMoved", target.x, target.y);
        },
        start: () =>
          loop(200, (i) =>
            mouse(i % 2 === 0 ? "mousePressed" : "mouseReleased", target.x, target.y, { button: "left", clickCount: 1 }),
          ),
      };
    case "fusion":
      return {
        setup: (p) => prepare(p),
        start: () => loop(700, (i) => evaluate(`window.__bench.set({ fused: ${i % 2 === 0} })`)),
      };
    default:
      throw new Error(`scénario inconnu : ${scenario}`);
  }
}
