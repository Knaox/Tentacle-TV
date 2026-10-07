import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { TV_LIGHT } from "@tentacle-tv/theme";
import { boundedLight, type ArtworkPalette } from "../color/artworkPalette";
import { PoolLayerView, useLayerPool } from "../motion/LayerStack";
import { colors } from "../theme/tokens";
import { useAmbientOf, type AmbientSource } from "./ambientSource";
import { RadialLight } from "./RadialLight";
import { SoftGradient, STAGE_SIZE } from "./SoftGradient";
import { effectOff } from "../render/measuredEffects";
import { RENDER } from "../render/renderProfile";

// Interrupteur de MESURE (lot Lite) : l'app de mesure seulement, jamais l'app livrée.
const AMBIENT_OFF = effectOff("ambient");
/** Profil Lite (`ambient: "tint"`) : une seule teinte statique, venue d'en haut. */
const TINT = RENDER.ambient === "tint";

/**
 * Le fond vivant : l'ENCRE de la scène (`TV_LIGHT.ink` — à peine teintée de
 * la marque, plus claire en haut ; jamais le noir pur, jamais un fond
 * violet), et trois lumières aux couleurs de l'œuvre qui a le focus (ses
 * violets ramenés vers le neutre — la marque se pose en touches) : une large,
 * d'en haut, qui éclaire toute la scène, et une de chaque côté. Dans une
 * grille pleine de cartes, la carte focalisée ne flotte plus sur un « grand
 * noir » (retour de l'essai sur l'Apple TV, 2026-10-01) : où qu'elle soit,
 * une lumière passe derrière elle.
 *
 * Les lumières sont des dégradés radiaux (aucun flou à calculer), à la
 * décroissance douce : sans bord visible, elles se lisent comme une lumière,
 * pas comme une tache. Leur clarté est bornée (`boundedLight`) : un jaune vif
 * n'éblouit pas, et le texte posé dessus garde son contraste. Quand l'œuvre
 * change, les nouvelles lumières apparaissent en fondu par-dessus les
 * anciennes, sur le fil d'interface, dans une réserve de calques réutilisés
 * (`motion/LayerStack`) : un changement repeint un calque éteint, il n'en
 * crée aucun. À l'arrêt, rien ne s'anime.
 *
 * Chaque lumière se DESSINE petite — un disque de 128 points — et le GPU
 * l'agrandit à la taille de son ellipse : un dégradé radial agrandi reste
 * lisse, et changer de lumière ne redessine plus trois ellipses plein écran
 * sur le fil principal (mesuré au banc : c'était le premier coût d'un pas du
 * focus sur une rangée).
 *
 * Profil Lite (`ambient: "tint"`) : ni lumières ni dégradé radial — UNE
 * teinte de l'œuvre (sa lumière d'en haut, même clarté bornée), en dégradé
 * vertical à deux arrêts dessiné petit, posée sur l'encre. Quand l'œuvre
 * change, la nouvelle teinte entre en UN fondu court (`ambient`, bref) ; deux
 * calques gardés au lieu de cinq.
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

const A = TV_LIGHT.ambient;

/** `tone` : la couleur de l'œuvre, de gauche à droite de son image. */
const BLOBS = [
  // D'en haut, sur toute la largeur : son cœur au-dessus de l'écran, la scène
  // en reçoit la retombée.
  { id: "t", tone: 1, cx: 980, cy: -120, rx: 1300, ry: 680, alpha: A.key },
  { id: "l", tone: 0, cx: 40, cy: 620, rx: 680, ry: 780, alpha: A.left },
  { id: "r", tone: 2, cx: 1900, cy: 600, rx: 680, ry: 780, alpha: A.right },
] as const;

/** La décroissance d'une lumière, du cœur au bord : douce, sans bord visible. */
const FALLOFF = [
  [0, 1],
  [0.3, 0.7],
  [0.58, 0.34],
  [0.82, 0.1],
  [1, 0],
] as const;

/** Une lumière : le disque, agrandi en ellipse autour de son centre. Là où
 *  la plateforme peint le dégradé radial elle-même (`RadialLight`, Android),
 *  l'ellipse est dessinée à sa taille, sans disque ni agrandissement. */
function Glow({ blob, color, intensity }: { blob: (typeof BLOBS)[number]; color: string; intensity: number }) {
  if (RadialLight) {
    const ellipse = {
      position: "absolute" as const,
      left: blob.cx - blob.rx,
      top: blob.cy - blob.ry,
      width: 2 * blob.rx,
      height: 2 * blob.ry,
      opacity: blob.alpha * intensity,
    };
    return <RadialLight color={color} stops={FALLOFF} style={ellipse} />;
  }
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
            {FALLOFF.map(([offset, opacity]) => (
              <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
            ))}
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
        <Glow key={blob.id} blob={blob} color={boundedLight(palette.glows[blob.tone], A.maxLuminance)} intensity={intensity} />
      ))}
    </>
  );
});

/** La teinte du Lite : la lumière d'en haut de l'œuvre, de la même force que
 *  le cœur de la lumière large (`A.key`), éteinte aux deux tiers de l'écran. */
const Tint = memo(function Tint({ palette, intensity }: { palette: ArtworkPalette; intensity: number }) {
  const color = boundedLight(palette.glows[1], A.maxLuminance);
  return (
    <View style={[StyleSheet.absoluteFill, { opacity: A.key * intensity }]}>
      <SoftGradient colors={[color, withAlpha(color, 0)]} locations={[0, 0.68]} {...STAGE_SIZE} />
    </View>
  );
});

/** La couleur `#rrggbb` (ou déjà `rgb…`) à l'opacité `alpha`. */
function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (!hex) return "transparent";
  const n = parseInt(hex[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const AmbientBackdrop = memo(function AmbientBackdrop({ palette, intensity = 1 }: AmbientBackdropProps) {
  const layers = useLayerPool(palette.glows.join("-"), palette, TINT ? 2 : undefined);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <SoftGradient colors={[colors.bgTop, colors.bgBottom]} {...STAGE_SIZE} />
      {AMBIENT_OFF ? null : layers.map((layer) => (
        <PoolLayerView key={layer.slot} present={layer.present} motion="ambient">
          {TINT ? <Tint palette={layer.item} intensity={intensity} /> : <Lights palette={layer.item} intensity={intensity} />}
        </PoolLayerView>
      ))}
    </View>
  );
});

/**
 * Le fond vivant d'un écran dont la lumière SUIT LE FOCUS sans le redessiner :
 * celle de `source` (la carte focalisée, `ambientSource`), sinon `palette`
 * (le héros, la première carte). Sans source : `AmbientBackdrop` tel quel.
 * Profil Lite (`ambientFollow: "screen"`) : la source est ignorée, le fond
 * garde la lumière de l'écran (`useAmbientOf`).
 */
export const LiveAmbientBackdrop = memo(function LiveAmbientBackdrop({
  source,
  palette,
  intensity,
}: AmbientBackdropProps & { source?: AmbientSource }) {
  return <AmbientBackdrop palette={useAmbientOf(source, palette)} intensity={intensity} />;
});

const styles = StyleSheet.create({
  disc: { position: "absolute", width: DISC, height: DISC },
});
