import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { retryFailedQueries } from "./retryFailedQueries";

/** Une requête observée (comme par un écran) qui échoue d'abord, puis réussit. */
async function watched(client: QueryClient, key: string, fail: { now: boolean }) {
  const calls = { n: 0 };
  const observer = new QueryObserver(client, {
    queryKey: [key],
    retry: false,
    queryFn: async () => {
      calls.n += 1;
      if (fail.now) throw new Error("Failed to fetch");
      return key;
    },
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await new Promise((r) => setTimeout(r, 0));
  return { calls, unsubscribe };
}

describe("retryFailedQueries", () => {
  it("démarrage hors ligne puis réseau revenu : la configuration en erreur est relancée et réussit", async () => {
    const client = new QueryClient();
    const fail = { now: true };
    const config = await watched(client, "app-config", fail);
    expect(client.getQueryState(["app-config"])?.status).toBe("error");
    fail.now = false;
    await retryFailedQueries(client);
    expect(client.getQueryState(["app-config"])?.status).toBe("success");
    expect(config.calls.n).toBe(2);
  });

  it("rien de réussi ni d'inactif n'est relancé (aucune requête de plus)", async () => {
    const client = new QueryClient();
    const ok = await watched(client, "ok", { now: false });
    const gone = await watched(client, "gone", { now: true });
    gone.unsubscribe();
    await retryFailedQueries(client);
    expect(ok.calls.n).toBe(1);
    expect(gone.calls.n).toBe(1);
  });
});
