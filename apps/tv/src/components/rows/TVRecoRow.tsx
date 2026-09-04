import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { LayoutChangeEvent } from "react-native";
import { recoRowTitle, useRecoPage, useRecoSettings } from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { FocusableRow } from "../focus/FocusableRow";
import { TVRecoCard } from "../cards/TVRecoCard";
import { TV_POSTER_WIDTH } from "../cards/cardSizes";
import { Spacing } from "../../theme/colors";

const EMPTY: number[] = [];

interface TVRecoRowProps {
  /** La clé servie (`forYou`, `trending`…), sans son préfixe `reco:`. */
  rowKey: string;
  titleAccessory?: ReactNode;
  onItemPress: (item: RecoRowItem) => void;
  onItemLongPress: (item: RecoRowItem) => void;
  onItemFocus: (item: RecoRowItem) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onRowFocus?: () => void;
}

const renderCard = (item: RecoRowItem, _i: number, focused: boolean) => <TVRecoCard item={item} focused={focused} />;

/**
 * Une rangée `reco:<row>` de l'accueil : lue dans LA page du filtre du compte
 * — la même que le web et le mobile, une seule requête partagée par toutes
 * les rangées reco (même clé TanStack). Le téléviseur ne montre que les
 * titres EN bibliothèque : sans catalogue Vigie à trois mètres, un titre « à
 * la demande » n'aurait nulle part où mener. Rangée vidée : rien — jamais de
 * squelette. Ne jamais gater sur `isLoading` : en TanStack v4, une requête
 * `enabled: false` y reste indéfiniment.
 */
export function TVRecoRow({ rowKey, titleAccessory, onItemPress, onItemLongPress, onItemFocus, onLayout, onRowFocus }: TVRecoRowProps) {
  const { t } = useTranslation("reco");
  const settings = useRecoSettings();
  // Attendre le filtre du compte : sans cette garde, le premier rendu
  // demanderait la page « toutes plateformes » puis la page filtrée.
  const settingsReady = settings.isSuccess || settings.isError;
  const { data: page } = useRecoPage(settings.data?.providerFilter ?? EMPTY, { enabled: settingsReady });
  const row = page?.rows.find((r) => r.key === rowKey);
  const items = row ? row.items.filter((item) => item.jellyfinItemId !== null) : [];
  if (!row || items.length === 0) return null;
  const { key, params } = recoRowTitle(row);
  return (
    <FocusableRow
      title={t(key, params)}
      titleAccessory={titleAccessory}
      data={items}
      renderItem={renderCard}
      keyExtractor={(item) => item.key}
      itemWidth={TV_POSTER_WIDTH.md}
      style={{ marginBottom: Spacing.rowGap }}
      onItemPress={onItemPress}
      onItemLongPress={onItemLongPress}
      onItemFocus={onItemFocus}
      onLayout={onLayout}
      onRowFocus={onRowFocus}
    />
  );
}
