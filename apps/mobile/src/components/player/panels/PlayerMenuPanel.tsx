import { Fragment } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import type { PanelFrame } from "../../../player/panels/panelLayout";
import { menuTitleKey, showSectionTitles, type PlayerMenu } from "../../../player/panels/playerMenus";
import type { MenuSectionModel } from "../../../player/panels/menuOptions";
import { PanelSurface } from "./PanelSurface";
import { PanelHeader } from "./PanelHeader";
import { PanelOptionRow } from "./PanelOptionRow";
import { PANEL, PANEL_TYPE } from "./panelTokens";

interface Props {
  menu: PlayerMenu;
  frame: PanelFrame;
  sections: readonly MenuSectionModel[];
  onSelect: (section: MenuSectionModel["id"], key: string | number) => void;
  onClose: () => void;
}

/**
 * Un menu du lecteur, façon lecteur d'Apple : un titre, puis des sections
 * nettes (« Audio », « Sous-titres », « Qualité »), une ligne par choix, la
 * coche en tête. Les sections se séparent par la bande épaisse des menus
 * d'iOS ; leur titre n'est dit que s'il y en a plusieurs.
 */
export function PlayerMenuPanel({ menu, frame, sections, onSelect, onClose }: Props) {
  const { t } = useTranslation("player");
  const { height } = useWindowDimensions();
  const ids = sections.map((section) => section.id);
  const titled = showSectionTitles(ids);
  // En-tête ≈ 52 pt : le reste défile si la liste est longue (vingt pistes de sous-titres).
  const listMax = Math.max(120, Math.min(frame.maxHeight, height) - 52);

  return (
    <PanelSurface frame={frame} onClose={onClose}>
      <PanelHeader title={t(menuTitleKey(menu, ids))} onClose={onClose} />
      <ScrollView style={{ maxHeight: listMax }} contentContainerStyle={st.content} showsVerticalScrollIndicator={false} bounces={false}>
        {sections.map((section, index) => (
          <Fragment key={section.id}>
            {index > 0 && <View style={st.sectionGap} />}
            {titled && <Text accessibilityRole="header" style={st.sectionTitle}>{t(`panels.${section.id}`)}</Text>}
            {section.options.map((option, row) => (
              <PanelOptionRow
                key={String(option.key)}
                option={option}
                separated={row > 0}
                onPress={() => onSelect(section.id, option.key)}
              />
            ))}
            {section.footnote ? <Text style={st.footnote}>{section.footnote}</Text> : null}
          </Fragment>
        ))}
      </ScrollView>
    </PanelSurface>
  );
}

const st = StyleSheet.create({
  content: { paddingBottom: 10 },
  sectionGap: { height: 8, backgroundColor: PANEL.sectionGap, marginVertical: 4 },
  sectionTitle: { color: PANEL.secondary, fontSize: PANEL_TYPE.section, fontWeight: "600", paddingLeft: 18, paddingTop: 8, paddingBottom: 4 },
  footnote: { color: PANEL.secondary, fontSize: PANEL_TYPE.footnote, lineHeight: 18, paddingLeft: 46, paddingRight: 18, paddingTop: 6 },
});
