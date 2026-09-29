import { memo, useCallback, useState } from "react";
import { View, Text, Image, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { ExtraEntry } from "@tentacle-tv/shared";
import { FocusableRow } from "../focus/FocusableRow";
import { Colors, Typography, Radius } from "../../theme/colors";

const TILE_W = 280;
const TILE_H = Math.round(TILE_W * 9 / 16);

interface TVExtrasRowProps {
  /** Les tuiles, dans l'ordre du modèle partagé (`buildExtraEntries`). */
  entries: ExtraEntry[];
  /** Titre de la rangée (« Extras », « Extras — Season 2 »). */
  title: string;
  onSelect: (entry: ExtraEntry) => void;
  style?: object;
  /** Position de la rangée dans sa section — pour le défilement d'accompagnement. */
  onLayout?: (event: LayoutChangeEvent) => void;
  /** Une tuile de la rangée a le focus — la page s'ancre sur la rangée. */
  onRowFocus?: () => void;
  /** HAUT depuis une tuile → ce focusable (le bouton Lecture) : l'ancrage de
   *  page fait sortir les actions de l'écran, la cible géométrique disparaît. */
  tilesNextFocusUp?: number;
}

/**
 * Rangée « Extras » de la fiche — équivalent TV de l'ExtrasRow web : tuiles
 * 16:9, libellé + genre, bandes-annonces locales et bonus lus dans le lecteur,
 * vidéos YouTube dans l'écran de bande-annonce.
 *
 * Vidéos indisponibles/privées : YouTube renvoie un placeholder gris 120×90
 * sur `hqdefault.jpg` → détecté via les dimensions au chargement (`onLoad`).
 * La LG les MASQUE (pointer libre) ; ici on les GRISE sans les démonter : la
 * vignette se résout pendant qu'on parcourt la rangée, et démonter la tuile
 * FOCUSÉE laissait le focus orphelin — plus aucune flèche ne répondait.
 */
export const TVExtrasRow = memo(function TVExtrasRow({ entries, title, onSelect, style, onLayout, onRowFocus, tilesNextFocusUp }: TVExtrasRowProps) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());

  const markUnavailable = useCallback((key: string) => {
    setUnavailable((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const handleSelect = useCallback((entry: ExtraEntry) => {
    if (!unavailable.has(entry.key)) onSelect(entry);
  }, [unavailable, onSelect]);

  if (entries.length === 0) return null;

  return (
    <FocusableRow
      title={title}
      data={entries}
      renderItem={(entry: ExtraEntry) => (
        <ExtraTile
          entry={entry}
          thumb={entry.source === "local"
            ? client.getImageUrl(entry.itemId, "Primary", { width: TILE_W * 2, quality: 80 })
            : entry.thumbUrl}
          unavailableLabel={t("trailerUnavailableShort")}
          unavailable={unavailable.has(entry.key)}
          onUnavailable={() => markUnavailable(entry.key)}
        />
      )}
      keyExtractor={(entry) => entry.key}
      itemWidth={TILE_W}
      style={style}
      onItemPress={handleSelect}
      onLayout={onLayout}
      onRowFocus={onRowFocus}
      cellNextFocusUp={tilesNextFocusUp}
    />
  );
});

function ExtraTile({
  entry,
  thumb,
  unavailableLabel,
  unavailable,
  onUnavailable,
}: {
  entry: ExtraEntry;
  thumb: string | null;
  unavailableLabel: string;
  unavailable: boolean;
  onUnavailable: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const isYouTube = entry.source === "remote" && !!entry.youtubeId;
  const src = thumb && !imgFailed ? thumb : null;

  return (
    <View style={{ width: TILE_W, opacity: unavailable ? 0.35 : 1 }}>
      <View style={{
        width: TILE_W, height: TILE_H,
        borderRadius: Radius.card,
        backgroundColor: Colors.bgCard,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
      }}>
        {src ? (
          <Image
            source={{ uri: src }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
            // Vidéo supprimée/privée → placeholder 120×90 : on grise l'entrée.
            onLoad={isYouTube ? (e) => {
              const w = e.nativeEvent?.source?.width;
              if (w && w <= 120) onUnavailable();
            } : undefined}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <Text style={{ color: Colors.textMuted, fontSize: 30 }}>▶</Text>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={{ color: Colors.textSecondary, ...Typography.cardTitle, marginTop: 8, width: TILE_W }}
      >
        {entry.title}
      </Text>
      {unavailable || entry.subtitle ? (
        <Text numberOfLines={1} style={{ color: Colors.textMuted, ...Typography.caption, width: TILE_W }}>
          {unavailable ? unavailableLabel : entry.subtitle}
        </Text>
      ) : null}
    </View>
  );
}
