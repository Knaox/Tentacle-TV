import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Pressable, Animated, Dimensions, ScrollView, Modal } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Track {
  index: number;
  label: string;
}

interface Props {
  title: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  audioTracks: Track[];
  subtitleTracks: Track[];
  selectedAudio: number;
  selectedSubtitle: number;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onBack: () => void;
  onSelectAudio: (index: number) => void;
  onSelectSubtitle: (index: number) => void;
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function MobilePlayerOverlay({
  title, currentTime, duration, paused,
  audioTracks, subtitleTracks, selectedAudio, selectedSubtitle,
  onPlayPause, onSeek, onBack, onSelectAudio, onSelectSubtitle,
}: Props) {
  const [visible, setVisible] = useState(true);
  const [showTracks, setShowTracks] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!paused) {
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setVisible(false));
      }, 4000);
    }
  }, [paused, opacity]);

  useEffect(() => { resetHideTimer(); return () => { if (hideTimer.current) clearTimeout(hideTimer.current); }; }, [resetHideTimer]);

  const handleTap = () => {
    if (!visible) {
      setVisible(true);
      opacity.setValue(1);
      resetHideTimer();
    } else {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setVisible(false));
    }
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  const handleScrub = (locationX: number) => {
    const pct = Math.max(0, Math.min(1, locationX / (SCREEN_WIDTH - 32)));
    onSeek(pct * duration);
    resetHideTimer();
  };

  return (
    <>
      <Pressable onPress={handleTap} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        {visible && (
          <Animated.View style={{ flex: 1, opacity, backgroundColor: "rgba(0,0,0,0.4)" }}>
            {/* Top bar */}
            <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 48, paddingHorizontal: 16, gap: 12 }}>
              <Pressable onPress={onBack} hitSlop={16}>
                <Text style={{ color: "#fff", fontSize: 24 }}>←</Text>
              </Pressable>
              <Text numberOfLines={1} style={{ color: "#fff", fontSize: 16, fontWeight: "600", flex: 1 }}>{title}</Text>
              <Pressable onPress={() => setShowTracks(true)} hitSlop={16}>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>Pistes</Text>
              </Pressable>
            </View>

            {/* Center controls */}
            <View style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 40 }}>
              <Pressable onPress={() => { onSeek(currentTime - 10); resetHideTimer(); }} hitSlop={16}>
                <Text style={{ color: "#fff", fontSize: 20 }}>-10s</Text>
              </Pressable>
              <Pressable onPress={() => { onPlayPause(); resetHideTimer(); }} hitSlop={16}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 24 }}>{paused ? "▶" : "⏸"}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => { onSeek(currentTime + 30); resetHideTimer(); }} hitSlop={16}>
                <Text style={{ color: "#fff", fontSize: 20 }}>+30s</Text>
              </Pressable>
            </View>

            {/* Progress bar */}
            <View style={{ paddingHorizontal: 16, paddingBottom: 36 }}>
              <Pressable
                onPress={(e) => handleScrub(e.nativeEvent.locationX)}
                style={{ height: 20, justifyContent: "center" }}
              >
                <View style={{ height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 }}>
                  <View style={{ height: "100%", width: `${progress * 100}%`, backgroundColor: "#8b5cf6", borderRadius: 2 }} />
                </View>
              </Pressable>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{formatTime(currentTime)}</Text>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{formatTime(duration)}</Text>
              </View>
            </View>
          </Animated.View>
        )}
      </Pressable>

      {/* Track selection modal */}
      <Modal visible={showTracks} transparent animationType="slide" onRequestClose={() => setShowTracks(false)}>
        <Pressable onPress={() => setShowTracks(false)} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
          <View style={{ backgroundColor: "#12121a", borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "60%", paddingBottom: 32 }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#1e1e2e" }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Pistes audio et sous-titres</Text>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {audioTracks.length > 0 && (
                <>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", marginBottom: 8 }}>AUDIO</Text>
                  {audioTracks.map((t) => (
                    <Pressable key={t.index} onPress={() => onSelectAudio(t.index)}
                      style={{ paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: selectedAudio === t.index ? "#8b5cf6" : "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" }}>
                        {selectedAudio === t.index && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#8b5cf6" }} />}
                      </View>
                      <Text style={{ color: "#fff", fontSize: 14 }}>{t.label}</Text>
                    </Pressable>
                  ))}
                </>
              )}
              {subtitleTracks.length > 0 && (
                <>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", marginTop: 16, marginBottom: 8 }}>SOUS-TITRES</Text>
                  <Pressable onPress={() => onSelectSubtitle(-1)}
                    style={{ paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: selectedSubtitle === -1 ? "#8b5cf6" : "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" }}>
                      {selectedSubtitle === -1 && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#8b5cf6" }} />}
                    </View>
                    <Text style={{ color: "#fff", fontSize: 14 }}>Désactivé</Text>
                  </Pressable>
                  {subtitleTracks.map((t) => (
                    <Pressable key={t.index} onPress={() => onSelectSubtitle(t.index)}
                      style={{ paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: selectedSubtitle === t.index ? "#8b5cf6" : "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" }}>
                        {selectedSubtitle === t.index && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#8b5cf6" }} />}
                      </View>
                      <Text style={{ color: "#fff", fontSize: 14 }}>{t.label}</Text>
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
