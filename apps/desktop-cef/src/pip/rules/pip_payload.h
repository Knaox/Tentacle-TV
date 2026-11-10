#pragma once
// Les charges des commandes `pip_*`, validées comme les schémas zod d'Electron
// (`ipc/pip.ts`) : une commande dont la charge est refusée n'est jamais exécutée, et la page
// reçoit « arguments invalides pour <commande>: … » (`ipc/registry.ts`).

#include <optional>
#include <string>
#include <variant>

#include <nlohmann/json.hpp>

#include "pip/rules/pip_types.h"

namespace tentacle::pip {

using Json = nlohmann::json;

struct OpenArgs {  // pip_open { mode, width, height } — taille de la VIDÉO
  Mode mode = Mode::floating;
  int width = 0, height = 0;
};
struct ModeArgs {  // pip_mode { mode, width?, height? }
  Mode mode = Mode::floating;
  std::optional<int> width, height;
};
struct ResizeArgs {  // pip_resize { width, height }
  int width = 0, height = 0;
};
struct GestureArgs {  // pip_gesture { gesture: … | null, grab?: {x, y} }
  std::optional<Gesture> gesture;
  std::optional<Point> grab;
};

/// Le résultat d'une lecture : la charge typée, ou le message d'erreur à rendre à la page.
template <typename T>
using Parsed = std::variant<T, std::string>;

Parsed<OpenArgs> parseOpen(const Json& raw);
Parsed<ModeArgs> parseMode(const Json& raw);
Parsed<ResizeArgs> parseResize(const Json& raw);
Parsed<GestureArgs> parseGesture(const Json& raw);
/// pip_restore et pip_close : un objet (ou rien), le reste est ignoré.
std::optional<std::string> checkEmpty(const std::string& command, const Json& raw);

}  // namespace tentacle::pip
