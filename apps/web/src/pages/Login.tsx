import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth, useAppConfig } from "@tentacle-tv/api-client";
import { GlassCard } from "@tentacle-tv/ui";

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { t } = useTranslation("auth");
  const { login } = useAuth();
  const { data: config } = useAppConfig();
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
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
      const res = await fetch(`${backendUrl}/api/auth/demo`, { method: "POST" });
      if (!res.ok) throw new Error("Demo unavailable");
      const data = await res.json();
      localStorage.setItem("tentacle_token", data.token);
      localStorage.setItem("tentacle_user", JSON.stringify(data.user));
      navigate("/");
    } catch {
      setDemoLoading(false);
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
                : login.error.message || t("loginFailed")}
            </p>
          )}

          <button type="submit" disabled={login.isPending}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
            {login.isPending ? t("signingIn") : t("signIn")}
          </button>
        </form>

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
      </GlassCard>
    </div>
  );
}
