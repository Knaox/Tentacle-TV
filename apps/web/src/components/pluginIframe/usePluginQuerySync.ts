/**
 * Le côté React de `pluginQuerySync.ts` pour `PluginIframe` : la query avec laquelle le document
 * est fabriqué (qui ne bouge plus quand l'extension tient sa query), et le geste `SET_QUERY`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  HOST_QUERY_MESSAGE, initialDocumentQuery, rememberPluginQuery, rememberedPluginQuery,
} from "./pluginQuerySync";

export function usePluginQuerySync(pluginPath: string, post: (message: { type: string; query: string }) => void) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  // Lu UNE fois : la query retenue la dernière fois, et si l'extension tient sa query.
  const [remembered] = useState(() => rememberedPluginQuery(pluginPath));
  const owns = useRef(remembered !== null);
  const [documentQuery, setDocumentQuery] = useState(() => initialDocumentQuery(search, remembered));
  const seen = useRef(search);
  const restored = useRef(false);

  // Rouverte sans query : l'adresse dit aussitôt celle retenue (sans entrée d'historique), une fois.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (!search && remembered) navigate({ search: remembered }, { replace: true });
  }, [search, remembered, navigate]);

  // La query de l'adresse change : redite à l'extension qui la tient, sinon document refait (avant).
  useEffect(() => {
    if (search === seen.current) return;
    seen.current = search;
    if (!owns.current) {
      setDocumentQuery(search);
      return;
    }
    rememberPluginQuery(pluginPath, search);
    post({ type: HOST_QUERY_MESSAGE, query: search });
  }, [search, pluginPath, post]);

  const setQuery = useCallback((query: string) => {
    owns.current = true;
    rememberPluginQuery(pluginPath, query);
    if (pathname !== pluginPath || query === search) return;
    seen.current = query;
    navigate({ search: query });
  }, [pluginPath, pathname, search, navigate]);

  return { documentQuery, setQuery };
}
