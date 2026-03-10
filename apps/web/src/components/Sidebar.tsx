import { useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLibraries, useAppConfig } from "@tentacle-tv/api-client";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { SidebarPreviewPanel } from "./SidebarPreviewPanel";
import { PlusMenu } from "./PlusMenu";
import { getLucideIcon, resolvePluginLabel } from "./lucideIcon";
import { usePinnedNav } from "../hooks/usePinnedNav";

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  isLibrary?: boolean;
  libraryId?: string;
}

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<NavItem | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const plusBtnRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation("nav");
  const { data: libraries } = useLibraries();
  const { data: config } = useAppConfig();
  const features = config?.features;
  const activePluginsMeta = useActivePluginsMeta();
  const pinned = usePinnedNav();
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { key: "home", label: t("home"), icon: <HomeIcon />, path: "/" },
    ];

    // Pinned watchlist
    if (pinned.watchlist) {
      items.push({ key: "pin-watchlist", label: t("myList"), icon: <WatchlistIcon />, path: "/watchlist" });
    }
    // Pinned favorites
    if (pinned.favorites) {
      items.push({ key: "pin-favorites", label: t("myFavorites"), icon: <HeartIcon />, path: "/favorites" });
    }
    // Pinned libraries
    if (libraries) {
      for (const lib of libraries) {
        if (pinned.isLibraryPinned(lib.Id)) {
          const icon = lib.CollectionType === "movies" ? <FilmIcon /> : <TvIcon />;
          items.push({
            key: `pin-lib-${lib.Id}`,
            label: lib.Name,
            icon,
            path: `/library/${lib.Id}`,
            isLibrary: true,
            libraryId: lib.Id,
          });
        }
      }
    }

    // Plugin nav items
    for (const plugin of activePluginsMeta) {
      if (plugin.configEnabled !== true) continue;
      for (const nav of plugin.navItems || []) {
        if (nav.admin || !nav.platforms?.includes("web")) continue;
        items.push({
          key: `plugin-${plugin.pluginId}-${nav.path}`,
          label: resolvePluginLabel(nav.labels ?? nav.label, i18n.language),
          icon: getLucideIcon(nav.icon),
          path: nav.path,
        });
      }
    }

    return items;
  }, [libraries, features, t, i18n.language, activePluginsMeta, pinned]);

  const isActive = (item: NavItem) => {
    if (item.key === "home") return location.pathname === "/";
    return location.pathname === item.path || location.pathname.startsWith(item.path + "/");
  };

  const handleItemHover = useCallback(
    (item: NavItem, el: HTMLButtonElement) => {
      clearTimeout(hoverTimeoutRef.current);
      if (item.isLibrary && !expanded) {
        setHoveredItem(item);
        setHoveredRect(el.getBoundingClientRect());
      } else {
        setHoveredItem(null);
        setHoveredRect(null);
      }
    },
    [expanded],
  );

  const handleItemLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredItem(null);
      setHoveredRect(null);
    }, 200);
  }, []);

  const handlePreviewEnter = useCallback(() => {
    clearTimeout(hoverTimeoutRef.current);
  }, []);

  const handlePreviewLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredItem(null);
      setHoveredRect(null);
    }, 200);
  }, []);

  return (
    <>
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => {
          setExpanded(false);
          handleItemLeave();
        }}
        className="fixed left-0 top-0 z-40 flex h-screen flex-col py-5 transition-all duration-300"
        style={{
          width: expanded ? 200 : 62,
          background: "rgba(10,10,18,0.85)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid transparent",
          borderImage: "linear-gradient(180deg, transparent, rgba(139,92,246,0.15), transparent) 1",
        }}
      >
        {/* Logo */}
        <div className="mb-6 flex items-center gap-2 px-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl shadow-[0_4px_15px_rgba(139,92,246,0.3)] hover:animate-breathe"
            style={{
              background: "linear-gradient(135deg, #8B5CF6, #6D28D9)",
            }}
          >
            <img src="/tentacle-logo-pirate.svg" alt="" className="h-6 w-6" />
          </div>
          <span
            className="overflow-hidden whitespace-nowrap text-sm font-bold text-white transition-opacity duration-300"
            style={{ opacity: expanded ? 1 : 0, width: expanded ? "auto" : 0 }}
          >
            Tentacle TV
          </span>
        </div>

        {/* Main nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2.5">
          {navItems.map((item) => (
            <SidebarButton
              key={item.key}
              item={item}
              active={isActive(item)}
              expanded={expanded}
              onClick={() => navigate(item.path)}
              onHover={handleItemHover}
              onLeave={handleItemLeave}
            />
          ))}
        </nav>

        {/* Gradient separator */}
        <div className="mx-3 my-2 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.2), transparent)" }} />

        {/* Bottom: Plus + Pair */}
        <div className="space-y-1 px-2.5 pt-2">
          {/* Plus button */}
          <button
            ref={plusBtnRef}
            onClick={() => setPlusOpen(!plusOpen)}
            title={expanded ? undefined : t("more")}
            className={`relative flex w-full items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${
              plusOpen
                ? "text-purple-400"
                : "text-white/40 hover:bg-white/5 hover:text-white/70"
            }`}
            style={{ paddingLeft: 12 }}
          >
            <span className="flex-shrink-0">
              <PlusCircleIcon active={plusOpen} />
            </span>
            <span
              className="overflow-hidden whitespace-nowrap transition-opacity duration-200"
              style={{ opacity: expanded ? 1 : 0, width: expanded ? "auto" : 0 }}
            >
              {t("more")}
            </span>
          </button>

          <SidebarButton
            item={{ key: "pair", label: t("pairDevice"), icon: <PairIcon />, path: "/pair-device" }}
            active={location.pathname === "/pair-device"}
            expanded={expanded}
            onClick={() => navigate("/pair-device")}
            onHover={handleItemHover}
            onLeave={handleItemLeave}
          />
        </div>
      </aside>

      {/* Preview panel */}
      {hoveredItem?.isLibrary && hoveredItem.libraryId && hoveredRect && (
        <SidebarPreviewPanel
          libraryId={hoveredItem.libraryId}
          libraryName={hoveredItem.label}
          top={hoveredRect.top}
          onMouseEnter={handlePreviewEnter}
          onMouseLeave={handlePreviewLeave}
        />
      )}

      {/* Plus menu flyout */}
      {plusOpen && (
        <PlusMenu
          onClose={() => setPlusOpen(false)}
          isMobile={false}
          anchorRect={plusBtnRef.current?.getBoundingClientRect()}
        />
      )}
    </>
  );
}

