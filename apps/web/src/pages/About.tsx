import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isTauriApp } from "../main";
import { PageTransition } from "../components/PageTransition";
import { TentacleLogo } from "../components/ui/TentacleLogo";

export function About() {
  const { t } = useTranslation("about");
  const platform = isTauriApp ? "Desktop" : "Web";
  const rawVersion = isTauriApp ? __APP_VERSION_DESKTOP__ : __APP_VERSION_WEB__;
  // Detect pre-release: "1.0.0-beta", "1.0.0-beta.2", "2.0.0-rc.1"…
  const preReleaseMatch = rawVersion.match(/-([a-z]+)/i);
  const preReleaseTag = preReleaseMatch ? preReleaseMatch[1].toUpperCase() : null;
  const versionLabel = rawVersion.replace(/-[a-z]+(\..+)?$/i, "");

  return (
    <PageTransition>
    <div className="mx-auto max-w-2xl px-6 pt-16 pb-16">
      <div className="flex items-center gap-5">
        <TentacleLogo size="xl" variant="glow" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-4xl font-bold tracking-tight text-white">Tentacle TV</h1>
            {preReleaseTag && (
              <span
                className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-100 ring-1 ring-violet-400/50 backdrop-blur-md"
                style={{
                  background: "linear-gradient(180deg, rgba(139,92,246,0.32) 0%, rgba(139,92,246,0.18) 100%)",
                  boxShadow: "0 2px 10px rgba(139,92,246,0.35)",
                  textShadow: "0 1px 2px rgba(0,0,0,0.45)",
                }}
              >
                {preReleaseTag}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-white/55">{t("about:version", { version: versionLabel })} — {platform}</p>
        </div>
      </div>

      <p className="mt-8 leading-relaxed text-white/70">
        {t("about:description")}
      </p>

      <h2 className="mt-10 text-lg font-semibold text-white">{t("about:features")}</h2>
      <ul className="mt-3 space-y-2 text-sm text-white/60">
        <li className="flex items-center gap-2"><Dot /> {t("about:featurePlayer")}</li>
        <li className="flex items-center gap-2"><Dot /> {t("about:featureResume")}</li>
        <li className="flex items-center gap-2"><Dot /> {t("about:featureRequests")}</li>
        <li className="flex items-center gap-2"><Dot /> {t("about:featureDesktop")}</li>
        <li className="flex items-center gap-2"><Dot /> {t("about:featureAdaptive")}</li>
        <li className="flex items-center gap-2"><Dot /> {t("about:featureNotifications")}</li>
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-white">{t("about:contact")}</h2>
      <p className="mt-3 text-sm text-white/60">
        {t("about:contactText")}
      </p>

      <Link
        to="/credits"
        className="mt-10 inline-flex items-center gap-2 text-sm font-medium transition-colors hover:underline"
        style={{ color: "var(--brand-light)" }}
      >
        {t("about:creditsLink")}
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </Link>

      <p className="mt-8 text-xs text-white/30">
        {t("about:copyright", { version: versionLabel, year: new Date().getFullYear() })}
      </p>
    </div>
    </PageTransition>
  );
}

function Dot() {
  return (
    <span
      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
      style={{ background: "var(--brand-light)" }}
    />
  );
}
