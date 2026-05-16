import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import {
  QUALITY_PRESETS, formatBitrateMbps,
  type QualityKey, type SourceQuality,
} from "@tentacle-tv/shared";
import { Focusable } from "../focus/Focusable";
import { CheckIcon } from "../icons/TVIcons";
import { Colors, Radius } from "../../theme/colors";

const QUALITY_ITEM_HEIGHT = 52;

export interface TVQualitySectionProps {
  qualityKey: QualityKey;
  sourceQuality?: SourceQuality;
  onSelectQuality: (key: QualityKey) => void;
  onInteraction?: () => void;
  makeOnFocus: (scrollIndex: number, height: number) => () => void;
  scrollOffsetStart: number;
}

/**
 * Sélecteur de qualité dans le panneau Paramètres TV.
 * - Original : suffixe résolution (4K / 1080p / 720p) + chips HDR/DV/Atmos
 * - Presets transcodés : nom + chip Mbps (30 / 10 / 4)
 */
export function TVQualitySection({
  qualityKey, sourceQuality, onSelectQuality, onInteraction,
  makeOnFocus, scrollOffsetStart,
}: TVQualitySectionProps) {
  const { t } = useTranslation("player");

  return (
    <View>
      <Text style={{
        color: Colors.textTertiary, fontSize: 14, fontWeight: "700",
        letterSpacing: 1, marginTop: 28, marginBottom: 10, marginLeft: 8,
        textTransform: "uppercase",
      }}>
        {t("quality")}
      </Text>

      {QUALITY_PRESETS.map((preset, i) => {
        const isOriginal = preset.key === "original";
        const active = qualityKey === preset.key;
        const suffix = isOriginal && sourceQuality?.resolution ? `— ${sourceQuality.resolution}` : null;
        const mbpsChip = !isOriginal && preset.bitrate ? formatBitrateMbps(preset.bitrate) : null;

        return (
          <Focusable
            key={preset.key}
            variant="row"
            onPress={() => { onSelectQuality(preset.key); onInteraction?.(); }}
            onFocus={makeOnFocus(scrollOffsetStart + i, QUALITY_ITEM_HEIGHT)}
          >
            <View style={{
              flexDirection: "row", alignItems: "center",
              paddingVertical: 14, paddingHorizontal: 16,
              borderRadius: Radius.small, marginBottom: 4,
              backgroundColor: active ? "rgba(139, 92, 246, 0.15)" : "transparent",
            }}>
              <View style={{ width: 28, alignItems: "center" }}>
                {active && <CheckIcon size={16} color={Colors.accentPurple} />}
              </View>
              <Text style={{
                color: active ? Colors.textPrimary : Colors.textSecondary,
                fontSize: 16, fontWeight: active ? "600" : "400",
              }}>
                {t(preset.key)}
              </Text>
              {suffix && (
                <Text style={{ color: Colors.textTertiary, fontSize: 15, marginLeft: 6 }}>
                  {suffix}
                </Text>
              )}
              {isOriginal && sourceQuality?.isDolbyVision && <QualityChip label="DV" tone="purple" />}
              {isOriginal && sourceQuality?.isHDR && <QualityChip label="HDR" tone="amber" />}
              {isOriginal && sourceQuality?.isDolbyAtmos && <QualityChip label="Atmos" tone="amber" />}
              {mbpsChip && (
                <View style={{ marginLeft: "auto" }}>
                  <QualityChip label={mbpsChip} tone="zinc" />
                </View>
              )}
            </View>
          </Focusable>
        );
      })}
    </View>
  );
}

function QualityChip({ label, tone }: { label: string; tone: "purple" | "amber" | "zinc" }) {
  const palette = tone === "purple"
    ? { bg: "rgba(139,92,246,0.2)", fg: "#c4b5fd" }
    : tone === "amber"
      ? { bg: "rgba(245,158,11,0.2)", fg: "#fcd34d" }
      : { bg: "rgba(255,255,255,0.08)", fg: "rgba(255,255,255,0.55)" };
  return (
    <View style={{
      marginLeft: 6,
      backgroundColor: palette.bg,
      paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4,
    }}>
      <Text style={{ color: palette.fg, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
