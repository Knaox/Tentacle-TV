import { memo } from "react";
import { StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import type { ArtworkPalette } from "../color/artworkPalette";
import { PoolLayerView, useLayerPool } from "../motion/LayerStack";
import { colors } from "../theme/tokens";

/**
 * Le fond vivant : le noir cinéma du bureau (#000 → #070710), et trois
 * lumières douces aux couleurs de l'œuvre qui a le focus (ses violets ramenés
 * vers le neutre — la marque se pose en touches, jamais en fond) — jamais un
 * noir pur, jamais une photo. Les lumières sont des dégradés radiaux (aucun flou
 * à calculer) ; quand l'œuvre change, les nouvelles apparaissent en fondu
 * par-dessus les anciennes, sur le fil d'interface, dans une réserve de
 * calques réutilisés (`motion/LayerStack`) : un changement repeint un calque
 * éteint, il n'en crée aucun.
 *
 * Chaque lumière se DESSINE petite — un disque de 128 points — et le GPU
 * l'agrandit à la taille de son ellipse : un dégradé radial agrandi reste
 * lisse, et changer de lumière ne redessine plus trois ellipses plein écran
 * sur le fil principal (mesuré au banc : c'était le premier coût d'un pas du
 * focus sur une rangée).
 *
 * Bord à bord : ce fond ignore la marge de sécurité, seul le contenu la
 * respecte.
 */

export interface AmbientBackdropProps {
  palette: ArtworkPalette;
  /** 0 à 1 — la force des lumières (défaut 1). */
  intensity?: number;
}

/** Le côté du disque dessiné, avant agrandissement. */
const DISC = 128;

const BLOBS = [
  { id: "l", tone: 0, cx: 180, cy: 470, rx: 760, ry: 640, alpha: 0.34 },
  { id: "r", tone: 2, cx: 1700, cy: 980, rx: 700, ry: 460, alpha: 0.2 },
  { id: "t", tone: 1, cx: 1080, cy: 60, rx: 820, ry: 360, alpha: 0.13 },
] as const;

/** Une lumière : le disque, agrandi en ellipse autour de son centre. */
function Glow({ blob, color, intensity }: { blob: (typeof BLOBS)[number]; color: string; intensity: number }) {
  const place = {
    left: blob.cx - DISC / 2,
    top: blob.cy - DISC / 2,
    opacity: blob.alpha * intensity,
    transform: [{ scaleX: (2 * blob.rx) / DISC }, { scaleY: (2 * blob.ry) / DISC }],
  };
  return (
    <View style={[styles.disc, place]}>
      <Svg width={DISC} height={DISC}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="0.45" stopColor={color} stopOpacity={0.5} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={DISC / 2} cy={DISC / 2} r={DISC / 2} fill="url(#glow)" />
      </Svg>
    </View>
  );
}

const Lights = memo(function Lights({ palette, intensity }: { palette: ArtworkPalette; intensity: number }) {
  return (
    <>
      {BLOBS.map((blob) => (
        <Glow key={blob.id} blob={blob} color={palette.glows[blob.tone]} intensity={intensity} />
      ))}
    </>
  );
});

export const AmbientBackdrop = memo(function AmbientBackdrop({ palette, intensity = 1 }: AmbientBackdropProps) {
  const layers = useLayerPool(palette.glows.join("-"), palette);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[colors.bgTop, colors.bgBottom]} style={StyleSheet.absoluteFill} />
      {layers.map((layer) => (
        <PoolLayerView key={layer.slot} present={layer.present} motion="ambient">
          <Lights palette={layer.item} intensity={intensity} />
        </PoolLayerView>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  disc: { position: "absolute", width: DISC, height: DISC },
});
