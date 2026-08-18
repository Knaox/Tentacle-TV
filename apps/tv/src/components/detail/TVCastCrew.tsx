import { memo } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { Colors, Typography } from "../../theme/colors";

const CREW_TYPES = ["Director", "Writer", "Producer", "Composer"] as const;
const CREW_KEYS: Record<(typeof CREW_TYPES)[number], string> = {
  Director: "crewDirector",
  Writer: "crewWriter",
  Producer: "crewProducer",
  Composer: "crewComposer",
};

/** Taille de la vignette ronde d'un acteur (web `sm:w-24` = 96). */
const PORTRAIT = 96;
const ACTORS_MAX = 20;

interface TVCastCrewProps {
  item: MediaItem;
}

/**
 * Distribution et équipe — parité `CastRow` (web, non substitué sur webOS).
 *
 * AUCUN élément focusable : la section se traverse d'un coup à la télécommande,
 * ce qui est exactement ce qu'on attend d'une liste qu'on ne fait que lire
 * (c'est l'inventaire de `detail-tv.css`). Les données `People`/`Studios` sont
 * déjà dans l'item (`useMediaItem` les demande) — zéro requête en plus.
 */
export const TVCastCrew = memo(function TVCastCrew({ item }: TVCastCrewProps) {
  const { t } = useTranslation("media");
  const client = useJellyfinClient();

  const people = item.People ?? [];
  const actors = people.filter((p) => p.Type === "Actor").slice(0, ACTORS_MAX);
  const crewGroups = CREW_TYPES.map((type) => ({
    type,
    label: t(CREW_KEYS[type]),
    members: people.filter((p) => p.Type === type),
  })).filter((g) => g.members.length > 0);
  const studios = item.Studios ?? [];
  const hasCrew = crewGroups.length > 0 || studios.length > 0;

  if (actors.length === 0 && !hasCrew) return null;

  return (
    <View style={{ gap: 24 }}>
      {hasCrew && (
        <View>
          <Text style={{ color: Colors.textPrimary, ...Typography.sectionTitle, marginBottom: 12 }}>
            {t("crewSection")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 32, rowGap: 12 }}>
            {crewGroups.map((group) => (
              <View key={group.type}>
                <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: "500" }}>
                  {group.label}
                </Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 15, marginTop: 2 }}>
                  {group.members.map((m) => m.Name).join(", ")}
                </Text>
              </View>
            ))}
            {studios.length > 0 && (
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: "500" }}>
                  {t("studioLabel")}
                </Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 15, marginTop: 2 }}>
                  {studios.map((s) => s.Name).join(", ")}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {actors.length > 0 && (
        <View>
          <Text style={{ color: Colors.textPrimary, ...Typography.sectionTitle, marginBottom: 12 }}>
            {t("castSection")}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} focusable={false}>
            <View style={{ flexDirection: "row", gap: 12, paddingBottom: 8 }}>
              {actors.map((person) => (
                <View key={person.Id} style={{ width: PORTRAIT, alignItems: "center" }}>
                  <View
                    style={{
                      width: PORTRAIT,
                      height: PORTRAIT,
                      borderRadius: PORTRAIT / 2,
                      overflow: "hidden",
                      backgroundColor: Colors.bgCard,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {person.PrimaryImageTag ? (
                      <Image
                        source={{ uri: client.getImageUrl(person.Id, "Primary", { width: 200, quality: 85 }) }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={{ color: Colors.textTertiary, fontSize: 26 }}>
                        {person.Name.charAt(0)}
                      </Text>
                    )}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{ color: Colors.textPrimary, fontSize: 13, fontWeight: "500", marginTop: 8, textAlign: "center" }}
                  >
                    {person.Name}
                  </Text>
                  {person.Role ? (
                    <Text
                      numberOfLines={1}
                      style={{ color: Colors.textMuted, fontSize: 12, textAlign: "center" }}
                    >
                      {person.Role}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
});
