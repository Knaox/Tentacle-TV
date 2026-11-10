// Documents des greffons (voir plugin_documents.h et pluginDocuments.ts).

#include "net/plugin_documents.h"

#include <list>
#include <mutex>
#include <utility>

namespace tentacle::net::plugins {
namespace {

std::mutex g_mutex;
// Ordre d'insertion, le plus ancien en tête (une `Map` JavaScript réinsérée en fin de file).
std::list<std::pair<std::string, std::string>> g_documents;

}  // namespace

bool isValidPluginId(std::string_view id) {
  if (id.empty() || id.size() > 64) return false;
  for (char c : id) {
    const bool ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') ||
                    c == '.' || c == '_' || c == '-';
    if (!ok) return false;
  }
  return true;
}

size_t utf16Length(std::string_view utf8) {
  size_t n = 0;
  for (unsigned char c : utf8) {
    if ((c & 0xC0) != 0x80) n += c >= 0xF0 ? 2 : 1;  // un astral = deux unités
  }
  return n;
}

std::optional<std::string> setDocument(const std::string& scheme, const std::string& id, std::string html) {
  if (!isValidPluginId(id)) return std::nullopt;
  std::lock_guard lock(g_mutex);
  g_documents.remove_if([&](const auto& d) { return d.first == id; });
  g_documents.emplace_back(id, std::move(html));
  while (g_documents.size() > kMaxDocuments) g_documents.pop_front();
  return scheme + "://" + kPluginHost + "/" + id;
}

std::optional<std::string> getDocument(const std::string& id) {
  std::lock_guard lock(g_mutex);
  for (const auto& [k, v] : g_documents) {
    if (k == id) return v;
  }
  return std::nullopt;
}

void clearDocuments() {
  std::lock_guard lock(g_mutex);
  g_documents.clear();
}

}  // namespace tentacle::net::plugins
