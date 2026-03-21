import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth, useAppConfig } from "@tentacle-tv/api-client";
import { useRefreshPlugins } from "@tentacle-tv/plugins-api";
import { GlassCard } from "@tentacle-tv/ui";
import { isTauriApp, backendUrl } from "../main";

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation("auth");
  const { login } = useAuth();
  const { data: config } = useAppConfig();
  const refreshPlugins = useRefreshPlugins();
  const [demoLoading, setDemoLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { username, password },
      { onSuccess: () => navigate("/") }
    );
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/auth/demo`, {
        method: "POST",
        credentials: isTauriApp ? undefined : "include",
      });
      if (!res.ok) throw new Error("Demo unavailable");
      const data = await res.json();
      if (data.AccessToken) {
        localStorage.setItem("tentacle_token", data.AccessToken);
      }
      localStorage.setItem("tentacle_user", JSON.stringify(data.user));
      refreshPlugins();
      navigate("/");
    } catch {
      setDemoLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) return;
    setForgotSending(true);
    try {
      await fetch(`${backendUrl}/api/auth/password-reset-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername.trim() }),
      });
      setForgotSent(true);
    } finally {
      setForgotSending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <GlassCard className="w-full max-w-md p-8">
        <h1 className="mb-2 text-center text-3xl font-bold">
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {t("tentacle")}
          </span>
        </h1>
        <p className="mb-8 text-center text-sm text-white/50">
          {t("signInSubtitle")}
        </p>

        {showForgot ? (
          <ForgotPasswordForm
            t={t}
            forgotUsername={forgotUsername}
            setForgotUsername={setForgotUsername}
            forgotSending={forgotSending}
            forgotSent={forgotSent}
            onSubmit={handleForgotSubmit}
            onBack={() => { setShowForgot(false); setForgotSent(false); setForgotUsername(""); }}
          />
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text" placeholder={t("username")} value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
                required
              />
              <input
                type="password" placeholder={t("password")} value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
                required
              />

              {login.error && (
                <p className="text-sm text-red-400">
                  {login.error.message?.includes("401")
                    ? t("invalidCredentials")
                    : login.error.message?.includes("502") || login.error.message?.includes("503")
                      ? t("common:offlineTitle")
                      : login.error.message || t("loginFailed")}
                </p>
              )}

              <button type="submit" disabled={login.isPending}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                {login.isPending ? t("signingIn") : t("signIn")}
              </button>
            </form>

            <button
              onClick={() => setShowForgot(true)}
              className="mt-3 w-full text-center text-sm text-white/40 transition-colors hover:text-purple-400"
            >
              {t("forgotPassword")}
            </button>

            {config?.features.demo && (
              <button onClick={handleDemo} disabled={demoLoading}
                className="mt-3 w-full rounded-xl border border-white/10 py-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50">
                {demoLoading ? t("loadingDemo") : t("tryDemo")}
              </button>
            )}

            <p className="mt-6 text-center text-sm text-white/40">
              {t("haveInviteKey")}{" "}
              <Link to="/register" className="text-purple-400 hover:underline">
                {t("createAccount")}
              </Link>
            </p>

            {isTauriApp && (
              <button
                onClick={() => { localStorage.removeItem("tentacle_server_url"); window.location.reload(); }}
                className="mt-4 w-full text-center text-sm text-white/30 transition-colors hover:text-white/60"
              >
                {t("changeServer")}
              </button>
            )}
          </>
        )}
      </GlassCard>
    </div>
  );
}

function ForgotPasswordForm({ t, forgotUsername, setForgotUsername, forgotSending, forgotSent, onSubmit, onBack }: {
  t: (key: string) => string;
  forgotUsername: string;
  setForgotUsername: (v: string) => void;
  forgotSending: boolean;
  forgotSent: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  if (forgotSent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-green-400">{t("forgotPasswordSuccess")}</p>
        <button onClick={onBack}
          className="text-sm text-purple-400 transition-colors hover:underline">
          {t("signIn")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-white">{t("forgotPasswordTitle")}</h2>
      <p className="text-sm text-white/50">{t("forgotPasswordDescription")}</p>
      <input
        type="text" placeholder={t("username")} value={forgotUsername}
        onChange={(e) => setForgotUsername(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
        required
      />
      <button type="submit" disabled={forgotSending}
        className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
        {forgotSending ? t("common:sending") : t("sendRequest")}
      </button>
      <button type="button" onClick={onBack}
        className="w-full text-center text-sm text-white/40 transition-colors hover:text-purple-400">
        {t("signIn")}
      </button>
    </form>
  );
}
