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
  const randomQuery = useRandomLibraryBackdrop(libraryId);
  const randomItem = randomQuery.data;
  // Le repli n'est demandé QUE si le tirage a répondu sans rien donner.
  //
  // « Derniers ajouts » rapporte jusqu'à cent épisodes avec leurs champs : sur
  // une bibliothèque de séries, c'est la requête la plus lourde de l'écran — et
  // dans neuf cas sur dix elle ne sert à rien, le tirage ayant fourni son fond.
  // La demander d'emblée, c'était la mettre en concurrence avec le catalogue,
  // dont l'affichage de la grille dépend, pour un repli hypothétique.
  const { data: latest } = useLatestItems(libraryId, {
    collectionType,
    enabled: randomQuery.isFetched && !randomItem,
  });

  const featured = randomItem ?? latest?.[0];

  return (
    <TVBannerCardFrame
      heightVh={TV_BANNER_CARD.libraryHeightVh}
      ambilightUri={featured ? backdropUriOf(client, featured, TV_AMBILIGHT.sourceWidth, 70) : undefined}
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
