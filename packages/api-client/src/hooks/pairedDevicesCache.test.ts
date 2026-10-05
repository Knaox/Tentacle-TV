import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  MY_PAIRED_DEVICES_KEY, PAIRED_DEVICES_KEY, forgetPairedDevice, isAlreadyRevoked, withoutPairedDevice,
} from "./pairedDevicesCache";

const salon = { id: "salon", name: "Shield" };
const chambre = { id: "chambre", name: "Apple TV" };

describe("withoutPairedDevice", () => {
  it("retire l'appareil déjumelé", () => {
    expect(withoutPairedDevice([salon, chambre], "salon")).toEqual([chambre]);
  });

  it("rend la même liste quand l'appareil n'y est pas, et rien sans liste", () => {
    const list = [chambre];
    expect(withoutPairedDevice(list, "salon")).toBe(list);
    expect(withoutPairedDevice(undefined, "salon")).toBeUndefined();
  });
});

describe("forgetPairedDevice — la TV déjumelée quitte les listes à l'instant", () => {
  it("retire la ligne de la liste du compte ET de celle de l'admin", () => {
    const qc = new QueryClient();
    qc.setQueryData(MY_PAIRED_DEVICES_KEY, [salon, chambre]);
    qc.setQueryData(PAIRED_DEVICES_KEY, [salon, chambre]);
    forgetPairedDevice(qc, "salon");
    expect(qc.getQueryData(MY_PAIRED_DEVICES_KEY)).toEqual([chambre]);
    expect(qc.getQueryData(PAIRED_DEVICES_KEY)).toEqual([chambre]);
  });

  it("ne crée pas une liste qui n'a jamais été lue", () => {
    const qc = new QueryClient();
    forgetPairedDevice(qc, "salon");
    expect(qc.getQueryData(PAIRED_DEVICES_KEY)).toBeUndefined();
  });
});

describe("isAlreadyRevoked", () => {
  it("un 404 dit « déjà révoqué », pas une autre panne", () => {
    expect(isAlreadyRevoked(Object.assign(new Error("Appareil introuvable"), { status: 404 }))).toBe(true);
    expect(isAlreadyRevoked(Object.assign(new Error("boom"), { status: 500 }))).toBe(false);
    expect(isAlreadyRevoked(new Error("réseau"))).toBe(false);
  });
});
