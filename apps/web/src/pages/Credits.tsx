import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { PageTransition } from "../components/PageTransition";
import { BackButton } from "../components/ui/BackButton";
import { externalLinkHandler } from "../lib/openExternal";
import { isDesktopApp } from "../desktop/bridge";
import { useDesktopVersion } from "../hooks/useDesktopVersion";
import { LicensesSection } from "../components/licenses/LicensesSection";
import { webLicensePlatform } from "../components/licenses/licensePlatform";

export function Credits() {
  const { t } = useTranslation("about");
  const desktopVersion = useDesktopVersion();
  const platform = webLicensePlatform();
  // La version sans suffixe de pré-version : c'est elle que porte le tag.
  const version = (isDesktopApp() ? desktopVersion : __APP_VERSION_WEB__).replace(/-[a-z]+(\..+)?$/i, "");

  const TECH_STACK = useMemo(() => [
    { name: "React", url: "https://react.dev", desc: t("about:techReact") },
    { name: "TypeScript", url: "https://typescriptlang.org", desc: t("about:techTypeScript") },
    { name: "Vite", url: "https://vitejs.dev", desc: t("about:techVite") },
    { name: "Tailwind CSS", url: "https://tailwindcss.com", desc: t("about:techTailwind") },
    { name: "Framer Motion", url: "https://motion.dev", desc: t("about:techFramerMotion") },
    { name: "TanStack Query", url: "https://tanstack.com/query", desc: t("about:techTanStackQuery") },
    { name: "React Router", url: "https://reactrouter.com", desc: t("about:techReactRouter") },
    { name: "Fastify", url: "https://fastify.dev", desc: t("about:techFastify") },
    // La coquille du bureau depuis la 1.50.0, sur les trois systèmes : CEF (Chromium
    // Embedded Framework) + SDL3, avec libmpv liée directement (`apps/desktop-cef`).
    { name: "Chromium Embedded Framework", url: "https://github.com/chromiumembedded/cef", desc: t("about:techCef") },
    { name: "Expo", url: "https://expo.dev", desc: t("about:techExpo") },
    { name: "React Native", url: "https://reactnative.dev", desc: t("about:techReactNative") },
    { name: "ExoPlayer / Media3", url: "https://developer.android.com/media/media3/exoplayer", desc: t("about:techExoPlayer") },
    { name: "mpv", url: "https://mpv.io", desc: t("about:techMpv") },
    { name: "FFmpeg", url: "https://ffmpeg.org", desc: t("about:techFFmpeg") },
    // Livré dans le paquet macOS : mpv y rend par Vulkan, que MoltenVK traduit
    // vers Metal. Sans lui, aucune image — voir `THIRD-PARTY-LICENSES.md`.
    { name: "MoltenVK", url: "https://github.com/KhronosGroup/MoltenVK", desc: t("about:techMoltenVK") },
    { name: "VoidTV", url: "https://github.com/hritwikjohri/VoidTV-for-jellyfin", desc: t("about:techVoidTV") },
  ], [t]);

  const SERVICES = useMemo(() => [
    { name: "Jellyfin", url: "https://jellyfin.org", desc: t("about:serviceJellyfin") },
  ], [t]);

  return (
    <PageTransition>
    <div className="mx-auto max-w-2xl px-6 pb-16 pt-12">
      <header className="flex items-start gap-3">
        <BackButton fallback="/" className="-ml-1 shrink-0" />
        <div className="min-w-0 pt-0.5">
          <h1 className="text-[1.875rem] font-[650] leading-[1.15] tracking-[-0.02em] text-content-primary">{t("about:creditsTitle")}</h1>
          <p className="mt-1.5 max-w-[65ch] text-sm leading-relaxed text-content-secondary">
            {t("about:creditsIntro")}
          </p>
        </div>
      </header>

      <h2 className="mt-10 text-heading-2 text-content-primary">{t("about:technologies")}</h2>
      <ul className="mt-3 divide-y divide-line-subtle">
        {TECH_STACK.map((tk) => (
          <li key={tk.name} className="flex items-center justify-between gap-4 py-2.5">
            <div>
              <a href={tk.url} target="_blank" rel="noopener noreferrer"
                onClick={externalLinkHandler(tk.url)}
                className="text-sm font-semibold text-accent hover:underline">
                {tk.name}
              </a>
              <p className="text-xs text-content-tertiary">{tk.desc}</p>
            </div>
            <ExternalIcon />
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-heading-2 text-content-primary">{t("about:compatibleServices")}</h2>
      <ul className="mt-3 divide-y divide-line-subtle">
        {SERVICES.map((s) => (
          <li key={s.name} className="flex items-center justify-between gap-4 py-2.5">
            <div>
              <a href={s.url} target="_blank" rel="noopener noreferrer"
                onClick={externalLinkHandler(s.url)}
                className="text-sm font-semibold text-accent hover:underline">
                {s.name}
              </a>
              <p className="text-xs text-content-tertiary">{s.desc}</p>
            </div>
            <ExternalIcon />
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-heading-2 text-content-primary">{t("about:license")}</h2>
      <p className="mt-3 text-sm leading-relaxed text-content-tertiary">
        {t("about:licenseText")}
      </p>
      {isDesktopApp() ? (
        <p className="mt-3 text-sm leading-relaxed text-content-tertiary">{t("about:licenseTextDesktop")}</p>
      ) : null}

      <LicensesSection platform={platform} version={version} />

      <p className="mt-12 text-xs text-content-quaternary">
        {t("about:creditsDisclaimer")}
      </p>
    </div>
    </PageTransition>
  );
}

function ExternalIcon() {
  return <ArrowSquareOutIcon size={16} aria-hidden className="flex-shrink-0 text-content-quaternary" />;
}
