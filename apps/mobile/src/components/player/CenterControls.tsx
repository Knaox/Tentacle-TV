import { Pressable, Text, View } from "react-native";
import { SkipBack, RotateCcw, Play, Pause, RotateCw, SkipForward } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PLAYER } from "@/theme";

interface Props {
  paused: boolean;
  ui: number;
  centerGap: number;
  playSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onPlayPause: () => void;
  onRewind: () => void;
  onForward: () => void;
}

/**
 * Rangée centrale du player — 5 emplacements TOUJOURS réservés : au
 * 1er/dernier épisode, le bouton précédent/suivant disparaissait et
 * play/pause se décentrait. Fantôme invisible de même emprise → grille
 * stable, lecture toujours au centre optique (Android + iOS).
 */
export function CenterControls({
  paused, ui, centerGap, playSize, hasPrevious, hasNext,
  onPrevious, onNext, onPlayPause, onRewind, onForward,
}: Props) {
  // Paysage : la rangée reste centrée, mais l'inset latéral garantit qu'un
  // écran étroit ne pousse jamais un bouton sous l'îlot caméra.
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: centerGap, paddingHorizontal: Math.max(insets.left, insets.right) }}>
      {hasPrevious && onPrevious ? (
        <Pressable onPress={onPrevious} hitSlop={16} style={{ padding: 8 }}>
          <SkipBack size={Math.round(22 * ui)} color={PLAYER.textSecondary} />
        </Pressable>
      ) : (
        <View pointerEvents="none" style={{ padding: 8, opacity: 0 }}>
          <SkipBack size={Math.round(22 * ui)} color={PLAYER.text} />
        </View>
      )}

      <Pressable onPress={onRewind} hitSlop={16} style={{ padding: 8 }}>
        <RotateCcw size={Math.round(24 * ui)} color={PLAYER.text} />
        <Text style={{ color: PLAYER.text, fontSize: Math.round(10 * ui), fontWeight: "600", textAlign: "center", marginTop: 2 }}>10</Text>
      </Pressable>

      <Pressable onPress={onPlayPause} hitSlop={16}>
        <View style={{
          width: playSize, height: playSize, borderRadius: playSize / 2,
          backgroundColor: PLAYER.border,
          justifyContent: "center", alignItems: "center",
        }}>
          {paused ? <Play size={Math.round(30 * ui)} color={PLAYER.text} /> : <Pause size={Math.round(30 * ui)} color={PLAYER.text} />}
        </View>
      </Pressable>

      <Pressable onPress={onForward} hitSlop={16} style={{ padding: 8 }}>
        <RotateCw size={Math.round(24 * ui)} color={PLAYER.text} />
        <Text style={{ color: PLAYER.text, fontSize: Math.round(10 * ui), fontWeight: "600", textAlign: "center", marginTop: 2 }}>30</Text>
      </Pressable>

      {hasNext && onNext ? (
        <Pressable onPress={onNext} hitSlop={16} style={{ padding: 8 }}>
          <SkipForward size={Math.round(22 * ui)} color={PLAYER.textSecondary} />
        </Pressable>
      ) : (
        <View pointerEvents="none" style={{ padding: 8, opacity: 0 }}>
          <SkipForward size={Math.round(22 * ui)} color={PLAYER.text} />
        </View>
      )}
    </View>
  );
}
