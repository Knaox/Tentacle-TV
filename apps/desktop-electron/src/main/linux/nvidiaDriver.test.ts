import { describe, expect, it } from "vitest";
import { detectNvidiaDriver, NVIDIA_DRIVER_WITNESS } from "./nvidiaDriver";

describe("le pilote NVIDIA", () => {
  it("se reconnaît au témoin de son module noyau", () => {
    expect(detectNvidiaDriver((p) => p === NVIDIA_DRIVER_WITNESS)).toBe(true);
    expect(detectNvidiaDriver(() => false)).toBe(false);
  });

  it("un témoin illisible ne fait pas échouer la lecture", () => {
    expect(
      detectNvidiaDriver(() => {
        throw new Error("EACCES");
      }),
    ).toBe(false);
  });
});
