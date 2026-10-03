// `require("react-native")` (useTVRemote, useScrubGestures.ios…) passe par le
// require de Node, pas par les alias de vite : on le renvoie vers le MÊME
// simulacre que les `import`.
import Module from "node:module";
import * as rn from "./mocks/react-native";

const mod = Module as unknown as { _load: (request: string, parent: unknown, isMain: boolean) => unknown };
const load = mod._load;
mod._load = function patched(request: string, parent: unknown, isMain: boolean) {
  if (request === "react-native") return rn;
  return load.call(this, request, parent, isMain);
};
