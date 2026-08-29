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
    <div>
      <h1 className="text-xl font-bold text-content-primary">{t("downloadsTitle")}</h1>
      <p className="mt-1 text-sm text-content-tertiary">{t("downloadsIntro")}</p>

      {isLoading && (
        <div className="mt-6 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-fill-faint" />
          ))}
        </div>
      )}
      {isError && (
        <p className="mt-6 rounded-lg border border-danger-border bg-danger-surface px-3 py-2 text-sm text-status-error-fg">
          {t("downloadsLoadError")}
        </p>
      )}

      <div className="mt-6 space-y-2">
        {users?.map((user) => (
          <div
            key={user.id}
            className="flex flex-wrap items-center gap-3 rounded-xl bg-fill-faint p-3 transition-colors hover:bg-fill-subtle"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-content-primary">
                {user.name}
                {user.isAdministrator && (
                  <span className="ml-2 rounded-full bg-fill-soft px-2 py-0.5 text-[10px] font-semibold text-content-tertiary">
                    {t("adminBadge")}
                  </span>
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
    </div>
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
