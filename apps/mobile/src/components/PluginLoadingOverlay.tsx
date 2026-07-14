import { useEffect, useRef, useState } from "react";
import { Animated, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { TentacleLogo } from "./TentacleLogo";
import { typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface PluginLoadingOverlayProps {
  visible: boolean;
  label: string;
  onHidden: () => void;
}

export function PluginLoadingOverlay({ visible, label, onHidden }: PluginLoadingOverlayProps) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
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
        color={theme.colors.brand.violet}
        style={styles.spinner}
      />
      {label ? (
        <Text style={styles.label}>{t("loadingPlugin", { label })}</Text>
      ) : null}
    </Animated.View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.colors.surface.s0,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    spinner: {
      marginTop: 20,
    },
    label: {
      ...typography.body,
      color: t.colors.text.tertiary,
      marginTop: 12,
    },
  });
