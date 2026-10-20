import { SettingsRow, type SettingScope, type SettingsIcon } from "@/components/settings";
import { useOpenProfilePane } from "./ProfilePaneContext";
import type { SettingsPaneId } from "@tentacle-tv/shared";

interface Props {
  pane: SettingsPaneId;
  icon: SettingsIcon;
  label: string;
  description?: string;
  value?: string;
  last?: boolean;
  /** Un volet d'une seule portée la dit sur sa ligne. */
  scope?: SettingScope;
}

/**
 * La ligne qui ouvre un volet — le deuxième niveau : un écran sur téléphone,
 * la colonne de détail sur tablette. Le chevron dit qu'on descend d'un cran.
 */
export function ProfilePaneRow({ pane, icon, label, description, value, last, scope }: Props) {
  const open = useOpenProfilePane(pane);
  return <SettingsRow icon={icon} label={label} description={description} value={value} scope={scope} chevron last={last} onPress={open} />;
}
