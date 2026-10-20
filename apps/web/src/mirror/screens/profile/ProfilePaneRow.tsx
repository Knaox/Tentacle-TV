import type { LucideIcon } from "lucide-react";
import { SettingsRow } from "../settings/ui/SettingsRow";
import type { SettingScope } from "@tentacle-tv/shared";
import type { WebPaneId } from "../settings/catalog/webCatalog";
import { useProfilePane } from "./ProfilePaneContext";

/**
 * `ProfilePaneRow` de l'app : la ligne d'un volet, dans la page de sa rubrique.
 * Sur téléphone, l'écran `/settings/*` s'ouvre ; sur tablette, le volet
 * remplace la page dans la colonne de détail (« ‹ Rubrique » pour remonter).
 */
export function ProfilePaneRow({ pane, icon, label, description, value, scope, last }: {
  pane: WebPaneId;
  icon: LucideIcon;
  label: string;
  description?: string;
  value?: string;
  scope?: SettingScope | null;
  last?: boolean;
}) {
  const { open } = useProfilePane(pane);
  return (
    <SettingsRow
      icon={icon}
      label={label}
      description={description}
      value={value}
      scope={scope}
      chevron
      last={last}
      onPress={open}
    />
  );
}
