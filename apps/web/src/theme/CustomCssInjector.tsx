import { useQuery } from "@tanstack/react-query";
import { fetchThemeCss } from "./themeApi";

interface CustomCssInjectorProps {
  backendUrl: string;
  /** Theme CSS content hash from `/api/theme` — invalidates the cache when changed. */
  hash: string;
}

/**
 * Renders a `<style>` element at the end of the React tree so its rules win
 * cascade order over everything injected by Vite into `<head>`. Pattern mirrors
 * Jellyfin's `<CustomCss />` component (see audit report).
 *
 * The component itself is mounted only when the backend reports `hasContent`.
 * When it unmounts, React removes the `<style>` tag from the DOM, which
 * naturally clears the custom CSS — no manual cleanup needed.
 */
export function CustomCssInjector({ backendUrl, hash }: CustomCssInjectorProps) {
  const { data } = useQuery({
    queryKey: ["theme-css", backendUrl, hash],
    // Pass the hash to bust the browser HTTP cache (`/api/theme/css?v=<hash>`).
    // Without it, switching presets within ~60s served the previous CSS.
    queryFn: () => fetchThemeCss(backendUrl, hash),
    staleTime: Infinity,
  });

  if (!data) return null;
  return <style data-tentacle-custom-css="">{data}</style>;
}