function SidebarButton({
  item,
  active,
  expanded,
  onClick,
  onHover,
  onLeave,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
  onHover: (item: NavItem, el: HTMLButtonElement) => void;
  onLeave: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={expanded ? undefined : item.label}
      onMouseEnter={(e) => onHover(item, e.currentTarget)}
      onMouseLeave={onLeave}
      className={`relative flex w-full items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${
        active
          ? "text-tentacle-accent-muted"
          : "text-white/40 hover:bg-white/5 hover:text-white/70"
      }`}
      style={{
        paddingLeft: 12,
        background: active ? "linear-gradient(90deg, rgba(139,92,246,0.15), transparent)" : undefined,
      }}
    >
      {/* Active indicator bar */}
      <div
        className="absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full transition-all duration-200"
        style={{
          height: active ? 20 : 0,
          opacity: active ? 1 : 0,
          background: "linear-gradient(180deg, #8B5CF6, #A78BFA)",
          boxShadow: active ? "0 0 15px rgba(139,92,246,0.3)" : "none",
        }}
      />
      <span className="flex-shrink-0">{item.icon}</span>
      <span
        className="overflow-hidden whitespace-nowrap transition-opacity duration-200"
        style={{ opacity: expanded ? 1 : 0, width: expanded ? "auto" : 0 }}
      >
        {item.label}
      </span>
    </button>
  );
}

/* ── Icons (20x20) ── */
function HomeIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>; }
function FilmIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>; }
function TvIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" /></svg>; }
function PairIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-6.364-6.364L4.5 8.25" /><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5" /></svg>; }

function WatchlistIcon() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>;
}

function HeartIcon() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>;
}

function PlusCircleIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12" cy="12" r="9"
        stroke={active ? "#A78BFA" : "currentColor"}
        strokeWidth={1.8}
        fill={active ? "rgba(139,92,246,0.15)" : "none"}
      />
      <path
        d="M12 8v8M8 12h8"
        stroke={active ? "#A78BFA" : "currentColor"}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}
