/**
 * Le kit des pages d'administration — une seule entrée à importer.
 *
 *   AdminPage / AdminPageHeader  le cadre et l'en-tête de chaque page
 *   AdminSection                 la carte de section (titre, actions, corps)
 *   StatusPill                   la puce d'état (point + mot)
 *   StatTile                     la tuile de chiffre, lien vers sa section
 *   AdminNotice                  l'encadré d'information teinté
 *   Tabs / TabPanel + useUrlTab  les onglets accessibles, gardés dans l'adresse
 *   UserAvatar                   l'avatar d'un compte Jellyfin
 *
 * Les boutons et champs restent les jetons `cls` de `pages/adminUtils` ; les
 * dialogues, `ConfirmDialog` / `Modal` de `components/ui`.
 */
export { AdminPage, AdminPageHeader, type AdminPageProps, type AdminPageHeaderProps } from "./AdminPage";
export { AdminSection, type AdminSectionProps } from "./AdminSection";
export { StatusPill, type StatusPillProps, type StatusTone } from "./StatusPill";
export { StatTile, type StatTileProps, type StatTone } from "./StatTile";
export { AdminNotice, type AdminNoticeProps, type NoticeTone } from "./AdminNotice";
export { Tabs, TabPanel, type TabItem } from "../../ui/Tabs";
export { useUrlTab } from "../../../hooks/useUrlTab";
export { UserAvatar } from "../../ui/UserAvatar";
