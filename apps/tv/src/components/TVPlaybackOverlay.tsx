import { useEffect, useRef } from "react";
import { View, Text, TVFocusGuideView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { useTVRemote } from "./focus/useTVRemote";
import { useTVFocusGrab } from "../hooks/useTVFocusGrab";
import { osdPlayPauseNodeRef } from "./player/focus/osdFocusBus";
import type { PlayerOverlay } from "@tentacle-tv/shared";
import { TV_OVERSCAN_PT, TV_PLAYER_SKIP } from "@tentacle-tv/theme";

interface TVPlaybackOverlayProps {
  /** L'arbitre partagé : c'est LUI qui dit s'il y a un passage à proposer. */
  overlay: PlayerOverlay;
  onSkip: () => void;
  onDismiss: () => void;
  /** Habillage visible : on ne vole pas le focus, et le bouton monte. */
  overlayVisible?: boolean;
  showSettings?: boolean;
  /** Panneau épisodes ouvert → masquer le bouton (il le recouvrirait). */
  showEpisodes?: boolean;
}

/**
 * Le bouton de saut du téléviseur — intro, résumé, aperçu, générique.
 *
 * Il remplace `TVSkipSegmentButton`, qui portait sa propre fenêtre de segment,
 * son propre refus et son propre décompte. Tout cela vient désormais de
 * l'arbitre partagé : ici, il ne reste QUE ce qui est vraiment de la
 * télévision — le focus, et il est repris mot pour mot.
 *
 * Les quatre mécanismes de focus, tous payés par une régression :
 *
 * 1. `useTVFocusGrab` sur front MONTANT, jamais quand l'habillage est ouvert :
 *    le bouton n'a aucune sortie géométrique, voler le focus l'y piégerait ;
 * 2. l'îlot `TVFocusGuideView autoFocus` avec pièges ←/→ pendant le décompte,
 *    pour que « sauter » et « garder » se répondent sans que la télécommande
 *    s'en échappe — piège LEVÉ quand l'habillage est là, sinon il entre en
 *    conflit avec le guide de sortie ;
 * 3. le guide de SORTIE vers play/pause, monté seulement OSD visible : tvOS
 *    ignore les `nextFocus*`, un guide `destinations` est le seul pont fiable ;
 * 4. la montée en `transform`, jamais en `bottom` — une position animée relance
 *    la mise en page à chaque image au-dessus d'un décodeur.
 */
export function TVPlaybackOverlay({
  overlay, onSkip, onDismiss,
  overlayVisible = false, showSettings = false, showEpisodes = false,
}: TVPlaybackOverlayProps) {
  const { t } = useTranslation("player");
  const skipRef = useRef<View>(null);

  const skip = overlay.kind === "skip" ? overlay : null;
  const visible = skip !== null && !showEpisodes;
  const compte = skip?.countdownSeconds ?? null;

  useTVFocusGrab(skipRef, visible && !showSettings && !overlayVisible);

  // Sur Android, le Retour est empilé et peut donc « garder ce passage » sans
  // quitter la vidéo. On ne le prend QUE pendant un décompte : sans échéance,
  // le bouton n'est qu'une proposition, et Retour doit rester le Retour.
  useTVRemote({ onBack: visible && compte !== null ? onDismiss : undefined });

  const opacity = useSharedValue(0);
  const raise = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 250 });
  }, [visible, opacity]);

  useEffect(() => {
    raise.value = withTiming(overlayVisible ? -TV_PLAYER_SKIP.lift : 0, { duration: 200 });
  }, [overlayVisible, raise]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: raise.value }],
  }));

  if (skip === null) return null;

  return (
    <Animated.View
      pointerEvents="auto"
      style={[{
        position: "absolute",
        bottom: TV_PLAYER_SKIP.bottom,
        right: TV_OVERSCAN_PT.x,
        zIndex: 100,
      }, animStyle]}
    >
      <TVFocusGuideView
        autoFocus
        trapFocusLeft={compte !== null && !overlayVisible}
        trapFocusRight={compte !== null && !overlayVisible}
        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        <Focusable ref={skipRef} variant="button" onPress={onSkip} focusRadius={8} hasTVPreferredFocus={!overlayVisible && !showSettings && !showEpisodes}>
          <View style={{
            paddingHorizontal: TV_PLAYER_SKIP.paddingH,
            paddingVertical: TV_PLAYER_SKIP.paddingV,
            backgroundColor: "rgba(0,0,0,0.6)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.2)",
            borderRadius: TV_PLAYER_SKIP.radius,
          }}>
            <Text style={{
              color: "#ffffff",
              fontSize: TV_PLAYER_SKIP.text,
              fontWeight: "600",
            }}>
              {compte !== null
                ? t(`player:${skip.labelKey}In`, { seconds: compte })
                : t(`player:${skip.labelKey}`)}
            </Text>
          </View>
        </Focusable>
        {/* Pas de croix : à trois mètres, une cible de 32 points ne se vise pas.
            Un second bouton, lisible, que la navigation atteint d'un appui. */}
        {compte !== null && (
          <Focusable variant="button" onPress={onDismiss} focusRadius={8}>
            <View style={{
              paddingHorizontal: TV_PLAYER_SKIP.paddingH,
              paddingVertical: TV_PLAYER_SKIP.paddingV,
              backgroundColor: "rgba(0,0,0,0.45)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              borderRadius: TV_PLAYER_SKIP.radius,
            }}>
              <Text style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: TV_PLAYER_SKIP.text,
                fontWeight: "500",
              }}>
                {t("dismiss")}
              </Text>
            </View>
          </Focusable>
        )}
      </TVFocusGuideView>
      {overlayVisible && osdPlayPauseNodeRef.current && (
        <TVFocusGuideView
          destinations={[osdPlayPauseNodeRef.current]}
          style={{ position: "absolute", top: "100%", left: -80, right: 0, height: 140 }}
        />
      )}
    </Animated.View>
  );
}
