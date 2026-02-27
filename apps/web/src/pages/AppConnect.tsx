import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GlassCard } from "@tentacle-tv/ui";
import { verifyServer } from "@tentacle-tv/shared";

interface AppConnectProps {
  onConnected: () => void;
}

/**
 * Simple "connect to server" screen for desktop/app mode.
 * Only asks for the Tentacle Web URL — no DB/Jellyfin/Admin config.
 */
export function AppConnect({ onConnected }: AppConnectProps) {
  const { t, i18n } = useTranslation("auth");
  const [url, setUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    setError("");
    setTesting(true);
    try {
      const result = await verifyServer(url);
      if (result.success) {
        localStorage.setItem("tentacle_server_url", result.url);
        onConnected();
      } else {
        const key = result.errorKey ?? "serverNotFoundRetry";
        setError(t(key, result.errorParams));
      }
    } catch {
      setError(t("serverNotFoundRetry"));
    } finally {
      setTesting(false);
    }
  };

  const switchLang = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("tentacle_language", lng);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      {/* Language toggle */}
      <div className="absolute right-4 top-4 flex overflow-hidden rounded-lg border border-white/10">
        {["fr", "en"].map((lng) => (
          <button
            key={lng}
            onClick={() => switchLang(lng)}
            className={`px-3 py-1.5 text-xs font-medium transition ${
              i18n.language === lng
                ? "bg-purple-500/30 text-purple-300"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {lng.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img src="/tentacle-logo-pirate.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
          <h1 className="mb-2 text-2xl font-bold">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {t("welcomeToTentacle")}
            </span>
          </h1>
          <p className="text-sm text-white/50">
            {t("enterServerUrl")}
          </p>
        </div>

        <GlassCard className="p-6">
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-white/60">
              {t("serverAddress")}
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("serverUrlPlaceholder")}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && url && handleConnect()}
            />
            <p className="mt-1.5 text-xs text-white/30">
              {t("serverUrlHint")}
            </p>
          </div>

          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

          <button
            onClick={handleConnect}
            disabled={testing || !url}
            className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
          >
            {testing ? t("connecting") : t("signIn")}
          </button>
        </GlassCard>
      </div>
    </div>
  );
}
