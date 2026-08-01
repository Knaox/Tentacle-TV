/**
 * Où monter le document d'un greffon.
 *
 * Un greffon est fait entièrement de scripts inline. Monté en `srcdoc`, il
 * hérite de la politique de sécurité de la page qui l'accueille — ce qui
 * convient partout SAUF sous Electron, dont la politique n'autorise que les
 * empreintes des scripts de l'application. Là, le document est déposé auprès du
 * processus principal et servi sous une origine à lui, qui reçoit sa propre
 * politique.
 *
 * L'appelant ne choisit pas : il donne le document, il reçoit l'attribut à
 * poser sur l'iframe.
 */

import { useEffect, useState } from "react";
import { invoke, isElectronShell } from "./bridge";

/** Attributs de montage : l'un des deux est défini, jamais les deux. */
export interface PluginMount {
  /** Electron : URL servie sous l'origine des greffons. */
  src?: string;
  /** Partout ailleurs : le document, monté en ligne. */
  srcDoc?: string;
}

/**
 * Rien tant que le document n'est pas prêt (`html` nul), ou tant que le dépôt
 * n'a pas répondu sous Electron — l'appelant affiche son chargeur pendant ce
 * temps.
 */
export function usePluginMount(pluginId: string, html: string | null): PluginMount | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!isElectronShell() || html === null) return;
    let cancelled = false;
    setSrc(null);
    void invoke<string | null>("plugin_document_set", { id: pluginId, html })
      .then((url) => {
        if (!cancelled && typeof url === "string") setSrc(url);
      })
      .catch(() => {
        /* dépôt refusé : l'iframe reste vide, le chargeur reste affiché */
      });
    return () => {
      cancelled = true;
    };
  }, [pluginId, html]);

  if (html === null) return null;
  if (!isElectronShell()) return { srcDoc: html };
  return src === null ? null : { src };
}
