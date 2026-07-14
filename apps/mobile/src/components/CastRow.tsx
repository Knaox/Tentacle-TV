import { View, Text, FlatList } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { spacing, typography, useTheme } from "../theme";

interface Person {
  Id: string;
  Name: string;
  Role?: string;
  Type: string;
  PrimaryImageTag?: string;
}

export interface CastRowProps { people: Person[] }

const CREW_TYPES = ["Director", "Writer", "Producer", "Composer"] as const;
const MAX_ACTORS = 20;
const AVATAR = 60;

export function CastRow({ people }: CastRowProps) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const client = useJellyfinClient();
  const actors = people.filter((p) => p.Type === "Actor").slice(0, MAX_ACTORS);
  const crewGroups = CREW_TYPES.map((type) => ({
    type,
    members: people.filter((p) => p.Type === type),
  })).filter((g) => g.members.length > 0);

  if (!actors.length && !crewGroups.length) return null;

  return (
    <View style={{ marginTop: spacing.xl }}>
      {/* Crew */}
      {crewGroups.length > 0 && (
        <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.lg, maxWidth: 640 }}>
          {crewGroups.map((g) => (
            <View key={g.type} style={{ marginBottom: spacing.sm }}>
              <Text style={{ ...typography.small, color: colors.text.tertiary }}>{t(g.type.toLowerCase())}</Text>
              <Text style={{ ...typography.caption, color: colors.text.secondary, marginTop: 2 }}>
                {g.members.map((m) => m.Name).join(", ")}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Actors */}
      {actors.length > 0 && (
        <View>
          <Text style={{
            ...typography.subtitle, color: colors.text.primary,
            paddingHorizontal: spacing.screenPadding, marginBottom: spacing.md,
          }}>
            {t("cast")}
          </Text>
          <FlatList
            horizontal
            data={actors}
            keyExtractor={(p) => p.Id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, gap: spacing.md }}
            renderItem={({ item: person }) => (
              <View style={{ width: 76, alignItems: "center" }}>
                {person.PrimaryImageTag ? (
                  <Image
                    source={{ uri: client.getImageUrl(person.Id, "Primary", { height: 120, quality: 80 }) }}
                    style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: colors.surface.s2 }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{
                    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
                    backgroundColor: colors.brand.soft, justifyContent: "center", alignItems: "center",
                  }}>
                    <Text style={{ ...typography.subtitle, color: colors.brand.violet }}>{person.Name.charAt(0)}</Text>
                  </View>
                )}
                <Text numberOfLines={1} style={{
                  ...typography.small, color: colors.text.primary, marginTop: spacing.xs, textAlign: "center",
                }}>
                  {person.Name}
                </Text>
                {person.Role && (
                  <Text numberOfLines={1} style={{
                    ...typography.badge, color: colors.text.tertiary, textAlign: "center", marginTop: 1,
                  }}>
                    {person.Role}
                  </Text>
                )}
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
}
