import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { BACKEND, hdrs, creds, cls } from "./adminUtils";
import { PageTransition } from "../components/PageTransition";
import { getUserInfo } from "../components/userMenu/menuItems";
import { startImpersonation } from "../lib/impersonation";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

interface AdminUser {
  id: string;
  name: string;
  hasAvatar: boolean;
  lastActivityDate: string | null;
  isAdministrator: boolean;
  isDisabled: boolean;
}

type Filter = "all" | "admins" | "disabled";

async function fetchUsers(): Promise<AdminUser[]> {
  const res = await fetch(`${BACKEND}/api/admin/users`, { headers: hdrs(), credentials: creds() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function currentUserId(): string | undefined {
  try {
    const raw = localStorage.getItem("tentacle_user");
    return raw ? (JSON.parse(raw)?.Id as string | undefined) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Page dédiée "Gestion des utilisateurs" — liste les comptes Jellyfin, recherche
 * + filtres (tous / admins / désactivés), et permet à l'admin de naviguer dans
 * l'app en tant qu'un utilisateur (impersonation). Les comptes admin et le
 * compte courant ne sont pas impersonables. Calquée sur la page Plugins.
 */
export function AdminUsers() {
  const { t } = useTranslation(["admin", "common"]);
  const { isAdmin } = getUserInfo();
  const reduce = useReducedMotion();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Confirmation maison : window.confirm() ne s'affiche pas dans les WKWebView
  // Tauri (desktop macOS).
  const [confirmTarget, setConfirmTarget] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selfId = currentUserId();

  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchUsers,
    staleTime: 60_000,
  });

  const counts = useMemo(() => ({
    all: users?.length ?? 0,
    admins: users?.filter((u) => u.isAdministrator).length ?? 0,
    disabled: users?.filter((u) => u.isDisabled).length ?? 0,
  }), [users]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    let list = q ? users.filter((u) => u.name.toLowerCase().includes(q)) : users;
    if (filter === "admins") list = list.filter((u) => u.isAdministrator);
    else if (filter === "disabled") list = list.filter((u) => u.isDisabled);
    // Admins en tête (lecture rapide), puis ordre alphabétique.
    return [...list].sort(
      (a, b) => Number(b.isAdministrator) - Number(a.isAdministrator) || a.name.localeCompare(b.name),
    );
  }, [users, search, filter]);

  const handleImpersonate = async (user: AdminUser) => {
    setPendingId(user.id);
    setError(null);
    try {
      await startImpersonation(user.id);
      // startImpersonation recharge la page — rien après ce point.
    } catch (err) {
      setError(err instanceof Error ? err.message : t("impersonateError"));
      setPendingId(null);
      setConfirmTarget(null);
    }
  };

  if (!isAdmin) return <Navigate to="/" replace />;

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("filterAll"), count: counts.all },
    { key: "admins", label: t("userAdmin"), count: counts.admins },
    { key: "disabled", label: t("userDisabled"), count: counts.disabled },
  ];

  return (
    <PageTransition>
      <div className="px-4 pt-6 pb-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-content-primary">{t("usersTitle")}</h1>
          <p className="mb-6 text-sm text-content-tertiary">{t("usersDescription")}</p>

          {/* Barre d'outils : recherche + filtres */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchUsers")}
              aria-label={t("searchUsers")}
              className={`${cls.inp} sm:max-w-xs`}
            />
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("usersTitle")}>
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(f.key)}
                    className={`inline-flex items-center gap-1.5 h-9 rounded-full border px-3.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand)]/40 ${
                      active
                        ? "border-[var(--brand)]/45 bg-[var(--brand-soft)] text-content-primary"
                        : "border-line-subtle bg-fill-subtle text-content-secondary hover:bg-fill-soft hover:text-content-primary"
                    }`}
                  >
                    {f.label}
                    <span className="tabular-nums text-content-quaternary">{f.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="mb-4 text-sm text-[var(--status-error-fg)]" role="alert">{error}</p>
          )}

          <div className="space-y-3">
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton-shimmer h-[72px] rounded-lg" />
              ))}

            {isError && (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-line-subtle p-4 xs:flex-row xs:items-center xs:justify-between">
                <p className="text-sm text-content-quaternary">{t("usersError")}</p>
                <button onClick={() => refetch()} className={cls.bs}>{t("retry")}</button>
              </div>
            )}

            {!isLoading && !isError && filtered.length === 0 && (
              <div className="rounded-lg border border-dashed border-line-subtle p-8 text-center">
                <p className="text-sm text-content-quaternary">{t("noUsers")}</p>
              </div>
            )}

            {filtered.map((user, i) => {
              const isSelf = user.id === selfId;
              const blocked = user.isAdministrator || isSelf;
              return (
                <motion.div
                  key={user.id}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: reduce ? 0 : Math.min(i * 0.035, 0.3), ease: "easeOut" }}
                  className="flex flex-col items-start gap-3 rounded-lg border border-line-subtle bg-fill-faint p-4 transition-colors hover:border-line-strong xs:flex-row xs:items-center xs:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      aria-hidden
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-sm font-bold text-cta-brand-fg"
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-content-primary">{user.name}</p>
                        {user.isAdministrator && (
                          <span className={`${cls.chip} bg-[var(--brand-soft)] text-[var(--brand-light)]`}>{t("userAdmin")}</span>
                        )}
                        {user.isDisabled && (
                          <span className={`${cls.chip} bg-[var(--status-error-bg)] text-[var(--status-error-fg)]`}>{t("userDisabled")}</span>
                        )}
                        {isSelf && (
                          <span className={`${cls.chip} bg-fill-soft text-content-tertiary`}>{t("userYou")}</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-content-quaternary">
                        {user.lastActivityDate
                          ? t("lastActivity", { date: new Date(user.lastActivityDate).toLocaleDateString() })
                          : t("lastActivityNever")}
                      </p>
                    </div>
                  </div>

                  {!blocked && (
                    <button
                      onClick={() => setConfirmTarget(user)}
                      disabled={pendingId !== null}
                      className={`${cls.bbrand} self-start xs:self-auto`}
                      aria-label={t("impersonateAs", { name: user.name })}
                    >
                      <EyeIcon />
                      {pendingId === user.id ? t("impersonating") : t("impersonate")}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>

          <ConfirmDialog
            open={confirmTarget !== null}
            title={t("impersonateConfirmTitle")}
            message={confirmTarget ? t("impersonateConfirm", { name: confirmTarget.name }) : ""}
            confirmLabel={t("impersonate")}
            cancelLabel={t("common:cancel")}
            pending={pendingId !== null}
            onConfirm={() => { if (confirmTarget) void handleImpersonate(confirmTarget); }}
            onCancel={() => { if (pendingId === null) setConfirmTarget(null); }}
          />
        </div>
      </div>
    </PageTransition>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
