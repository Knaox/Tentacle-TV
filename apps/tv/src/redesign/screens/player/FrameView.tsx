import { memo } from "react";
import { Image, StyleSheet, View } from "react-native";
import type { FrameImage } from "./playerTypes";

/**
 * Une image plein cadre du lecteur : l'image entière (couvre le cadre), ou
 * une case d'une planche de vignettes, agrandie à l'écran sans la déformer
 * (bandes noires au besoin). Sert au défilement et au rechargement doux.
 */
export const FrameView = memo(function FrameView({
  frame,
  width = 1920,
  height = 1080,
}: {
  frame: FrameImage;
  width?: number;
  height?: number;
}) {
  const crop = frame.crop;
  if (!crop) {
    return <Image source={{ uri: frame.uri }} style={{ width, height }} resizeMode="cover" fadeDuration={0} />;
  }
  const scale = Math.min(width / crop.width, height / crop.height);
  return (
    <View style={[styles.box, { width, height }]}>
      <View style={{ width: crop.width * scale, height: crop.height * scale, overflow: "hidden" }}>
        <Image
          source={{ uri: frame.uri }}
          style={{
            position: "absolute",
            left: -crop.x * scale,
            top: -crop.y * scale,
            width: crop.sheetWidth * scale,
            height: crop.sheetHeight * scale,
          }}
          resizeMode="stretch"
          fadeDuration={0}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
});
