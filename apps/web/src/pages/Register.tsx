import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GlassCard } from "@tentacle-tv/ui";
import { backendUrl } from "../main";
import { TentacleLogo } from "../components/ui/TentacleLogo";

const BACKEND_URL = backendUrl;

const CTA_PRIMARY =
  "inline-flex h-11 w-full items-center justify-center rounded-lg bg-white text-sm font-bold text-black transition-all hover:-translate-y-0.5 hover:bg-white/95 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";
const CTA_PRIMARY_HALO = { boxShadow: "0 8px 22px rgba(var(--brand-rgb), 0.45)" };
const INPUT_BASE =
  "h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.06] px-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/30";

export function Register() {
  const [searchParams] = useSearchParams();
  const [inviteKey, setInviteKey] = useState(searchParams.get("invite") ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation("auth");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteKey, username, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t("registrationFailed"));
      }
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("registrationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const passwordsMismatch = !!confirmPassword && password !== confirmPassword;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(var(--brand-rgb), 0.18) 0%, rgba(var(--brand-rgb), 0.04) 30%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <TentacleLogo size="lg" variant="glow" />
          <h1 className="mt-5 mb-2 text-3xl font-extrabold tracking-tight text-white">
            {t("joinTentacle")}
          </h1>
          <p className="text-sm text-white/55">{t("invitationOnly")}</p>
        </div>

        <GlassCard className="p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="reg-invite" className="mb-1 block text-xs font-medium text-white/60">
                {t("inviteKey")}
              </label>
              <input
                id="reg-invite" type="text" value={inviteKey} required
                onChange={(e) => setInviteKey(e.target.value)}
                className={`${INPUT_BASE} font-mono tracking-wide`}
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="reg-username" className="mb-1 block text-xs font-medium text-white/60">
                {t("username")}
              </label>
              <input
                id="reg-username" type="text" value={username} required
                onChange={(e) => setUsername(e.target.value)}
                className={INPUT_BASE}
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="mb-1 block text-xs font-medium text-white/60">
                {t("password")}
              </label>
              <input
                id="reg-password" type="password" value={password} required
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT_BASE}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="reg-confirm" className="mb-1 block text-xs font-medium text-white/60">
                {t("confirmPassword")}
              </label>
              <input
                id="reg-confirm" type="password" value={confirmPassword} required
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${INPUT_BASE} ${passwordsMismatch ? "border-[var(--status-error-fg)]/60 focus:border-[var(--status-error-fg)] focus:ring-[var(--status-error-fg)]/30" : ""}`}
                autoComplete="new-password"
                aria-invalid={passwordsMismatch}
              />
              {passwordsMismatch && (
                <p className="mt-1.5 text-xs text-[var(--status-error-fg)]" role="alert">{t("passwordMismatch")}</p>
              )}
            </div>

            {error && <p className="text-sm text-[var(--status-error-fg)]" role="alert">{error}</p>}

            <button
              type="submit"
              disabled={isLoading || !confirmPassword || passwordsMismatch}
              className={CTA_PRIMARY}
              style={CTA_PRIMARY_HALO}
            >
              {isLoading ? t("creatingAccount") : t("createAccount")}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-white/45">
            {t("alreadyHaveAccount")}{" "}
            <Link to="/login" className="font-semibold text-[var(--brand-light)] hover:underline">
              {t("signIn")}
            </Link>
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
