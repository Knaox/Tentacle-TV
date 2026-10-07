import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeftRight, Folder, HardDrive } from "lucide-react";
import type { PathStyle, SetupContext } from "@tentacle-tv/shared";

/**
 * Où sont les fichiers, dit selon la machine de JELLYFIN :
 *
 *  - le Jellyfin de la pile complète (un conteneur) : son `/media` est, sur le
 *    serveur, le dossier monté (`TENTACLE_MEDIA_HOST_PATH`, sinon la variable
 *    `MEDIA_PATH` du compose) — deux cases côte à côte, le lien entre elles ;
 *  - ailleurs : des exemples de chemins Linux ou Windows, selon ce que
 *    Jellyfin a rendu de ses lecteurs.
 */
export function MediaFolderMap({ context, inStack, style }: { context: SetupContext | null; inStack: boolean; style: PathStyle }) {
  const { t } = useTranslation("setupWizard");
  const folders = context?.mediaFolders;
  if (inStack && folders) {
    const host = context?.mediaHostPath?.replace(/\/+$/, "") ?? null;
    return (
      <section aria-labelledby="media-map" className="space-y-3 rounded-xl border border-line-subtle bg-fill-faint p-4">
        <h2 id="media-map" className="text-sm font-semibold text-content-primary">{t("mediaMapTitle")}</h2>
        <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]" aria-hidden="true">
          <MapBox icon={<Folder size={16} />} label={t("mediaMapInside")} path={folders.root} />
          <ArrowLeftRight size={16} className="mx-auto rotate-90 self-center text-content-tertiary sm:rotate-0" />
          <MapBox icon={<HardDrive size={16} />} label={t("mediaMapHost")} path={host ?? t("mediaMapHostUnknown")} />
        </div>
        <p className="text-sm leading-relaxed text-content-secondary">
          {host ? t("mediaMapDocker", { inside: folders.root, host }) : t("mediaMapDockerUnknown", { inside: folders.root })}
        </p>
      </section>
    );
  }
  return (
    <div className="space-y-1 text-sm leading-relaxed text-content-secondary">
      <p>{t(`pathHint_${style}`)}</p>
      {style === "posix" ? <p className="text-xs text-content-tertiary">{t("pathHintContainer")}</p> : null}
    </div>
  );
}

function MapBox({ icon, label, path }: { icon: ReactNode; label: string; path: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line-subtle bg-fill-subtle px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-content-tertiary">
        {icon}
        {label}
      </p>
      <p className="mt-1 break-all font-mono text-sm text-content-primary">{path}</p>
    </div>
  );
}
