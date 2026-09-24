import { memo, useCallback, useRef } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { MicIcon, SearchIcon } from "../icons/TVIcons";
import { Colors, brandAlpha } from "../../theme/colors";
import { Button } from "../../theme/buttons";

const IS_TVOS = Platform.OS === "ios";
export const SEARCH_BAR_HEIGHT = 64;

interface TVSearchBarProps {
  width: number;
  query: string;
  /** La suite grisée du meilleur résultat (« Harry » → « Potter… »). */
  completion: string | null;
  /** Remplace toute la saisie (clavier système tvOS, dictée Siri Remote). */
  onSetQuery: (text: string) => void;
  /** Le clavier système s'est refermé : rendre le focus au clavier à l'écran. */
  onSystemKeyboardClosed: () => void;
}

/**
 * La barre de recherche : ce qui est tapé, en blanc ; la complétion du
 * meilleur résultat, en gris ; un curseur. Elle dit toujours où l'on en est,
 * même quand le focus est trois rangées plus bas.
 *
 * tvOS — parité LG : la barre est un BOUTON, le champ réel est masqué. Seule
 * la sélection fait monter le clavier système (et la dictée de la Siri
 * Remote) ; un champ focalisable au D-pad l'ouvrait au simple passage.
 * Android TV : un affichage — la saisie passe par le clavier à l'écran et la
 * touche micro.
 */
export const TVSearchBar = memo(function TVSearchBar({
  width, query, completion, onSetQuery, onSystemKeyboardClosed,
}: TVSearchBarProps) {
  const { t } = useTranslation(["search", "common"]);
  const inputRef = useRef<TextInput>(null);
  const openSystemKeyboard = useCallback(() => inputRef.current?.focus(), []);

  const content = (
    <View style={{
      width, height: SEARCH_BAR_HEIGHT, flexDirection: "row", alignItems: "center", gap: 12,
      paddingHorizontal: 18, borderRadius: Button.small.borderRadius,
      backgroundColor: "rgba(255,255,255,0.07)",
      borderWidth: 1, borderColor: query ? brandAlpha(0.45) : Colors.glassBorder,
    }}>
      <SearchIcon size={24} color={query ? Colors.textPrimary : Colors.textTertiary} />
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 24, fontWeight: "400", color: Colors.textPrimary }}>
        {query.length === 0 ? (
          <Text style={{ color: Colors.textTertiary }}>{t("search:launcher")}</Text>
        ) : (
          <>
            {query}
            <Text style={{ color: Colors.accentPurpleLight }}>|</Text>
            {completion ? <Text style={{ color: Colors.textTertiary }}>{completion}</Text> : null}
          </>
        )}
      </Text>
      {IS_TVOS && <MicIcon size={20} color={Colors.accentPurpleLight} />}
    </View>
  );

  if (!IS_TVOS) return content;

  return (
    <>
      <Focusable
        variant="button"
        focusRadius={Button.small.borderRadius}
        onPress={openSystemKeyboard}
        accessibilityLabel={query || t("common:voiceOrType")}
      >
        {content}
      </Focusable>
      {/* Le champ RÉEL : hors écran, jamais candidat du moteur géométrique. */}
      <TextInput
        ref={inputRef}
        value={query}
        onChangeText={onSetQuery}
        onEndEditing={onSystemKeyboardClosed}
        returnKeyType="search"
        autoCorrect={false}
        style={{ position: "absolute", left: -1000, top: 0, width: 1, height: 1, opacity: 0 }}
      />
    </>
  );
});
