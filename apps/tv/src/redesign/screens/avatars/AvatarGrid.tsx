import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AVATAR_GALLERY_COLUMNS, AVATAR_GALLERY_GRID_GROUP, avatarTileKey, type AvatarGalleryPhase } from "@tentacle-tv/tv-core";
import { FocusGroup } from "../../focus/FocusGroup";
import { text } from "../../theme/tokens";
import { AVATAR_TILE, AVATAR_TILE_GAP, AvatarTile, type AvatarTileState } from "./AvatarTile";
import type { AvatarGallerySectionModel } from "./avatarGalleryTypes";

/** La largeur de la grille : six tuiles et leurs écarts. */
export const AVATAR_GRID_WIDTH = AVATAR_GALLERY_COLUMNS * AVATAR_TILE + (AVATAR_GALLERY_COLUMNS - 1) * AVATAR_TILE_GAP;
/** La marge où une tuile focalisée grandit sans être coupée par le bord du défilement. */
const ROOM = 26;

/** Ce que l'envoi en cours fait paraître sur la tuile d'un personnage. */
function tileState(phase: AvatarGalleryPhase, id: string): AvatarTileState {
  if (phase.kind === "browsing") return phase.failedId === id ? "failed" : "idle";
  if (phase.id !== id) return "idle";
  return phase.kind === "sending" ? "sending" : "done";
}

/**
 * La troupe, collection par collection : un titre, puis ses personnages sur
 * des lignes de six. La grille défile d'elle-même vers la tuile focalisée.
 */
export const AvatarGrid = memo(function AvatarGrid({ sections, phase, onPick, onFocusChange }: {
  sections: AvatarGallerySectionModel[];
  phase: AvatarGalleryPhase;
  onPick?: (id: string) => void;
  onFocusChange?: (id: string, focused: boolean) => void;
}) {
  const { t } = useTranslation("avatars");
  return (
    <FocusGroup focusKey={AVATAR_GALLERY_GRID_GROUP} style={styles.box}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sections.map((section) => (
          <View key={section.collection} style={styles.section}>
            <Text style={styles.title}>{t(`collections.${section.collection}`)}</Text>
            <View style={styles.tiles}>
              {section.characters.map((character) => (
                <AvatarTile
                  key={character.id}
                  character={character}
                  focusKey={avatarTileKey(character.id)}
                  label={t(`characters.${character.id}.name`)}
                  state={tileState(phase, character.id)}
                  onPick={onPick}
                  onFocusChange={onFocusChange}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </FocusGroup>
  );
});

const styles = StyleSheet.create({
  box: { flex: 1 },
  content: { padding: ROOM, gap: 44 },
  section: { width: AVATAR_GRID_WIDTH },
  title: { ...text.kicker, marginBottom: 22 },
  tiles: { flexDirection: "row", flexWrap: "wrap", columnGap: AVATAR_TILE_GAP, rowGap: AVATAR_TILE_GAP },
});

/** La place que prend la grille en largeur, marges du défilement comprises. */
export const AVATAR_GRID_OUTER_WIDTH = AVATAR_GRID_WIDTH + 2 * ROOM;
