#include "update/state.h"

#include <nlohmann/json.hpp>

#include <cstdio>
#include <fstream>
#include <sstream>

namespace tentacle::update {
namespace {

using Json = nlohmann::json;

std::optional<Json> loadJson(const std::string& path) {
  auto text = readFile(path);
  if (!text) return std::nullopt;
  Json j = Json::parse(*text, nullptr, false);
  if (j.is_discarded() || !j.is_object()) return std::nullopt;
  return j;
}

// Lectures typées : un fichier abîmé ou trafiqué rend la valeur par défaut, jamais une exception.
std::string text(const Json& j, const char* k) {
  auto it = j.find(k);
  return it != j.end() && it->is_string() ? it->get<std::string>() : std::string();
}
int64_t number(const Json& j, const char* k) {
  auto it = j.find(k);
  return it != j.end() && it->is_number_integer() ? it->get<int64_t>() : 0;
}
bool flag(const Json& j, const char* k) {
  auto it = j.find(k);
  return it != j.end() && it->is_boolean() && it->get<bool>();
}

}  // namespace

std::optional<std::string> readFile(const std::string& path, size_t maxBytes) {
  std::ifstream in(path, std::ios::binary);
  if (!in) return std::nullopt;
  std::string out;
  char buf[8192];
  while (in.read(buf, sizeof buf) || in.gcount() > 0) {
    out.append(buf, size_t(in.gcount()));
    if (out.size() > maxBytes) return std::nullopt;
  }
  return out;
}

bool writeFileAtomic(const std::string& path, const std::string& content) {
  const std::string tmp = path + ".tmp";
  {
    std::ofstream out(tmp, std::ios::binary | std::ios::trunc);
    if (!out) return false;
    out << content;
    out.flush();
    if (!out) return false;
  }
  return std::rename(tmp.c_str(), path.c_str()) == 0;
}

std::optional<DeviceState> loadState(const std::string& path) {
  auto j = loadJson(path);
  if (!j) return std::nullopt;
  DeviceState s;
  s.mutedThrough = text(*j, "mutedThrough");
  s.snoozedVersion = text(*j, "snoozedVersion");
  s.snoozedUntil = number(*j, "snoozedUntil");
  s.lastIssuedAt = number(*j, "lastIssuedAt");
  if (auto it = j->find("badVersions"); it != j->end() && it->is_array())
    for (auto& v : *it)
      if (v.is_string()) s.badVersions.push_back(v.get<std::string>());
  return s;
}

bool saveState(const std::string& path, const DeviceState& s) {
  const Json j = {{"mutedThrough", s.mutedThrough},   {"snoozedVersion", s.snoozedVersion},
                  {"snoozedUntil", s.snoozedUntil},   {"badVersions", s.badVersions},
                  {"lastIssuedAt", s.lastIssuedAt}};
  return writeFileAtomic(path, j.dump(2) + "\n");
}

std::optional<Probation> loadProbation(const std::string& path) {
  auto j = loadJson(path);
  if (!j) return std::nullopt;
  Probation p;
  p.version = text(*j, "version");
  p.previousPath = text(*j, "previousPath");
  p.appPath = text(*j, "appPath");
  p.launches = int(number(*j, "launches"));
  p.healthy = flag(*j, "healthy");
  p.rolledBack = text(*j, "rolledBack");
  return p;
}

bool saveProbation(const std::string& path, const Probation& p) {
  const Json j = {{"version", p.version},   {"previousPath", p.previousPath}, {"appPath", p.appPath},
                  {"launches", p.launches}, {"healthy", p.healthy},           {"rolledBack", p.rolledBack}};
  return writeFileAtomic(path, j.dump(2) + "\n");
}

}  // namespace tentacle::update
