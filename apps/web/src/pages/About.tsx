import { useState } from "react";
import { Link } from "react-router-dom";
import { useServerCapabilities } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { isDesktopApp } from "../desktop/bridge";
import { useDesktopVersion } from "../hooks/useDesktopVersion";
import { PageTransition } from "../components/PageTransition";
import { BackButton } from "../components/ui/BackButton";
import { TentacleLogo } from "../components/ui/TentacleLogo";
import type { WhatsNewSelection } from "../whatsNew/selectFeatures";
import { selectionForRelease, whatsNewGateForced } from "../whatsNew/whatsNewDev";
import { WhatsNewScreen } from "../whatsNew/WhatsNewScreen";

export function About() {
  const { t } = useTranslation("about");
  const platform = isDesktopApp() ? "Desktop" : "Web";
  // Sur desktop, la VRAIE version du bundle (ex. 1.0.0 pour le build Mac App
  // Store) dès que la coquille a répondu, la constante de build en attendant.
  const desktopVersion = useDesktopVersion();
  const rawVersion = isDesktopApp() ? desktopVersion : __APP_VERSION_WEB__;
  // Detect pre-release with optional iteration: "1.0.0-beta" → "BETA",
  // "1.0.0-beta.2" → "BETA 2", "2.0.0-rc.1" → "RC 1".
  const preReleaseMatch = rawVersion.match(/-([a-z]+)(?:\.(\d+))?/i);
  const preReleaseTag = preReleaseMatch
    ? (preReleaseMatch[2]
        ? `${preReleaseMatch[1].toUpperCase()} ${preReleaseMatch[2]}`
        : preReleaseMatch[1].toUpperCase())
    : null;
  const versionLabel = rawVersion.replace(/-[a-z]+(\..+)?$/i, "");
  // « Revoir les nouveautés » : desktop seulement, et seulement si la release
  // courante a quelque chose à montrer. Rouvre sans toucher au drapeau. En
  // porte forcée (préviz navigateur), la page affiche la version web : la
  // release à rejouer est celle de la constante desktop.
  // Rien de ce que le serveur ne sait pas faire n'y est rejoué (`capability`).
  const [whatsNew, setWhatsNew] = useState<WhatsNewSelection | null>(null);
  const { capabilities } = useServerCapabilities();
  const replayVersion = isDesktopApp() ? versionLabel : __APP_VERSION_DESKTOP__;
  const canReplayWhatsNew =
    (isDesktopApp() || whatsNewGateForced()) && selectionForRelease(replayVersion, capabilities) !== null;

  return (
    <PageTransition>
    <div className="mx-auto max-w-2xl px-6 pt-16 pb-16">
      <div className="flex items-center gap-3">
        <BackButton fallback="/" className="-ml-1 shrink-0" />
        <div className="flex min-w-0 items-center gap-5">
          <TentacleLogo size="xl" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-display-3 text-content-primary sm:text-[2.5rem]">Tentacle TV</h1>
              {preReleaseTag && <span className="chip chip-accent">{preReleaseTag}</span>}
            </div>
            <p className="num mt-1 text-sm text-content-tertiary">{t("about:version", { version: versionLabel })} — {platform}</p>
          </div>
        </div>
      </div>

      <p className="mt-8 max-w-[65ch] leading-relaxed text-content-secondary">
        {t("about:description")}
      </p>

      <h2 className="mt-10 text-heading-2 text-content-primary">{t("about:features")}</h2>
      <ul className="mt-3 space-y-2 text-sm text-content-secondary">
        <li className="flex items-center gap-2"><Dot /> {t("about:featurePlayer")}</li>
        <li className="flex items-center gap-2"><Dot /> {t("about:featureResume")}</li>
        <li className="flex items-center gap-2"><Dot /> {t("about:featureRequests")}</li>
        <li className="flex items-center gap-2"><Dot /> {t("about:featureDesktop")}</li>
        <li className="flex items-center gap-2"><Dot /> {t("about:featureAdaptive")}</li>
        <li className="flex items-center gap-2"><Dot /> {t("about:featureNotifications")}</li>
      </ul>

      <h2 className="mt-10 text-heading-2 text-content-primary">{t("about:contact")}</h2>
      <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-content-secondary">
        {t("about:contactText")}
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-3">
        <Link to="/credits" className="btn btn-soft pr-3.5">
          {t("about:creditsLink")}
          <CaretRightIcon size={16} aria-hidden />
        </Link>
        {canReplayWhatsNew && (
          <button
            type="button"
            onClick={() => setWhatsNew(selectionForRelease(replayVersion, capabilities))}
            className="btn btn-soft pr-3.5"
          >
            {t("about:whatsNewAgain")}
            <CaretRightIcon size={16} aria-hidden />
          </button>
        )}
      </div>
      <WhatsNewScreen open={whatsNew !== null} selection={whatsNew} onClose={() => setWhatsNew(null)} />

      <p className="mt-8 text-xs text-content-quaternary">
        {t("about:copyright", { version: versionLabel, year: new Date().getFullYear() })}
      </p>
    </div>
    </PageTransition>
  );
}

function Dot() {
  return (
    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-content-quaternary" />
  );
}
