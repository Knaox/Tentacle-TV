#pragma once
// Langues préférées du système Linux, au format Accept-Language de CEF (« fr-CH,fr,en »).
// Source, dans l'ordre de gettext : LANGUAGE (liste « fr_CH:fr:en »), puis LC_ALL,
// LC_MESSAGES, LANG (« fr_CH.UTF-8@euro »). « C » et « POSIX » ne disent rien : "".
// Comme Chromium, chaque langue régionale est suivie de sa langue de base.

#include <functional>
#include <optional>
#include <string>

namespace tentacle::platform {

std::string acceptLanguagesFrom(
    const std::function<std::optional<std::string>(const char* name)>& env);

}  // namespace tentacle::platform
