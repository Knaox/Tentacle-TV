import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { failureMetaOf, problemFromError } from "@tentacle-tv/shared";
import { useToast } from "../../contexts/ToastContext";

/**
 * Les gestes qui échouent se DISENT : une mutation étiquetée
 * (`meta.failureTitle` — favori, Ma liste, vu, note) qui échoue devient un
 * message bref, son titre et sa cause, dans les mots du modèle commun. Le
 * geste optimiste est déjà défait par la mutation ; avant, il l'était en
 * silence. Même liaison que le mobile ; monté une fois, sous les toasts.
 */
export function MutationFailureBinding() {
  const queryClient = useQueryClient();
  const { t } = useTranslation("errors");
  const { show } = useToast();
  useEffect(() => queryClient.getMutationCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "error") return;
    const meta = failureMetaOf(event.mutation.options.meta);
    if (!meta) return;
    const model = problemFromError(event.action.error, { target: meta.failureTarget ?? "relayed", context: "action" });
    show("error", t(model.reasonKey, model.values), { title: t(meta.failureTitle) });
  }), [queryClient, show, t]);
  return null;
}
