#include "offline/core/files.h"

#include <cerrno>
#include <fstream>
#include <iterator>
#include <system_error>

#include "offline/core/utf8_path.h"

namespace tentacle::offline::files {

void throwErrno(const char* what, const fs::path& target) {
  const int code = errno != 0 ? errno : EIO;
  throw fs::filesystem_error(what, target, std::error_code(code, std::generic_category()));
}

bool exists(const fs::path& target) {
  std::error_code ec;
  return fs::exists(target, ec);
}

std::optional<int64_t> size(const fs::path& target) {
  std::error_code ec;
  if (!fs::is_regular_file(target, ec)) return std::nullopt;
  const auto bytes = fs::file_size(target, ec);
  if (ec) return std::nullopt;
  return static_cast<int64_t>(bytes);
}

void mkdirp(const fs::path& dir) {
  std::error_code ec;
  fs::create_directories(dir, ec);
  if (ec && !fs::is_directory(dir)) throw fs::filesystem_error("mkdir", dir, ec);
}

void writeBytes(const fs::path& target, const void* data, size_t length) {
  errno = 0;
  std::ofstream out(target, std::ios::binary | std::ios::trunc);
  if (!out) throwErrno("open", target);
  out.write(static_cast<const char*>(data), static_cast<std::streamsize>(length));
  out.flush();
  if (!out) throwErrno("write", target);
}

void writeText(const fs::path& target, const std::string& text) { writeBytes(target, text.data(), text.size()); }

std::vector<uint8_t> readBytes(const fs::path& target) {
  errno = 0;
  std::ifstream in(target, std::ios::binary);
  if (!in) throwErrno("open", target);
  return std::vector<uint8_t>((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
}

std::string readText(const fs::path& target) {
  const auto bytes = readBytes(target);
  return std::string(bytes.begin(), bytes.end());
}

void remove(const fs::path& target) {
  std::error_code ec;
  fs::remove(target, ec);
  // Déjà absent : le cas courant après un échec de transfert.
  if (ec && ec != std::errc::no_such_file_or_directory) throw fs::filesystem_error("unlink", target, ec);
}

void removeTree(const fs::path& dir) {
  std::error_code ec;
  fs::remove_all(dir, ec);
  if (ec && ec != std::errc::no_such_file_or_directory) throw fs::filesystem_error("rm", dir, ec);
}

void rename(const fs::path& from, const fs::path& to) { fs::rename(from, to); }

std::vector<std::string> listFiles(const fs::path& dir) {
  std::vector<std::string> names;
  std::error_code ec;
  fs::directory_iterator it(dir, ec);
  if (ec) return names;  // pas de dossier : rien à lister
  for (const auto& entry : it) {
    std::error_code fileEc;
    if (entry.is_regular_file(fileEc)) names.push_back(pathToUtf8(entry.path().filename()));
  }
  return names;
}

int64_t freeSpace(const fs::path& target) {
  // `available` = blocs libres POUR l'utilisateur (bavail), comme `statfs` de Node.
  return static_cast<int64_t>(fs::space(target).available);
}

namespace {

const std::error_code* codeOf(const std::exception& error) {
  if (const auto* fsError = dynamic_cast<const fs::filesystem_error*>(&error)) return &fsError->code();
  if (const auto* sysError = dynamic_cast<const std::system_error*>(&error)) return &sysError->code();
  return nullptr;
}

}  // namespace

std::string errnoName(const std::error_code& code) {
  // Les causes qui orientent un diagnostic de racine ou de transfert ; Windows passe par la
  // condition générique (ERROR_ACCESS_DENIED → EACCES, ERROR_DISK_FULL → ENOSPC…).
  const std::error_condition c = code.default_error_condition();
  if (c.category() != std::generic_category()) return "";
  switch (static_cast<std::errc>(c.value())) {
    case std::errc::operation_not_permitted: return "EPERM";
    case std::errc::permission_denied: return "EACCES";
    case std::errc::read_only_file_system: return "EROFS";
    case std::errc::no_space_on_device: return "ENOSPC";
    case std::errc::no_such_file_or_directory: return "ENOENT";
    case std::errc::file_exists: return "EEXIST";
    case std::errc::not_a_directory: return "ENOTDIR";
    case std::errc::is_a_directory: return "EISDIR";
    case std::errc::device_or_resource_busy: return "EBUSY";
    case std::errc::io_error: return "EIO";
    case std::errc::filename_too_long: return "ENAMETOOLONG";
    case std::errc::too_many_files_open: return "EMFILE";
    case std::errc::file_too_large: return "EFBIG";
    case std::errc::cross_device_link: return "EXDEV";
    case std::errc::directory_not_empty: return "ENOTEMPTY";
    case std::errc::invalid_argument: return "EINVAL";
    default: return "";
  }
}

ErrorKind classify(const std::exception& error) {
  const std::error_code* code = codeOf(error);
  if (code == nullptr) return ErrorKind::Other;
  if (*code == std::errc::no_space_on_device) return ErrorKind::DiskFull;
  if (*code == std::errc::no_such_file_or_directory) return ErrorKind::NotFound;
  return ErrorKind::Other;
}

std::string describe(const std::exception& error) {
  const std::error_code* code = codeOf(error);
  if (code == nullptr) return error.what();
  std::string name = errnoName(*code);
  if (name.empty()) name = code->message();
  if (const auto* fsError = dynamic_cast<const fs::filesystem_error*>(&error); fsError && !fsError->path1().empty()) {
    return name + " " + pathToUtf8(fsError->path1());
  }
  return name;
}

}  // namespace tentacle::offline::files
