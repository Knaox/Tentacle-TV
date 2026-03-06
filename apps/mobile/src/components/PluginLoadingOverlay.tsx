import { useEffect, useRef, useState } from "react";
import { Animated, ActivityIndicator, Text, StyleSheet } from "react-native";
import { TentacleLogo } from "./TentacleLogo";
import { colors, typography } from "@/theme";

interface PluginLoadingOverlayProps {
  visible: boolean;
  label: string;
  onHidden: () => void;
}

export function PluginLoadingOverlay({ visible, label, onHidden }: PluginLoadingOverlayProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!visible) {
      const anim = Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      });
      anim.start(() => {
        setGone(true);
        onHidden();
      });
      return () => anim.stop();
    }
  }, [visible, opacity, onHidden]);

  if (gone) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <TentacleLogo size={80} />
      <ActivityIndicator
        size="small"
        color={colors.accent}
        style={styles.spinner}
      />
      {label ? (
        <Text style={styles.label}>Chargement de {label}…</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  spinner: {
    marginTop: 20,
  },
  label: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 12,
  },
});
