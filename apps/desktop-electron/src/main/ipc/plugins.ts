/**
 * Dépôt du document d'un greffon, en vue de le servir sous son origine.
 *
 * C'est la page qui construit ce document : elle seule connaît la langue, le
 * chemin du greffon, et va chercher le runtime Tailwind et les dépendances
 * partagées auprès du serveur Tentacle. Le processus principal ne fait que le
 * garder et le rendre à l'origine `tentacle://plugin`, où il recevra la
 * politique de sécurité qui lui convient.
 */

import { z } from "zod";
import { APP_SCHEME } from "../appProtocol";
import { isValidPluginId, setPluginDocument } from "../pluginDocuments";
import { CommandRegistry } from "./registry";

/**
 * Le document embarque Tailwind et les dépendances partagées : quelques
 * centaines de kilo-octets sont normales, quelques mégaoctets ne le sont pas.
 * La borne protège le processus principal d'une page devenue folle.
 */
const MAX_HTML_BYTES = 8 * 1024 * 1024;

const SET_DOCUMENT = z.object({
  id: z.string().refine(isValidPluginId, "identifiant de greffon invalide"),
  html: z.string().max(MAX_HTML_BYTES),
});

export function registerPluginCommands(registry: CommandRegistry): void {
  registry.add("plugin_document_set", {
    schema: SET_DOCUMENT,
    run: ({ id, html }) => setPluginDocument(APP_SCHEME, id, html),
  });
}
