/**
 * Octave (mobile) — « Réglages d'Octave » DANS la coquille d'Octave (`/octave/settings`, comme le bureau : on y
 * voit l'apparence d'Octave en direct, sans retomber dans les films) : la page du mode, son grand titre et son
 * retour, puis le volet des réglages — deux colonnes sur tablette.
 */

import { useTranslation } from "react-i18next";
import { useWindowDimensions } from "react-native";
import { OctavePage, useOctaveLayout } from "@/octave/layout";
import type { OctaveScreenProps } from "@/octave/registry/octaveRegistryTypes";
import { OctaveSettingsPane, TWO_COLUMNS_MIN_WIDTH } from "./OctaveSettingsScreen";

export function OctaveSettingsRoute(_props: OctaveScreenProps) {
  const { t } = useTranslation("octaveShell");
  const { width } = useWindowDimensions();
  const { gutter } = useOctaveLayout();
  return (
    <OctavePage title={t("settings.title")} subtitle={t("settings.kicker")} back>
      <OctaveSettingsPane wide={width >= TWO_COLUMNS_MIN_WIDTH} gutter={gutter} />
    </OctavePage>
  );
}
