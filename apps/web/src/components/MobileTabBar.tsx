import { useMemo, type ComponentType } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePluginNavItems } from "@tentacle-tv/plugins-api";

interface Tab {
  path: string;
  label: string;
  icon: React.ReactNode;
  match?: (p: string) => boolean;
}

export function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation("nav");
  const pluginNavItems = usePluginNavItems("web");

  const tabs: Tab[] = useMemo(() => {
    const list: Tab[] = [
      {
        path: "/", label: t("home"),
        icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>,
        match: (p) => p === "/",
      },
    ];

    // Plugin nav items — only appear when plugin is installed AND configured
    for (const item of pluginNavItems) {
      const IconComp = typeof item.icon !== "string" ? item.icon as ComponentType<{ className?: string }> : null;
      list.push({
        path: item.path,
        label: item.label,
        icon: IconComp ? <IconComp className="h-5 w-5" /> : <span className="h-5 w-5">{item.icon as string}</span>,
        match: (p) => p.startsWith(item.path),
      });
    }

    list.push(
      {
        path: "/pair-device", label: t("pairDevice"),
        icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" /></svg>,
      },
      {
        path: "/settings", label: t("profile"),
        icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
      },
    );
    return list;
  }, [t, pluginNavItems]);

  const isActive = (tab: Tab) => {
    if (tab.match) return tab.match(location.pathname);
    return location.pathname === tab.path || location.pathname.startsWith(tab.path + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-white/10 bg-black/95 backdrop-blur-xl safe-area-pb">
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <button key={tab.path} onClick={() => navigate(tab.path)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              active ? "text-purple-400" : "text-white/40"
            }`}>
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
