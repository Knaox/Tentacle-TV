import { SettingsRow, type SettingsIcon } from "@/components/settings";
import { useProfilePane } from "./ProfilePaneContext";
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
 * La ligne qui ouvre un volet : chevron sur téléphone (un écran s'ouvre),
 * surbrillance sur tablette (le volet s'affiche à droite).
 */
export function ProfilePaneRow({ pane, icon, label, description, value, last }: Props) {
  const { open, selected, inline } = useProfilePane(pane);
  return (
    <SettingsRow
      icon={icon}
      label={label}
      description={description}
      value={value}
      chevron={!inline}
      selected={selected}
      last={last}
      onPress={open}
    />
  );
}
