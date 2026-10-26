import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HardDriveDownload, Languages, Palette, Play, ShieldCheck, Sparkles, Users } from "lucide-react";
import { SettingsShell, type SettingsShellSection } from "@tentacle-tv/ui";
import { firstWideSection, visibleWideSections, type WideSettingsSectionId } from "@tentacle-tv/shared";

import { useIsMobile } from "../../hooks/useIsMobile";
import { useGlassSidebar } from "../nav/useGlassSidebar";
import { SettingsSearchField, SettingsSearchResults } from "./wide/SettingsSearch";
import { useSettingHashScroll } from "./wide/useSettingHashScroll";
import { useWideSettingsContext } from "./wide/useWideSettingsContext";
import { SettingTargetCtx, WideSettingsCtx, useCatalogText } from "./wide/wideSettingsMeta";

/**
 * Coquille des réglages utilisateur du web large et du bureau — maître-détail,
 * comme l'administration et les Réglages Système de macOS.
 *
 * Le rail, sa phrase d'intro par rubrique et la recherche lisent le
 * CATALOGUE partagé (`@tentacle-tv/shared` › `WIDE_SETTINGS_SECTIONS`) :
 * rubriques rangées par intention (« Regarder », « Interface », « Vous »),
 * une rubrique sans ligne visible ici n'existe pas (un navigateur n'a pas de
 * téléchargements, un profil de la Famille n'a pas de mot de passe). La
 * recherche remplace la rubrique tant qu'elle a un mot ; un résultat mène à
 * SA ligne (`#<id>`).
 */

const ICON = 17;

const ICONS: Readonly<Record<WideSettingsSectionId, ReactNode>> = {
  playback: <Play size={ICON} />,
  languages: <Languages size={ICON} />,
  downloads: <HardDriveDownload size={ICON} />,
  appearance: <Palette size={ICON} />,
  personalization: <Sparkles size={ICON} />,
  family: <Users size={ICON} />,
  security: <ShieldCheck size={ICON} />,
};

/**
 * Index de `/settings`. Sur grand écran, la première rubrique visible ; sur
 * mobile, le rail reste l'écran d'atterrissage (rediriger ferait BOUCLER le
 * bouton Retour : Retour → /settings → redirection → la même page).
 */
export function SettingsIndex() {
  const isMobile = useIsMobile();
  const ctx = useWideSettingsContext();
  if (isMobile) return null;
  return <Navigate to={`/settings/${firstWideSection(ctx)}`} replace />;
}

export function SettingsLayout() {
  const { t } = useTranslation(["settingsWeb", "preferences"]);
  const text = useCatalogText();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const target = hash ? decodeURIComponent(hash.slice(1)) : null;
  const ctx = useWideSettingsContext();
  const [query, setQuery] = useState("");
  useSettingHashScroll();

  const visible = useMemo(() => visibleWideSections(ctx), [ctx]);
  const sections = useMemo<SettingsShellSection[]>(
    () => visible.map((section) => ({
      id: section.id,
      label: text(section.label),
      icon: ICONS[section.id],
      group: t(`settingsWeb:rail.${section.railGroup}`),
    })),
    [visible, text, t],
  );

  const activeId = useMemo(() => pathname.replace(/^\/settings\/?/, "").split("/")[0] || null, [pathname]);
  // Changer de rubrique (le rail, un lien) referme la recherche.
  useEffect(() => { setQuery(""); }, [activeId]);

  const active = visible.find((s) => s.id === activeId);
  const searching = query.trim().length > 0;
  const sidebar = useGlassSidebar("settings");

  return (
    <div className="pt-6">
      <WideSettingsCtx.Provider value={ctx}>
        <SettingTargetCtx.Provider value={target}>
          <SettingsShell
            sections={sections}
            activeId={searching ? activeId ?? "search" : activeId}
            onSelect={(id) => navigate(`/settings/${id}`)}
            title={searching ? t("settingsWeb:search.title", { query: query.trim() }) : active ? text(active.label) : t("preferences:settingsTitle")}
            description={searching ? undefined : active ? text(active.intro) : undefined}
            navLabel={t("preferences:settingsTitle")}
            onBack={() => (searching ? setQuery("") : navigate("/settings"))}
            backLabel={t("preferences:back")}
            railHeader={<SettingsSearchField value={query} onChange={setQuery} />}
            selectionIndicator={sidebar.selection}
            sidebarSurface={sidebar.surface}
          >
            {searching ? <SettingsSearchResults query={query} ctx={ctx} onPick={() => setQuery("")} /> : <Outlet />}
          </SettingsShell>
        </SettingTargetCtx.Provider>
      </WideSettingsCtx.Provider>
    </div>
  );
}
