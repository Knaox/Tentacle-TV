/**
 * La TV résout TanStack Query v4 : juste après un changement de clé (filtre,
 * « Tendances actuelles » allumée ou coupée), son résultat OPTIMISTE recalcule
 * `select` à CHAQUE rendu tant que l'effet qui passe à la nouvelle requête n'a
 * pas tourné — la même page servie, un objet neuf à chaque fois. La visite ne
 * juge une page servie qu'UNE fois : elle la reconnaît à sa requête (clé, date),
 * jamais à son identité — sinon un état posé pendant le rendu boucle (« Too many
 * re-renders », plantage de l'Apple TV du lot 1017).
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecoPage } from "../hooks/useRecoPage";

const served = vi.hoisted(() => ({ updatedAt: 0, rows: ["forYou"] as string[], placeholder: true, renders: 0 }));

vi.mock("../hooks/useRecoPage", async (importOriginal) => {
  const original = await importOriginal<typeof import("../hooks/useRecoPage")>();
  return {
    ...original,
    // Comme le résultat optimiste de v4 : un objet NEUF à chaque rendu, pour la même page.
    useRecoPage: () => {
      served.renders += 1;
      const data = {
        state: "ready", signalCount: 20, generating: false, refining: false, exploring: false, generatedAt: null,
        poolGeneratedAt: null, tmdbConfigured: true, personalized: true, filter: null,
        rows: served.rows.map((key) => ({ key, items: [{ key: `movie:${key.length}`, jellyfinItemId: null }] })),
      } as unknown as RecoPage;
      return {
        data, dataUpdatedAt: served.updatedAt, isPlaceholderData: served.placeholder, isError: false,
        refetch: async () => ({ data }),
      };
    },
  };
});

import { useRecoPageVisit, type RecoPageVisit } from "./useRecoPageVisit";

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = {
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
};

let root: Root | null = null;
let probe: RecoPageVisit;

function Rig() {
  probe = useRecoPageVisit(null);
  return null;
}

async function render() {
  root ??= createRoot(container as never);
  await act(async () => {
    root!.render(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(Rig)));
  });
}

beforeEach(() => {
  Object.assign(served, { updatedAt: 0, rows: ["forYou"], placeholder: true, renders: 0 });
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
});

describe("useRecoPageVisit — une page servie, un objet neuf à chaque rendu", () => {
  it("ne boucle pas : la page est jugée une fois, puis tenue", async () => {
    await render();
    expect(probe.data?.rows.map((row) => row.key)).toEqual(["forYou"]);
    expect(served.renders).toBeLessThan(10);
  });

  it("une page VRAIMENT nouvelle (autre contenu) est encore jugée — à l'arrivée, elle entre", async () => {
    await render();
    Object.assign(served, { updatedAt: 42, rows: ["trendingNow", "forYou"], placeholder: false });
    await render();
    expect(probe.data?.rows.map((row) => row.key)).toEqual(["trendingNow", "forYou"]);
  });
});
