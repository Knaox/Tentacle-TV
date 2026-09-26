import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Monitor, PlayCircle, Rewind, Send, Smartphone, type LucideIcon } from "lucide-react";
import { GlassCard } from "../shared/GlassCard";
import { brandTile, SECTION_HEADER_STYLE } from "../shared/sectionStyles";

/** `FEATURE_KEYS` de l'app, mêmes icônes Feather (play-circle, rewind…). */
const FEATURES: { key: string; Icon: LucideIcon }[] = [
  { key: "featurePlayer", Icon: PlayCircle },
  { key: "featureResume", Icon: Rewind },
  { key: "featureRequests", Icon: Send },
  { key: "featureDesktop", Icon: Monitor },
  { key: "featureAdaptive", Icon: Smartphone },
  { key: "featureNotifications", Icon: Bell },
];

/**
 * Les fonctionnalités d'`AboutScreen` : une `GlassCard` par ligne (écart 10),
 * padding 14, pastille 36 rayon 10, icône 18, texte 14 medium à 90 %.
 */
export const AboutFeatureList = memo(function AboutFeatureList() {
  const { t } = useTranslation("about");
  return (
    <>
      <h2 style={SECTION_HEADER_STYLE}>{t("features")}</h2>
      <div className="flex flex-col" style={{ gap: 10, marginBottom: 28 }}>
        {FEATURES.map(({ key, Icon }) => (
          <GlassCard key={key} padding={0}>
            <div className="flex items-center" style={{ gap: 14, padding: 14 }}>
              <span style={brandTile(36, 10)}>
                <Icon size={18} strokeWidth={2} />
              </span>
              <span
                className="flex-1 font-medium"
                style={{ fontSize: 14, letterSpacing: -0.1, color: "var(--text-primary)", opacity: 0.9 }}
              >
                {t(key)}
              </span>
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
});
