import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppConfig } from "@tentacle-tv/api-client";

export function About() {
  const { t } = useTranslation("about");
  const { data: config } = useAppConfig();

  return (
    <div className="mx-auto max-w-2xl px-6 pt-12">
      <div className="flex items-center gap-4">
        <img src="/tentacle-logo-pirate.svg" alt="" className="h-14 w-14" />
        <div>
          <h1 className="text-3xl font-bold text-white">Tentacle TV</h1>
          <p className="text-sm text-white/50">{t("about:version", { version: config?.version ?? "..." })}</p>
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

      <Link to="/credits" className="mt-10 inline-flex items-center gap-2 text-sm text-purple-400 hover:underline">
        {t("about:creditsLink")}
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </Link>

      <p className="mt-8 text-xs text-white/30">
        {t("about:copyright", { version: config?.version ?? "", year: new Date().getFullYear() })}
      </p>
    </div>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />;
}
