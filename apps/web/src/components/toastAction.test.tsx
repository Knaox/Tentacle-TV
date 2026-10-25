import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Le verre et le compte à rebours ont leurs propres tests : ici, des doublures neutres.
vi.mock("./ui/glass/useGlassControl", () => ({ useGlassControl: () => ({ ref: () => undefined, props: { style: {} }, layers: null }) }));
// framer-motion hors navigateur : une simple <div> (le mouvement n'est pas le sujet).
vi.mock("framer-motion", () => ({
  motion: { div: ({ children, initial: _i, animate: _a, exit: _e, transition: _t, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) => <div {...rest}>{children}</div> },
  useReducedMotion: () => false,
}));
const countdown = vi.fn((_ms: number) => ({ running: true }));
vi.mock("./session/useMessageCountdown", () => ({ useMessageCountdown: (ms: number) => countdown(ms) }));

const { Toast } = await import("./Toast");

/** Un avis peut porter UN geste à côté de son message (« Ajouté à Soirée — Changer », 25/10). */
describe("avis avec action", () => {
  it("le geste paraît, en bouton, à côté du message", () => {
    const html = renderToStaticMarkup(<Toast id={1} type="success" message="Ajouté à « Soirée »" action={{ label: "Changer", onPress: () => undefined }} onDismiss={() => undefined} />);
    expect(html).toContain("Ajouté à « Soirée »");
    expect(html).toMatch(/<button type="button"[^>]*>Changer<\/button>/);
  });
  it("sans action : le message seul, comme avant", () => {
    const html = renderToStaticMarkup(<Toast id={2} type="info" message="Bonjour" onDismiss={() => undefined} />);
    expect(html).not.toContain("<button");
  });
  it("un avis qui porte « Annuler » reste plus longtemps (le temps du geste)", () => {
    countdown.mockClear();
    renderToStaticMarkup(<Toast id={3} type="success" message="Retiré" action={{ label: "Annuler", onPress: () => undefined }} onDismiss={() => undefined} />);
    renderToStaticMarkup(<Toast id={4} type="success" message="Ajouté" onDismiss={() => undefined} />);
    expect(countdown.mock.calls.map((c) => c[0])).toEqual([7000, 4000]);
  });
});
