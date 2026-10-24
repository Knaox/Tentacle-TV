import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { usePlugins } from "@tentacle-tv/plugins-api";
import { PageSpinner } from "../PageSpinner";
import { unknownRouteView } from "./unknownRouteView";

/** La route `*` : connexion, attente de la liste des extensions, ou la page introuvable (`unknownRouteView.ts`). */
export function UnknownRoute({ authed, notFound }: { authed: boolean; notFound: ReactElement }) {
  // Le client LG remplace plugins-api par un shim sans état de chargement : `loading` absent = liste connue.
  const plugins: unknown = usePlugins();
  const pluginsLoading = typeof plugins === "object" && plugins !== null && "loading" in plugins && plugins.loading === true;
  const view = unknownRouteView({ authed, pluginsLoading });
  if (view === "login") return <Navigate to="/login" replace />;
  return view === "wait" ? <PageSpinner /> : notFound;
}
