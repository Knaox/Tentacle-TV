import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePairedDevices } from "@tentacle-tv/api-client";
import { AdminPage } from "../components/admin/kit";
import { UserSheet } from "../components/admin/users/UserSheet";
import { UsersGrid } from "../components/admin/users/UsersGrid";
import { UsersSummary } from "../components/admin/users/UsersSummary";
import { UsersToolbar } from "../components/admin/users/UsersToolbar";
import { AdminRequestError, useAdminUsers, useUserSheetParam } from "../components/admin/users/useAdminUsers";
import {
  countByFilter,
  groupByUser,
  normalizeUserId,
  sameUserId,
  visibleUsers,
  type UserFilter,
  type UserSort,
} from "../components/admin/users/userListModel";

/** L'identifiant du compte connecté — la pastille « Vous », et pas d'usurpation de soi. */
function currentUserId(): string | undefined {
  try {
    const raw = localStorage.getItem("tentacle_user");
    return raw ? (JSON.parse(raw)?.Id as string | undefined) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Admin > Utilisateurs — les comptes Jellyfin du serveur, photo en tête : un
 * résumé chiffré, la recherche, un filtre et un tri, puis une grille de
 * cartes qui occupe toute la largeur. Une carte ouvre la fiche du compte
 * (`?user=`) : activité, droits de téléchargement, appareils jumelés, et
 * « Voir en tant que ».
 *
 * Le garde admin est celui d'`AdminLayout`, et la coquille pose marges et
 * largeur : la page n'apporte que son contenu.
 */
export function AdminUsers() {
  const { t, i18n } = useTranslation("admin");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [sort, setSort] = useState<UserSort>("name");
  const sheet = useUserSheetParam();
  const usersQuery = useAdminUsers();
  const devicesQuery = usePairedDevices();
  const [selfId] = useState(currentUserId);

  const users = usersQuery.data;
  const devices = devicesQuery.data;
  // Les « il y a… » se comptent depuis la relève : ils avancent avec elle.
  const now = usersQuery.dataUpdatedAt || Date.now();
  const errorStatus = usersQuery.error instanceof AdminRequestError ? usersQuery.error.status : usersQuery.error ? 0 : null;

  const collator = useMemo(
    () => new Intl.Collator(i18n.language, { sensitivity: "base", numeric: true }),
    [i18n.language],
  );
  const counts = useMemo(() => (users ? countByFilter(users) : null), [users]);
  const visible = useMemo(
    () => visibleUsers(users ?? [], { query, filter, sort }, collator),
    [users, query, filter, sort, collator],
  );
  const devicesByUser = useMemo(() => (devices ? groupByUser(devices, (d) => d.jellyfinUserId) : null), [devices]);
  const openUser = useMemo(() => users?.find((u) => sameUserId(u.id, sheet.userId)) ?? null, [users, sheet.userId]);

  const showAll = useCallback(() => {
    setQuery("");
    setFilter("all");
  }, []);
  const { refetch } = usersQuery;
  const retry = useCallback(() => void refetch(), [refetch]);
  // Rien à résumer ni à filtrer quand la liste n'a pas pu être lue.
  const failed = !users && errorStatus !== null;

  return (
    <AdminPage
      title={t("usersTitle")}
      description={t("usersDescription")}
      summary={failed ? undefined : (
        <UsersSummary users={users} devices={devices} devicesFailed={devicesQuery.isError} now={now} />
      )}
    >
      {!failed && (
        <UsersToolbar
          query={query}
          onQuery={setQuery}
          filter={filter}
          onFilter={setFilter}
          counts={counts}
          sort={sort}
          onSort={setSort}
        />
      )}
      <p className="sr-only" aria-live="polite">{users ? t("usersShown", { count: visible.length }) : ""}</p>
      <UsersGrid
        users={users}
        visible={visible}
        errorStatus={errorStatus}
        selfId={selfId}
        deviceCounts={devicesByUser}
        now={now}
        onOpen={sheet.open}
        onRetry={retry}
        onShowAll={showAll}
      />
      <UserSheet
        user={openUser}
        isSelf={sameUserId(openUser?.id, selfId)}
        devices={openUser && devicesByUser ? (devicesByUser.get(normalizeUserId(openUser.id)) ?? []) : undefined}
        devicesFailed={devicesQuery.isError}
        now={now}
        onClose={sheet.close}
      />
    </AdminPage>
  );
}
