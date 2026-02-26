import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export function Credits() {
  const { t } = useTranslation("about");

  const TECH_STACK = useMemo(() => [
    { name: "React", url: "https://react.dev", desc: t("about:techReact") },
    { name: "TypeScript", url: "https://typescriptlang.org", desc: t("about:techTypeScript") },
    { name: "Vite", url: "https://vitejs.dev", desc: t("about:techVite") },
    { name: "Tailwind CSS", url: "https://tailwindcss.com", desc: t("about:techTailwind") },
    { name: "Framer Motion", url: "https://motion.dev", desc: t("about:techFramerMotion") },
    { name: "TanStack Query", url: "https://tanstack.com/query", desc: t("about:techTanStackQuery") },
    { name: "React Router", url: "https://reactrouter.com", desc: t("about:techReactRouter") },
    { name: "Fastify", url: "https://fastify.dev", desc: t("about:techFastify") },
    { name: "Tauri", url: "https://tauri.app", desc: t("about:techTauri") },
    { name: "Expo", url: "https://expo.dev", desc: t("about:techExpo") },
    { name: "React Native", url: "https://reactnative.dev", desc: t("about:techReactNative") },
  ], [t]);

  const SERVICES = useMemo(() => [
    { name: "Jellyfin", url: "https://jellyfin.org", desc: t("about:serviceJellyfin") },
    { name: "Overseerr / Jellyseerr", url: "https://overseerr.dev", desc: t("about:serviceOverseerr") },
  ], [t]);

  return (
    <div className="mx-auto max-w-2xl px-6 pt-12">
      <h1 className="text-2xl font-bold text-white">{t("about:creditsTitle")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/60">
        {t("about:creditsIntro")}
      </p>

      <h2 className="mt-10 text-lg font-semibold text-white">{t("about:technologies")}</h2>
      <ul className="mt-3 divide-y divide-white/5">
        {TECH_STACK.map((tk) => (
          <li key={tk.name} className="flex items-center justify-between py-2.5">
            <div>
              <a href={tk.url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium text-purple-400 hover:underline">
                {tk.name}
              </a>
              <p className="text-xs text-white/40">{tk.desc}</p>
            </div>
            <ExternalIcon />
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-white">{t("about:compatibleServices")}</h2>
      <ul className="mt-3 divide-y divide-white/5">
        {SERVICES.map((s) => (
          <li key={s.name} className="flex items-center justify-between py-2.5">
            <div>
              <a href={s.url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium text-purple-400 hover:underline">
                {s.name}
              </a>
              <p className="text-xs text-white/40">{s.desc}</p>
            </div>
            <ExternalIcon />
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-white">{t("about:license")}</h2>
      <p className="mt-3 text-sm leading-relaxed text-white/60">
        {t("about:licenseText")}
      </p>

      <p className="mt-12 text-xs text-white/30">
        {t("about:creditsDisclaimer")}
      </p>
    </div>
  );
}

function ExternalIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}
