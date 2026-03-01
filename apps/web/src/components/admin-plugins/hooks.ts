import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { backendUrl } from "../../main";
import type { InstalledPlugin, MarketplacePlugin, PluginSource } from "./types";

const BASE = `${backendUrl}/api/plugins`;

function hdrs(): Record<string, string> {
  const tok = localStorage.getItem("tentacle_token");
  return {
    "Content-Type": "application/json",
    ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...hdrs(), ...(init?.headers as Record<string, string>) } });
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
    mutationFn: (id: string) => apiFetch(`/${id}/toggle`, { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plugins"] }),
  });
}

export function useUninstallPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plugins"] }),
  });
}

export function useUpdatePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/${id}/update`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plugins"] }),
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
      apiFetch("/install", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plugins"] }),
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
