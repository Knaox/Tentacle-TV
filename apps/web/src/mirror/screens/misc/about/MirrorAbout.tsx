import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, ExternalLink } from "lucide-react";
import { TentacleSvg } from "../../../../components/ui/TentacleSvg";
import { isDesktopApp } from "../../../../desktop/bridge";
import { useDesktopVersion } from "../../../../hooks/useDesktopVersion";
import { openExternal } from "../../../../lib/openExternal";
import { useContentPadding } from "../../../useMirrorLayout";
import { AmbientGlow } from "../shared/AmbientGlow";
import { useBackOrHome } from "../shared/backOrHome";
import { FadeIn } from "../shared/FadeIn";
import { ScreenTitle } from "../shared/ScreenTitle";
import { AboutFeatureList } from "./AboutFeatureList";
import { displayVersion } from "./version";
import "../../../mirror.css";
import "../shared/screens.css";

const PRIVACY_POLICY_URL = "https://github.com/Knaox/Tentacle-TV/blob/main/PRIVACY.md";

/**
 * `AboutScreen` de l'app (`/about`) : colonne centrée de 640, tête chevron 40 +
 * titre 28, logo 80, nom 28 extra-gras, version 12 `brand.light`, description
 * 14/22 centrée, fonctionnalités en cartes de verre, lien Crédits (surface s2,
 * rayon 12, 56 de haut), politique de confidentialité, mention 11.
 */
export function MirrorAbout() {
  const { t } = useTranslation("about");
  const navigate = useNavigate();
  const goBack = useBackOrHome();
  const pad = useContentPadding();
  const desktopVersion = useDesktopVersion();
  const version = displayVersion(isDesktopApp() ? desktopVersion : __APP_VERSION_WEB__);
  const openPrivacy = useCallback(() => void openExternal(PRIVACY_POLICY_URL), []);

  return (
    <div className="relative" style={{ paddingTop: 12, paddingBottom: 32, paddingLeft: pad, paddingRight: pad }}>
      <AmbientGlow />
      <div className="relative">
        <ScreenTitle title={t("title")} onBack={goBack} className="mb-6" />

        <FadeIn className="flex flex-col items-center" style={{ marginBottom: 28 }}>
          <TentacleSvg size={80} />
          <p className="font-extrabold text-content-primary" style={{ fontSize: 28, letterSpacing: -0.6, marginTop: 14 }}>
            Tentacle TV
          </p>
          <p className="font-medium" style={{ fontSize: 12, letterSpacing: 0.4, marginTop: 4, color: "var(--brand-light)" }}>
            {t("version", { version })}
          </p>
        </FadeIn>

        <FadeIn delay={100}>
          <p className="text-center text-content-secondary" style={{ fontSize: 14, lineHeight: "22px", marginBottom: 24, paddingLeft: 8, paddingRight: 8 }}>
            {t("description")}
          </p>
        </FadeIn>

        <FadeIn delay={200}>
          <AboutFeatureList />
        </FadeIn>

        <FadeIn delay={300}>
          <button
            type="button"
            onClick={() => navigate("/credits")}
            className="mirror-dim flex w-full items-center justify-between rounded-xl border border-line-subtle bg-surface-2 text-left"
            style={{ padding: 16, minHeight: 56, marginBottom: 16 }}
          >
            <span className="font-semibold" style={{ fontSize: 15, color: "var(--brand-light)" }}>{t("creditsLink")}</span>
            <ChevronRight size={20} className="text-content-quaternary" />
          </button>
        </FadeIn>

        <FadeIn delay={400}>
          <button
            type="button"
            onClick={openPrivacy}
            className="flex w-full items-center justify-center gap-2 text-content-tertiary active:opacity-70"
            style={{ paddingTop: 12, paddingBottom: 12, minHeight: 44 }}
          >
            <ExternalLink size={14} />
            <span className="font-medium underline" style={{ fontSize: 13 }}>{t("privacyPolicy")}</span>
          </button>
        </FadeIn>

        <p className="text-center text-content-quaternary" style={{ fontSize: 11, marginTop: 16 }}>
          {t("copyright", { version: `v${version}`, year: new Date().getFullYear() })}
        </p>
      </div>
    </div>
  );
}
