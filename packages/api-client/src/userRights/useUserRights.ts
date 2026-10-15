import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { FAMILY_KEY } from "../hooks/useFamily";
import {
  fetchFamilyParentalOptions,
  fetchUserRights,
  fetchUserRightsOptions,
  patchUserRights,
  setFamilyGuestParental,
} from "./userRightsApi";
import type { UserRightsDto } from "./userRightsTypes";

/**
 * Les droits des comptes en crochets react-query (web et bureau : rien sur le
 * mobile ni la TV). Clés :
 * - `["admin-user-rights", "options"]` : bibliothèques, canaux, échelle des notes ;
 * - `["admin-user-rights", "user", id]` : la politique RELUE d'un compte.
 *
 * Jellyfin reste la source : lecture courte (15 s), relue au retour sur
 * l'onglet — un changement fait dans son tableau de bord se voit ici.
 */

export const USER_RIGHTS_KEY = ["admin-user-rights"] as const;
export const USER_RIGHTS_OPTIONS_KEY = ["admin-user-rights", "options"] as const;
export const userRightsKey = (userId: string) => ["admin-user-rights", "user", normalizeId(userId)] as const;

/** La page Téléchargements et la fiche d'un compte partagent cette liste (droits hors ligne). */
export const ADMIN_DOWNLOAD_RIGHTS_KEY = ["admin-download-rights"] as const;
export const FAMILY_PARENTAL_OPTIONS_KEY = ["family", "parental-options"] as const;

const STALE_MS = 15_000;

/** Jellyfin rend ses identifiants avec ou sans tirets : une seule forme dans les clés. */
function normalizeId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

export function useUserRightsOptions(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: USER_RIGHTS_OPTIONS_KEY,
    queryFn: fetchUserRightsOptions,
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useUserRights(userId: string | null, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: userRightsKey(userId ?? ""),
    queryFn: () => fetchUserRights(userId as string),
    enabled: (options.enabled ?? true) && !!userId,
    staleTime: STALE_MS,
    // Un refus (compte inconnu, invité) ne change pas en réessayant.
    retry: 1,
  });
}

/** Les champs de la liste des droits hors ligne, recopiés de l'état relu. */
interface DownloadRightsRow {
  id: string;
  isAdministrator?: boolean;
  enableContentDownloading?: boolean;
  enableMediaConversion?: boolean;
  enableAllFolders?: boolean;
  enabledFoldersCount?: number;
}

function syncDownloadRights(qc: QueryClient, dto: UserRightsDto) {
  const id = normalizeId(dto.userId);
  qc.setQueryData<DownloadRightsRow[]>([...ADMIN_DOWNLOAD_RIGHTS_KEY], (rows) =>
    rows?.map((row) =>
      normalizeId(row.id) === id
        ? {
            ...row,
            isAdministrator: dto.rights.isAdministrator,
            enableContentDownloading: dto.rights.enableContentDownloading,
            enableMediaConversion: dto.rights.enableMediaConversion,
            enableAllFolders: dto.rights.enableAllFolders,
            enabledFoldersCount: dto.rights.enabledFolders.length,
          }
        : row,
    ),
  );
}

/**
 * Écrit un correctif et range l'état RELU par le serveur. Deux interrupteurs
 * basculés coup sur coup : la réponse la plus récente (`readAt`) l'emporte,
 * une réponse arrivée en retard ne ramène pas un état ancien. Un échec relit
 * le compte : l'écran revient à la vérité de Jellyfin. Les annonces restent à
 * l'appelant (`mutateAsync`).
 */
export function useUpdateUserRights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: patchUserRights,
    onSuccess: (dto) => {
      qc.setQueryData<UserRightsDto>(userRightsKey(dto.userId), (current) =>
        current && Date.parse(current.readAt) > Date.parse(dto.readAt) ? current : dto,
      );
      syncDownloadRights(qc, dto);
      // Administrateur, désactivé, caché : les badges de la liste des comptes.
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (_error, { userId }) => {
      void qc.invalidateQueries({ queryKey: userRightsKey(userId) });
    },
  });
}

/** L'échelle des notes et les types, pour le contrôle parental d'un invité (session personnelle). */
export function useFamilyParentalOptions(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: FAMILY_PARENTAL_OPTIONS_KEY,
    queryFn: fetchFamilyParentalOptions,
    enabled: options.enabled ?? true,
    staleTime: 5 * 60_000,
  });
}

/** Pose le contrôle parental d'un invité ; la Famille se relit (son état voyage avec l'invité). */
export function useSetFamilyGuestParental() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setFamilyGuestParental,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [...FAMILY_KEY] });
    },
  });
}
