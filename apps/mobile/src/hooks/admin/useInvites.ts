import { useCallback, useEffect, useState } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";

export interface InviteKey {
  id: number;
  key: string;
  maxUses: number;
  currentUses: number;
  expiresAt: string | null;
  createdAt: string;
  usages: { username: string; usedAt: string }[];
}

/**
 * Les codes d'invitation du serveur (admin) : la liste et la création, par
 * `/api/invites` avec le jeton de session. Une création relit la liste.
 */
export function useInvites() {
  const { storage } = useTentacleConfig();
  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const token = storage.getItem("tentacle_token");
  const [invites, setInvites] = useState<InviteKey[] | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (!serverUrl || !token) return;
    try {
      const res = await fetch(`${serverUrl}/api/invites`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setInvites(await res.json());
    } catch { /* la liste reste celle d'avant */ }
  }, [serverUrl, token]);

  useEffect(() => { void refresh(); }, [refresh]);

  const create = useCallback(async (maxUses: number, expiresInHours: number) => {
    if (!serverUrl || !token) return;
    setCreating(true);
    try {
      const res = await fetch(`${serverUrl}/api/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ maxUses, expiresInHours }),
      });
      if (res.ok) await refresh();
    } catch { /* rien de créé */ } finally {
      setCreating(false);
    }
  }, [serverUrl, token, refresh]);

  return { invites, creating, create, serverUrl };
}

/** Une invitation qu'on peut encore partager : ni expirée, ni épuisée. */
export function isInviteActive(invite: InviteKey, now: Date = new Date()): boolean {
  const expired = invite.expiresAt ? new Date(invite.expiresAt) < now : false;
  return !expired && invite.currentUses < invite.maxUses;
}
