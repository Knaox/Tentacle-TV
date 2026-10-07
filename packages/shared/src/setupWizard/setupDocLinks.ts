import type { SetupStep } from "./setupFlowContract";

/**
 * Les pages de la documentation du site, une par étape de l'assistant
 * d'installation (« Besoin d'aide ? ») et par sujet. Des adresses STABLES :
 * le site (dépôt à part) les tient pour toujours — on n'en renomme aucune ;
 * une page déplacée y garde une redirection.
 *
 * `https://tentacletv.app/docs/server/<slug>/`, une page bilingue par sujet ;
 * la langue se force par `?lang=fr|en`. Une ancre (`libraries/#…`) désigne
 * une partie d'une page existante.
 */
export const SETUP_DOCS_BASE = "https://tentacletv.app/docs/server/";

export type SetupDocTopic =
  | SetupStep
  | "home"
  | "beforeYouStart"
  | "install"
  | "librariesExistingEmpty"
  | "librariesFolders"
  | "librariesDockerFolder"
  | "remotePrivatePublic"
  | "remoteProxy"
  | "remotePorts"
  | "remoteDirectPlay"
  | "segmentDetection"
  | "addContent"
  | "disableWebUi"
  | "troubleshooting"
  | "faq"
  | "gpu";

/** Le chemin sous la base, ancre comprise. Une valeur publiée ne change plus. */
export const SETUP_DOC_PATHS: Readonly<Record<SetupDocTopic, string>> = {
  home: "",
  beforeYouStart: "before-you-start/",
  install: "install/",
  welcome: "setup-code/",
  code: "setup-code/",
  database: "database/",
  jellyfin: "choose-jellyfin/",
  account: "account/",
  signIn: "account/#sign-in",
  libraries: "libraries/",
  librariesExistingEmpty: "libraries/#existing-jellyfin-without-libraries",
  librariesFolders: "libraries/#choose-folders",
  librariesDockerFolder: "libraries/#docker-media-folder",
  recommended: "recommended-settings/",
  segmentDetection: "segment-detection/",
  recap: "review-and-install/",
  apply: "review-and-install/",
  remote: "remote-access/",
  remotePrivatePublic: "remote-access/#private-or-public",
  remoteProxy: "remote-access/#reverse-proxy",
  remotePorts: "remote-access/#ports",
  remoteDirectPlay: "remote-access/#direct-play",
  done: "finish/",
  addContent: "add-content/",
  disableWebUi: "install/#disable-web-ui",
  troubleshooting: "troubleshooting/",
  faq: "faq/",
  gpu: "gpu/",
};

/** L'adresse d'une page, dans la langue de l'interface (`fr` ou `en`, sinon `en`). */
export function setupDocUrl(topic: SetupDocTopic, language: string): string {
  const lang = language.toLowerCase().startsWith("fr") ? "fr" : "en";
  const [path, anchor] = SETUP_DOC_PATHS[topic].split("#");
  return `${SETUP_DOCS_BASE}${path}?lang=${lang}${anchor ? `#${anchor}` : ""}`;
}
