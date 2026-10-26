import { describe, expect, it } from "vitest";
import { latestWinsQueue } from "./useMusicListOrder";

describe("envois de l'ordre d'une liste", () => {
  it("un à la fois ; pendant l'envoi, seul le dernier demandé part ensuite", async () => {
    const send = latestWinsQueue();
    const sent: string[] = [];
    let release!: () => void;
    const first = new Promise<void>((r) => (release = r));
    const done = send("p", async () => {
      sent.push("1");
      await first;
    });
    void send("p", async () => sent.push("2"));
    void send("p", async () => sent.push("3"));
    release();
    await done;
    expect(sent).toEqual(["1", "3"]);
  });

  it("un échec ne bloque pas l'envoi suivant ; deux listes ne s'attendent pas", async () => {
    const send = latestWinsQueue();
    const sent: string[] = [];
    await send("a", async () => {
      throw new Error("503");
    });
    await Promise.all([send("a", async () => sent.push("a2")), send("b", async () => sent.push("b1"))]);
    expect(sent.sort()).toEqual(["a2", "b1"]);
  });
});
