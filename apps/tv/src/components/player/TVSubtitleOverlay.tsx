import { memo } from "react";
import { View, Text } from "react-native";

interface TVSubtitleOverlayProps {
  /** Cue courante (null = rien à afficher) */
  text: string | null;
  /** OSD affiché → remonter les sous-titres au-dessus des contrôles */
  osdVisible: boolean;
}

/**
 * Rendu JS des sous-titres texte (cf. useTVSubtitles) — le player natif
 * n'est jamais rechargé pour les sous-titres. Style classique TV : texte
 * blanc ombré sur bandeau discret, centré bas.
 */
export const TVSubtitleOverlay = memo(function TVSubtitleOverlay({ text, osdVisible }: TVSubtitleOverlayProps) {
  if (!text) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute", left: 0, right: 0,
        bottom: osdVisible ? 210 : 56,
        alignItems: "center",
        zIndex: 40, elevation: 40,
      }}
    >
      <View style={{
        backgroundColor: "rgba(0,0,0,0.55)",
        borderRadius: 8,
        paddingHorizontal: 18,
        paddingVertical: 6,
        maxWidth: "78%",
      }}>
        <Text style={{
          color: "#fff",
          fontSize: 30,
          lineHeight: 40,
          textAlign: "center",
          textShadowColor: "rgba(0,0,0,0.9)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }}>
          {text}
        </Text>
      </View>
    </View>
  );
});
