import { memo, useState } from "react";
import { Image, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { itemMeta, matchReason, type SearchTopHit } from "@tentacle-tv/shared";
import { Focusable } from "../focus/Focusable";
import { TVCardImage } from "../cards/TVCardImage";
import { TVPersonCard } from "./TVPersonCard";
import { Colors, Typography } from "../../theme/colors";
import { TV_CARD_RADIUS } from "../cards/cardSizes";

export const TOP_HIT_HEIGHT = 250;

interface TVSearchTopHitProps {
  top: SearchTopHit;
  width: number;
  onOpen: (top: SearchTopHit) => void;
  onFocus?: () => void;
}

/**
 * Le meilleur résultat, en tête de page : une bannière qu'un seul appui
 * ouvre. Un titre y montre son fond, son logo et POURQUOI il répond (« Avec
 * Tom Hanks ») ; une personne, son portrait et ce qu'elle représente ici —
 * l'appui mène alors à sa filmographie dans la bibliothèque.
 */
export const TVSearchTopHit = memo(function TVSearchTopHit({ top, width, onOpen, onFocus }: TVSearchTopHitProps) {
  const { t, i18n } = useTranslation("search");
  const client = useJellyfinClient();
  const [focused, setFocused] = useState(false);

  let body: React.ReactNode;
  if (top.kind === "person") {
    body = (
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 36, paddingHorizontal: 40 }}>
        <TVPersonCard person={top.hit} focused={focused} />
        <View style={{ flex: 1 }}>
          <Label text={t("topResult")} />
          <Text numberOfLines={1} style={{ color: Colors.textPrimary, ...Typography.heroTitle }}>{top.hit.name}</Text>
          <Text style={{ color: Colors.textSecondary, ...Typography.meta, marginTop: 8 }}>{t("filmography")}</Text>
        </View>
      </View>
    );
  } else {
    const { item, match } = top.hit;
    const backdropTag = item.BackdropImageTags?.[0];
    const backdrop = backdropTag
      ? client.getImageUrl(item.Id, "Backdrop", { width: 1280, tag: backdropTag, quality: 80 })
      : null;
    const logoTag = item.ImageTags?.Logo;
    const logo = logoTag ? client.getImageUrl(item.Id, "Logo", { width: 460, tag: logoTag, quality: 90 }) : null;
    const reason = matchReason(t, match);
    body = (
      <>
        {backdrop && <TVCardImage uri={backdrop} style={{ position: "absolute", width: "100%", height: "100%" }} />}
        <LinearGradient
          colors={["rgba(0,0,0,0.92)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]}
          locations={[0, 0.45, 0.85]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ position: "absolute", left: 0, top: 0, bottom: 0, right: 0 }}
        />
        <View style={{ flex: 1, justifyContent: "flex-end", padding: 32, maxWidth: width * 0.6 }}>
          <Label text={t("topResult")} />
          {logo ? (
            <Image source={{ uri: logo }} resizeMode="contain" fadeDuration={0} style={{ width: 360, height: 96, marginBottom: 10 }} />
          ) : (
            <Text numberOfLines={2} style={{ color: Colors.textPrimary, ...Typography.heroTitle, marginBottom: 6 }}>{item.Name}</Text>
          )}
          <Text numberOfLines={1} style={{ color: Colors.textSecondary, ...Typography.meta }}>
            {itemMeta(t, item, i18n.language)}
          </Text>
          {reason && (
            <Text numberOfLines={1} style={{ color: Colors.accentPurpleLight, ...Typography.meta, marginTop: 4 }}>{reason}</Text>
          )}
        </View>
      </>
    );
  }

  return (
    <Focusable
      variant="card"
      focusRadius={TV_CARD_RADIUS}
      scaleOverride={1.02}
      onPress={() => onOpen(top)}
      onFocus={() => { setFocused(true); onFocus?.(); }}
      onBlur={() => setFocused(false)}
      accessibilityLabel={top.kind === "person" ? top.hit.name : top.hit.item.Name}
    >
      <View style={{
        width, height: TOP_HIT_HEIGHT, borderRadius: TV_CARD_RADIUS, overflow: "hidden",
        backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.glassBorder,
      }}>
        {body}
      </View>
    </Focusable>
  );
});

function Label({ text }: { text: string }) {
  return (
    <Text style={{
      color: Colors.textTertiary, fontSize: 13, fontWeight: "700", letterSpacing: 1.4,
      textTransform: "uppercase", marginBottom: 8,
    }}>
      {text}
    </Text>
  );
}
