import { describe, expect, it } from "vitest";
import { createExtractionSlots, type ExtractionPriority } from "./extractionSlots";

/** Une tâche qu'on termine à la main, et l'ordre dans lequel les tâches ont démarré. */
function harness(max = 2, maxPreviews = 1) {
  const slots = createExtractionSlots(max, maxPreviews);
  const started: string[] = [];
  const finish = new Map<string, () => void>();
  const launch = (name: string, priority: ExtractionPriority) =>
    slots.run(priority, () => {
      started.push(name);
      return new Promise<string>((resolve) => finish.set(name, () => resolve(name)));
    });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { slots, started, finish, launch, settle };
}

describe("places d'extraction", () => {
  it("deux à la fois au plus, la suivante dès qu'une place se libère", async () => {
    const { started, finish, launch, settle } = harness();
    const runs = [launch("a", "play"), launch("b", "play"), launch("c", "play")];
    await settle();
    expect(started).toEqual(["a", "b"]);
    finish.get("a")!();
    await settle();
    expect(started).toEqual(["a", "b", "c"]);
    finish.get("b")!();
    finish.get("c")!();
    expect(await Promise.all(runs)).toEqual(["a", "b", "c"]);
  });

  it("un aperçu n'occupe jamais plus d'une place : une lecture en garde toujours une", async () => {
    const { slots, started, finish, launch, settle } = harness();
    void launch("p1", "preview");
    void launch("p2", "preview");
    await settle();
    expect(started).toEqual(["p1"]);
    expect(slots.state()).toEqual({ running: 1, previews: 1, waiting: { play: 0, preview: 1 } });
    void launch("tv", "play");
    await settle();
    expect(started).toEqual(["p1", "tv"]);
    finish.get("p1")!();
    await settle();
    expect(started).toEqual(["p1", "tv", "p2"]);
  });

  it("une lecture qui attend passe devant les aperçus arrivés avant elle", async () => {
    const { started, finish, launch, settle } = harness();
    void launch("tv1", "play");
    void launch("tv2", "play");
    void launch("p1", "preview");
    void launch("tv3", "play");
    await settle();
    expect(started).toEqual(["tv1", "tv2"]);
    finish.get("tv1")!();
    await settle();
    expect(started).toEqual(["tv1", "tv2", "tv3"]);
    finish.get("tv2")!();
    await settle();
    expect(started).toEqual(["tv1", "tv2", "tv3", "p1"]);
  });

  it("une tâche en échec rend sa place", async () => {
    const slots = createExtractionSlots(1, 1);
    await expect(slots.run("preview", () => Promise.reject(new Error("yt-dlp")))).rejects.toThrow("yt-dlp");
    expect(slots.state().running).toBe(0);
    expect(await slots.run("play", async () => "ok")).toBe("ok");
  });
});
