import { expect } from "vitest";
import { check, feature } from "../harness";
import { waitUntil } from "../jellyfinHttp";
import { backendApi, ctx } from "./support";

feature("search.catalog", () => {
  check("recherche Tentacle d'un titre de la bibliothèque", async () => {
    let names: string[] = [];
    // L'index se construit une vingtaine de secondes après le démarrage du serveur.
    await waitUntil(async () => {
      const res = await backendApi(`/api/search?q=${encodeURIComponent("sintel")}`, ctx().user.token);
      if (!res.ok) return false;
      const text = await res.text();
      names = [...text.matchAll(/"Name"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
      return names.includes("Sintel");
    }, 90_000, "Sintel trouvé par la recherche", 3000);
    expect(names).toContain("Sintel");
  }, { timeoutMs: 120_000 });

  check("recherche d'épisodes par titre", async () => {
    const res = await backendApi(`/api/search/episodes?q=${encodeURIComponent("Breaking")}`, ctx().user.token);
    expect(res.ok).toBe(true);
  });
});
