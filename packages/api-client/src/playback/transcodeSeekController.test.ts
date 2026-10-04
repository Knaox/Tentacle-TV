import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEEK_SETTLE_MS, SEEK_SLOW_HINT_MS, SEEK_TIMEOUT_MS } from "@tentacle-tv/shared";
import { createTranscodeSeekController, type TranscodeSeekState } from "./transcodeSeekController";

function setup(over: { transcoding?: boolean; position?: number } = {}) {
  const applied: number[] = [];
  const states: TranscodeSeekState[] = [];
  let position = over.position ?? 100;
  const controller = createTranscodeSeekController({
    transcoding: () => over.transcoding ?? true,
    duration: () => 3600,
    position: () => position,
    apply: (target) => applied.push(target),
    onChange: (state) => states.push(state),
    now: () => Date.now(),
  });
  return { controller, applied, states, setPosition: (p: number) => { position = p; } };
}

describe("createTranscodeSeekController", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("cinq « +30 s » rapides : UN seul déplacement du moteur, de 2 min 30", () => {
    const { controller, applied } = setup();
    for (let i = 0; i < 5; i += 1) {
      controller.request({ by: 30 });
      vi.advanceTimersByTime(200);
    }
    expect(applied).toEqual([]);
    vi.advanceTimersByTime(SEEK_SETTLE_MS);
    expect(applied).toEqual([250]);
  });

  it("dit l'attente dès le premier appui, la phrase après 5 s, l'échec au délai", () => {
    const { controller } = setup();
    controller.request({ to: 900 });
    expect(controller.state()).toEqual({ target: 900, phase: "loading" });
    vi.advanceTimersByTime(SEEK_SLOW_HINT_MS);
    expect(controller.state().phase).toBe("slow");
    vi.advanceTimersByTime(SEEK_TIMEOUT_MS - SEEK_SLOW_HINT_MS);
    expect(controller.state().phase).toBe("failed");
  });

  it("un écart pendant l'attente part de la cible appliquée, pas de l'ancienne position", () => {
    const { controller, applied } = setup({ position: 100 });
    controller.request({ by: 30 });
    vi.advanceTimersByTime(SEEK_SETTLE_MS);
    controller.request({ by: 30 });
    vi.advanceTimersByTime(SEEK_SETTLE_MS);
    expect(applied).toEqual([130, 160]);
  });

  it("s'éteint quand la vidéo avance au passage visé — jamais sur l'ancienne position", () => {
    const { controller } = setup({ position: 100 });
    controller.request({ to: 900 });
    vi.advanceTimersByTime(SEEK_SETTLE_MS);
    controller.observe(100.5, false);
    controller.observe(101, false);
    expect(controller.state().phase).toBe("loading");
    controller.observe(900.2, true);
    controller.observe(900.6, false);
    expect(controller.state()).toEqual({ target: null, phase: "idle" });
  });

  it("ne conclut pas avant d'avoir déplacé le moteur", () => {
    const { controller } = setup();
    controller.request({ to: 900 });
    controller.landed();
    expect(controller.state().phase).toBe("loading");
    vi.advanceTimersByTime(SEEK_SETTLE_MS);
    controller.landed();
    expect(controller.state().phase).toBe("idle");
  });

  it("une position choisie à la barre part tout de suite, mais rejoint des appuis en attente", () => {
    const { controller, applied } = setup({ position: 100 });
    controller.request({ to: 900 }, { immediate: true });
    expect(applied).toEqual([900]);
    expect(controller.state()).toEqual({ target: 900, phase: "loading" });
    controller.request({ by: 30 });
    controller.request({ to: 1200 }, { immediate: true });
    expect(applied).toEqual([900]);
    vi.advanceTimersByTime(SEEK_SETTLE_MS);
    expect(applied).toEqual([900, 1200]);
  });

  it("hors transcodage, le saut part tout de suite, sans attente dite", () => {
    const { controller, applied, states } = setup({ transcoding: false, position: 100 });
    controller.request({ by: -10 });
    controller.request({ to: 4000 });
    expect(applied).toEqual([90, 3600]);
    expect(states).toEqual([]);
  });

  it("reset éteint tout, minuteurs compris", () => {
    const { controller, applied } = setup();
    controller.request({ to: 900 });
    controller.reset();
    vi.advanceTimersByTime(SEEK_TIMEOUT_MS);
    expect(applied).toEqual([]);
    expect(controller.state()).toEqual({ target: null, phase: "idle" });
  });
});
