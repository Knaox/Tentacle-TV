import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getUserInfo } from "./userMenu/menuItems";

type AdminKeyState = "ok" | "revoquee" | "sansDroits" | "absente" | "injoignable";

interface AdminKeyHealth {
  state: AdminKeyState;
  checkedAt: string;
}

/**
 * Bandeau d'alerte, pour les seuls administrateurs, quand la clé admin Jellyfin
 * ne répond plus.
 *
 * Il comble un angle mort : cette clé ne sert JAMAIS à la navigation — le proxy
 * voyage avec le jeton de l'utilisateur connecté. Elle ne porte que le travail
 * sans personne derrière : notifications d'ajouts, invitations, création de
 * comptes, écrans d'administration. Quand elle est révoquée côté Jellyfin,
 * l'application continue donc de s'afficher normalement pendant que tout ce
 * pan-là est mort, et le seul témoin est un `403` de journal toutes les trente
 * secondes. Une panne muette peut durer des semaines.
 *
 * « Injoignable » ne déclenche rien : un serveur hors ligne est déjà signalé
 * ailleurs, et confondre les deux ferait crier au loup à chaque coupure.
 *
 * Essai (développement seulement) — dans la console :
 * `tentacleTestAdminKeyBanner()` force l'affichage, `(false)` le retire, et
 * `("sansDroits")` montre l'autre libellé. Même dispositif que `VersionBanner`,
 * pour vérifier le rendu sans avoir à révoquer une clé pour de vrai.
 */
export function AdminKeyBanner() {
  const { t } = useTranslation("admin");
  const { isAdmin } = getUserInfo();
  const [masque, setMasque] = useState(false);
  const [force, setForce] = useState<AdminKeyState | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.tentacleTestAdminKeyBanner = (state: AdminKeyState | false = "revoquee") =>
      setForce(state === false ? null : state);
    return () => { delete w.tentacleTestAdminKeyBanner; };
  }, []);

  const { data } = useQuery<AdminKeyHealth>({
    queryKey: ["admin", "jellyfin-key"],
    queryFn: async () => {
      // Import PARESSEUX, et ce n'est pas une coquetterie : `adminUtils` lit
      // `backendUrl` de `main.tsx`, qui monte `App` — donc ce composant. Une
      // importation statique refermerait la boucle et ferait lire la constante
      // avant son initialisation : l'application entière tombait sur un écran
      // noir. Les pages d'administration y échappent parce qu'elles arrivent
      // en chargement différé, bien après l'amorçage.
      const { BACKEND, hdrs, creds } = await import("../pages/adminUtils");
      const res = await fetch(`${BACKEND}/api/admin/jellyfin-key`, {
        headers: hdrs(),
        credentials: creds(),
      });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    enabled: isAdmin,
    // Le backend garde déjà son verdict cinq minutes ; inutile de le redemander
    // à chaque changement de page ou retour sur l'onglet.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const state = force ?? data?.state;
  const enPanne = state === "revoquee" || state === "sansDroits" || state === "absente";
  if (!isAdmin || masque || !enPanne) return null;

  const cause =
    state === "revoquee" ? t("adminKeyRevoked")
    : state === "sansDroits" ? t("adminKeyNoRights")
    : t("adminKeyMissing");

  return (
    <div
      role="alert"
      className="relative z-30 flex items-start gap-3 border-y border-[var(--status-error)]/40 bg-[var(--status-error-bg)] px-4 py-3 text-sm md:px-8"
    >
      <svg
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--status-error-fg)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.4 14.55A1.5 1.5 0 003.19 21h17.62a1.5 1.5 0 001.3-2.59l-8.4-14.55a1.5 1.5 0 00-2.62 0z" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[var(--status-error-fg)]">{t("adminKeyTitle")}</p>
        <p className="mt-0.5 text-[var(--status-error-fg)]/80">{cause}</p>
        {/* Ce qui est hors service, nommément : sans cette liste, l'alerte
            paraît anodine puisque tout continue de s'afficher à l'écran. */}
        <p className="mt-0.5 text-[var(--status-error-fg)]/80">{t("adminKeyImpact")}</p>
        <Link
          to="/admin/services"
          className="mt-1.5 inline-block font-semibold text-[var(--status-error-fg)] underline underline-offset-4 hover:opacity-80"
        >
          {t("adminKeyAction")}
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setMasque(true)}
        aria-label={t("adminKeyDismiss")}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[var(--status-error-fg)]/70 transition-colors hover:bg-[var(--status-error)]/20 hover:text-[var(--status-error-fg)]"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
