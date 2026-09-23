import { useCallback, useMemo, useState } from "react";
import { Text, TVFocusGuideView, View } from "react-native";
import type { View as RNView } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { Colors } from "../../theme/colors";

export type SettingsSection = "account" | "playback" | "about";

const SECTIONS: Array<{ id: SettingsSection; labelKey: string }> = [
  { id: "account", labelKey: "preferences:sectionAccount" },
  { id: "playback", labelKey: "preferences:sectionPlayback" },
  { id: "about", labelKey: "nav:about" },
];

/**
 * La colonne des trois sections — Compte · Lecture · À propos, comme la
 * coquille de réglages de la LG (`SettingsTv`). L'entrée de focus vise la
 * section AFFICHÉE, jamais une action du panneau.
 *
 * La colonne est un guide de focus dont la destination est l'onglet ACTIF :
 * GAUCHE depuis le panneau revient dessus, jamais sur le premier de la liste,
 * et sur Android l'`autoFocus` du cadre d'écran (qui tombe sur ce guide quand
 * rien n'y a le focus) aboutit lui aussi à l'onglet affiché. Plus de
 * `hasTVPreferredFocus={isActive}` : sur Android, `setTVPreferredFocus` ignore
 * une valeur inchangée, donc une prop figée à `true` rendait inopérant le
 * `setNativeProps` de la capture de focus (useContentFocusCapture) — arriver
 * depuis le rail ne posait pas le focus. La capture est le seul propriétaire.
 */
export function TVSettingsTabs({
  active,
  onSelect,
  entryRef,
}: {
  active: SettingsSection;
  onSelect: (id: SettingsSection) => void;
  /** Publie l'onglet ACTIF comme focusable d'entrée du contenu (sortie rail). */
  entryRef?: (node: RNView | null) => void;
}) {
  const { t } = useTranslation(["preferences", "nav"]);
  const [activeNode, setActiveNode] = useState<RNView | null>(null);
  // Ref STABLE : une identité neuve à chaque rendu détacherait puis rattacherait
  // l'onglet, donc un état neuf, donc un rendu — en boucle. `entryRef` l'est
  // déjà (useTVContentEntry).
  const setActiveRef = useCallback((node: RNView | null) => {
    setActiveNode(node);
    entryRef?.(node);
  }, [entryRef]);
  const destinations = useMemo(() => (activeNode ? [activeNode] : []), [activeNode]);

  return (
    <TVFocusGuideView destinations={destinations} style={{ width: 250, gap: 8 }}>
      {SECTIONS.map((section) => {
        const isActive = section.id === active;
        return (
          <Focusable
            key={section.id}
            ref={isActive ? setActiveRef : undefined}
            variant="row"
            onPress={() => onSelect(section.id)}
            accessibilityLabel={t(section.labelKey)}
          >
            <View
              style={{
                paddingVertical: 14,
                paddingHorizontal: 18,
                borderRadius: 12,
                backgroundColor: isActive ? "rgba(255,255,255,0.10)" : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: isActive ? "700" : "500",
                  color: isActive ? Colors.textPrimary : Colors.textSecondary,
                }}
              >
                {t(section.labelKey)}
              </Text>
            </View>
          </Focusable>
        );
      })}
    </TVFocusGuideView>
  );
}
