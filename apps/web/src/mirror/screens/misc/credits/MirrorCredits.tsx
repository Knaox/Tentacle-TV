import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Award, Code, Server } from "lucide-react";
import { useContentPadding } from "../../../useMirrorLayout";
import { AmbientGlow } from "../shared/AmbientGlow";
import { useBackOrHome } from "../shared/backOrHome";
import { FadeIn } from "../shared/FadeIn";
import { GlassCard } from "../shared/GlassCard";
import { ScreenTitle } from "../shared/ScreenTitle";
import { brandTile, SECTION_HEADER_STYLE } from "../shared/sectionStyles";
import { CreditRow } from "./CreditRow";
import { TECH_STACK } from "./techStack";
import "../../../mirror.css";
import "../shared/screens.css";

/**
 * `CreditsScreen` de l'app (`/credits`) : colonne de 640, tête (marge 16),
 * intro 14/22, trois sections en `GlassCard` (technologies séparées par un
 * filet à 12, services, licence), mention finale 11 à 32 du bas.
 */
export function MirrorCredits() {
  const { t } = useTranslation("about");
  const goBack = useBackOrHome();
  const pad = useContentPadding();

  return (
    <div className="relative" style={{ paddingTop: 12, paddingBottom: 32, paddingLeft: pad, paddingRight: pad }}>
      <AmbientGlow />
      <div className="relative">
        <ScreenTitle title={t("creditsTitle")} onBack={goBack} className="mb-4" />

        <FadeIn>
          <p className="text-content-secondary" style={{ fontSize: 14, lineHeight: "22px", marginBottom: 24 }}>
            {t("creditsIntro")}
          </p>
        </FadeIn>

        <FadeIn delay={80}>
          <h2 style={SECTION_HEADER_STYLE}>{t("technologies")}</h2>
          <GlassCard style={{ marginBottom: 24 }}>
            {TECH_STACK.map((tech, i) => (
              <Fragment key={tech.name}>
                <CreditRow icon={<Code size={14} />} name={tech.name} description={t(tech.descKey)} />
                {i < TECH_STACK.length - 1 && <div className="bg-line-subtle" style={{ height: 1, margin: "12px 0" }} />}
              </Fragment>
            ))}
          </GlassCard>
        </FadeIn>

        <FadeIn delay={160}>
          <h2 style={SECTION_HEADER_STYLE}>{t("compatibleServices")}</h2>
          <GlassCard style={{ marginBottom: 24 }}>
            <CreditRow icon={<Server size={14} />} name="Jellyfin" description={t("serviceJellyfin")} />
          </GlassCard>
        </FadeIn>

        <FadeIn delay={240}>
          <h2 style={SECTION_HEADER_STYLE}>{t("license")}</h2>
          <GlassCard>
            <div className="flex items-start" style={{ gap: 12 }}>
              <span style={{ ...brandTile(32, 8), marginTop: 2 }}><Award size={14} /></span>
              <p className="flex-1 whitespace-pre-line text-content-secondary" style={{ fontSize: 13, lineHeight: "20px" }}>
                {`${t("licenseText")}\n\n${t("licenseTextMobile")}`}
              </p>
            </div>
          </GlassCard>
        </FadeIn>

        <p className="text-center text-content-quaternary" style={{ fontSize: 11, marginTop: 32 }}>
          {t("creditsDisclaimer")}
        </p>
      </div>
    </div>
  );
}
