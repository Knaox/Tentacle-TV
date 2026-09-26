import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminInviteDto, CreateInviteRequest, CreatedInviteDto } from "@tentacle-tv/shared";
import { BACKEND, creds, hdrs } from "../pages/adminUtils";
import { getBackendBase } from "../lib/backendBase";

/**
 * Les invitations côté administration : la liste, la création et la
 * suppression — une mutation rafraîchit la liste d'elle-même —, et l'origine
 * sur laquelle bâtir les liens envoyés aux invités.
 */

export const ADMIN_INVITES_KEY = ["admin", "invites"] as const;
const PUBLIC_URL_KEY = ["admin", "public-url"] as const;

async function request<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    method: init?.method ?? "GET",
    headers: hdrs(),
    credentials: creds(),
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function useAdminInvites() {
  return useQuery({
    queryKey: ADMIN_INVITES_KEY,
    queryFn: () => request<AdminInviteDto[]>("/api/invites"),
    staleTime: 30_000,
    // On envoie un lien, on attend l'inscription dans une autre fenêtre : au
    // retour sur l'onglet, le nouveau compte doit déjà être dans la liste.
    refetchOnWindowFocus: true,
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInviteRequest) =>
      request<CreatedInviteDto>("/api/invites", { method: "POST", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_INVITES_KEY }),
  });
}

export function useDeleteInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<{ success: boolean }>(`/api/invites/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: (_result, id) => {
      // Retirée de la liste sans attendre la relecture, qui confirme derrière.
      queryClient.setQueryData<AdminInviteDto[]>(ADMIN_INVITES_KEY, (list) =>
        list?.filter((invite) => invite.id !== id),
      );
      return queryClient.invalidateQueries({ queryKey: ADMIN_INVITES_KEY });
    },
  });
}

/**
 * L'origine des liens d'invitation : l'URL publique du serveur quand elle est
 * connue (réglée dans Services, ou `TENTACLE_PUBLIC_URL`), sinon celle du
 * serveur joint. Jamais `window.location.origin` d'office : elle vaut
 * `tentacle://app` sous Electron — le lien copié était mort —, et une adresse
 * du réseau local quand l'administrateur navigue depuis chez lui.
 *
 * `ready` reste faux tant que l'URL publique n'est pas connue : un lien bâti
 * avant partirait sur la mauvaise origine. Relue à chaque visite — elle se
 * règle dans Services, qui ne passe pas par ce cache.
 */
export function useInviteLinkBase(): { base: string; ready: boolean } {
  const { data, isPending } = useQuery({
    queryKey: PUBLIC_URL_KEY,
    queryFn: () => request<{ effectiveUrl?: string }>("/api/admin/public-url"),
    staleTime: 0,
  });
  const publicUrl = data?.effectiveUrl?.trim().replace(/\/+$/, "") ?? "";
  const base = publicUrl || getBackendBase().replace(/\/+$/, "") || window.location.origin;
  return { base, ready: !isPending };
}

/**
 * L'heure, relue toutes les 30 s : les « expire dans 3 h » avancent, et une
 * invitation qui expire sous les yeux change de statut sans rechargement.
 */
export function useClock(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
