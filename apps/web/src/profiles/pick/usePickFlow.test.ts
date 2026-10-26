/**
 * Changer de profil (« Qui écoute ? » d'Octave, « Qui regarde ? ») : le
 * crochet monté pour de vrai (React, sans DOM, conteneur factice). Un profil
 * qui a un code PIN ouvre le pavé et RIEN ne part avant le quatrième chiffre ;
 * c'est le serveur qui reçoit le code (jamais comparé ici). Un profil sans
 * code s'ouvre tout de suite.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PickedProfileDto, PickerProfileDto } from "@tentacle-tv/shared";
import type { PickFlow } from "./usePickFlow";

const h = vi.hoisted(() => ({
  pick: vi.fn(async (_id: string, _code: string | undefined, _device: string) => ({ token: "t" }) as unknown as PickedProfileDto),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr-FR" } }) }));
vi.mock("../api/pickerGateway", () => ({ pickProfile: h.pick }));
vi.mock("../../auth/profileEnded", () => ({ beginProfileSwitch: () => undefined, cancelProfileSwitch: () => undefined }));

const { usePickFlow } = await import("./usePickFlow");

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = () => ({
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
});

function profile(userId: string, hasPin: boolean): PickerProfileDto {
  return { userId, kind: "member", name: userId, color: "pink", hasPin, imageTag: null, lockedUntil: null, createdBy: null, personal: false };
}

const PROFILES = [profile("lea", true), profile("sam", false)];
let flow: PickFlow;
let root: Root | null = null;
const onPicked = vi.fn(async () => undefined);

function Rig() {
  flow = usePickFlow({ profiles: PROFILES, deviceName: "Mac", onPicked, onStale: () => undefined, onAccountLost: () => undefined });
  return null;
}

beforeEach(async () => {
  h.pick.mockClear();
  onPicked.mockClear();
  root = createRoot(container() as never);
  await act(async () => root!.render(createElement(Rig)));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
});

describe("changer de profil", () => {
  it("un profil qui a un code : le pavé, et rien au serveur avant le quatrième chiffre", async () => {
    await act(async () => flow.choose("lea"));
    expect(flow.pin?.profile.userId).toBe("lea");
    for (const d of ["1", "2", "3"]) await act(async () => flow.digit(d));
    expect(h.pick).not.toHaveBeenCalled();
    await act(async () => flow.digit("4"));
    expect(h.pick).toHaveBeenCalledWith("lea", "1234", "Mac");
    expect(onPicked).toHaveBeenCalledTimes(1);
  });

  it("un profil sans code : il s'ouvre tout de suite, sans pavé", async () => {
    await act(async () => flow.choose("sam"));
    expect(flow.pin).toBeNull();
    expect(h.pick).toHaveBeenCalledWith("sam", undefined, "Mac");
  });
});
