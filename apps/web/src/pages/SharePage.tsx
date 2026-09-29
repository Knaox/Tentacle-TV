import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSharedView } from "@tentacle-tv/api-client";
import { statsLocale } from "@tentacle-tv/shared";
import { ShareShell } from "../components/share/ShareShell";
import { ShareError, SharePageSkeleton } from "../components/share/ShareStates";
import { SharedListBody } from "../components/share/SharedListBody";
import { SharedStatsView } from "../components/share/stats/SharedStatsView";
import { useShareVisitor } from "../components/share/useShareVisitor";

/**
 * Page PUBLIQUE d'un partage (/share/:token) — la même adresse et la même
 * coquille pour tout ce qui se partage : une liste (Ma liste, titres likés) ou
 * des statistiques. Le serveur dit ce que le lien partage ; la page choisit
 * sa mise en page. La langue du visiteur part avec la demande : les
 * statistiques nomment genres et pays côté serveur.
 *
 * Un lien révoqué, mal copié ou un serveur muet donnent la même erreur, avec
 * une reprise et une sortie qui ne suppose pas de session.
 */
export function SharePage() {
  const { token = "" } = useParams<{ token: string }>();
  const { t, i18n } = useTranslation("share");
  const { data, isLoading, isError, isFetching, refetch } = useSharedView(token, statsLocale(i18n.language));
  const visitor = useShareVisitor(`/share/${token}`);

  let body;
  if (isLoading) {
    body = <SharePageSkeleton />;
  } else if (isError || !data) {
    body = (
      <ShareError
        onRetry={() => void refetch()}
        retrying={isFetching}
        exitTo={visitor.authed ? "/" : visitor.loginPath}
        exitLabel={visitor.authed ? t("goHome") : t("joinSignIn")}
      />
    );
  } else if (data.kind === "stats") {
    body = <SharedStatsView token={token} view={data} visitor={visitor} />;
  } else {
    body = <SharedListBody token={token} data={data} visitor={visitor} />;
  }
  return <ShareShell authed={visitor.authed}>{body}</ShareShell>;
}
