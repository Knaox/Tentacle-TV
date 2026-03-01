import { useState, useMemo, useRef, useCallback, type ComponentType } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLibraries, useAppConfig } from "@tentacle-tv/api-client";
import { usePluginNavItems } from "@tentacle-tv/plugins-api";
import { SidebarPreviewPanel } from "./SidebarPreviewPanel";

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
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("nav");
  const { data: libraries } = useLibraries();
  const { data: config } = useAppConfig();
  const features = config?.features;
  const pluginNavItems = usePluginNavItems("desktop");
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { key: "home", label: t("home"), icon: <HomeIcon />, path: "/" },
    ];
    if (libraries) {
      for (const lib of libraries) {
        const icon = lib.CollectionType === "movies" ? <FilmIcon /> : <TvIcon />;
        items.push({
          key: `lib-${lib.Id}`,
          label: lib.Name,
          icon,
          path: `/library/${lib.Id}`,
          isLibrary: true,
          libraryId: lib.Id,
        });
      }
    }
    // Plugin nav items — only shown when plugin is installed AND configured
    for (const item of pluginNavItems) {
      const IconComp = typeof item.icon !== "string" ? item.icon as ComponentType<{ className?: string }> : null;
      items.push({
        key: `plugin-${item.path}`,
        label: item.label,
        icon: IconComp ? <IconComp /> : <span>{item.icon as string}</span>,
        path: item.path,
      });
    }

    if (features?.downloads)
      items.push({ key: "downloads", label: t("downloads"), icon: <DownloadIcon />, path: "/downloads" });
    return items;
  }, [libraries, features, t, pluginNavItems]);

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
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Logo */}
        <div className="mb-6 flex items-center gap-2 px-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, #8B5CF6, #6D28D9)",
              boxShadow: "0 4px 15px rgba(139,92,246,0.3)",
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

        {/* Bottom: pair device only */}
        <div className="border-t border-white/5 px-2.5 pt-3">
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
        background: active ? "rgba(139,92,246,0.15)" : undefined,
      }}
    >
      {/* Active indicator bar */}
      {active && (
        <div
          className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full animate-breathe"
          style={{
            background: "linear-gradient(180deg, #8B5CF6, #A78BFA)",
          }}
        />
      )}
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

/* ── Icons (20×20) ── */
function HomeIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>; }
function FilmIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>; }
function TvIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" /></svg>; }
function DownloadIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>; }
function PairIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-6.364-6.364L4.5 8.25" /><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5" /></svg>; }
