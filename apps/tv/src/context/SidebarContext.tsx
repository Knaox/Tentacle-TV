import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface SidebarState {
  isVisible: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarState>({
  isVisible: false,
  openSidebar: () => {},
  closeSidebar: () => {},
  toggleSidebar: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);

  const openSidebar = useCallback(() => setIsVisible(true), []);
  const closeSidebar = useCallback(() => setIsVisible(false), []);
  const toggleSidebar = useCallback(() => setIsVisible((v) => !v), []);

  return (
    <SidebarContext.Provider value={{ isVisible, openSidebar, closeSidebar, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
