import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { TV_LIGHT, TV_STAGE, TV_TYPE } from "@tentacle-tv/theme";
import { BACK_BUTTON_SIZE, BACK_TOP } from "../controls/BackButton";
import { BrandMark } from "./BrandMark";

/**
 * La marque en haut à droite de l'écran, INTÉGRÉE à la scène (retour de
 * l'essai sur l'Apple TV, 2026-10-01 : elle « faisait PNG qui flotte ») :
 * - la mascotte NORMALE, en couleurs (« l'Étreinte », `brand/logo-color.svg`).
 *   Pas la version mono : en blanc, ses yeux creusés en orbites et le crâne
 *   évidé du chapeau lisaient « tête de mort » à cette taille — le « logo
 *   d'Halloween » vu sur l'Apple TV (2026-10-02) ;
 * - éclairée par la lumière de la MARQUE, la seule lumière qui la porte : le
 *   halo des icônes de `brand/` (magenta au cœur, violet au bord), discret ;
 * - calée sur la scène : son DESSIN (pas son carré) affleure au bord droit
 *   de la marge de sécurité, son centre sur la LIGNE DE LA MARQUE — celle du
 *   centre de la croix Retour (`BACK_TOP`), où tombe aussi le titre des
 *   réglages : croix à gauche, marque à droite, un seul trait (rien du
 *   rail, dont le bloc se centre) ; son corps — dôme et écran — a la
 *   hauteur des capitales d'un titre d'écran, le chapeau dépasse au-dessus
 *   comme une hampe, les pattes dessous comme un jambage ;
 * - posée dans la page qui défile (l'appelant la met dans son contenu) : elle
 *   part avec l'en-tête au lieu de passer par-dessus les rangées.
 * Sur une image (fiche, carte héros), la lumière de la marque teinterait la
 * photo : `backing="veil"` pose à la place un voile d'ombre, comme le voile du
 * haut d'une fiche, qui garde le dessin lisible sur un ciel clair.
 */

export interface BrandCornerProps {
  /** Où se pose le DESSIN dans le parent : la ligne de son centre et son bord
   *  droit — par défaut la ligne de la marque et la marge de sécurité, le
   *  parent couvrant l'écran. */
  anchor?: { centerY: number; right: number };
  /** Ce qui porte le dessin : la lumière de la marque sur l'encre (défaut),
   *  un voile d'ombre sur une image. */
  backing?: "light" | "veil";
}

/** L'emprise du dessin dans son carré de 240, mesurée sur
 *  `brand/logo-color.svg` (rsvg-convert à 960 px, canal alpha) — à remesurer
 *  si le dessin change d'encombrement. Son corps (dôme + écran, cadre
 *  compris) va de 32 à 198,5. */
const DRAWING = { left: 55.5, top: 13, right: 184.5, bottom: 228 } as const;
const BODY = { top: 32, bottom: 198.5 } as const;
/** La hauteur des capitales d'Inter, en part de la taille de la police. */
const INTER_CAP_HEIGHT = 0.727;
/** Le côté du carré : le CORPS du dessin a la hauteur des capitales d'un
 *  titre d'écran (`TV_TYPE.title`) — 60 points. */
const SIZE = Math.round((TV_TYPE.title * INTER_CAP_HEIGHT * 240) / (BODY.bottom - BODY.top));
const SCALE = SIZE / 240;
const CENTER_Y = ((DRAWING.top + DRAWING.bottom) / 2) * SCALE;
const HEIGHT = (DRAWING.bottom - DRAWING.top) * SCALE;

/** La ligne de la marque : le centre de la croix Retour. */
const BRAND_LINE = BACK_TOP + BACK_BUTTON_SIZE / 2;

/** Sur la ligne de la marque, à la marge de sécurité, le parent couvrant l'écran. */
export const BRAND_CORNER_ON_SCREEN = { centerY: BRAND_LINE, right: TV_STAGE.safe.x } as const;
/** La même place, le parent commençant déjà à la marge (en-tête d'une grille). */
export const BRAND_CORNER_IN_SAFE_AREA = { centerY: BRAND_LINE - TV_STAGE.safe.y, right: 0 } as const;
/** Sur la carte héros : dans son coin, à la distance qui sépare ses points de
 *  rotation de son bord droit (56) — ni sur l'arrondi, ni sur son texte. */
const HERO_INSET = 56;
export function brandCornerOnHero(heroLeft: number, heroWidth: number) {
  return { centerY: TV_STAGE.hero.top + HERO_INSET + HEIGHT / 2, right: 1920 - heroLeft - heroWidth + HERO_INSET };
}

/** Le disque dessiné, puis agrandi par le GPU (aucun flou à calculer). */
const DISC = 128;
/** Le rayon de la lumière, et celui du voile, autour du centre du dessin. */
const HALO_RADIUS = 76;
const VEIL_RADIUS = 64;

const H = TV_LIGHT.brandHalo;

function Backing({ kind }: { kind: "light" | "veil" }) {
  const radius = kind === "light" ? HALO_RADIUS : VEIL_RADIUS;
  const place = {
    left: SIZE / 2 - DISC / 2,
    top: CENTER_Y - DISC / 2,
    opacity: kind === "light" ? H.opacity : 1,
    transform: [{ scale: (2 * radius) / DISC }],
  };
  return (
    <View pointerEvents="none" style={[styles.disc, place]}>
      <Svg width={DISC} height={DISC}>
        <Defs>
          {kind === "light" ? (
            <RadialGradient id="backing" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={H.inner} stopOpacity={0.6} />
              <Stop offset="0.35" stopColor={H.inner} stopOpacity={0.32} />
              <Stop offset="0.7" stopColor={H.outer} stopOpacity={0.08} />
              <Stop offset="1" stopColor={H.outer} stopOpacity={0} />
            </RadialGradient>
          ) : (
            <RadialGradient id="backing" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#000" stopOpacity={0.5} />
              <Stop offset="0.5" stopColor="#000" stopOpacity={0.28} />
              <Stop offset="1" stopColor="#000" stopOpacity={0} />
            </RadialGradient>
          )}
        </Defs>
        <Circle cx={DISC / 2} cy={DISC / 2} r={DISC / 2} fill="url(#backing)" />
      </Svg>
    </View>
  );
}

export const BrandCorner = memo(function BrandCorner({ anchor = BRAND_CORNER_ON_SCREEN, backing = "light" }: BrandCornerProps) {
  const place = { top: anchor.centerY - CENTER_Y, right: anchor.right - (240 - DRAWING.right) * SCALE };
  return (
    <View pointerEvents="none" style={[styles.corner, place]}>
      <Backing kind={backing} />
      <BrandMark size={SIZE} />
    </View>
  );
});

const styles = StyleSheet.create({
  corner: { position: "absolute", width: SIZE, height: SIZE },
  disc: { position: "absolute", width: DISC, height: DISC },
});
