import { WIDE_SETTINGS_BY_ID, type WideSettingId } from "@tentacle-tv/shared";
import { ScopeBadge } from "../ScopeBadge";

/**
 * La pastille de portée d'un réglage du catalogue, pour un bloc qui porte son
 * propre titre (la Famille, ses sections) : la portée vient du catalogue,
 * jamais d'une valeur écrite dans l'écran.
 */
export function SettingScope({ setting }: { setting: WideSettingId }) {
  const scope = WIDE_SETTINGS_BY_ID[setting].scope;
  return scope ? <ScopeBadge scope={scope} /> : null;
}
