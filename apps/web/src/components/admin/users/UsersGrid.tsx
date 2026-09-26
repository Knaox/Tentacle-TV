import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { SearchX, Users } from "lucide-react";
import { EmptyState } from "../../ui/EmptyState";
import { AdminNotice } from "../kit";
import { cls } from "../../../pages/adminUtils";
import { UserCard } from "./UserCard";
import { normalizeUserId, sameUserId, type AdminUser } from "./userListModel";

/**
 * Autant de colonnes que la largeur en offre : une sur un téléphone, cinq sur
 * un grand écran — la page d'administration occupe toute la largeur.
 */
const GRID = "grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3";

interface UsersGridProps {
  /** Tous les comptes reçus — `undefined` tant que rien n'est arrivé. */
  users: AdminUser[] | undefined;
  /** Ceux qui passent la recherche et le filtre, dans l'ordre choisi. */
  visible: AdminUser[];
  /** Statut HTTP de l'échec du premier chargement, `null` sans échec. */
  errorStatus: number | null;
  selfId: string | undefined;
  /** Appareils jumelés par compte (clé normalisée) — `null` si illisibles. */
  deviceCounts: Map<string, unknown[]> | null;
  now: number;
  onOpen: (id: string) => void;
  onRetry: () => void;
  onShowAll: () => void;
}

export function UsersGrid({
  users, visible, errorStatus, selfId, deviceCounts, now, onOpen, onRetry, onShowAll,
}: UsersGridProps) {
  const { t } = useTranslation("admin");

  if (!users && errorStatus !== null) return <UsersError status={errorStatus} onRetry={onRetry} />;

  if (!users) {
    return (
      <ul aria-hidden className={GRID}>
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 rounded-xl border border-line-subtle bg-fill-faint p-3">
            <span className="skeleton-shimmer h-12 w-12 shrink-0 rounded-full" />
            <span className="flex-1 space-y-2">
              <span className="skeleton-shimmer block h-3.5 w-2/5 rounded" />
              <span className="skeleton-shimmer block h-3 w-3/5 rounded" />
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (users.length === 0) return <EmptyState icon={<Users size={26} />} title={t("noUsers")} />;

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={<SearchX size={26} />}
        title={t("usersNoMatch")}
        description={t("usersNoMatchHint")}
        action={<button type="button" onClick={onShowAll} className={cls.bs}>{t("usersShowAll")}</button>}
      />
    );
  }

  return (
    <ul className={GRID}>
      {visible.map((user) => (
        <UserCard
          key={user.id}
          user={user}
          isSelf={sameUserId(user.id, selfId)}
          deviceCount={deviceCounts ? (deviceCounts.get(normalizeUserId(user.id))?.length ?? 0) : null}
          now={now}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}

/**
 * Trois échecs qui ne se règlent pas de la même façon : Jellyfin jamais
 * configuré (rien à retenter — Services), Jellyfin muet ou qui refuse la clé
 * (retenter, ou vérifier dans Services), et le reste. L'encadré arrive APRÈS
 * l'ouverture, au retour de la requête : `alert`, pour qu'il soit annoncé.
 */
function UsersError({ status, onRetry }: { status: number; onRetry: () => void }) {
  const { t } = useTranslation("admin");
  const retry = <button type="button" onClick={onRetry} className={cls.bs}>{t("retry")}</button>;
  const services = (primary: boolean) => (
    <Link to="/admin/services" className={primary ? cls.bp : cls.bs}>{t("usersOpenServices")}</Link>
  );

  if (status === 503) {
    return (
      <AdminNotice role="alert" tone="warning" title={t("usersJellyfinMissing")} action={services(true)}>
        {t("usersJellyfinMissingHint")}
      </AdminNotice>
    );
  }
  if (status === 502) {
    return (
      <AdminNotice
        role="alert"
        tone="error"
        title={t("usersUnreachable")}
        action={<div className="flex flex-wrap gap-2">{retry}{services(false)}</div>}
      >
        {t("usersUnreachableHint")}
      </AdminNotice>
    );
  }
  return <AdminNotice role="alert" tone="error" title={t("usersError")} action={retry} />;
}
