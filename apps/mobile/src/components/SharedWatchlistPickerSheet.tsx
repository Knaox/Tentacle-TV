import { useState, useCallback } from "react";
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  useMySharedWatchlists,
  useBatchAddToSharedWatchlists,
  useToggleWatchlist,
  useCreateSharedWatchlist,
} from "@tentacle-tv/api-client";
import { BottomSheet, Button } from "./ui";
import { colors, spacing, typography } from "@/theme";

interface ContentProps {
  itemId: string;
  alreadyInWatchlist: boolean;
  onClose: () => void;
}

/** Contenu du picker — réutilisable dans un BottomSheet existant. */
export function SharedWatchlistPickerContent({ itemId, alreadyInWatchlist, onClose }: ContentProps) {
  const { t } = useTranslation("common");
  const { data: lists } = useMySharedWatchlists();
  const batchAdd = useBatchAddToSharedWatchlists();
  const watchlist = useToggleWatchlist(itemId);
  const createList = useCreateSharedWatchlist();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [alsoMyList, setAlsoMyList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const editableLists = lists?.filter((l) => l.myRole === "creator" || l.myRole === "contributor") ?? [];

  const toggleList = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newListName.trim()) return;
    const result = await createList.mutateAsync({ name: newListName.trim() });
    setSelected((prev) => new Set(prev).add(result.id));
    setNewListName("");
    setShowCreate(false);
  }, [newListName, createList]);

  const handleConfirm = useCallback(async () => {
    if (selected.size > 0) {
      await batchAdd.mutateAsync({ jellyfinItemId: itemId, watchlistIds: Array.from(selected) });
    }
    if (alsoMyList && !alreadyInWatchlist) {
      watchlist.add.mutate();
    }
    setSelected(new Set());
    setAlsoMyList(false);
    onClose();
  }, [selected, alsoMyList, alreadyInWatchlist, batchAdd, watchlist, itemId, onClose]);

  const isPending = batchAdd.isPending || watchlist.add.isPending;

  return (
    <View style={{ flex: 1, paddingHorizontal: spacing.screenPadding }}>
      <Text style={{ ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.md }}>
        {t("addToSharedList")}
      </Text>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {editableLists.length === 0 && !showCreate && (
          <View style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
            <Feather name="list" size={36} color={colors.textMuted} />
            <Text style={{ ...typography.body, color: colors.textMuted, marginTop: spacing.sm }}>
              {t("noSharedLists")}
            </Text>
            <Text style={{ ...typography.caption, color: colors.textDim, marginTop: spacing.xs }}>
              {t("createFirstList")}
            </Text>
          </View>
        )}

        {editableLists.map((list) => (
          <Pressable
            key={list.id}
            onPress={() => toggleList(list.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Feather
              name={selected.has(list.id) ? "check-square" : "square"}
              size={22}
              color={selected.has(list.id) ? colors.accent : colors.textMuted}
            />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={{ ...typography.body, color: colors.textPrimary }}>{list.name}</Text>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>
                {t(list.myRole)} · {t("memberCount", { count: list.memberCount })}
              </Text>
            </View>
            <Text style={{ ...typography.badge, color: colors.textDim }}>
              {list.itemCount}
            </Text>
          </Pressable>
        ))}

        {/* Créer une liste inline */}
        {showCreate ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.md, gap: spacing.sm }}>
            <TextInput
              value={newListName}
              onChangeText={setNewListName}
              placeholder={t("listNamePlaceholder")}
              placeholderTextColor={colors.textDim}
              autoFocus
              style={{
                flex: 1,
                ...typography.body,
                color: colors.textPrimary,
                backgroundColor: colors.surfaceElevated,
                borderRadius: spacing.buttonRadius,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderWidth: 1,
                borderColor: colors.borderAccent,
              }}
            />
            <Pressable
              onPress={handleCreate}
              disabled={!newListName.trim() || createList.isPending}
              style={{ padding: spacing.sm }}
            >
              {createList.isPending ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Feather name="check" size={22} color={newListName.trim() ? colors.accent : colors.textDim} />
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowCreate(true)}
            style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.md, paddingVertical: spacing.sm }}
          >
            <Feather name="plus-circle" size={20} color={colors.accent} />
            <Text style={{ ...typography.body, color: colors.accent, marginLeft: spacing.sm }}>
              {t("createSharedList")}
            </Text>
          </Pressable>
        )}

        {/* Aussi dans ma liste */}
        {!alreadyInWatchlist && (
          <Pressable
            onPress={() => setAlsoMyList((v) => !v)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: spacing.lg,
              paddingVertical: spacing.sm,
            }}
          >
            <Feather
              name={alsoMyList ? "check-square" : "square"}
              size={22}
              color={alsoMyList ? colors.accent : colors.textMuted}
            />
            <Text style={{ ...typography.body, color: colors.textSecondary, marginLeft: spacing.md }}>
              {t("alsoAddToMyList")}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Confirmer */}
      <View style={{ paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Button
          title={isPending ? "..." : t("confirm")}
          onPress={handleConfirm}
          disabled={isPending && selected.size === 0 && !alsoMyList}
          fullWidth
          style={{ borderRadius: spacing.buttonRadius }}
        />
      </View>
    </View>
  );
}

/* ── Version avec BottomSheet intégré (pour MediaDetailScreen) ── */

interface SheetProps {
  visible: boolean;
  itemId: string;
  alreadyInWatchlist: boolean;
  onClose: () => void;
}

export function SharedWatchlistPickerSheet({ visible, itemId, alreadyInWatchlist, onClose }: SheetProps) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <BottomSheet visible={visible} onClose={handleClose} snapPoints={[0.65, 0.9]}>
      {visible && (
        <SharedWatchlistPickerContent
          itemId={itemId}
          alreadyInWatchlist={alreadyInWatchlist}
          onClose={handleClose}
        />
      )}
    </BottomSheet>
  );
}
