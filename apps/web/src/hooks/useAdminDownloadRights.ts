import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_DOWNLOAD_RIGHTS_KEY, userRightsKey } from "@tentacle-tv/api-client";
import { BACKEND, creds, hdrs } from "../pages/adminUtils";

/**
 * Les droits de téléchargement des comptes, tels que Jellyfin les tient — le
 * backend les lit et les écrit dans la policy Jellyfin, sans copie locale.
 *
 * Deux écrans les affichent : Admin > Téléchargements (tous les comptes) et la
 * fiche d'un compte dans Admin > Utilisateurs. Ils partagent CETTE clé : un
 * interrupteur basculé dans l'un se voit dans l'autre sans relecture. Face à
 * un serveur qui déclare `admin.userRights`, la fiche écrit par la route des
 * droits (`useUpdateUserRights`), qui range aussi sa réponse sous cette clé ;
 * dans l'autre sens, une écriture d'ici relit les droits complets du compte. La page
 * Téléchargements lit encore par ses propres fonctions, sous la même clé et
 * pour la même réponse — elle pourra passer par ce hook.
 */

export interface AdminUserRights {
  id: string;
  name: string;
  isAdministrator: boolean;
  enableContentDownloading: boolean;
  enableMediaConversion: boolean;
  enableAllFolders: boolean;
  enabledFoldersCount: number;
}

export interface RightsPatch {
  enableContentDownloading?: boolean;
  enableMediaConversion?: boolean;
}

const DOWNLOAD_RIGHTS_KEY = ADMIN_DOWNLOAD_RIGHTS_KEY;

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

export function useAdminDownloadRights() {
  return useQuery({
    queryKey: DOWNLOAD_RIGHTS_KEY,
    queryFn: fetchRights,
    staleTime: 30_000,
  });
}

/**
 * Écrit un patch et range la réponse — les droits RELUS par le backend après
 * écriture, donc ce que Jellyfin a réellement retenu. En cas d'échec, la liste
 * est relue : l'interrupteur revient à la vérité du serveur.
 *
 * Les annonces (toast) restent à l'appelant, par `mutateAsync` : les rappels
 * de `mutate` ne répondent que pour le DERNIER appel, et deux interrupteurs
 * basculés coup sur coup laisseraient le premier sans réponse.
 */
export function useUpdateAdminDownloadRights() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, patch }: { userId: string; patch: RightsPatch }) => putRights(userId, patch),
    onSuccess: (applied) => {
      queryClient.setQueryData<AdminUserRights[]>(DOWNLOAD_RIGHTS_KEY, (previous) =>
        previous?.map((user) => (user.id === applied.id ? applied : user)),
      );
      void queryClient.invalidateQueries({ queryKey: userRightsKey(applied.id) });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: DOWNLOAD_RIGHTS_KEY });
    },
  });
}
