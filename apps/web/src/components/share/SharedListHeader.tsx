import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

interface Props {
  ownerUsername: string;
  authed: boolean;
  /** Token courant — pour revenir ici après connexion. */
  token?: string;
  /** Liste partagée : watchlist (défaut) ou titres likés. */
  kind?: "watchlist" | "likes";
}

/** En-tête de la page publique de liste partagée. */
export function SharedListHeader({ ownerUsername, authed, token, kind = "watchlist" }: Props) {
  const { t } = useTranslation("common");
  const loginTo = token ? `/login?redirect=/share/${token}` : "/login";
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-content-quaternary">
        {t("common:readOnlyList")}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-content-primary md:text-3xl">
        {t(kind === "likes" ? "common:sharedFavoritesBy" : "common:sharedListBy", { name: ownerUsername })}
      </h1>
      {!authed && (
        <p className="mt-2 text-sm text-content-tertiary">
          {t("common:signInToAdd")}{" "}
          <Link to={loginTo} className="font-semibold text-[var(--brand-light)] underline-offset-4 hover:underline">
            {t("common:signIn", "Se connecter")}
          </Link>
        </p>
      )}
    </div>
  );
}
