import { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { BACK_BUTTON_SIZE, BACK_TOP, BackButton } from "../../controls/BackButton";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { Icon } from "../../icons/Icon";
import { Presented } from "../../motion/Presented";
import { useEntrance } from "../../motion/useMotion";
import { colors, fonts, white } from "../../theme/tokens";
import type {
  PlaybackTroubleModel, TroubleActionKey, TroubleNoticeModel, TroublePanelModel, TroublePillKey,
} from "./playbackTroubleTypes";
import { DENSE_BASE, SOFT_BASE } from "./surfaces";

/**
 * Le message-outil du lecteur, quand un serveur ne répond plus — un OUTIL plus
 * qu'un avertissement : il dit ce qui se passe, ce qui marche encore, ce qui
 * va se passer, et offre les gestes utiles.
 *
 * - Le BANDEAU (`notice`), en haut, jamais focalisable : la lecture continue
 *   sur ce qui est chargé — le compte à rebours en chiffres tabulaires —, ou
 *   elle vient de reprendre. Il ne demande rien.
 * - Le PANNEAU (`panel`), au centre, là où tournait l'indicateur : la lecture
 *   est arrêtée. Il paraît sans prendre le focus ; c'est le premier geste de
 *   l'utilisateur qui l'active (l'intégration). Activé, l'habillage recule et
 *   la croix Retour paraît en haut à gauche, comme partout : elle referme le
 *   lecteur. Clés : `trouble:retry`, `trouble:quality`, `trouble:back` (la
 *   croix) ; groupes `trouble:actions`, `trouble:bridge` (le pont entre la
 *   croix et le panneau) et `trouble:screen` — l'écran entier, croix
 *   comprise, où l'intégration retient le focus.
 *
 * Aucun des deux ne coupe la lecture ; tous deux se retirent seuls quand elle
 * reprend.
 */

const SAFE = TV_STAGE.safe;

const FOCUS_KEYS: Record<TroublePillKey, string> = {
  retry: "trouble:retry",
  quality: "trouble:quality",
};

function useAppear(appear: SharedValue<number>, lift: number) {
  return useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: lift * (1 - appear.value) }, { scale: 0.96 + 0.04 * appear.value }],
  }));
}

const Notice = memo(function Notice({ model, appear }: { model: TroubleNoticeModel; appear: SharedValue<number> }) {
  const backing = useNativeGlassBacking("regular");
  const style = useAppear(appear, -12);
  const success = model.tone === "success";
  const tint = success ? colors.successFg : colors.warningFg;
  return (
    <Animated.View pointerEvents="none" style={[styles.top, style]}>
      <GlassSurface radius={36} tone="regular" elevated style={[styles.notice, backing]}>
        <View style={[styles.noticeIcon, { backgroundColor: success ? colors.successBg : colors.warningBg }]}>
          <Icon name={model.icon} size={26} color={tint} strokeWidth={2.4} />
        </View>
        <View style={styles.noticeText} accessible accessibilityLiveRegion="polite">
          <Text style={styles.noticeTitle} numberOfLines={1}>{model.title}</Text>
          {model.detail ? <Text style={styles.noticeDetail} numberOfLines={1}>{model.detail}</Text> : null}
        </View>
      </GlassSurface>
    </Animated.View>
  );
});

