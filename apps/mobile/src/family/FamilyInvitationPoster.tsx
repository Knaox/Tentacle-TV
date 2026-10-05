import { useEffect, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { familyErrorFromApi, useAcceptFamilyInvitation, useDeclineFamilyInvitation } from "@tentacle-tv/api-client";
import type { IncomingInvitationDto } from "@tentacle-tv/shared";
import { UserAvatar } from "@/components/admin/sessions/UserAvatar";
import { retainModal } from "@/components/ui/modalGate";
import { showToast } from "@/notices/toastStore";
import { ctaGradient, FONT_FAMILY, RADIUS, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { MODAL_ORIENTATIONS } from "./modalOrientations";
import { useFamilyText } from "./useFamilyText";

interface FamilyInvitationPosterProps {
  invitation: IncomingInvitationDto;
  /** « Plus tard », ou l'affiche fermée sans réponse (retour Android, voile). */
  onLater: (id: string) => void;
  /** Répondue (acceptée ou refusée) : l'affiche se retire. */
  onDone: (id: string) => void;
}

const POSTER_MAX_WIDTH = 440;

/**
 * L'AFFICHE : « X vous invite à rejoindre sa famille », ce que cela implique
 * (son profil s'ouvrira sur les TV de X sans mot de passe, sauf code PIN ; on
 * peut quitter à tout moment), puis Accepter / Refuser / Plus tard. La même
 * que celle du web, centrée sur l'iPhone comme sur l'iPad.
 *
 * Les noms sont du TEXTE rendu par React Native, jamais interprétés.
 * L'identifiant de l'invitation voyage dans le corps des requêtes, jamais
 * dans une URL (api-client › `familyApi.ts`).
 */
export function FamilyInvitationPoster({ invitation, onLater, onDone }: FamilyInvitationPosterProps) {
  const { t } = useTranslation(["family", "familyWeb", "familyMobile"]);
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { formatDate, errorText } = useFamilyText();
  const accept = useAcceptFamilyInvitation();
  const decline = useDeclineFamilyInvitation();
  const [error, setError] = useState<string | null>(null);
  const pending = accept.isPending || decline.isPending;
  const owner = invitation.ownerName;
  const title = t("family:poster.title", { owner });
  const gradient = ctaGradient(theme.colors.brand);

  // Une modale à la fois (`modalGate`) ; le lecteur d'écran entend l'invitation.
  useEffect(() => retainModal(), []);
  useEffect(() => {
    haptic("notice");
    AccessibilityInfo.announceForAccessibility(title);
  }, [title]);

  const onAccept = () => {
    setError(null);
    accept.mutate(invitation.id, {
      onSuccess: () => {
        haptic("success");
        showToast({ title: t("familyWeb:poster.accepted", { owner }), tone: "success" });
        onDone(invitation.id);
      },
      // Déjà dans une famille : la phrase qui dit quoi faire (la quitter d'abord).
      onError: (failure) =>
        setError(familyErrorFromApi(failure)?.code === "family.already_in_family"
          ? t("familyWeb:shared.alreadyInFamily")
          : errorText(failure)),
    });
  };

  const onDecline = () => {
    setError(null);
    decline.mutate(invitation.id, {
      onSuccess: () => {
        showToast({ title: t("familyWeb:poster.declined"), tone: "info" });
        onDone(invitation.id);
      },
      onError: (failure) => setError(errorText(failure)),
    });
  };

  // Fermer sans répondre vaut « Plus tard » — sauf pendant un envoi.
  const later = () => {
    if (!pending) onLater(invitation.id);
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent supportedOrientations={[...MODAL_ORIENTATIONS]} onRequestClose={later}>
      <View style={st.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={later} accessible={false} />
        <View style={st.card} accessibilityViewIsModal accessibilityLabel={t("familyMobile:posterLabel")}>
          {/* Halo de marque : un dégradé posé une fois, sans animation ni flou. */}
          <LinearGradient
            pointerEvents="none"
            colors={[theme.colors.brand.glow, "transparent"]}
            style={st.halo}
          />
          <View style={st.head}>
            <View>
              <UserAvatar userId={invitation.ownerUserId} name={owner} hasAvatar size={72} />
              <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={st.badge}>
                <Feather name="users" size={14} color={theme.colors.cta.brandFg} />
              </LinearGradient>
            </View>
            <Text style={st.title} accessibilityRole="header">{title}</Text>
            <Text style={st.expires}>{t("familyWeb:poster.expires", { date: formatDate(invitation.expiresAt) })}</Text>
          </View>

          <View style={st.facts}>
            <Fact icon="tv" text={t("family:poster.profile", { owner })} />
            <Fact icon="log-out" text={t("family:poster.leave")} />
          </View>

          {error ? (
            <View style={st.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Feather name="alert-circle" size={16} color={theme.colors.statusPairs.error.fg} />
              <Text style={st.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={onAccept}
            disabled={pending}
            accessibilityRole="button"
            accessibilityState={{ disabled: pending, busy: accept.isPending }}
            style={({ pressed }) => [st.acceptWrap, (pressed || pending) && st.dim]}
          >
            <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={st.accept}>
              {accept.isPending
                ? <ActivityIndicator color={theme.colors.cta.brandFg} />
                : <Text style={st.acceptText}>{t("family:poster.accept")}</Text>}
            </LinearGradient>
          </Pressable>
          <View style={st.row}>
            <Pressable
              onPress={onDecline}
              disabled={pending}
              accessibilityRole="button"
              accessibilityState={{ disabled: pending, busy: decline.isPending }}
              style={({ pressed }) => [st.secondary, (pressed || pending) && st.dim]}
            >
              {decline.isPending
                ? <ActivityIndicator color={theme.colors.text.primary} />
                : <Text style={st.secondaryText}>{t("family:poster.decline")}</Text>}
            </Pressable>
            <Pressable
              onPress={later}
              disabled={pending}
              accessibilityRole="button"
              style={({ pressed }) => [st.ghost, pressed && st.ghostPressed, pending && st.dim]}
            >
              <Text style={st.ghostText}>{t("family:poster.later")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Fact({ icon, text }: { icon: "tv" | "log-out"; text: string }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.fact}>
      <Feather name={icon} size={18} color={theme.colors.brand.light} style={st.factIcon} />
      <Text style={st.factText}>{text}</Text>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: t.colors.overlay.scrimHeavy,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    card: {
      width: "100%",
      maxWidth: POSTER_MAX_WIDTH,
      borderRadius: RADIUS.xl,
      backgroundColor: t.colors.surface.s1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      padding: spacing.xl,
      overflow: "hidden",
      ...t.colors.shadow.sheet,
    },
    halo: { position: "absolute", left: 0, right: 0, top: 0, height: 150, opacity: 0.6 },
    head: { alignItems: "center" },
    badge: {
      position: "absolute",
      right: -4,
      bottom: -4,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: t.colors.surface.s1,
    },
    title: { ...typography.subtitle, color: t.colors.text.primary, textAlign: "center", marginTop: spacing.md },
    expires: { ...typography.small, color: t.colors.text.tertiary, marginTop: spacing.xs, textAlign: "center" },
    facts: {
      marginTop: spacing.lg,
      padding: spacing.md,
      gap: spacing.md,
      borderRadius: RADIUS.lg,
      backgroundColor: t.colors.fill.subtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    fact: { flexDirection: "row", gap: spacing.sm },
    factIcon: { marginTop: 1 },
    factText: { ...typography.body, color: t.colors.text.secondary, flex: 1, lineHeight: 21 },
    error: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.md,
      padding: spacing.sm + 2,
      borderRadius: RADIUS.md,
      backgroundColor: t.colors.statusPairs.error.bg,
    },
    errorText: { ...typography.small, color: t.colors.statusPairs.error.fg, flex: 1, lineHeight: 18 },
    acceptWrap: { marginTop: spacing.lg, borderRadius: RADIUS.lg, overflow: "hidden" },
    accept: { minHeight: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
    acceptText: { ...typography.bodyBold, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.brandFg },
    row: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
    secondary: {
      flex: 1,
      minHeight: 48,
      borderRadius: RADIUS.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.cta.secondaryBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    secondaryText: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.cta.secondaryFg },
    ghost: { flex: 1, minHeight: 48, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
    ghostPressed: { backgroundColor: t.colors.fill.subtle },
    ghostText: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
    dim: { opacity: 0.55 },
  });
