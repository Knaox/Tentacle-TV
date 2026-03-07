import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { unregisterPlugin } from "@tentacle-tv/plugins-api";
import { backendUrl } from "../../main";
import type { InstalledPlugin, MarketplacePlugin, PluginSource } from "./types";

const BASE = `${backendUrl}/api/plugins`;

function hdrs(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("tentacle_token");
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const hasToken = !!localStorage.getItem("tentacle_token");
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...hdrs(), ...(init?.headers as Record<string, string>) }, credentials: hasToken ? undefined : "include" });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status}`);
    throw new Error(msg);
  }
  return res.json();
}

// -- Installed plugins --

export function useInstalledPlugins() {
  return useQuery({
    queryKey: ["admin-plugins", "installed"],
    queryFn: () => apiFetch<InstalledPlugin[]>(""),
    staleTime: 30_000,
  });
}

export function useTogglePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<InstalledPlugin>(`/${id}/toggle`, { method: "PUT" }),
    onSuccess: (plugin) => {
      qc.invalidateQueries({ queryKey: ["admin-plugins"] });
      if (!plugin.enabled) {
        unregisterPlugin(plugin.pluginId);
      }
    },
  });
}

export function useUninstallPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; pluginId: string }) =>
      apiFetch(`/${id}`, { method: "DELETE" }),
    onSuccess: (_, { pluginId }) => {
      qc.invalidateQueries({ queryKey: ["admin-plugins"] });
      unregisterPlugin(pluginId);
    },
  });
}

export function useUpdatePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<InstalledPlugin>(`/${id}/update`, { method: "POST" }),
    onSuccess: (data: unknown) => {
      qc.invalidateQueries({ queryKey: ["admin-plugins"] });
      const plugin: InstalledPlugin = (data as { plugin?: InstalledPlugin }).plugin ?? (data as InstalledPlugin);
      if (plugin.pluginId) {
        unregisterPlugin(plugin.pluginId);
      }
    },
  });
}

// -- Marketplace --

export function useMarketplacePlugins() {
  return useQuery({
    queryKey: ["admin-plugins", "marketplace"],
    queryFn: () => apiFetch<MarketplacePlugin[]>("/marketplace"),
    staleTime: 60_000,
  });
}

export function useInstallPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { pluginId: string; version: string; sourceId: string }) =>
      apiFetch<InstalledPlugin>("/install", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-plugins"] });
    },
  });
}

// -- Sources --

export function usePluginSources() {
  return useQuery({
    queryKey: ["admin-plugins", "sources"],
    queryFn: () => apiFetch<PluginSource[]>("/sources"),
    staleTime: 30_000,
  });
}

export function useAddSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; url: string }) =>
      apiFetch("/sources", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plugins"] }),
  });
}

export function useRemoveSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/sources/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plugins"] }),
  });
}

export function useToggleSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/sources/${id}/toggle`, { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plugins"] }),
  });
}

export function useRefreshSources() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/sources/refresh", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plugins"] }),
  });
}
