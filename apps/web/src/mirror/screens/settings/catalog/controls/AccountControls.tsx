import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AtSign, Camera, Monitor, MonitorPlay, RefreshCw } from "lucide-react";
import { DESKTOP_ONLY_SETTINGS } from "@tentacle-tv/shared";
import { getUserInfo } from "../../../../../components/userMenu/menuItems";
import { useAvatarUpload } from "../../../../../hooks/useAvatarUpload";
import { useAvatarGallery } from "../../../../../profiles/avatarGallery/useAvatarGallery";
import { useAskAtLaunch } from "../../../../../profiles/settings/useAskAtLaunch";
import { openSwitchScreen } from "../../../../../profiles/switcher/switchScreenStore";
import { SettingsRow } from "../../ui/SettingsRow";
import { SwitchSettingRow, type ControlRowProps } from "./SettingRowKit";

/**
 * « Photo de profil » — la photo du COMPTE Jellyfin : la galerie des
 * personnages ou une photo importée (`useAvatarGallery`), comme le toucher de
 * la photo en tête du profil.
 */
export function PhotoRow({ scope, last }: ControlRowProps) {
  const { t } = useTranslation(["settingsMobile", "profile"]);
  const { avatarSrc, onAvatarError, avatarVersion, uploading, userId } = useAvatarUpload();
  const { openGallery, dialog } = useAvatarGallery();
  return (
    <>
      <SettingsRow
        icon={Camera}
        label={t("account.photo")}
        description={t("account.photoHint")}
        scope={scope}
        chevron
        last={last}
        disabled={uploading || !userId}
        ariaLabel={t("profile:changePhoto")}
        onPress={() => openGallery()}
        trailing={avatarSrc ? (
          <img
            key={`${avatarVersion}-${avatarSrc}`}
            src={avatarSrc}
            alt=""
            onError={onAvatarError}
            className="h-8 w-8 shrink-0 rounded-full bg-fill-subtle object-cover"
          />
        ) : undefined}
      />
      {dialog}
    </>
  );
}

/** Le nom du compte, en lecture : il se change dans Jellyfin, par un administrateur. */
export function UserNameRow({ last }: ControlRowProps) {
  const { t } = useTranslation(["settingsMobile", "profile"]);
  const { name } = getUserInfo();
  return <SettingsRow icon={AtSign} label={t("account.name")} value={name || t("profile:defaultUsername")} last={last} />;
}

/** « Changer de profil » : « Qui regarde ? » plein écran, PIN compris (`WhoIsWatchingHost`). */
export function SwitchProfileRow({ last }: ControlRowProps) {
  const { t } = useTranslation("settingsMobile");
  return <SettingsRow icon={RefreshCw} label={t("account.switchProfile")} chevron last={last} onPress={() => openSwitchScreen()} />;
}

/**
 * « Qui regarde ? » au démarrage — le réglage de CE navigateur (`useAskAtLaunch`,
 * le même que Réglages › Famille). Coupé par l'administration : la phrase seule.
 */
export function AskAtLaunchRow({ scope, last }: ControlRowProps) {
  const { t } = useTranslation("settingsMobile");
  const setting = useAskAtLaunch();
  if (!setting) return null;
  if (!setting.allowed) return <SettingsRow icon={MonitorPlay} label={t("account.askAtLaunch")} description={setting.description} scope={scope} last={last} />;
  return (
    <SwitchSettingRow
      icon={MonitorPlay} label={t("account.askAtLaunch")} description={setting.description}
      scope={scope} value={setting.proposes} onChange={setting.toggle} last={last}
    />
  );
}

/**
 * « Réglages avancés : sur l'app bureau » — un renvoi, pas un réglage. Le
 * toucher déplie l'explication sur place (pas de dialogue : une phrase se lit
 * dans la page). Le texte du web dit aussi « une fenêtre plus large » : le
 * même site, sur un ordinateur, montre les réglages fins.
 */
export function AdvancedOnDesktopRow({ last }: ControlRowProps) {
  const { t } = useTranslation("settingsMobile");
  const [open, setOpen] = useState(false);
  return (
    <div className={last ? "" : "border-b border-line-subtle"}>
      <SettingsRow
        icon={Monitor}
        ariaExpanded={open}
        label={t("advanced.row")}
        description={t("advanced.rowHint")}
        last
        onPress={() => setOpen((value) => !value)}
      />
      {open && (
        <div className="px-3 pb-3 pl-[42px] text-[13px] leading-[19px] text-content-secondary">
          <p>{t("web.advancedIntro")}</p>
          {/* La liste vient du catalogue partagé (« réservé au bureau »), la même que celle du mobile. */}
          <ul className="mt-2 list-disc pl-4">
            {DESKTOP_ONLY_SETTINGS.map((ref) => <li key={ref.key}>{t(ref.key, { ns: ref.ns })}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
