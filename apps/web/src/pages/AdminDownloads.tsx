/**
 * Admin > Téléchargements : droits par utilisateur, ÉCRITS DANS JELLYFIN
 * (source de vérité unique — le backend fait GET-merge-POST de la policy
 * complète puis relit). Deux interrupteurs : droit de téléchargement
 * (EnableContentDownloading) et mode Allégé (EnableMediaConversion, appliqué
 * par Tentacle). Le périmètre par bibliothèque reste géré dans Jellyfin
 * (affiché à titre indicatif). Animations CSS pures, tokens de thème.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BACKEND, hdrs, creds } from "./adminUtils";
import { useToast } from "../contexts/ToastContext";
import { ToggleSwitch } from "../components/settings/ToggleSwitch";
import { AdminNotice, AdminPage, AdminSection, StatusPill } from "../components/admin/kit";
import { AdminDownloadBandwidth } from "./AdminDownloadBandwidth";

interface AdminUserRights {
  id: string;
  name: string;
  isAdministrator: boolean;
  enableContentDownloading: boolean;
  enableMediaConversion: boolean;
  enableAllFolders: boolean;
  enabledFoldersCount: number;
}

interface RightsPatch {
  enableContentDownloading?: boolean;
  enableMediaConversion?: boolean;
}

async function fetchRights(): Promise<AdminUserRights[]> {
  const res = await fetch(`${BACKEND}/api/admin/downloads/users`, {
    headers: hdrs(),
    credentials: creds(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function putRights(userId: string, patch: RightsPatch): Promise<AdminUserRights> {
  const res = await fetch(`${BACKEND}/api/admin/downloads/users/${userId}`, {
    method: "PUT",
    headers: { ...hdrs(), "Content-Type": "application/json" },
    credentials: creds(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function AdminDownloads() {
  const { t } = useTranslation("admin");
  const { show } = useToast();
  const queryClient = useQueryClient();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const { data: users, isLoading, isError } = useQuery({
    queryKey: ["admin-download-rights"],
    queryFn: fetchRights,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: ({ userId, patch }: { userId: string; patch: RightsPatch }) =>
      putRights(userId, patch),
    onSuccess: (applied) => {
      queryClient.setQueryData<AdminUserRights[]>(["admin-download-rights"], (previous) =>
        previous?.map((user) => (user.id === applied.id ? applied : user)),
      );
      show("success", t("downloadsSaved"));
    },
    onError: () => {
      show("error", t("downloadsSaveError"));
      queryClient.invalidateQueries({ queryKey: ["admin-download-rights"] });
    },
    onSettled: () => setPendingKey(null),
  });

  const toggle = (user: AdminUserRights, field: keyof RightsPatch, value: boolean) => {
    setPendingKey(`${user.id}:${field}`);
    mutation.mutate({ userId: user.id, patch: { [field]: value } });
  };

  return (
    <AdminPage title={t("downloadsTitle")} description={t("downloadsDescription")}>
      {/* Le réglage du serveur d'abord, puis les droits par compte : deux
          cartes, chacune avec son explication. */}
      <AdminDownloadBandwidth />
      <AdminSection title={t("downloadsRightsTitle")} description={t("downloadsIntro")}>
        {/* Squelettes au balayage borné (`skeleton-shimmer`) : `animate-pulse`
            battait sans fin tant que Jellyfin ne répondait pas. */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer h-14 rounded-xl" />
            ))}
          </div>
        )}
        {isError && <AdminNotice tone="error">{t("downloadsLoadError")}</AdminNotice>}

        {users && users.length > 0 && (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-fill-subtle p-3 transition-colors hover:bg-fill-soft"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-content-primary">
                    <span className="truncate">{user.name}</span>
                    {user.isAdministrator && (
                      <StatusPill tone="neutral" size="sm" dot={false}>
                        {t("adminBadge")}
                      </StatusPill>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-content-quaternary">
                    {user.enableAllFolders
                      ? t("downloadsAllLibraries")
                      : t("downloadsSomeLibraries", { count: user.enabledFoldersCount })}
                  </p>
                </div>
                <RightSwitch
                  label={t("rightDownload")}
                  checked={user.enableContentDownloading}
                  busy={pendingKey === `${user.id}:enableContentDownloading`}
                  onChange={(value) => toggle(user, "enableContentDownloading", value)}
                />
                <RightSwitch
                  label={t("rightLight")}
                  checked={user.enableMediaConversion}
                  busy={pendingKey === `${user.id}:enableMediaConversion`}
                  onChange={(value) => toggle(user, "enableMediaConversion", value)}
                />
              </div>
            ))}
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
}

function RightSwitch({
  label,
  checked,
  busy,
  onChange,
}: {
  label: string;
  checked: boolean;
  busy: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex flex-shrink-0 cursor-pointer items-center gap-2">
      <span className="text-xs font-medium text-content-tertiary">{label}</span>
      {/* Même interrupteur que les réglages : la copie qui vivait ici animait
          `left`, ce qui repeint, et peignait un violet plat que plus rien
          d'autre ne porte. */}
      <ToggleSwitch checked={checked} onChange={onChange} label={label} disabled={busy} />
    </label>
  );
}
