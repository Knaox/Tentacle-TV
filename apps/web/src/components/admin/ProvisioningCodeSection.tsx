import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BACKEND, hdrs, cls, creds } from "../../pages/adminUtils";

interface ProvisioningState {
  code: string;
  enabled: boolean;
  expiresAt: string | null;
  account: string;
  publicUrl: string;
}

/** Convertit un ISO en valeur pour <input type="datetime-local"> (heure locale). */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

/**
 * Section admin — Code de jumelage de provisionnement (code long réutilisable,
 * désactivé par défaut, activé avec date d'expiration obligatoire). Pensé pour
 * jumeler une TV sans config lors du passage dans les stores. En LECTURE SEULE
 * tant que l'URL publique du serveur n'est pas définie (le provisioning grave
 * une entrée dans le relay, inutile sans URL publique joignable).
 */
export function ProvisioningCodeSection() {
  const { t } = useTranslation("admin");
  const [state, setState] = useState<ProvisioningState | null>(null);
  const [expiry, setExpiry] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const load = async () => {
    try {
      const r = await fetch(`${BACKEND}/api/admin/provisioning`, { headers: hdrs(), credentials: creds() });
      if (r.ok) {
        const d: ProvisioningState = await r.json();
        setState(d);
        setExpiry(isoToLocalInput(d.expiresAt));
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const apply = async (enabled: boolean) => {
    setBusy(true);
    setMsg(null);
    const payload: Record<string, unknown> = { enabled };
    if (enabled) {
      if (!expiry) {
        setMsg({ ok: false, t: t("provisioningExpiryRequired") });
        setBusy(false);
        return;
      }
      payload.expiresAt = new Date(expiry).toISOString();
    }
    if (username && password) {
      payload.username = username;
      payload.password = password;
    }
    try {
      const r = await fetch(`${BACKEND}/api/admin/provisioning`, {
        method: "PUT",
        headers: hdrs(),
        body: JSON.stringify(payload),
        credentials: creds(),
      });
      if (r.ok) {
        const d: ProvisioningState = await r.json();
        setState(d);
        setExpiry(isoToLocalInput(d.expiresAt));
        setPassword("");
        setMsg({ ok: true, t: t("saved") });
      } else {
        const e = await r.json().catch(() => ({}));
        setMsg({ ok: false, t: e.message || t("saveFailed") });
      }
    } catch {
      setMsg({ ok: false, t: t("saveFailed") });
    }
    setBusy(false);
  };

  const regenerate = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/provisioning/regenerate`, {
        method: "POST",
        headers: hdrs(),
        credentials: creds(),
      });
      if (r.ok) {
        const d: ProvisioningState = await r.json();
        setState(d);
        setExpiry(isoToLocalInput(d.expiresAt));
        setMsg({ ok: true, t: t("saved") });
      } else {
        setMsg({ ok: false, t: t("saveFailed") });
      }
    } catch {
      setMsg({ ok: false, t: t("saveFailed") });
    }
    setBusy(false);
  };

  const copyCode = () => {
    if (!state?.code) return;
    navigator.clipboard?.writeText(state.code).then(
      () => setMsg({ ok: true, t: t("provisioningCopied") }),
      () => {},
    );
  };

  if (!state) return null;

  // Lecture seule tant que l'URL publique du serveur n'est pas configurée.
  const readOnly = !state.publicUrl;

  return (
    <div className={cls.card}>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-content-primary">{t("provisioningTitle")}</h2>
        <span
          className={`${cls.chip} ${state.enabled ? "bg-[var(--status-success-bg)] text-[var(--status-success-fg)]" : "bg-fill-soft text-content-tertiary"}`}
        >
          {state.enabled ? t("provisioningEnabled") : t("provisioningDisable")}
        </span>
      </div>
      <p className="mb-4 text-sm text-content-quaternary">{t("provisioningDescription")}</p>

      {readOnly && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning-fg)]">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.4 14.55A1.5 1.5 0 003.19 21h17.62a1.5 1.5 0 001.3-2.59l-8.4-14.55a1.5 1.5 0 00-2.62 0z" />
          </svg>
          <span>{t("provisioningNeedsPublicUrl")}</span>
        </div>
      )}

      <div className={`${cls.sub} ${readOnly ? "pointer-events-none opacity-50" : ""}`}>
        {/* Code */}
        <label className={cls.lbl}>{t("provisioningCodeLabel")}</label>
        <div className="flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-fill-subtle px-3 py-2 text-lg font-bold tracking-[0.3em] text-content-primary">
            {state.code}
          </code>
          <button onClick={copyCode} className={`${cls.bs} pointer-events-auto`}>{t("provisioningCopy")}</button>
          <button onClick={regenerate} disabled={busy || readOnly} className={cls.bs}>{t("provisioningRegenerate")}</button>
        </div>

        {/* Compte dédié */}
        <label className={`${cls.lbl} mt-4`}>{t("provisioningAccount")}</label>
        {state.account && (
          <p className="text-xs text-content-quaternary">{t("provisioningCurrentAccount", { name: state.account })}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            autoComplete="off"
            placeholder={t("provisioningAccountUser")}
            value={username}
            disabled={readOnly}
            onChange={(e) => setUsername(e.target.value)}
            className={`${cls.inp} min-w-[180px] flex-1`}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder={t("provisioningAccountPassword")}
            value={password}
            disabled={readOnly}
            onChange={(e) => setPassword(e.target.value)}
            className={`${cls.inp} min-w-[180px] flex-1`}
          />
        </div>
        <p className="text-xs text-content-quaternary">{t("provisioningAccountHelp")}</p>

        {/* Expiration + actions */}
        <label className={`${cls.lbl} mt-4`}>{t("provisioningExpiresAt")}</label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="datetime-local"
            value={expiry}
            disabled={readOnly}
            onChange={(e) => setExpiry(e.target.value)}
            className={`${cls.inp} min-w-[220px]`}
          />
          {state.enabled ? (
            <button onClick={() => apply(false)} disabled={busy || readOnly} className={cls.bd}>{t("provisioningDisable")}</button>
          ) : (
            <button onClick={() => apply(true)} disabled={busy || readOnly} className={cls.bp}>{t("provisioningEnable")}</button>
          )}
          {msg && (
            <span className={`text-xs ${msg.ok ? "text-[var(--status-success-fg)]" : "text-[var(--status-error-fg)]"}`}>{msg.t}</span>
          )}
        </div>
      </div>
    </div>
  );
}
