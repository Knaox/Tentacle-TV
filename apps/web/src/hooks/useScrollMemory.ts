import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const scrollPositions = new Map<string, number>();

export function useScrollMemory() {
  const { pathname } = useLocation();
  const prevPath = useRef(pathname);

  useEffect(() => {
    // Save scroll position of previous route
    if (prevPath.current !== pathname) {
      scrollPositions.set(prevPath.current, window.scrollY);
      prevPath.current = pathname;
    }

    // Restore scroll position for current route
    const saved = scrollPositions.get(pathname);
    if (saved != null) {
      window.scrollTo(0, saved);
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
}
