import { describe, expect, it } from "vitest";
import { clearLocalCache } from "./clearLocalCache";

/** Un stockage indexé comme `localStorage` (ordre d'insertion). */
function storage(initial: Record<string, string>) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

describe("vider le cache de l'appareil", () => {
  it("garde la session active, le serveur et la langue ; le reste part", () => {
    const store = storage({
      tentacle_server_url: "https://tentacle.example",
      tentacle_token: "jeton-perso",
      tentacle_user: "{\"Id\":\"owner\"}",
      i18nextLng: "fr",
      tentacle_query_cache_v1: "{}",
      tentacle_theme_mode: "dark",
    });
    clearLocalCache(store);
    expect(Object.keys(store.dump()).sort()).toEqual(["i18nextLng", "tentacle_server_url", "tentacle_token", "tentacle_user"]);
  });

  it("pendant le profil d'un autre (bureau) : la marque du profil et la réserve du compte restent avec son jeton", () => {
    const store = storage({
      tentacle_token: "jeton-lea",
      tentacle_user: "{\"Id\":\"lea\"}",
      tentacle_profile_session: "{\"id\":\"lea\",\"name\":\"Léa\",\"kind\":\"guest\",\"color\":\"pink\"}",
      tentacle_account_session: "{\"token\":\"jeton-perso\",\"user\":\"{}\"}",
      tentacle_profile_launch: "{}",
    });
    clearLocalCache(store);
    expect(store.dump()).toMatchObject({
      tentacle_token: "jeton-lea",
      tentacle_profile_session: expect.any(String),
      tentacle_account_session: expect.any(String),
    });
    expect(store.dump().tentacle_profile_launch).toBeUndefined();
  });
});
