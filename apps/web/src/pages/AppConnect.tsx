import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GlassCard } from "@tentacle-tv/ui";
import { verifyServer } from "@tentacle-tv/shared";
import { TentacleLogo } from "../components/ui/TentacleLogo";

interface AppConnectProps {
  onConnected: () => void;
}

/**
 * Simple "connect to server" screen for desktop/app mode — aligned on the
 * MASTER design system (R11) :
 *  - CTA primary : pill blanc + halo violet inline
 *  - Inputs : h-11 + focus ring var(--brand) 2px
 *  - Lang toggle : violet ghost when active (no solid purple)
 *  - Title : Inter ExtraBold tracking-tight (no gradient text)
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Ambient violet orb top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0.04) 30%, transparent 70%)",
        }}
      />

      {/* Language toggle — violet ghost when active */}
      <div className="absolute right-4 top-4 flex overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur">
        {["fr", "en"].map((lng) => {
          const active = i18n.language === lng;
          return (
            <button
              key={lng}
              onClick={() => switchLang(lng)}
              className={`px-3.5 py-1.5 text-xs font-semibold tracking-wide transition ${
                active
                  ? "bg-[var(--brand-soft)] text-[var(--brand-light)]"
                  : "text-white/55 hover:text-white/85"
              }`}
            >
              {lng.toUpperCase()}
            </button>
          );
        })}
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <TentacleLogo size="lg" variant="glow" />
          <h1 className="mt-5 mb-2 text-3xl font-extrabold tracking-tight text-white">
            {t("welcomeToTentacle")}
          </h1>
          <p className="text-sm text-white/55">
            {t("enterServerUrl")}
          </p>
        </div>

        <GlassCard className="p-6">
          <div className="mb-4">
            <label htmlFor="server-url" className="mb-1 block text-xs font-medium text-white/60">
              {t("serverAddress")}
            </label>
            <input
              id="server-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("serverUrlPlaceholder")}
              className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.06] px-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/30"
              onKeyDown={(e) => e.key === "Enter" && url && handleConnect()}
              autoFocus
            />
            <p className="mt-1.5 text-xs text-white/35">
              {t("serverUrlHint")}
            </p>
          </div>

          {error && <p className="mb-3 text-sm text-[var(--status-error-fg)]" role="alert">{error}</p>}

          <button
            onClick={handleConnect}
            disabled={testing || !url}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-white text-sm font-bold text-black transition-all hover:-translate-y-0.5 hover:bg-white/95 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            style={{ boxShadow: "0 8px 22px rgba(139,92,246,0.45)" }}
          >
            {testing ? t("connecting") : t("signIn")}
          </button>
        </GlassCard>
      </div>
    </div>
  );
}
