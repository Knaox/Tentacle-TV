import { memo, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { castCredits, creditRoleKey, initials, type CastCredit, type CastPerson } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useThemedStyles, type AppTheme } from "../theme";

export interface CastRowProps {
  people: CastPerson[];
  /**
   * Les cartes ne mènent nulle part : la fiche d'un titre gardé, hors ligne,
   * n'ouvrirait qu'une page d'erreur.
   */
  readOnly?: boolean;
}

const CARD_W = 96;
const CARD_H = 144;

/**
 * « Casting et équipe » : une rangée de portraits 2:3, l'équipe d'abord (ses
 * métiers réunis, en couleur de marque), puis la distribution (ses
 * personnages). Toucher une carte ouvre l'écran de la personne — sa vie, sa
 * filmographie dans la bibliothèque, puis ce que les extensions connaissent.
 */
export function CastRow({ people, readOnly = false }: CastRowProps) {
  const { t } = useTranslation("media");
  const st = useThemedStyles(makeStyles);
  const { crew, actors } = useMemo(() => castCredits(people), [people]);
  const credits = useMemo(() => [...crew, ...actors], [crew, actors]);
  if (credits.length === 0) return null;

  return (
    <View style={st.section}>
      <Text style={st.title} accessibilityRole="header">{t("castAndCrew")}</Text>
      <FlatList
        horizontal
        data={credits}
        keyExtractor={(c, i) => `${i < crew.length ? "crew" : "cast"}-${c.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.list}
        initialNumToRender={6}
        renderItem={({ item, index }) => (
          // Le filet entre équipe et distribution vit dans la cellule de la
          // première carte d'acteur : une cellule de FlatList est une colonne.
          <View style={st.cell}>
            {index === crew.length && crew.length > 0 && <View style={st.sep} />}
            <CreditCard credit={item} readOnly={readOnly} />
          </View>
        )}
      />
    </View>
  );
}

const CreditCard = memo(function CreditCard({ credit, readOnly }: { credit: CastCredit; readOnly: boolean }) {
  const { t } = useTranslation("media");
  const router = useRouter();
  const st = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const isCrew = credit.crewRoles.length > 0;
  const subtitle = isCrew ? credit.crewRoles.map((r) => t(creditRoleKey(r))).join(" · ") : credit.character;

  return (
    <Pressable
      disabled={readOnly}
      onPress={() => router.push({
        pathname: "/person/[personId]",
        params: { personId: credit.id, ...(credit.linkRole !== "Actor" ? { role: credit.linkRole } : {}) },
      })}
      accessibilityRole="button"
      accessibilityLabel={`${credit.name}${subtitle ? `, ${subtitle}` : ""}`}
      accessibilityHint={readOnly ? undefined : t("personOpen", { name: credit.name })}
      style={({ pressed }) => [st.card, pressed && st.pressed]}
    >
      <View style={st.portrait}>
        {credit.imageTag ? (
          <Image
            source={{ uri: client.getImageUrl(credit.id, "Primary", { height: CARD_H * 2, quality: 80, tag: credit.imageTag }) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            recyclingKey={credit.id}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, st.fallback]}>
            <Text style={st.initials}>{initials(credit.name)}</Text>
          </View>
        )}
      </View>
      <Text style={st.name} numberOfLines={1}>{credit.name}</Text>
      {subtitle ? <Text style={[st.sub, isCrew && st.subCrew]} numberOfLines={1}>{subtitle}</Text> : null}
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    section: { marginTop: spacing.xl },
    title: {
      fontSize: 18,
      lineHeight: 23,
      letterSpacing: -0.4,
      fontFamily: FONT_FAMILY.bold,
      color: t.colors.text.primary,
      paddingHorizontal: spacing.screenPadding,
      marginBottom: spacing.md,
    },
    list: { paddingHorizontal: spacing.screenPadding, gap: spacing.md },
    sep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginVertical: spacing.sm, marginRight: spacing.md, backgroundColor: t.colors.border.strong },
    cell: { flexDirection: "row" },
    card: { width: CARD_W },
    pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
    portrait: {
      width: CARD_W,
      height: CARD_H,
      borderRadius: RADIUS.md,
      overflow: "hidden",
      backgroundColor: t.colors.surface.s2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    fallback: { alignItems: "center", justifyContent: "center", backgroundColor: t.colors.brand.soft },
    initials: { fontSize: 22, fontFamily: FONT_FAMILY.bold, color: t.colors.brand.light },
    name: { marginTop: spacing.xs + 2, fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    sub: { marginTop: 1, fontSize: 11.5, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    subCrew: { color: t.colors.brand.light },
  });
