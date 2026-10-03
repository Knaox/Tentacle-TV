import { memo, useCallback, useEffect, useState, type ReactElement } from "react";
import { AccessibilityInfo, Linking, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  closeNoticeForSession, noticeContent, useClientNotice, useSetHintDismissed, type ClientNotice,
} from "@tentacle-tv/api-client";
import { noticeAutoHideMs, NOTICE_AUTO_HIDE_MS, type DismissibleHint, type NoticeId } from "@tentacle-tv/shared";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useScreenReaderEnabled } from "@/hooks/useScreenReaderEnabled";
import { MIN_SERVER_VERSION, useServerCompat } from "@/hooks/useServerCompat";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { useMessageCountdown } from "@/session/useMessageCountdown";
import { SHEET_MAX_WIDTH, spacing } from "@/theme";
import { haptic } from "@/utils/haptics";
import { NoticeCard, type NoticeCardAction, type NoticeIcon } from "./NoticeCard";
import { dismissToast, useToasts } from "./toastStore";
import { useSwipeDismiss } from "./useSwipeDismiss";

/** Une fois masqué pour de bon : la phrase qui le dit, et « Annuler ». */
interface Confirmation {
  id: NoticeId;
  hint: DismissibleHint;
  text: string;
}

/**
 * Les avertissements surgissants du mobile et de l'iPad — la politique
 * partagée rendue : un seul à la fois, en haut, sous la zone sûre, largeur
 * bornée sur iPad ; jamais sur le lecteur (il attend la sortie) ni sur la
 * barre d'onglets. Une recommandation s'efface seule (6 s, suspendues tant
 * que le doigt la tient, que l'app est en arrière-plan ou qu'un lecteur
 * d'écran est actif) ; « Ne plus afficher » est une préférence du COMPTE.
 * Monté une fois, à la racine.
 */
export function NoticeHost() {
  const { t } = useTranslation(["notices", "errors"]);
  const insets = useSafeAreaInsets();
  const isAdmin = useIsAdmin();
  const { serverVersion } = useServerCompat();
  const { serverUrl } = useServerUrl();
  const notice = useClientNotice({ isAdmin, serverVersion, minServer: MIN_SERVER_VERSION });
  const pathname = usePathname();
  const screenReader = useScreenReaderEnabled();
  const { mutate } = useSetHintDismissed();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const toasts = useToasts();

  const open = useCallback((path: string) => {
    if (serverUrl) void Linking.openURL(`${serverUrl}${path}`).catch(() => undefined);
  }, [serverUrl]);

  const dismissForGood = useCallback((current: ClientNotice, text: string) => {
    const hint = current.rule.hint;
    if (!hint) return;
    haptic("commit");
    setConfirmation({ id: current.id, hint, text });
    mutate({ hint, dismissed: true, mark: current.mark }, {
      onError: () => setConfirmation({ id: current.id, hint, text: t("errors:titleAction") }),
    });
  }, [mutate, t]);

  const undo = useCallback((current: Confirmation) => {
    haptic("tap");
    setConfirmation(null);
    mutate({ hint: current.hint, dismissed: false });
  }, [mutate]);

  // Le lecteur : rien par-dessus, l'avertissement attend la sortie.
  if (pathname.startsWith("/watch")) return null;

  let banner: ReactElement | null = null;
  if (confirmation) {
    banner = (
      <Banner
        key={`confirm-${confirmation.id}`}
        severity="info"
        icon="check"
        lines={[confirmation.text]}
        primary={{ label: t("notices:undo"), onPress: () => undo(confirmation) }}
        durationMs={screenReader ? null : NOTICE_AUTO_HIDE_MS}
        onDone={() => {
          setConfirmation(null);
          closeNoticeForSession(confirmation.id);
        }}
      />
    );
  } else if (notice) {
    const content = noticeContent(notice);
    const lines = content.textKeys.map((key) => t(key, notice.values));
    const dismiss: NoticeCardAction | undefined = notice.canDismiss && content.dismissKey
      ? { label: t(content.dismissKey), onPress: () => dismissForGood(notice, t(content.dismissedKey ?? "")) }
      : undefined;
    banner = (
      <Banner
        key={notice.id}
        severity={notice.rule.severity}
        icon={content.icon}
        title={t(content.titleKey)}
        lines={lines}
        primary={{
          label: t(content.actionKey),
          onPress: () => {
            haptic("tap");
            open(content.actionPath);
            closeNoticeForSession(notice.id);
          },
        }}
        secondary={dismiss}
        durationMs={screenReader ? null : noticeAutoHideMs(notice.rule.severity)}
        onDone={() => closeNoticeForSession(notice.id)}
      />
    );
  }
  if (!banner && toasts.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[st.layer, { top: Math.max(insets.top, 12) + spacing.sm }]}>
      {/* Les gestes défaits d'abord (ce qui vient d'arriver), puis l'avertissement. */}
      {toasts.map((toast) => (
        <Banner
          key={`toast-${toast.id}`}
          severity="blocking"
          icon="alert-triangle"
          title={toast.title}
          lines={toast.text ? [toast.text] : []}
          durationMs={NOTICE_AUTO_HIDE_MS}
          onDone={() => dismissToast(toast.id)}
        />
      ))}
      {banner}
    </View>
  );
}

interface BannerProps {
  severity: ClientNotice["rule"]["severity"];
  icon: NoticeIcon;
  title?: string;
  lines: string[];
  primary?: NoticeCardAction;
  secondary?: NoticeCardAction;
  durationMs: number | null;
  onDone: () => void;
}

/** Une carte et son temps : le compte à rebours, la main qui le suspend, le geste qui la chasse. */
const Banner = memo(function Banner({ severity, icon, title, lines, primary, secondary, durationMs, onDone }: BannerProps) {
  const [held, setHeld] = useState(false);
  const countdown = useMessageCountdown(durationMs, held, onDone);
  const swipe = useSwipeDismiss(onDone);
  const announcement = [title, ...lines].filter(Boolean).join(". ");
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);
  return (
    <Animated.View
      entering={FadeInUp.duration(240)}
      exiting={FadeOutUp.duration(160)}
      style={[st.item, swipe.style]}
      {...swipe.panHandlers}
      onTouchStart={() => setHeld(true)}
      onTouchEnd={() => setHeld(false)}
      onTouchCancel={() => setHeld(false)}
    >
      <NoticeCard
        severity={severity}
        icon={icon}
        title={title}
        lines={lines}
        primary={primary}
        secondary={secondary}
        countdown={countdown}
        durationMs={durationMs}
        onClose={() => {
          haptic("tap");
          onDone();
        }}
      />
    </Animated.View>
  );
});

const st = StyleSheet.create({
  layer: { position: "absolute", left: spacing.md, right: spacing.md, alignItems: "center", gap: spacing.sm, zIndex: 900, elevation: 20 },
  item: { width: "100%", maxWidth: SHEET_MAX_WIDTH },
});
