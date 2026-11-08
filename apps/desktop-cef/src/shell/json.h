#pragma once
// Type JSON commun à tous les modules (nlohmann::json, Homebrew « nlohmann-json »).
#include <nlohmann/json.hpp>

namespace tentacle {
using Json = nlohmann::json;
}
