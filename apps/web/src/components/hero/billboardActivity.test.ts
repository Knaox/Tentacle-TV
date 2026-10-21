import { describe, expect, it } from "vitest";
import { billboardActivity } from "./billboardActivity";

const base = { near: true, onScreen: true, idle: false, dataSaver: false };

describe("billboardActivity", () => {
  it("à l'écran : le halo est monté, la rotation tourne", () => {
    expect(billboardActivity(base)).toEqual({ haloMounted: true, rotating: true });
  });

  it("sortie de l'écran mais dans la marge : halo gardé, rotation ARRÊTÉE", () => {
    expect(billboardActivity({ ...base, onScreen: false })).toEqual({ haloMounted: true, rotating: false });
  });

  it("loin de l'écran : ni halo, ni rotation", () => {
    expect(billboardActivity({ ...base, near: false, onScreen: false })).toEqual({ haloMounted: false, rotating: false });
  });

  it("inactivité ou mode économie : la rotation s'arrête, le halo reste", () => {
    expect(billboardActivity({ ...base, idle: true }).rotating).toBe(false);
    expect(billboardActivity({ ...base, dataSaver: true }).rotating).toBe(false);
    expect(billboardActivity({ ...base, idle: true }).haloMounted).toBe(true);
  });
});
