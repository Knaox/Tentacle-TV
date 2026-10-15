import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { railSetupMoveKey, railSetupRowKey } from "@tentacle-tv/tv-core";
import { FocusTarget } from "../../focus/FocusTarget";
import { Icon } from "../../icons/Icon";
import { useRemoteHints } from "../../remote/remoteHints";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import { NavRowSurface } from "../settings/NavOrderRow";
import type { RailSetupLibrary } from "./railSetupTypes";

/**
 * Une bibliothèque de la préconfiguration : la ligne, puis à droite
 * « Déplacer ».
 *
 * - la ligne (la case, le pictogramme, le nom) : OK l'ÉPINGLE ou la retire —
 *   la case se coche à la couleur de la marque, le nom s'éteint quand elle
 *   n'est pas dans la barre ;
 * - « Déplacer » la SOULÈVE : la ligne prend le liseré de la marque et dit
 *   ses touches ; HAUT / BAS la déplacent, OK la pose (la même surface et les
 *   mêmes mots que Réglages › Navigation).
 *
 * Clés de focus : `railSetup:row:<i>` et `railSetup:row:<i>:move` — par
 * POSITION : une bibliothèque déplacée change de case, pas de cible. Pendant
 * un déplacement, l'intégration verrouille les lignes (tv-core
 * `railSetupLockedKeys`) : HAUT / BAS restent dans la colonne des pastilles.
 */

export const LIBRARY_ROW_HEIGHT = 84;
const MOVE_WIDTH = 240;
const BOX = 34;

export const LibraryRow = memo(function LibraryRow({ index, library, moving, onToggle, onMove, onFocusChange }: {
  index: number;
  library: RailSetupLibrary;
  /** Cette bibliothèque est soulevée. */
  moving: boolean;
  onToggle?: (key: string) => void;
  onMove?: (key: string) => void;
  onFocusChange?: (key: string, focused: boolean) => void;
}) {
  const { t } = useTranslation("nav");
  const state = library.pinned ? t("railSetup.pinned") : t("railSetup.notPinned");
  return (
    <View style={styles.line}>
      <FocusTarget
        focusKey={railSetupRowKey(index)}
        form="row"
        onPress={onToggle ? () => onToggle(library.key) : undefined}
        onFocusChange={(focused) => onFocusChange?.(library.key, focused)}
        accessibilityLabel={`${library.label}, ${state}`}
        style={styles.main}
      >
        {(focused) => <MainBody library={library} moving={moving} focused={focused} />}
      </FocusTarget>
      <FocusTarget
        focusKey={railSetupMoveKey(index)}
        onPress={onMove ? () => onMove(library.key) : undefined}
        onFocusChange={(focused) => onFocusChange?.(library.key, focused)}
        accessibilityLabel={`${t("railSetup.move")} : ${library.label}`}
      >
        {(focused) => <MoveBody label={t("railSetup.move")} focused={focused} />}
      </FocusTarget>
    </View>
  );
});

function MainBody({ library, moving, focused }: { library: RailSetupLibrary; moving: boolean; focused: boolean }) {
  const { t } = useTranslation("preferences");
  const hints = useRemoteHints();
  return (
    <NavRowSurface focused={focused} moving={moving}>
      {(dark) => {
        const main = dark ? colors.ctaFg : library.pinned || moving ? colors.text : colors.textTertiary;
        return (
          <View style={styles.row}>
            <CheckBox checked={library.pinned} dark={dark} />
            <Icon name={moving ? "moveVertical" : library.icon} size={30} color={main} strokeWidth={2.2} />
            <Text style={[styles.label, { color: main }]} numberOfLines={1}>
              {library.label}
            </Text>
            {moving ? (
              <Text style={[styles.hint, { color: dark ? scrim(0.55) : colors.textSecondary }]} numberOfLines={1}>
                {t(hints.navigationMoving)}
              </Text>
            ) : null}
          </View>
        );
      }}
    </NavRowSurface>
  );
}

/** La case : pleine à la couleur de la marque quand la bibliothèque est dans la barre. */
function CheckBox({ checked, dark }: { checked: boolean; dark: boolean }) {
  if (checked) {
    return (
      <View style={[styles.box, styles.boxOn]}>
        <Icon name="check" size={22} color={colors.onAccent} strokeWidth={3} />
      </View>
    );
  }
  return <View style={[styles.box, { borderColor: dark ? scrim(0.4) : white(0.4) }]} />;
}

function MoveBody({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={styles.move}>
      <NavRowSurface focused={focused}>
        {(dark) => {
          const color = dark ? colors.ctaFg : colors.textSecondary;
          return (
            <View style={[styles.row, styles.moveRow]}>
              <Icon name="moveVertical" size={28} color={color} strokeWidth={2.2} />
              <Text style={[styles.moveLabel, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          );
        }}
      </NavRowSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: 16 },
  main: { flex: 1 },
  row: { height: LIBRARY_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 22, paddingHorizontal: 28 },
  label: { ...fonts.semibold, fontSize: 28, flex: 1 },
  hint: { ...fonts.medium, fontSize: 22 },
  box: { width: BOX, height: BOX, borderRadius: BOX / 2, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  boxOn: { borderWidth: 0, backgroundColor: colors.accent },
  move: { width: MOVE_WIDTH },
  moveRow: { gap: 14, justifyContent: "center" },
  moveLabel: { ...fonts.semibold, fontSize: 24 },
});
