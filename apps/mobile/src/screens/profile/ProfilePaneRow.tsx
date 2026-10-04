import { SettingsRow, type SettingsIcon } from "@/components/settings";
import { useOpenProfilePane } from "./ProfilePaneContext";
import type { ProfilePaneId } from "./profilePanes";

interface Props {
  pane: ProfilePaneId;
  icon: SettingsIcon;
  label: string;
  description?: string;
  value?: string;
  last?: boolean;
}

/**
 * La ligne qui ouvre un volet — le deuxième niveau : un écran sur téléphone,
 * la colonne de détail sur tablette. Le chevron dit qu'on descend d'un cran.
 */
export function ProfilePaneRow({ pane, icon, label, description, value, last }: Props) {
  const open = useOpenProfilePane(pane);
  return <SettingsRow icon={icon} label={label} description={description} value={value} chevron last={last} onPress={open} />;
}
