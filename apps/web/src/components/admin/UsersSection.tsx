import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { BACKEND, hdrs, creds, cls } from "../../pages/adminUtils";
import { startImpersonation } from "../../lib/impersonation";

interface AdminUser {
  id: string;
  name: string;
  hasAvatar: boolean;
  lastActivityDate: string | null;
  isAdministrator: boolean;
  isDisabled: boolean;
}

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
 * Section "Utilisateurs" admin — liste les comptes Jellyfin et permet à
 * l'admin de naviguer dans l'app en tant qu'un utilisateur (impersonation).
 * Les comptes admin et le compte courant ne sont pas impersonables.
 */
export function UsersSection({ id }: { id?: string }) {
  const { t } = useTranslation("admin");
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selfId = currentUserId();

  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchUsers,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    const list = q ? users.filter((u) => u.name.toLowerCase().includes(q)) : users;
    // Admins en tête (lecture rapide), puis ordre alphabétique.
    return [...list].sort(
      (a, b) => Number(b.isAdministrator) - Number(a.isAdministrator) || a.name.localeCompare(b.name),
    );
  }, [users, search]);

  const handleImpersonate = async (user: AdminUser) => {
    if (!confirm(t("impersonateConfirm", { name: user.name }))) return;
    setPendingId(user.id);
    setError(null);
    try {
      await startImpersonation(user.id);
      // startImpersonation recharge la page — rien après ce point.
    } catch (err) {
      setError(err instanceof Error ? err.message : t("impersonateError"));
      setPendingId(null);
    }
  };

  return (
    <div id={id} className={cls.card}>
      <h2 className="text-lg font-semibold text-white">{t("usersTitle")}</h2>
      <p className="mt-1 text-sm text-white/40">{t("usersDescription")}</p>

      {users && users.length > 6 && (
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchUsers")}
          aria-label={t("searchUsers")}
          className={`${cls.inp} mt-4`}
        />
      )}

      {error && (
        <p className="mt-3 text-sm text-[var(--status-error-fg)]" role="alert">{error}</p>
      )}

      <div className="mt-4 space-y-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-[72px] rounded-lg" />
          ))}

        {isError && (
          <div className="flex flex-col items-start gap-3 xs:flex-row xs:items-center xs:justify-between">
            <p className="text-sm text-white/40">{t("usersError")}</p>
            <button onClick={() => refetch()} className={cls.bs}>{t("retry")}</button>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <p className="text-sm text-white/40">{t("noUsers")}</p>
        )}

        {filtered.map((user) => {
          const isSelf = user.id === selfId;
          const blocked = user.isAdministrator || isSelf;
          return (
            <div
              key={user.id}
              className="flex flex-col items-start gap-3 rounded-lg border border-white/[0.06] p-4 xs:flex-row xs:items-center xs:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  aria-hidden
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-sm font-bold text-white"
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">{user.name}</p>
                    {user.isAdministrator && (
                      <span className={`${cls.chip} bg-[var(--brand-soft)] text-[var(--brand-light)]`}>
                        {t("userAdmin")}
                      </span>
                    )}
                    {user.isDisabled && (
                      <span className={`${cls.chip} bg-[var(--status-error-bg)] text-[var(--status-error-fg)]`}>
                        {t("userDisabled")}
                      </span>
                    )}
                  </div>
                  {user.lastActivityDate && (
                    <p className="mt-1 text-xs text-white/40">
                      {t("lastActivity", { date: new Date(user.lastActivityDate).toLocaleDateString() })}
                    </p>
                  )}
                </div>
              </div>

              {!blocked && (
                <button
                  onClick={() => handleImpersonate(user)}
                  disabled={pendingId !== null}
                  className={`${cls.bbrand} self-start xs:self-auto`}
                  aria-label={t("impersonateAs", { name: user.name })}
                >
                  <EyeIcon />
                  {pendingId === user.id ? t("impersonating") : t("impersonate")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
