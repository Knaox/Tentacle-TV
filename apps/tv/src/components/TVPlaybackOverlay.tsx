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
  /** « Aller à l'épisode suivant » — le geste de la PILULE, qui n'est pas un
   *  saut dans le média mais mène au même bouton. */
  onPlayNow: () => void;
  /** Habillage visible : le bouton monte pour ne pas couvrir la barre. */
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
 * télévision — le dessin à trois mètres et le focus.
 *
 * # Le focus va au bouton UTILE, pas toujours au même
 *
 * La règle tient en une phrase : on donne le focus au geste que l'utilisateur
 * aurait à faire. Quand le passage part TOUT SEUL (`overlay.auto`), ce geste
 * est de l'en empêcher — le focus va donc à « Masquer ». Quand il faut le
 * demander, c'est « Passer ». L'ancienne version focalisait « Passer » dans
 * les deux cas : sur un saut automatique, il fallait naviguer à droite pour
 * atteindre le refus, pendant que le décompte courait.
 *
 * Et la prise de focus ne dépend plus de l'habillage. Elle en dépendait par
 * prudence — un bouton sans sortie géométrique piège la télécommande — mais la
 * sortie existe : le guide vers play/pause, monté justement quand l'habillage
 * est là. `useTVFocusGrab` n'agit qu'au front MONTANT, donc le bouton prend le
 * focus quand IL apparaît, et l'habillage qui s'ouvre ensuite garde le sien.
 *
 * # Ce qui revient par l'habillage ne vole rien
 *
 * Un passage mis en sourdine sort de l'image et ne reparaît qu'avec
 * l'habillage (`dismissible: false`, tranché par l'arbitre). Là, l'utilisateur
 * est déjà en train de faire autre chose : le bouton se montre, reste
 * atteignable à la navigation, et ne prend pas le focus. C'est exactement ce
 * que `dismissible` distingue — inutile d'un second témoin.
 *
 * # Rien pendant l'avance rapide
 *
 * L'arbitre rend `none` en déplacement (`scrubbing`), donc il n'y a rien à
 * masquer ici : le bouton n'existe simplement pas.
 *
 * # La pilule « épisode suivant », le même bouton
 *
 * L'arbitre la propose quand la fiche « à suivre » ne parle pas — scène
 * post-générique en cours, fiche éteinte ou refusée. Le web et le téléviseur
 * LG la rendaient ; ici, rien ne la lisait, et sauter le générique d'un média
 * à scène finale faisait DISPARAÎTRE l'accès à la suite jusqu'au bout du
 * fichier. C'est le même dessin et le même geste : un seul bouton pour un
 * seul objet.
 *
 * Les mécanismes de focus, tous payés par une régression :
 *
 * 1. `useTVFocusGrab` sur front MONTANT — jamais sur un retour par l'habillage ;
 * 2. l'îlot `TVFocusGuideView autoFocus` avec pièges ←/→ pendant le décompte,
 *    pour que « passer » et « masquer » se répondent sans que la télécommande
 *    s'en échappe — piège LEVÉ quand l'habillage est là, sinon il entre en
 *    conflit avec le guide de sortie ;
 * 3. le guide de SORTIE vers play/pause, monté seulement OSD visible : tvOS
 *    ignore les `nextFocus*`, un guide `destinations` est le seul pont fiable ;
 * 4. la montée en `transform`, jamais en `bottom` — une position animée relance
 *    la mise en page à chaque image au-dessus d'un décodeur.
 */
export function TVPlaybackOverlay({
  overlay, onSkip, onDismiss, onPlayNow,
  overlayVisible = false, showSettings = false, showEpisodes = false,
}: TVPlaybackOverlayProps) {
  const { t } = useTranslation("player");
  const skipRef = useRef<View>(null);
  const dismissRef = useRef<View>(null);

  // Les deux surfaces qui portent CE bouton : un passage à sauter, ou la suite
  // à rejoindre. Même dessin, même place, un seul objet.
  const pill = overlay.kind === "skip" || overlay.kind === "nextButton" ? overlay : null;
  const skip = overlay.kind === "skip" ? overlay : null;
  const visible = pill !== null && !showEpisodes;
  const countdown = skip?.countdownSeconds ?? null;
  // Le refus suit le caractère AUTOMATIQUE du passage, pas l'affichage des
  // secondes : un saut auto dont le décompte est masqué doit lui aussi pouvoir
  // être empêché, et il ne le pouvait pas. La pilule de la suite, elle,
  // n'arme rien — il n'y a rien à empêcher.
  const refusable = skip?.auto === true;
  // Ce qui revient par l'habillage a déjà été refusé : il se montre, il ne
  // s'impose pas.
  const grabs = visible && pill.dismissible && !showSettings;

  useTVFocusGrab(refusable ? dismissRef : skipRef, grabs);

  // Sur Android, le Retour est empilé et peut donc « garder ce passage » sans
  // quitter la vidéo. On ne le prend QUE si le passage part tout seul : sans
  // échéance, le bouton n'est qu'une proposition, et Retour doit rester le
  // Retour.
  useTVRemote({ onBack: visible && refusable ? onDismiss : undefined });

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

  if (pill === null) return null;

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
        trapFocusLeft={refusable && !overlayVisible}
        trapFocusRight={refusable && !overlayVisible}
        style={{ flexDirection: "row", alignItems: "center", gap: TV_PLAYER_SKIP.gap }}
      >
        <Focusable
          ref={skipRef}
          variant="button"
          onPress={skip !== null ? onSkip : onPlayNow}
          focusRadius={TV_PLAYER_SKIP.radius}
          hasTVPreferredFocus={grabs && !refusable}
          // L'anneau est blanc, la pilule aussi : seul le halo de marque dit
          // où l'on est. Même parti que la feuille du téléviseur LG.
          glowOverride={TV_PLAYER_SKIP.focusGlow}
        >
          <View style={{
            paddingHorizontal: TV_PLAYER_SKIP.paddingH,
            paddingVertical: TV_PLAYER_SKIP.paddingV,
            backgroundColor: TV_PLAYER_SKIP.bg,
            borderWidth: 1,
            borderColor: "transparent",
            borderRadius: TV_PLAYER_SKIP.radius,
          }}>
            <Text style={{
              color: TV_PLAYER_SKIP.fg,
              fontSize: TV_PLAYER_SKIP.text,
              fontWeight: "700",
            }}>
              {skip === null
                ? t("player:goToNextEpisode")
                : countdown !== null
                  ? t(`player:${skip.labelKey}In`, { seconds: countdown })
                  : t(`player:${skip.labelKey}`)}
            </Text>
          </View>
        </Focusable>
        {/* Pas une croix : à trois mètres, une cible de 32 points ne se vise pas.
            Un second bouton, lisible, que la navigation atteint d'un appui —
            et qui reçoit le focus quand le saut est automatique. */}
        {refusable && (
          <Focusable
            ref={dismissRef}
            variant="button"
            onPress={onDismiss}
            focusRadius={TV_PLAYER_SKIP.radius}
            hasTVPreferredFocus={grabs}
            glowOverride={TV_PLAYER_SKIP.focusGlow}
          >
            <View style={{
              paddingHorizontal: TV_PLAYER_SKIP.paddingH,
              paddingVertical: TV_PLAYER_SKIP.paddingV,
              backgroundColor: TV_PLAYER_SKIP.dismissBg,
              borderWidth: 1,
              borderColor: TV_PLAYER_SKIP.dismissBorder,
              borderRadius: TV_PLAYER_SKIP.radius,
            }}>
              <Text style={{
                color: TV_PLAYER_SKIP.dismissFg,
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
