import { View } from "react-native";
import type { HomeRowDescriptor } from "@tentacle-tv/api-client";
import { TVHomeRow } from "./tvHomeRowRegistry";
import type { TVHomeRowData, TVHomeRowHandlers } from "./tvHomeRowRegistry";

interface TVHomeRowsProps {
  /** Les rangées de la mise en page du compte, actives, dans l'ordre (useTVHomeRows). */
  rows: readonly HomeRowDescriptor[];
  data: TVHomeRowData;
  handlers: TVHomeRowHandlers;
  onWrapperLayout: (y: number) => void;
}

/**
 * Les rangées de l'accueil — dans l'ordre de la mise en page du COMPTE, la
 * même que le web et le mobile (le téléviseur la lit, il ne l'édite pas) ;
 * chaque clé se rend depuis `tvHomeRowRegistry`. Extraites de `HomeScreen`
 * pour le budget de 300 lignes.
 *
 * AUCUN chevauchement avec la bannière : la référence l'a supprimé (le `-mt-12`
 * web masquait la couture d'une bannière à fond perdu, qui n'existe plus — la
 * carte porte son écart bas). Chaque rangée garde sa marge BASSE (web `mb-10`).
 */
export function TVHomeRows({ rows, data, handlers, onWrapperLayout }: TVHomeRowsProps) {
  return (
    <View onLayout={(e) => onWrapperLayout(e.nativeEvent.layout.y)}>
      {rows.map((row) => (
        <TVHomeRow key={row.key} rowKey={row.key} data={data} handlers={handlers} />
      ))}
    </View>
  );
}
