import type { LucideIcon } from "lucide-react";
import { SettingsRow } from "../settings/ui/SettingsRow";
import type { MirrorPaneId } from "../settings/panes";
import { useProfilePane } from "./ProfilePaneContext";

/**
 * `ProfilePaneRow` de l'app : chevron sur téléphone (un écran s'ouvre),
 * surbrillance `brand.soft` sans chevron sur tablette (le volet s'affiche à droite).
 */
export function ProfilePaneRow({ pane, icon, label, description, value, last }: {
  pane: MirrorPaneId;
  icon: LucideIcon;
  label: string;
  description?: string;
  value?: string;
  last?: boolean;
}) {
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
