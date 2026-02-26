import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppConfig } from "@tentacle/api-client";

interface Tab {
  path: string;
  label: string;
  icon: React.ReactNode;
  match?: (p: string) => boolean;
}

export function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: config } = useAppConfig();
  const features = config?.features;

  const tabs: Tab[] = useMemo(() => {
    const list: Tab[] = [
      {
        path: "/", label: "Accueil",
        icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>,
        match: (p) => p === "/",
      },
      {
        path: "/requests", label: "Demandes",
        icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>,
        match: (p) => p.startsWith("/requests"),
      },
    ];
    if (features?.discover) {
      list.push({
        path: "/discover", label: "Demandes",
        icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
        match: (p) => p.startsWith("/discover") || p.startsWith("/requests"),
      });
    }
    list.push(
      {
        path: "/support", label: "Aide",
        icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>,
      },
      {
        path: "/settings", label: "Profil",
        icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
      },
    );
    return list;
  }, [features]);

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
