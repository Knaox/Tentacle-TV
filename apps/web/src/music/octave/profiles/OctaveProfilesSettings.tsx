/**
 * Octave — Réglages d'Octave › « Profils » : qui écoute, et les deux gestes du menu du profil — « Changer de
 * profil » (la petite feuille « Qui écoute ? », code PIN compris) et « Gérer les profils » (la page dans Octave). Les
 * MÊMES règles que le menu (`octaveProfileMenu`) : rien sans famille de plusieurs profils, hors ligne, ni face à un
 * serveur qui ne déclare pas les profils. Un réglage du COMPTE (la famille), d'où sa pastille.
 */

import { memo, useCallback, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { SettingsSection } from "@tentacle-tv/ui";
import { ManageProfilesIcon, SwitchProfileIcon } from "../../../components/userMenu/icons";
import { switchActiveId } from "../../../profiles/switcher/switchPlan";
import { octavePaths } from "../octavePaths";
import { OctaveProfileSheet } from "./OctaveProfileSheet";
import { shellIdentityOf } from "./shellIdentity";
import { useOctaveProfileMenu } from "./useOctaveProfileMenu";

const rowClass =
  "flex min-h-[52px] w-full cursor-pointer items-center gap-3 border-t border-line-subtle px-5 text-left text-sm font-medium text-content-primary transition-colors duration-150 hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus";

export const OctaveProfilesSettings = memo(function OctaveProfilesSettings({ badge }: { badge?: ReactNode }) {
  const { t } = useTranslation("octaveShell");
  const navigate = useNavigate();
  const { menu, activeProfileId, refetch } = useOctaveProfileMenu();
  const [sheet, setSheet] = useState(false);
  const closeSheet = useCallback(() => setSheet(false), []);
  const identity = shellIdentityOf(menu);
  if (!menu?.current || !identity) return null;

  return (
    <SettingsSection title={t("settings.profiles")} caption={t("settings.profilesCaption")} badge={badge}>
      <div className="flex items-center gap-3 px-5 py-4" data-octave-settings-profile>
        {identity.avatar(40)}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-content-primary">{identity.name}</span>
          <span className="block truncate text-xs text-content-tertiary">{t("profile.current")}</span>
        </span>
      </div>
      <button type="button" className={rowClass} onClick={() => setSheet(true)}>
        <SwitchProfileIcon />
        <span className="flex-1">{t("profile.switch")}</span>
        <ChevronRight size={16} aria-hidden className="text-content-tertiary" />
      </button>
      {menu.canManage && (
        <button type="button" className={rowClass} onClick={() => navigate(octavePaths.profiles)}>
          <ManageProfilesIcon />
          <span className="flex-1">{t("profile.manage")}</span>
          <ChevronRight size={16} aria-hidden className="text-content-tertiary" />
        </button>
      )}
      {sheet && (
        <OctaveProfileSheet
          profiles={menu.profiles}
          currentId={switchActiveId(menu.profiles, activeProfileId)}
          onClose={closeSheet}
          onStale={refetch}
        />
      )}
    </SettingsSection>
  );
});
