import { memo } from "react";
import { Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useJellyfinClient, useLatestItems, useRandomLibraryBackdrop } from "@tentacle-tv/api-client";
import { TV_AMBILIGHT, TV_BANNER_CARD } from "@tentacle-tv/theme";
import { useTranslation } from "react-i18next";
import { TVBannerCardFrame } from "../hero/TVBannerCardFrame";
import { TVHeroBackdrop, backdropUriOf } from "../hero/TVHeroBackdrop";
import { Colors, Typography } from "../../theme/colors";

interface TVLibraryHeroProps {
  libraryId: string;
  libraryName: string;
  collectionType?: string;
}

/**
 * L'en-tête de bibliothèque — la MÊME carte que l'accueil, en 44 vh (parité
 * `LibraryHero` + `library-tv.css`). Le backdrop est un item ALÉATOIRE de la
 * bibliothèque, tiré une fois par session puis en cache ; repli sur le premier
 * des « Derniers ajouts » quand le tirage ne renvoie rien.
 */
export const TVLibraryHero = memo(function TVLibraryHero({
  libraryId,
  libraryName,
  collectionType,
}: TVLibraryHeroProps) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { data: randomItem } = useRandomLibraryBackdrop(libraryId);
  const { data: latest } = useLatestItems(libraryId, { collectionType });

  const featured = randomItem ?? latest?.[0];

  return (
    <TVBannerCardFrame
      heightVh={TV_BANNER_CARD.hauteurBibliothequeVh}
      ambilightUri={featured ? backdropUriOf(client, featured, TV_AMBILIGHT.largeurSource, 70) : undefined}
    >
      {featured && <TVHeroBackdrop current={featured} />}

      {/* Titre ancré à 18 % du bas de la carte, retrait d'une gouttière. */}
      <View style={{ position: "absolute", left: 56, right: 56, bottom: "18%", zIndex: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <LinearGradient
            colors={[Colors.accentPurpleLight, Colors.accentPink]}
            style={{ width: 3, height: 22, borderRadius: 2 }}
          />
          <Text
            style={{
              color: Colors.textSecondary,
              fontSize: 13,
              fontWeight: "700",
              letterSpacing: 2.6,
              textTransform: "uppercase",
            }}
          >
            {t("librariesTitle")}
          </Text>
        </View>
        <Text numberOfLines={1} style={{ color: Colors.textPrimary, ...Typography.pageTitle }}>
          {libraryName}
        </Text>
      </View>
    </TVBannerCardFrame>
  );
});
