import { memo } from "react";
import { ToggleGlyph } from "../../cards/ToggleGlyph";
import { Icon, type IconName } from "../../icons/Icon";
import type { SheetActionKind } from "./sheetTypes";

/**
 * Le glyphe d'une action. Les bascules sont celles de la pastille des cartes
 * et de leur plateau (`ToggleGlyph`) — au trait tant que l'état n'est pas
 * posé, pleines quand il l'est : la feuille dit l'état dans la même forme que
 * la carte qu'elle recouvre.
 */

const ICON_OF: Record<Exclude<SheetActionKind, "watchlist" | "favorite" | "watched">, IconName> = {
  play: "play",
  request: "plus",
  details: "info",
  dismiss: "eyeOff",
  offline: "layers",
  providersAll: "filterOff",
};

export const SheetGlyph = memo(function SheetGlyph({
  kind,
  active = false,
  color,
  size = 30,
}: {
  kind: SheetActionKind;
  active?: boolean;
  color: string;
  size?: number;
}) {
  if (kind !== "watchlist" && kind !== "favorite" && kind !== "watched") {
    return <Icon name={ICON_OF[kind]} size={size} color={color} strokeWidth={2.2} />;
  }
  return <ToggleGlyph kind={kind} active={active} color={color} size={size} />;
});
