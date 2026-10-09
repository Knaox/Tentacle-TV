import { memo } from "react";
import { Platform, Text, TextInput, View, type TextStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { isForeignMessage } from "@tentacle-tv/shared";
import { FONT_FAMILY, useTheme } from "../../theme";

interface Props {
  body: string;
  style: TextStyle;
}

/**
 * Le texte d'un message de ticket, que l'on peut TRADUIRE : sélectionnable,
 * avec le menu complet du système — Copier, Rechercher, Traduire, Partager.
 * Sur le web, le navigateur propose de lui-même de traduire la page ; dans
 * l'application, le texte n'était même pas sélectionnable, et un ticket écrit
 * dans une autre langue restait illisible sur téléphone comme sur tablette.
 *
 * iOS (iPhone, iPad) : un `Text` sélectionnable n'offre que « Copier » sous la
 * nouvelle architecture (RCTParagraphComponentView) ; une zone de texte en
 * lecture seule (UITextView) donne le menu entier, « Traduire » compris.
 * Android : le `Text` sélectionnable ouvre la barre du système, où « Traduire »
 * paraît dès qu'une application de traduction est là.
 *
 * Un message dans une autre langue que celle de l'interface le dit, sous le
 * texte, sans rien envoyer nulle part : la traduction est celle du système.
 */
export const MessageBody = memo(function MessageBody({ body, style }: Props) {
  const { t, i18n } = useTranslation("tickets");
  const { colors } = useTheme();
  const foreign = isForeignMessage(body, i18n.language);
  return (
    <View>
      {Platform.OS === "ios" ? (
        <TextInput
          value={body}
          editable={false}
          multiline
          scrollEnabled={false}
          dataDetectorTypes="link"
          accessibilityLabel={body}
          style={[style, { padding: 0, margin: 0 }]}
        />
      ) : (
        <Text selectable style={style}>{body}</Text>
      )}
      {foreign ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
          <Feather name="globe" size={12} color={colors.text.tertiary} />
          <Text style={{ flexShrink: 1, fontSize: 12, lineHeight: 16, fontFamily: FONT_FAMILY.medium, color: colors.text.tertiary }}>
            {t("translateHint")}
          </Text>
        </View>
      ) : null}
    </View>
  );
});
