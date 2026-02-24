import { View, Text, ScrollView } from "react-native";
import { Focusable } from "./focus/Focusable";

interface Track {
  index: number;
  label: string;
}

interface TVTrackSelectorProps {
  audioTracks: Track[];
  subtitleTracks: Track[];
  selectedAudio: number;
  selectedSubtitle: number;
  onSelectAudio: (index: number) => void;
  onSelectSubtitle: (index: number) => void;
  onClose: () => void;
}

export function TVTrackSelector({
  audioTracks, subtitleTracks, selectedAudio, selectedSubtitle,
  onSelectAudio, onSelectSubtitle, onClose,
}: TVTrackSelectorProps) {
  return (
    <View style={{
      position: "absolute", top: 0, right: 0, bottom: 0, width: 350,
      backgroundColor: "rgba(18,18,26,0.95)", borderLeftWidth: 1, borderLeftColor: "#1e1e2e",
      paddingVertical: 32, paddingHorizontal: 24,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Paramètres</Text>
        <Focusable onPress={onClose}>
          <View style={{ padding: 8 }}>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 18 }}>✕</Text>
          </View>
        </Focusable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Audio tracks */}
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600", marginBottom: 8, textTransform: "uppercase" }}>
          Audio
        </Text>
        {audioTracks.map((track) => (
          <Focusable key={`audio-${track.index}`} onPress={() => onSelectAudio(track.index)}>
            <View style={{
              flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12,
              borderRadius: 6, marginBottom: 4,
              backgroundColor: track.index === selectedAudio ? "rgba(139,92,246,0.2)" : "transparent",
            }}>
              {track.index === selectedAudio && <Text style={{ color: "#8b5cf6", marginRight: 8 }}>✓</Text>}
              <Text style={{ color: "#fff", fontSize: 15 }}>{track.label}</Text>
            </View>
          </Focusable>
        ))}

        {/* Subtitle tracks */}
        <Text style={{
          color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600",
          marginTop: 20, marginBottom: 8, textTransform: "uppercase",
        }}>
          Sous-titres
        </Text>
        <Focusable onPress={() => onSelectSubtitle(-1)}>
          <View style={{
            paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, marginBottom: 4,
            backgroundColor: selectedSubtitle === -1 ? "rgba(139,92,246,0.2)" : "transparent",
          }}>
            <Text style={{ color: "#fff", fontSize: 15 }}>
              {selectedSubtitle === -1 && "✓ "}Désactivés
            </Text>
          </View>
        </Focusable>
        {subtitleTracks.map((track) => (
          <Focusable key={`sub-${track.index}`} onPress={() => onSelectSubtitle(track.index)}>
            <View style={{
              flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12,
              borderRadius: 6, marginBottom: 4,
              backgroundColor: track.index === selectedSubtitle ? "rgba(139,92,246,0.2)" : "transparent",
            }}>
              {track.index === selectedSubtitle && <Text style={{ color: "#8b5cf6", marginRight: 8 }}>✓</Text>}
              <Text style={{ color: "#fff", fontSize: 15 }}>{track.label}</Text>
            </View>
          </Focusable>
        ))}
      </ScrollView>
    </View>
  );
}