const Panel = memo(function Panel({ model, onAction }: {
  model: TroublePanelModel;
  onAction?: (key: TroubleActionKey) => void;
}) {
  const backing = useNativeGlassBacking("strong");
  const style = useAppear(useEntrance("panel"), 18);
  return (
    <FocusGroup focusKey="trouble:screen" style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View pointerEvents="box-none" style={styles.center}>
        <Animated.View style={style} pointerEvents="box-none">
          <GlassSurface radius={44} tone="strong" elevated style={[styles.panel, backing]}>
            <View style={styles.header} accessible accessibilityLiveRegion="polite">
              <View style={styles.panelIcon}>
                <Icon name={model.icon} size={34} color={colors.warningFg} strokeWidth={2.2} />
              </View>
              <Text style={styles.title} numberOfLines={2}>{model.title}</Text>
            </View>
            <Text style={styles.detail}>{model.detail}</Text>
            <View style={styles.status}>
              <View style={styles.statusMark}>
                {model.busy ? <ActivityIndicator size="small" color={white(0.72)} style={styles.spinner} /> : <View style={styles.statusDot} />}
              </View>
              <Text style={styles.statusText} numberOfLines={1}>{model.status}</Text>
            </View>
            <FocusGroup focusKey="trouble:actions" style={styles.actions}>
              {model.actions.map((action, index) => (
                <PillButton
                  key={action.key}
                  variant={index === 0 ? "primary" : "glass"}
                  size="md"
                  icon={action.icon}
                  label={action.label}
                  focusKey={FOCUS_KEYS[action.key]}
                  onPress={() => onAction?.(action.key)}
                />
              ))}
            </FocusGroup>
          </GlassSurface>
        </Animated.View>
      </View>
      {/* À la place de celle de l'habillage, qui vient de reculer ; le pont la
          relie au panneau, rien n'étant aligné entre eux. */}
      {model.active ? (
        <>
          <View style={styles.back}>
            <BackButton focusKey="trouble:back" onPress={() => onAction?.("back")} />
          </View>
          <FocusGroup focusKey="trouble:bridge" style={styles.bridge} />
        </>
      ) : null}
    </FocusGroup>
  );
});

export const PlaybackTrouble = memo(function PlaybackTrouble({ model, onAction }: {
  model: PlaybackTroubleModel | null;
  onAction?: (key: TroubleActionKey) => void;
}) {
  return (
    <>
      <Presented value={model?.mode === "notice" ? model : null} motion="reveal">
        {(notice, appear) => <Notice model={notice} appear={appear} />}
      </Presented>
      {/* Sans sortie jouée : un focalisable gardé vivant le temps d'une sortie
          retient le focus (ses guides), et la lecture reprend dessous. */}
      {model?.mode === "panel" ? <Panel model={model} onAction={onAction} /> : null}
    </>
  );
});

const styles = StyleSheet.create({
  top: { position: "absolute", top: SAFE.y, left: 0, right: 0, alignItems: "center" },
  notice: {
    flexDirection: "row", alignItems: "center", gap: 18, maxWidth: 1180,
    paddingVertical: 14, paddingLeft: 16, paddingRight: 30, backgroundColor: SOFT_BASE,
  },
  noticeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  noticeText: { gap: 2, flexShrink: 1 },
  noticeTitle: { ...fonts.semibold, fontSize: 26, color: colors.text },
  noticeDetail: { ...fonts.medium, fontSize: 22, color: white(0.72), fontVariant: ["tabular-nums"] },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  back: { position: "absolute", top: BACK_TOP, left: SAFE.x },
  // Toute la largeur, sous la croix et au-dessus du panneau (centré, plus de 320 pt du haut).
  bridge: { position: "absolute", left: 0, right: 0, top: BACK_TOP + BACK_BUTTON_SIZE + 24, height: 130 },
  panel: { width: 980, padding: 44, gap: 20, backgroundColor: DENSE_BASE },
  header: { flexDirection: "row", alignItems: "center", gap: 22 },
  panelIcon: {
    width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.warningBg,
  },
  title: { ...fonts.bold, fontSize: 38, lineHeight: 46, color: colors.text, flexShrink: 1 },
  detail: { ...fonts.medium, fontSize: 27, lineHeight: 38, color: white(0.86) },
  status: { flexDirection: "row", alignItems: "center", gap: 12, height: 32 },
  // L'indicateur de tvOS est grand même en « small » : ramené à la ligne.
  statusMark: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  spinner: { transform: [{ scale: 0.55 }] },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.warningFg },
  statusText: { ...fonts.medium, fontSize: 22, color: white(0.6), fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", gap: 18, marginTop: 10 },
});
