import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { MY_TITLE_PERCENT_KEY } from "@tentacle-tv/shared";
import { SHEET_CLOSE_KEY, SHEET_HEADER_GROUP } from "@tentacle-tv/tv-core";
import { BackButton } from "../../controls/BackButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { ArrivalArtwork } from "../../requests/ArrivalArtwork";
import type { ArrivalModel } from "../../requests/arrivalTypes";
import { useArrivalPercent } from "../../requests/useArrivalPercent";
import { colors, fonts, white } from "../../theme/tokens";
import type { SheetHeaderModel } from "./sheetTypes";

/**
 * L'en-tête : la croix Retour dans le coin haut-gauche du panneau — la règle
 * de toute la refonte (`controls/BackButton`) —, puis l'image de la carte —
 * sa forme, affiche ou vignette —, son titre et sa ligne de contexte, ce que
 * le voile vient de recouvrir. Menu ferme aussi.
 *
 * Un titre que le compte a demandé (`header.arrival`) : son affiche arrive
 * comme sur sa carte (`ArrivalArtwork`), et la ligne de contexte dit
 * l'avancement à la même seconde que le camembert.
 *
 * Focus (câblage) : groupe `sheet:header`, sur TOUTE la largeur du panneau —
 * la croix, dans son coin, n'est au-dessus ni du cran visé ni des pictos ; le
 * groupe, si. Croix : `sheet:close`.
 */

const ART = { poster: { width: 104, height: 156 }, landscape: { width: 224, height: 126 } };
/** Le camembert au centre de l'affiche de l'en-tête. */
const SIGN = 44;

export const SheetHeader = memo(function SheetHeader({
  header,
  onClose,
}: {
  header: SheetHeaderModel;
  onClose?: () => void;
}) {
  return (
    <FocusGroup focusKey={SHEET_HEADER_GROUP} style={styles.header}>
      <View style={styles.back}>
        <BackButton focusKey={SHEET_CLOSE_KEY} onPress={onClose} />
      </View>
      {header.arrival ? <Arriving header={header} arrival={header.arrival} /> : <Still header={header} />}
    </FocusGroup>
  );
});

function Texts({ header, extra }: { header: SheetHeaderModel; extra?: string | null }) {
  const subtitle = [header.subtitle, extra].filter(Boolean).join(" · ");
  return (
    <View style={styles.text}>
      <Text style={styles.title} numberOfLines={2}>{header.title}</Text>
      {subtitle ? <Text style={[styles.subtitle, styles.tabular]} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
  );
}

function Still({ header }: { header: SheetHeaderModel }) {
  const art = ART[header.shape];
  return (
    <>
      <View style={[styles.art, art]}>
        {header.imageUri ? (
          <Image source={{ uri: header.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
        ) : null}
      </View>
      <Texts header={header} />
    </>
  );
}

function Arriving({ header, arrival }: { header: SheetHeaderModel; arrival: ArrivalModel }) {
  const { t } = useTranslation();
  const art = ART[header.shape];
  const percent = useArrivalPercent(arrival);
  const value = arrival.state === "arriving" && percent !== null ? t(MY_TITLE_PERCENT_KEY, { percent: Math.floor(percent) }) : null;
  return (
    <>
      <View style={[styles.art, art]}>
        <ArrivalArtwork uri={header.imageUri} width={art.width} height={art.height} arrival={arrival} percent={percent} signSize={SIGN} />
      </View>
      <Texts header={header} extra={value} />
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 24 },
  // Dans le coin : calée en haut de l'en-tête, quelle que soit la forme de l'image.
  back: { alignSelf: "flex-start" },
  art: { borderRadius: 16, overflow: "hidden", backgroundColor: white(0.08) },
  text: { flex: 1, gap: 6 },
  title: { ...fonts.bold, fontSize: 36, lineHeight: 42, color: colors.text },
  subtitle: { ...fonts.medium, fontSize: 24, color: colors.textTertiary },
  tabular: { fontVariant: ["tabular-nums"] },
});
