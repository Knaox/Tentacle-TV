import { memo, useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import type { AvatarCollection } from "@tentacle-tv/shared";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { PROFILES_PALETTE } from "../profiles/profileColors";
import { AVATAR_GRID_OUTER_WIDTH, AvatarGrid } from "./AvatarGrid";
import { AvatarStoryPanel } from "./AvatarStoryPanel";
import type { AvatarGalleryCharacter, AvatarGalleryViewProps } from "./avatarGalleryTypes";

export type {
  AvatarGalleryCharacter,
  AvatarGalleryModel,
  AvatarGallerySectionModel,
  AvatarGalleryViewProps,
} from "./avatarGalleryTypes";

/**
 * La GALERIE DES AVATARS (Apple TV, Android TV) — « Choisissez votre
 * personnage » : la troupe en grille à droite, collection par collection ; à
 * gauche, le personnage que le focus désigne, son portrait, son nom et son
 * histoire. OK le prend comme photo ; « Plus tard » (et Retour, décidé par
 * l'intégration) sort sans rien changer. Aucune croix.
 *
 * Pas de barre de navigation : la page est une étape (première entrée dans un
 * profil) ou un détour des réglages. La lumière de l'écran prend la couleur du
 * personnage désigné — la marque en touches seulement (la coche, le surtitre).
 *
 * Clés : `avatarGallery:tile:<id>`, `avatarGallery:later` ; groupes
 * `avatarGallery:grid`, `avatarGallery:actions` (tv-core `avatars/avatarGallery`).
 */
export const AvatarGalleryView = memo(function AvatarGalleryView({ model, onPick, onLater }: AvatarGalleryViewProps) {
  const { sections, phase } = model;
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const onTileFocus = useCallback((id: string, focused: boolean) => {
    if (focused) setFocusedId(id);
  }, []);

  const index = useMemo(() => {
    const byId = new Map<string, { character: AvatarGalleryCharacter; collection: AvatarCollection }>();
    for (const section of sections) for (const character of section.characters) byId.set(character.id, { character, collection: section.collection });
    return byId;
  }, [sections]);

  // Pendant l'envoi et sa confirmation, le panneau garde le personnage choisi ;
  // sinon, le dernier désigné — par défaut le premier, celui de l'entrée.
  const shownId = phase.kind === "browsing" ? focusedId : phase.id;
  const first = sections[0]?.characters[0];
  const shown = (shownId ? index.get(shownId) : undefined) ?? (first ? index.get(first.id) : undefined) ?? null;
  const tone = shown?.character.tone ?? null;
  const palette = useMemo(() => (tone ? avatarPalette(tone) : PROFILES_PALETTE), [tone]);

  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} intensity={0.9} />
      <View style={styles.stage}>
        <View style={styles.panel}>
          <AvatarStoryPanel
            character={shown?.character ?? null}
            collection={shown?.collection ?? null}
            guestName={model.guestName}
            phase={phase}
            onLater={onLater}
          />
        </View>
        <View style={styles.grid}>
          <AvatarGrid sections={sections} phase={phase} onPick={onPick} onFocusChange={onTileFocus} />
        </View>
      </View>
    </View>
  );
});

/** La lumière d'un personnage : sa couleur en touches, l'encre froide de « Qui regarde ? » au centre. */
function avatarPalette(tone: string): ArtworkPalette {
  return { glows: [tone, PROFILES_PALETTE.glows[1], tone], deep: PROFILES_PALETTE.deep };
}

/** Le panneau commence dans la marge de sécurité, la grille finit contre elle. */
const STAGE_X = TV_STAGE.safe.x + 24;

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: {
    position: "absolute",
    left: STAGE_X,
    right: TV_STAGE.safe.x,
    top: TV_STAGE.safe.y + 20,
    bottom: TV_STAGE.safe.y,
    flexDirection: "row",
    gap: 56,
  },
  panel: { flex: 1, paddingTop: 20, paddingBottom: 6 },
  grid: { width: AVATAR_GRID_OUTER_WIDTH },
});
