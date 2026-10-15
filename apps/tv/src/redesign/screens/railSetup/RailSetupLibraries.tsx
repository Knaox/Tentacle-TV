import { memo, useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import {
  RAIL_SETUP_ACTIONS_GROUP,
  RAIL_SETUP_CONTINUE_KEY,
  RAIL_SETUP_LIST_GROUP,
  RAIL_SETUP_SKIP_KEY,
} from "@tentacle-tv/tv-core";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { colors, text } from "../../theme/tokens";
import { LibraryRow } from "./LibraryRow";
import { RailPreview } from "./RailPreview";
import type { RailSetupModel, RailSetupViewProps } from "./railSetupTypes";

type LibrariesModel = Extract<RailSetupModel, { kind: "libraries" }>;

/**
 * « Quelles bibliothèques dans votre barre ? » — à gauche, l'APERÇU de la
 * barre à sa place réelle ; à droite, la question, la liste des
 * bibliothèques du profil (elle défile s'il y en a beaucoup), et le pied :
 * « Continuer » (l'action principale), « Passer » (la disposition d'avant).
 * La bibliothèque que le focus vise s'éclaire dans l'aperçu.
 */
export const RailSetupLibraries = memo(function RailSetupLibraries({ model, onTogglePin, onMove, onContinue, onSkip }: {
  model: LibrariesModel;
} & Pick<RailSetupViewProps, "onTogglePin" | "onMove" | "onContinue" | "onSkip">) {
  const { t } = useTranslation("nav");
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const onRowFocus = useCallback((key: string, focused: boolean) => {
    if (focused) setFocusedKey(key);
    else setFocusedKey((current) => (current === key ? null : current));
  }, []);
  const kicker = model.profileName ? t("railSetup.kickerFor", { name: model.profileName }) : t("railSetup.kicker");

  return (
    <View style={styles.fill}>
      <RailPreview caption={t("railSetup.preview")} entries={model.preview} focusedKey={focusedKey} movingKey={model.movingKey} />
      <View style={styles.content}>
        <Text style={styles.kicker} numberOfLines={1}>{kicker}</Text>
        <Text style={styles.title}>{t("railSetup.title")}</Text>
        <Text style={styles.subtitle}>{t("railSetup.subtitle")}</Text>
        <FocusGroup focusKey={RAIL_SETUP_LIST_GROUP} style={styles.listBox}>
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {model.libraries.map((library, index) => (
              <LibraryRow
                key={`slot:${index}`}
                index={index}
                library={library}
                moving={library.key === model.movingKey}
                onToggle={onTogglePin}
                onMove={onMove}
                onFocusChange={onRowFocus}
              />
            ))}
          </ScrollView>
        </FocusGroup>
        <FocusGroup focusKey={RAIL_SETUP_ACTIONS_GROUP} style={styles.actions}>
          <PillButton variant="primary" label={t("railSetup.continue")} icon="check" focusKey={RAIL_SETUP_CONTINUE_KEY} onPress={onContinue} />
          <PillButton label={t("railSetup.skip")} focusKey={RAIL_SETUP_SKIP_KEY} onPress={onSkip} />
        </FocusGroup>
      </View>
    </View>
  );
});

/** Le bord gauche du contenu : la barre ouverte et un large souffle. */
const CONTENT_LEFT = TV_STAGE.nav.left + TV_STAGE.nav.expandedWidth + 120;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    position: "absolute",
    left: CONTENT_LEFT,
    right: TV_STAGE.safe.x + 40,
    top: TV_STAGE.safe.y + 40,
    bottom: TV_STAGE.safe.y + 20,
  },
  kicker: { ...text.kicker, marginBottom: 16 },
  title: { ...text.title, marginBottom: 18 },
  subtitle: { ...text.body, color: colors.textSecondary, maxWidth: 1080, marginBottom: 36 },
  listBox: { flex: 1 },
  // Une marge où la ligne focalisée grandit sans être coupée par le bord du défilement.
  list: { gap: 12, paddingVertical: 10, paddingHorizontal: 12 },
  actions: { flexDirection: "row", gap: 24, alignItems: "center", paddingTop: 28, paddingHorizontal: 12 },
});
