#include "shell/dialog_rule.h"

namespace tentacle::dialogs {
namespace {

std::vector<std::string> splitExtensions(const std::string& joined) {
  std::vector<std::string> out;
  size_t start = 0;
  while (start <= joined.size()) {
    size_t end = joined.find(';', start);
    if (end == std::string::npos) end = joined.size();
    std::string ext = joined.substr(start, end - start);
    if (!ext.empty() && ext[0] == '.') ext.erase(0, 1);
    if (!ext.empty()) out.push_back(ext);
    start = end + 1;
  }
  return out;
}

}  // namespace

std::vector<FileFilter> filtersFromAccept(const std::vector<std::string>& acceptFilters,
                                          const std::vector<std::string>& acceptExtensions) {
  std::vector<std::string> extensions;
  int validTypeCount = 0;
  std::string description;
  for (size_t i = 0; i < acceptFilters.size(); ++i) {
    const std::string& type = acceptFilters[i];
    if (type.empty()) continue;
    const size_t before = extensions.size();
    if (type[0] == '.') {
      // Une extension (« .txt ») : prise telle quelle, sans son point.
      extensions.push_back(type.substr(1));
    } else {
      if (type == "image/*") description = "Image Files";
      else if (type == "audio/*") description = "Audio Files";
      else if (type == "video/*") description = "Video Files";
      if (i < acceptExtensions.size()) {
        for (auto& e : splitExtensions(acceptExtensions[i])) extensions.push_back(std::move(e));
      }
    }
    if (extensions.size() > before) validTypeCount++;
  }
  if (extensions.empty()) return {};
  if (validTypeCount > 1 || (validTypeCount == 1 && description.empty())) {
    description = "Custom Files";
  }
  return {FileFilter{description, std::move(extensions)}, FileFilter{"All Files", {"*"}}};
}

bool pathsUsable(const std::vector<std::string>& paths) {
  if (paths.empty()) return false;
  for (const auto& p : paths) {
    if (p.empty()) return false;
  }
  return true;
}

std::string joinPath(const std::string& dir, const std::string& name, char sep) {
  if (dir.empty()) return name;
  if (name.empty()) return dir;
  if (dir.back() == sep || dir.back() == '/') return dir + name;
  return dir + sep + name;
}

std::string dirName(const std::string& path) {
  const size_t cut = path.find_last_of("/\\");
  if (cut == std::string::npos) return {};
  return cut == 0 ? path.substr(0, 1) : path.substr(0, cut);
}

FileRequest webFileChooser(FileMode mode, const std::string& title, const std::string& defaultName,
                           const std::string& lastDirectory, std::vector<FileFilter> filters) {
#ifdef _WIN32
  constexpr char kSep = '\\';
#else
  constexpr char kSep = '/';
#endif
  FileRequest r;
  r.mode = mode;
  r.title = title;
  r.filters = std::move(filters);
  if (mode == FileMode::save) {
    r.defaultPath = defaultName;
    return r;
  }
  r.createDirectory = true;
  r.treatPackageAsDirectory = mode != FileMode::openFolder;
  r.defaultPath = joinPath(lastDirectory, defaultName, kSep);
  return r;
}

FileRequest downloadSave(const std::string& url, const std::string& directory,
                         const std::string& suggestedName) {
#ifdef _WIN32
  constexpr char kSep = '\\';
#else
  constexpr char kSep = '/';
#endif
  FileRequest r;
  r.mode = FileMode::save;
  r.title = url;
  r.defaultPath = joinPath(directory, suggestedName, kSep);
  return r;
}

std::optional<MessageBox> javaScriptBox(JsKind kind, const std::string& message) {
  switch (kind) {
    case JsKind::alert:
      return MessageBox{message, {"OK"}, -1, 0};
    case JsKind::confirm:
      // « First button is default, second button is cancel ».
      return MessageBox{message, {"OK", "Cancel"}, 0, 1};
    case JsKind::prompt:
      return std::nullopt;
  }
  return std::nullopt;
}

bool javaScriptAccepted(JsKind kind, int response) {
  return kind != JsKind::prompt && response == 0;
}

}  // namespace tentacle::dialogs
