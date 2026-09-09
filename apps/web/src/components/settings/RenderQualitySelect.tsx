import { useState } from "react";
import { useTranslation } from "react-i18next";
import { desktopPlatform, supportsMpv } from "../../desktop/bridge";
import { renderQualityChoice, setRenderQuality, type RenderQuality } from "../../lib/renderQuality";
import { SettingsSection } from "@tentacle-tv/ui";
import { SegmentedChoice } from "./SegmentedChoice";

/**
 * La qualité de rendu — Automatique / Économe.
 *
 * Les défauts de mpv sont de bons défauts, et chacun est une passe de shader par
 * image : sur un GPU intégré, ils s'entendent au ventilateur. Ce réglage les
 * allège sans jamais rien décider à la place de l'utilisateur — voir
 * `lib/renderQuality.ts`, qui porte les mesures.
 *
 * N'apparaît que là où mpv rend : la coquille de bureau. Le choix appartient à
 * l'appareil, et s'applique à la lecture suivante — pas de relance.
 */
export function RenderQualitySelect() {
  const { t } = useTranslation("preferences");
  const [choice, setChoice] = useState<RenderQuality>(renderQualityChoice);

  if (!supportsMpv() || desktopPlatform() === "web") return null;

  return (
    <SettingsSection title={t("renderQualityTitle")}>
      <div className="p-5">
        <p className="text-xs leading-relaxed text-content-tertiary">{t("renderQualityHint")}</p>
        <SegmentedChoice
          label={t("renderQualityTitle")}
          value={choice}
          options={[
            { value: "auto", label: t("renderQualityAuto") },
            { value: "eco", label: t("renderQualityEco") },
          ]}
          onChange={(next: RenderQuality) => {
            setChoice(next);
            setRenderQuality(next);
          }}
          className="mt-4 max-w-full"
        />
        <p className="mt-3 text-xs leading-relaxed text-content-quaternary">
          {t(choice === "auto" ? "renderQualityAutoHint" : "renderQualityEcoHint")}
        </p>
      </div>
    </SettingsSection>
  );
}
