/**
 * Le bac à sable des pages d'extension (web, bureau) : `sandbox="allow-scripts"`,
 * RIEN de plus — origine opaque, ni formulaires, ni fenêtres, ni navigation du
 * haut de page. Décision du 24/10 (lot Sillon vitesse) : on n'ajoute pas
 * `allow-forms`.
 *
 * Conséquence pour une extension : **aucun `<form>`**. Sans `allow-forms`,
 * Chromium ne déclenche JAMAIS l'évènement `submit` — ni au clic d'un bouton
 * d'envoi, ni à Entrée, `preventDefault` ou pas : le geste est mort, sans un
 * mot (vécu : « Enregistrer » de l'administration de Sillon). Envoyer au clic
 * d'un bouton `type="button"`, et à Entrée par un `keydown` sur le groupe de
 * champs — le modèle est `ActionForm` de Sillon (`src/ui/ActionForm.tsx`). Le
 * pont de l'iframe avertit dans la console quand un envoi natif est tenté
 * (`apps/web/src/components/pluginIframe/formSubmitGuard.ts`).
 */
export const PLUGIN_IFRAME_SANDBOX = "allow-scripts";
