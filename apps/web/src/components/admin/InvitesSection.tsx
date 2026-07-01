import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { BACKEND, hdrs, cls, creds } from "../../pages/adminUtils";

interface InviteKey {
  id: string;
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
 * Section "Invitations" — création + liste repliable des clés, avec suppression.
 * Extraite depuis Admin.tsx. Layout responsive : grille empilée mobile.
 */
export function InvitesSection({ id }: Props) {
  const { t } = useTranslation("admin");
  const [invites, setInvites] = useState<InviteKey[]>([]);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresHours, setExpiresHours] = useState(72);
  const [creating, setCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    if (r.ok) { await fetchInvites(); setExpanded(true); }
    setCreating(false);
  };

  const copyLink = (key: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/register?invite=${key}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const deleteInvite = async (inviteId: string) => {
    if (!window.confirm(t("deleteInviteConfirm"))) return;
    setDeletingId(inviteId);
    const r = await fetch(`${BACKEND}/api/invites/${inviteId}`, { method: "DELETE", headers: hdrs(), credentials: creds() });
    if (r.ok) await fetchInvites();
    setDeletingId(null);
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
        {/* En-tête déroulable */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-lg font-semibold text-white">
            {t("existingInvites")}
            <span className="ml-2 text-sm font-normal text-white/40">({invites.length})</span>
          </span>
          <svg className={`h-5 w-5 text-white/50 transition-transform ${expanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {expanded && (
          <div className="mt-4">
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
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {active && (
                            <button onClick={() => copyLink(inv.key)} className={cls.bs}>
                              {copiedKey === inv.key ? t("copied") : t("copyLink")}
                            </button>
                          )}
                          <button
                            onClick={() => deleteInvite(inv.id)}
                            disabled={deletingId === inv.id}
                            aria-label={t("deleteInvite")}
                            title={t("deleteInvite")}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-white/50 transition-colors hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
