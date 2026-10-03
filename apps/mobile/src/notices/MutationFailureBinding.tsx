import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { failureMetaOf, problemFromError } from "@tentacle-tv/shared";
import { showToast } from "./toastStore";

/**
 * Les gestes qui échouent se DISENT : une mutation étiquetée (`meta.failureTitle`
 * — favori, Ma liste, vu, note) qui échoue devient un message bref, son titre
 * et sa cause. Le geste optimiste est déjà défait par la mutation ; avant, il
 * l'était en silence. Monté une fois, sous le fournisseur de requêtes.
 */
export function MutationFailureBinding() {
  const queryClient = useQueryClient();
  const { t } = useTranslation("errors");
  useEffect(() => queryClient.getMutationCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "error") return;
    const meta = failureMetaOf(event.mutation.options.meta);
    if (!meta) return;
    const model = problemFromError(event.action.error, { target: meta.failureTarget ?? "relayed", context: "action" });
    showToast({ title: t(meta.failureTitle), text: t(model.reasonKey, model.values) });
  }), [queryClient, t]);
  return null;
}
