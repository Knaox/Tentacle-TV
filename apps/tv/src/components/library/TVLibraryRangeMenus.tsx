import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { useTVRemote } from "../focus/useTVRemote";
import { TVLibraryFilterMenu, type MenuAnchor } from "./TVLibraryFilterMenu";
import { Colors } from "../../theme/colors";
import { Bouton } from "../../theme/boutons";

/**
 * Le menu des années : deux champs numériques (1900-2100), SANS auto-focus —
 * rien ne doit faire monter un clavier sans un geste explicite (règle
 * `FilterMenuTv` webOS). L'énumération des années pour Jellyfin est faite par
 * `libraryCatalogParams.anneesEnumerees`.
 */
export function TVYearMenu({
  anchor,
  yearFrom,
  yearTo,
  onYearFromChange,
  onYearToChange,
}: {
  anchor: MenuAnchor;
  yearFrom: number | null;
  yearTo: number | null;
  onYearFromChange: (v: number | null) => void;
  onYearToChange: (v: number | null) => void;
}) {
  const { t } = useTranslation("common");

  const parse = (v: string): number | null => {
    if (v.trim() === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.min(2100, Math.max(1900, Math.trunc(n)));
  };

  const inputStyle = {
    minHeight: 44,
    fontSize: 18,
    color: Colors.textPrimary,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: 12,
    flex: 1,
  } as const;

  return (
    <TVLibraryFilterMenu anchor={anchor} autoFocus={false}>
      <View style={{ flexDirection: "row", gap: 10, padding: 6 }}>
        <TextInput
          defaultValue={yearFrom != null ? String(yearFrom) : ""}
          onEndEditing={(e) => onYearFromChange(parse(e.nativeEvent.text))}
          placeholder={t("yearFrom")}
          placeholderTextColor={Colors.textTertiary}
          keyboardType="number-pad"
          style={inputStyle}
        />
        <TextInput
          defaultValue={yearTo != null ? String(yearTo) : ""}
          onEndEditing={(e) => onYearToChange(parse(e.nativeEvent.text))}
          placeholder={t("yearTo")}
          placeholderTextColor={Colors.textTertiary}
          keyboardType="number-pad"
          style={inputStyle}
        />
      </View>
    </TVLibraryFilterMenu>
  );
}

/**
 * Le menu de note minimale : un curseur MAISON au D-pad (gauche/droite par
 * pas de 0,5, zéro = « toutes ») — pas de widget système en React Native, et
 * aucune dépendance n'est ajoutée. Même geste que le scrub du lecteur : le
 * curseur n'agit que quand il a le focus.
 */
export function TVRatingMenu({
  anchor,
  ratingMin,
  onRatingMinChange,
}: {
  anchor: MenuAnchor;
  ratingMin: number | null;
  onRatingMinChange: (v: number | null) => void;
}) {
  const { t } = useTranslation("common");
  const [focused, setFocused] = useState(false);
  const current = ratingMin ?? 0;

  const adjust = (delta: number) => {
    const next = Math.min(10, Math.max(0, current + delta));
    onRatingMinChange(next > 0 ? next : null);
  };

  useTVRemote({
    onLeft: focused ? () => adjust(-0.5) : undefined,
    onRight: focused ? () => adjust(0.5) : undefined,
  });

  return (
    <TVLibraryFilterMenu anchor={anchor}>
      <View style={{ padding: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={{ color: Colors.textMuted, fontSize: 16 }}>{t("ratingMin")}</Text>
          <Text style={{ color: Colors.textSecondary, fontSize: 16, fontWeight: "600" }}>
            {current > 0 ? `★ ${current.toFixed(1)}+` : t("ratingAny")}
          </Text>
        </View>
        <Focusable
          variant="button"
          focusRadius={Bouton.moyen.borderRadius}
          hasTVPreferredFocus
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={t("ratingMin")}
        >
          <View style={{ paddingVertical: 14, paddingHorizontal: 8 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
              <View
                style={{
                  width: `${(current / 10) * 100}%`,
                  height: "100%",
                  backgroundColor: Colors.accentPurple,
                  borderRadius: 3,
                }}
              />
            </View>
          </View>
        </Focusable>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ color: Colors.textTertiary, fontSize: 12 }}>0</Text>
          <Text style={{ color: Colors.textTertiary, fontSize: 12 }}>5</Text>
          <Text style={{ color: Colors.textTertiary, fontSize: 12 }}>10</Text>
        </View>
      </View>
    </TVLibraryFilterMenu>
  );
}
