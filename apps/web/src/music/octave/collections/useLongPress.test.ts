import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LONG_PRESS_MS, useLongPress } from "./useLongPress";

// Le crochet sans React : ses refs et son effet, remplacés par des valeurs simples.
vi.mock("react", () => ({ useRef: (v: unknown) => ({ current: v }), useCallback: (f: unknown) => f, useEffect: () => undefined }));

const down = (x = 0, y = 0) => ({ button: 0, isPrimary: true, clientX: x, clientY: y, pointerId: 1 }) as never;
const move = (x: number, y: number) => ({ clientX: x, clientY: y, pointerId: 1 }) as never;
const click = () => ({ preventDefault: vi.fn(), stopPropagation: vi.fn() });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("appui long", () => {
  it("500 ms immobile : le menu s'ouvre au point, et le clic qui suit n'ouvre pas la carte", () => {
    const open = vi.fn();
    const h = useLongPress(open);
    h.onPointerDown(down(10, 20));
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(open).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(open).toHaveBeenCalledWith({ x: 10, y: 20 });
    const c = click();
    h.onClickCapture(c as never);
    expect(c.preventDefault).toHaveBeenCalled();
    const next = click();
    h.onClickCapture(next as never);
    expect(next.preventDefault).not.toHaveBeenCalled();
  });
  it("un glisser au-delà de 8 px, ou un lâcher avant, l'annule ; un clic ordinaire passe", () => {
    const open = vi.fn();
    const h = useLongPress(open);
    h.onPointerDown(down());
    h.onPointerMove(move(9, 0));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    h.onPointerDown(down());
    h.onPointerUp();
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(open).not.toHaveBeenCalled();
    const c = click();
    h.onClickCapture(c as never);
    expect(c.preventDefault).not.toHaveBeenCalled();
  });
});
