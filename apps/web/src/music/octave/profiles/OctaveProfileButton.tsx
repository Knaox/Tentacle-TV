/**
 * Octave — le menu du profil dans la coquille : le profil ACTUEL (sa photo ou
 * son initiale sur sa couleur), et, au clic, « Changer de profil » (la petite
 * feuille « Qui écoute ? », code PIN compris) et « Gérer les profils » (là où
 * « Qui regarde ? » l'offre ; Réglages › Famille de Tentacle). Rien sans
 * famille de plusieurs profils, ni hors ligne (`octaveProfileMenu`).
 *
 * Bureau : une rangée en pied de la barre latérale, le menu s'ouvre au-dessus.
 * Fenêtre étroite (`compact`) : le rond seul dans l'en-tête, le menu dessous.
 * Un îlot opaque (jamais de verre sur le verre du rail) ; Échap, un clic
 * dehors ou un choix le referment ; flèches Haut/Bas d'une entrée à l'autre.
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronsUpDown } from "lucide-react";
import { FamilyAvatar } from "../../../family/FamilyAvatar";
import { ManageProfilesIcon, SwitchProfileIcon } from "../../../components/userMenu/icons";
import { useMenuKeyboard } from "../../../components/userMenu/useMenuKeyboard";
import { FAMILY_SETTINGS_PATH } from "../../../profiles/launch/ProfileLaunchScreen";
import { switchActiveId } from "../../../profiles/switcher/switchPlan";
import { OctaveProfileSheet } from "./OctaveProfileSheet";
import { useOctaveProfileMenu } from "./useOctaveProfileMenu";

const itemClass =
  "flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-content-primary transition-colors duration-150 hover:bg-octave-hover focus-visible:bg-octave-hover focus-visible:outline-none";

export const OctaveProfileButton = memo(function OctaveProfileButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("octaveShell");
  const navigate = useNavigate();
  const { menu, activeProfileId, refetch } = useOctaveProfileMenu();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { panelRef, onKeyDown } = useMenuKeyboard(open);
  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const closeSheet = useCallback(() => setSheet(false), []);
  if (!menu?.current) return null;
  const { current } = menu;

  return (
    <div ref={root} className={`relative ${compact ? "" : "w-full"}`} data-octave-profile>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("profile.button", { name: current.name })}
        onClick={() => setOpen((value) => !value)}
        className={compact
          ? "flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          : "flex min-h-[48px] w-full items-center gap-3 rounded-xl px-2 text-left transition-colors duration-150 hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"}
      >
        <FamilyAvatar userId={current.userId} name={current.name} color={current.color} imageTag={current.imageTag} size={compact ? 30 : 32} />
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-content-primary">{current.name}</span>
              <span className="block truncate text-[11px] text-content-tertiary">{t("profile.current")}</span>
            </span>
            <ChevronsUpDown aria-hidden className="h-4 w-4 shrink-0 text-content-tertiary" />
          </>
        )}
      </button>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={t("profile.menu")}
          onKeyDown={onKeyDown}
          className={`octave-island octave-enter absolute z-50 w-64 p-1.5 ${compact ? "right-0 top-full mt-2" : "bottom-full left-0 mb-2"}`}
        >
          <div className="flex items-center gap-3 px-3 pb-2 pt-2.5">
            <FamilyAvatar userId={current.userId} name={current.name} color={current.color} imageTag={current.imageTag} size={40} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-content-primary">{current.name}</span>
              <span className="block truncate text-xs text-octave-accent-text">{t("profile.current")}</span>
            </span>
          </div>
          <div aria-hidden className="mx-2 my-1 h-px bg-octave-line" />
          <button type="button" role="menuitem" className={itemClass} onClick={() => { close(false); setSheet(true); }}>
            <SwitchProfileIcon />
            {t("profile.switch")}
          </button>
          {menu.canManage && (
            <button type="button" role="menuitem" className={itemClass} onClick={() => { close(false); navigate(FAMILY_SETTINGS_PATH); }}>
              <ManageProfilesIcon />
              {t("profile.manage")}
            </button>
          )}
        </div>
      )}
      {sheet && (
        <OctaveProfileSheet
          profiles={menu.profiles}
          currentId={switchActiveId(menu.profiles, activeProfileId)}
          onClose={closeSheet}
          onStale={refetch}
        />
      )}
    </div>
  );
});
