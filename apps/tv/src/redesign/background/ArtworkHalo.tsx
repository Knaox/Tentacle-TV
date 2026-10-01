import { memo, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, FeGaussianBlur, Filter, LinearGradient, Rect, Stop } from "react-native-svg";
import { TV_STAGE } from "@tentacle-tv/theme";
import { brandLight, type ArtworkPalette } from "../color/artworkPalette";
import { PoolLayerView, useLayerPool } from "../motion/LayerStack";

/**
 * Le halo d'une œuvre : sa lumière qui déborde tout autour de son cadre, aux
 * couleurs de la MARQUE nuancées par son image (`brandLight`) — un halo
 * orange ne disait pas l'app. Violet à gauche, rose à droite, sans retour au
 * violet : le dégradé de la marque, à dominante rose comme les lumières du
 * bureau (`--progress-glow`). Un rectangle arrondi dégradé, flouté UNE fois par
 * le SVG (le bitmap est ensuite réutilisé tel quel) ; rien ne s'anime dans le
 * flou.
 *
 * Le flou se dessine au QUART de sa taille, puis le GPU l'agrandit : un flou
 * agrandi reste un flou, et le fil principal calcule seize fois moins de
 * pixels quand l'œuvre change (le héros qui tourne). Quand elle change, le
 * nouveau halo entre en fondu pendant que l'ancien s'efface (préréglage
 * `hero`) — il ne disparaît plus d'un coup avant que l'autre n'arrive.
 *
 * Posé derrière le cadre, centré sur lui : `width`/`height` sont ceux du
 * cadre, `spread` ce que la lumière déborde avant le flou.
 */

export interface ArtworkHaloProps {
  width: number;
  height: number;
  radius: number;
  palette: ArtworkPalette;
  spread?: number;
  /** Force du halo, 0 à 1. Défaut : celui du héros, `TV_STAGE.hero.haloOpacity`
   *  (0,28, flou 44, débord court) — « plus discret, vraiment » (retour du
   *  2026-10-01) : 0,3 est un PLAFOND. Les petits halos (portrait, disque,
   *  carte) montent un peu plus, jamais au-delà de 0,45 : sur une petite
   *  surface, la même force se voit moins. Jusqu'au 2026-10-01, cette force
   *  n'était PAS rendue (l'animation d'entrée la ramenait à 1) : les halos
   *  s'affichaient pleins, quels que soient ces réglages. */
  opacity?: number;
  blur?: number;
  style?: StyleProp<ViewStyle>;
}

/** L'échelle du dessin, avant agrandissement. */
const DRAW = 0.25;


interface Geometry {
  w: number;
  h: number;
  width: number;
  height: number;
  radius: number;
  spread: number;
  margin: number;
  blur: number;
}

/** Le halo dessiné petit, agrandi autour de son centre à la taille `w × h`. */
const HaloDrawing = memo(function HaloDrawing({ glows, g, opacity }: { glows: readonly string[]; g: Geometry; opacity: number }) {
  const [a, b, c] = glows;
  const small = { width: g.w * DRAW, height: g.h * DRAW };
  const place = {
    left: (g.w - small.width) / 2,
    top: (g.h - small.height) / 2,
    opacity,
    transform: [{ scale: 1 / DRAW }],
  };
  return (
    <View style={[styles.drawing, small, place]}>
      <Svg width={small.width} height={small.height} viewBox={`0 0 ${g.w} ${g.h}`}>
        <Defs>
          <LinearGradient id="halo-fill" x1="0" y1="0" x2="1" y2="0.2">
            <Stop offset="0" stopColor={a} />
            <Stop offset="0.3" stopColor={b} />
            <Stop offset="0.62" stopColor={c} />
            <Stop offset="1" stopColor={c} />
          </LinearGradient>
          {/* Le rayon du flou est en points d'écran (react-native-svg ne
              l'échelonne pas avec le viewBox) : il suit le dessin. */}
          <Filter id="halo-blur" x="-20%" y="-30%" width="140%" height="160%">
            <FeGaussianBlur stdDeviation={g.blur * DRAW} />
          </Filter>
        </Defs>
        <Rect
          x={g.margin - g.spread}
          y={g.margin - g.spread}
          width={g.width + g.spread * 2}
          height={g.height + g.spread * 2}
          rx={g.radius + g.spread}
          fill="url(#halo-fill)"
          filter="url(#halo-blur)"
        />
      </Svg>
    </View>
  );
});

export const ArtworkHalo = memo(function ArtworkHalo({
  width,
  height,
  radius,
  palette,
  spread = 26,
  opacity = TV_STAGE.hero.haloOpacity,
  blur = 44,
  style,
}: ArtworkHaloProps) {
  // Le flou a besoin de place : trois écarts-types de chaque côté.
  const margin = spread + blur * 3;
  const w = width + margin * 2;
  const h = height + margin * 2;
  const glows = useMemo(() => brandLight(palette).glows, [palette]);
  const layers = useLayerPool(glows.join("-"), glows, 3);
  const g = useMemo<Geometry>(() => ({ w, h, width, height, radius, spread, margin, blur }), [w, h, width, height, radius, spread, margin, blur]);
  return (
    <View pointerEvents="none" style={[{ position: "absolute", left: -margin, top: -margin, width: w, height: h }, style]}>
      {layers.map((layer) => (
        <PoolLayerView key={layer.slot} present={layer.present} motion="hero">
          <HaloDrawing glows={layer.item} g={g} opacity={opacity} />
        </PoolLayerView>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  drawing: { position: "absolute" },
});
