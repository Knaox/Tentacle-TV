import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { INITIAL_REVIVAL, revivalReducer, type RevivalEvent, type RevivalState } from "./webViewRevival";

const play = (...events: RevivalEvent[]): RevivalState => events.reduce(revivalReducer, INITIAL_REVIVAL);

describe("la page d'une extension qui perd son processus", () => {
  it("affichée puis reprise cachée (iOS en arrière-plan) : elle attend, puis renaît au retour", () => {
    const lost = play({ type: "ready" }, { type: "lost", visible: false });
    expect(lost).toMatchObject({ lost: true, crashed: false, generation: 0 });
    // Tant qu'elle n'est pas revue, rien ne se recharge.
    expect(revivalReducer(lost, { type: "lost", visible: false })).toBe(lost);
    expect(revivalReducer(lost, { type: "shown" })).toEqual({ generation: 1, ready: false, lost: false, crashed: false });
  });

  it("affichée puis perdue sous les yeux : elle renaît aussitôt revue", () => {
    expect(play({ type: "ready" }, { type: "lost", visible: true }, { type: "shown" }))
      .toMatchObject({ generation: 1, lost: false, crashed: false });
  });

  it("perdue avant de s'afficher, sous les yeux : un plantage, pas de relance en boucle", () => {
    const crashed = play({ type: "lost", visible: true });
    expect(crashed).toMatchObject({ crashed: true, lost: false, generation: 0 });
    expect(revivalReducer(crashed, { type: "shown" })).toBe(crashed);
    expect(revivalReducer(crashed, { type: "retry" })).toEqual({ generation: 1, ready: false, lost: false, crashed: false });
  });

  it("renée puis reperdue avant de s'afficher, sous les yeux : on le dit", () => {
    expect(play({ type: "ready" }, { type: "lost", visible: false }, { type: "shown" }, { type: "lost", visible: true }))
      .toMatchObject({ crashed: true, generation: 1 });
  });

  it("perdue cachée pendant son chargement : elle renaît au retour", () => {
    expect(play({ type: "lost", visible: false }, { type: "shown" })).toMatchObject({ generation: 1, crashed: false });
  });
});

/** Garde-fou : toute WebView d'extension répond à la perte de son processus, iOS et Android. */
describe("les WebViews d'extension", () => {
  const ROOT = join(__dirname, "..");
  const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });

  it("gèrent onContentProcessDidTerminate (iOS) et onRenderProcessGone (Android)", () => {
    const hosts = files(ROOT).filter((file) => readFileSync(file, "utf8").includes("<WebViewComponent"));
    expect(hosts.length).toBeGreaterThan(0);
    const missing = hosts.flatMap((file) => {
      const code = readFileSync(file, "utf8");
      return ["onContentProcessDidTerminate=", "onRenderProcessGone="]
        .filter((prop) => !code.includes(prop))
        .map((prop) => `${relative(ROOT, file)} : ${prop}`);
    });
    expect(missing).toEqual([]);
  });
});
