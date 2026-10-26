import { describe, expect, it } from "vitest";
import {
  PLUGIN_QUERY_STORAGE_KEY, buildQuerySyncBridgeMethod, buildQuerySyncListener, initialDocumentQuery, parseSetQuery,
  rememberPluginQuery, rememberedPluginQuery, sanitizePluginQuery,
} from "./pluginQuerySync";

function memoryStore() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

describe("la query d'une page d'extension", () => {
  it("n'accepte qu'une query courte, sans fragment", () => {
    expect(sanitizePluginQuery("?tab=users")).toBe("?tab=users");
    expect(sanitizePluginQuery("")).toBe("");
    expect(sanitizePluginQuery("?")).toBe("");
    expect(sanitizePluginQuery("tab=users")).toBeNull();
    expect(sanitizePluginQuery("?tab=users#x")).toBeNull();
    expect(sanitizePluginQuery("?a b")).toBeNull();
    expect(sanitizePluginQuery(`?${"x".repeat(300)}`)).toBeNull();
    expect(sanitizePluginQuery(42)).toBeNull();
  });

  it("lit le message SET_QUERY et refuse le reste", () => {
    expect(parseSetQuery({ type: "SET_QUERY", query: "?tab=sources" })).toBe("?tab=sources");
    expect(parseSetQuery({ type: "NAVIGATE", query: "?tab=sources" })).toBeNull();
    expect(parseSetQuery({ type: "SET_QUERY", query: "/admin" })).toBeNull();
    expect(parseSetQuery(null)).toBeNull();
  });

  it("retient la dernière query par page, bornée", () => {
    const store = memoryStore();
    expect(rememberedPluginQuery("/admin/plugins/sillon", store)).toBeNull();
    rememberPluginQuery("/admin/plugins/sillon", "?tab=users", store);
    rememberPluginQuery("/admin/plugins/sillon", "?tab=requests", store);
    expect(rememberedPluginQuery("/admin/plugins/sillon", store)).toBe("?tab=requests");
    for (let i = 0; i < 40; i += 1) rememberPluginQuery(`/p/${i}`, "?tab=a", store);
    expect(Object.keys(JSON.parse(store.data.get(PLUGIN_QUERY_STORAGE_KEY) ?? "{}"))).toHaveLength(32);
  });

  it("une query vide n'est pas « retenue », un stockage abîmé ne casse rien", () => {
    const store = memoryStore();
    rememberPluginQuery("/x", "", store);
    expect(rememberedPluginQuery("/x", store)).toBeNull();
    store.setItem(PLUGIN_QUERY_STORAGE_KEY, "{pas du json");
    expect(rememberedPluginQuery("/x", store)).toBeNull();
    expect(rememberedPluginQuery("/x", null)).toBeNull();
  });

  it("le document s'ouvre sur l'adresse, sinon sur la query retenue", () => {
    expect(initialDocumentQuery("?media=movie:1", "?tab=users")).toBe("?media=movie:1");
    expect(initialDocumentQuery("", "?tab=users")).toBe("?tab=users");
    expect(initialDocumentQuery("", null)).toBe("");
  });

  it("le pont porte la méthode et l'évènement de l'API publique", () => {
    expect(buildQuerySyncBridgeMethod()).toContain("setQuery: function(query)");
    expect(buildQuerySyncBridgeMethod()).toContain('"SET_QUERY"');
    expect(buildQuerySyncListener()).toContain('"HOST_QUERY"');
    expect(buildQuerySyncListener()).toContain('"tentacle:hostquery"');
  });
});
