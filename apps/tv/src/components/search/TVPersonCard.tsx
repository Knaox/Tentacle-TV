import { memo } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { initials, personMeta, type SearchPersonHit } from "@tentacle-tv/shared";
import { TVCardImage } from "../cards/TVCardImage";
import { Colors, Typography } from "../../theme/colors";

export const PERSON_CARD_WIDTH = 170;
const PORTRAIT = 150;

/**
 * Une personne trouvée : portrait rond, nom, et ce qu'elle représente dans la
 * bibliothèque (« Interprétation — 12 titres »). Pur visuel — l'appelant
 * l'enveloppe dans un `Focusable variant="card"`.
 */
export const TVPersonCard = memo(function TVPersonCard({ person, focused = false }: {
  person: SearchPersonHit;
  focused?: boolean;
}) {
  const { t } = useTranslation("search");
  const client = useJellyfinClient();
  const uri = person.imageTag
    ? client.getImageUrl(person.id, "Primary", { height: PORTRAIT * 2, tag: person.imageTag, quality: 85 })
    : null;

  return (
    <View style={{ width: PERSON_CARD_WIDTH, alignItems: "center" }}>
      <View style={{
        width: PORTRAIT, height: PORTRAIT, borderRadius: PORTRAIT / 2, overflow: "hidden",
        backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.glassBorder,
        justifyContent: "center", alignItems: "center",
      }}>
        {uri ? (
          <TVCardImage uri={uri} style={{ width: "100%", height: "100%" }} />
        ) : (
          <Text style={{ color: Colors.textSecondary, fontSize: 42, fontWeight: "700" }}>{initials(person.name)}</Text>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={{ color: focused ? Colors.textPrimary : Colors.textSecondary, ...Typography.cardTitle, marginTop: 12, textAlign: "center" }}
      >
        {person.name}
      </Text>
      <Text numberOfLines={1} style={{ color: Colors.textTertiary, ...Typography.caption, marginTop: 2, textAlign: "center" }}>
        {personMeta(t, person)}
      </Text>
    </View>
  );
});
