import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { BACKEND, hdrs, cls, creds } from "../../pages/adminUtils";

interface InviteKey {
  id: number;
  key: string;
  maxUses: number;
  currentUses: number;
  expiresAt: string | null;
  createdAt: string;
  usages: { username: string; usedAt: string }[];
}

interface Props {
  id?: string;
}

/**
 * Section "Invitations" — création + liste des clés. Extraite depuis Admin.tsx
 * (orchestrateur 277L → ~80L). Layout responsive : grille empilée mobile,
 * row alignée à partir de 480px.
 */
export function InvitesSection({ id }: Props) {
  const { t } = useTranslation("admin");
  const [invites, setInvites] = useState<InviteKey[]>([]);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresHours, setExpiresHours] = useState(72);
  const [creating, setCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    const r = await fetch(`${BACKEND}/api/invites`, { headers: hdrs(), credentials: creds() });
    if (r.ok) setInvites(await r.json());
  }, []);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  const createInvite = async () => {
    setCreating(true);
    const r = await fetch(`${BACKEND}/api/invites`, {
      method: "POST",
      headers: hdrs(),
      body: JSON.stringify({ maxUses, expiresInHours: expiresHours }),
      credentials: creds(),
    });
    if (r.ok) await fetchInvites();
    setCreating(false);
  };

  const copyLink = (key: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/register?invite=${key}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <>
      <div className={cls.card} id={id}>
        <h2 className="mb-4 text-lg font-semibold text-white">{t("generateInvite")}</h2>
        <div className="flex flex-col gap-3 xs:flex-row xs:flex-wrap xs:items-end xs:gap-4">
          <div className="xs:w-28">
            <label className={cls.lbl}>{t("maxUses")}</label>
            <input type="number" min={1} max={100} value={maxUses}
              onChange={(e) => setMaxUses(+e.target.value)}
              className={cls.inp} />
          </div>
          <div className="xs:w-28">
            <label className={cls.lbl}>{t("expiresInHours")}</label>
            <input type="number" min={1} max={720} value={expiresHours}
              onChange={(e) => setExpiresHours(+e.target.value)}
              className={cls.inp} />
          </div>
          <button onClick={createInvite} disabled={creating}
            className={`${cls.bp} w-full xs:w-auto`} style={cls.bpStyle}>
            {creating ? "..." : t("generate")}
          </button>
        </div>
      </div>

      <div className={cls.card}>
        <h2 className="mb-4 text-lg font-semibold text-white">{t("existingInvites")}</h2>
        {invites.length === 0 ? (
          <p className="text-sm text-white/40">{t("noInvites")}</p>
        ) : (
          <div className="space-y-3">
            {invites.map((inv) => {
              const expired = inv.expiresAt && new Date(inv.expiresAt) < new Date();
              const full = inv.currentUses >= inv.maxUses;
              const active = !expired && !full;
              return (
                <div key={inv.id} className={`rounded-lg border p-4 ${active ? "border-white/[0.06]" : "border-white/[0.04] opacity-50"}`}>
                  <div className="flex flex-col gap-3 xs:flex-row xs:items-center xs:justify-between xs:gap-4">
                    <div className="min-w-0">
                      <code className="block break-all text-sm font-mono text-[var(--brand-light)]">{inv.key}</code>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/40">
                        <span>{t("usesCount", { current: inv.currentUses, max: inv.maxUses })}</span>
                        {inv.expiresAt && <span>{t("expiresOn", { date: new Date(inv.expiresAt).toLocaleDateString() })}</span>}
                        <span>{t("createdOn", { date: new Date(inv.createdAt).toLocaleDateString() })}</span>
                      </div>
                      {inv.usages.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {inv.usages.map((u) => (
                            <span key={u.username} className="rounded bg-white/5 px-2 py-0.5 text-xs text-white/50">{u.username}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {active && (
                      <button onClick={() => copyLink(inv.key)}
                        className={`${cls.bs} flex-shrink-0`}>
                        {copiedKey === inv.key ? t("copied") : t("copyLink")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
