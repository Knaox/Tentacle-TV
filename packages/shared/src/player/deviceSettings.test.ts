import { describe, expect, it } from "vitest";
import {
  DEVICE_SETTING_KEYS,
  createBooleanStore,
  DEVICE_SETTING_DEFAULT,
  type DeviceStorage,
} from "./deviceSettings";

/**
 * Les clés et le défaut, tenus par un banc.
 *
 * Ce ne sont pas des détails d'implémentation : cinq cibles écrivent et
 * relisent ces chaînes-là, et le défaut est porté par une COMPARAISON, pas par
 * une valeur stockée. Renommer une clé déconnecterait silencieusement les
 * appareils déjà réglés ; rétablir `=== "true"` éteindrait les trois réglages
 * pour tout le monde sans qu'aucun type ne bronche.
 */

function fakeStorage(initial: Record<string, string> = {}) {
  const content = { ...initial };
  const adapter: DeviceStorage = {
    getItem: (key) => (key in content ? content[key] : null),
    setItem: (key, value) => {
      content[key] = value;
    },
  };
  return { content, adapter };
}

describe("les clés de stockage", () => {
  it("sont celles que les cinq cibles se partagent", () => {
    expect(DEVICE_SETTING_KEYS).toEqual({
      autoSkipIntro: "tentacle_auto_skip_intro",
      upNextCard: "tentacle_up_next_card",
      upNextCountdown: "tentacle_up_next_countdown",
    });
  });

  it("sont toutes distinctes", () => {
    const values = Object.values(DEVICE_SETTING_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("le magasin booléen", () => {
  it("part du défaut quand rien n'a été choisi", () => {
    expect(DEVICE_SETTING_DEFAULT).toBe(true);
    for (const key of Object.values(DEVICE_SETTING_KEYS)) {
      expect(createBooleanStore(fakeStorage().adapter, key).readSnapshot()).toBe(true);
    }
  });

  it("n'est éteint que par un refus EXPLICITE", () => {
    const key = DEVICE_SETTING_KEYS.upNextCard;
    for (const [raw, expected] of [
      ["false", false],
      ["true", true],
      ["", true],
      ["0", true],
      ["oui", true],
    ] as const) {
      const { adapter } = fakeStorage({ [key]: raw });
      expect(createBooleanStore(adapter, key).readSnapshot()).toBe(expected);
    }
  });

  it("respecte un défaut à faux quand on le demande", () => {
    const key = DEVICE_SETTING_KEYS.upNextCountdown;
    expect(createBooleanStore(fakeStorage().adapter, key, false).readSnapshot()).toBe(false);
    const { adapter } = fakeStorage({ [key]: "true" });
    expect(createBooleanStore(adapter, key, false).readSnapshot()).toBe(true);
  });

  it("écrit le choix et prévient ses auditeurs", () => {
    const key = DEVICE_SETTING_KEYS.upNextCountdown;
    const { content, adapter } = fakeStorage();
    const store = createBooleanStore(adapter, key);
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });

    store.set(true); // déjà le défaut → rien à annoncer
    expect(calls).toBe(0);
    expect(content[key]).toBeUndefined();

    store.set(false);
    expect(calls).toBe(1);
    expect(content[key]).toBe("false");
    expect(store.readSnapshot()).toBe(false);

    unsubscribe();
    store.set(true);
    expect(calls).toBe(1);
  });

  it("survit à un stockage qui lève", () => {
    const broken: DeviceStorage = {
      getItem: () => {
        throw new Error("indisponible");
      },
      setItem: () => {
        throw new Error("indisponible");
      },
    };
    const store = createBooleanStore(broken, DEVICE_SETTING_KEYS.upNextCard);
    expect(store.readSnapshot()).toBe(true);
    store.set(false); // ne doit pas jeter
    expect(store.readSnapshot()).toBe(false); // vaut pour la session
  });
});
