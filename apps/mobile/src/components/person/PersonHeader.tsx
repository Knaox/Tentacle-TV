import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { creditRoleKey, formatCalendarDate, initials, type CreditRole, type PersonLife } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface Props {
  id: string;
  name: string;
  imageTag: string | null;
  life: PersonLife;
  roles: CreditRole[];
  countLabel: string | null;
  portraitW: number;
  like: { liked: boolean; pending: boolean; toggle: () => void };
}

/**
 * Portrait, nom, métiers et vie d'une personne — posé à cheval sur le bas du
 * décor, comme l'affiche d'une fiche. Tout le texte est thémé : le voile du
 * décor le rend au fond de page.
 */
export const PersonHeader = memo(function PersonHeader({ id, name, imageTag, life, roles, countLabel, portraitW, like }: Props) {
  const { t, i18n } = useTranslation("media");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const portraitH = Math.round(portraitW * 1.5);
  const locale = i18n.language || "fr";
  const uri = imageTag ? client.getImageUrl(id, "Primary", { height: portraitH * 3, quality: 85, tag: imageTag }) : null;

  const facts: Array<{ label: string; value: string }> = [];
  if (life.born) {
    const age = life.age !== null && life.died === null ? ` · ${t("personAge", { count: life.age })}` : "";
    facts.push({ label: t("personBorn"), value: `${formatCalendarDate(life.born, locale)}${age}` });
  }
  if (life.died) {
    const age = life.age !== null ? ` · ${t("personAge", { count: life.age })}` : "";
    facts.push({ label: t("personDied"), value: `${formatCalendarDate(life.died, locale)}${age}` });
  }
  if (life.birthPlace) facts.push({ label: t("personBirthplace"), value: life.birthPlace });
  const likeLabel = like.liked ? t("unlikeActor", { name }) : t("likeActor", { name });

  return (
    <View>
      <View style={[st.row, { marginTop: -Math.round(portraitH * 0.55) }]}>
        <View style={[st.portrait, { width: portraitW, height: portraitH }]}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[StyleSheet.absoluteFill, st.fallback]}>
              <Text style={st.initials}>{initials(name)}</Text>
            </View>
          )}
        </View>
        <View style={st.titleCol}>
          <Text style={st.kicker} numberOfLines={1}>
            {t("personKicker")}
            {roles.length > 0 && <Text style={st.kickerRoles}> · {roles.slice(0, 2).map((r) => t(creditRoleKey(r))).join(" · ")}</Text>}
          </Text>
          <Text style={st.name} numberOfLines={3} accessibilityRole="header">{name}</Text>
          {countLabel && <Text style={st.count}>{countLabel}</Text>}
        </View>
      </View>

      <View style={st.factsRow}>
        <View style={st.facts}>
          {facts.map((f) => (
            <View key={f.label} style={st.fact}>
              <Text style={st.factLabel}>{f.label}</Text>
              <Text style={st.factValue}>{f.value}</Text>
            </View>
          ))}
        </View>
        <Pressable
          onPress={like.toggle}
          disabled={like.pending}
          accessibilityRole="button"
          accessibilityLabel={likeLabel}
          accessibilityState={{ selected: like.liked, disabled: like.pending }}
          hitSlop={6}
          style={({ pressed }) => [st.like, like.liked && st.likeOn, pressed && { opacity: 0.75 }]}
        >
          <Feather name="heart" size={18} color={like.liked ? theme.colors.cta.primaryFg : theme.colors.text.secondary} />
        </Pressable>
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.screenPadding, gap: spacing.lg },
    portrait: {
      borderRadius: RADIUS.lg,
      overflow: "hidden",
      backgroundColor: t.colors.surface.s2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    fallback: { alignItems: "center", justifyContent: "center", backgroundColor: t.colors.brand.soft },
    initials: { fontSize: 28, fontFamily: FONT_FAMILY.bold, color: t.colors.brand.light },
    titleCol: { flex: 1, paddingBottom: spacing.xs },
    kicker: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontFamily: FONT_FAMILY.semibold, color: t.colors.text.tertiary },
    kickerRoles: { color: t.colors.brand.light },
    name: { marginTop: 4, fontSize: 26, lineHeight: 31, letterSpacing: -0.5, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary },
    count: { marginTop: 4, fontSize: 13, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    factsRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: spacing.screenPadding, marginTop: spacing.lg, gap: spacing.md },
    facts: { flex: 1, flexDirection: "row", flexWrap: "wrap", columnGap: spacing.xl, rowGap: spacing.sm },
    fact: { maxWidth: "100%" },
    factLabel: { fontSize: 10.5, letterSpacing: 0.9, textTransform: "uppercase", fontFamily: FONT_FAMILY.semibold, color: t.colors.text.quaternary },
    factValue: { marginTop: 2, fontSize: 14, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
    like: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.strong,
    },
    likeOn: { backgroundColor: t.colors.brand.violet, borderColor: withAlpha(t.colors.brand.violet, 0.6, t.colors.brand.glow) },
  });
