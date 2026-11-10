// `.part` POSIX (macOS, Linux) : `open` + `pwrite` + `fsync`.

#include <fcntl.h>
#include <unistd.h>

#include <cerrno>
#include <system_error>

#include "offline/core/part_file.h"

namespace tentacle::offline {
namespace {

[[noreturn]] void fail(const char* what, const std::filesystem::path& target) {
  throw std::filesystem::filesystem_error(what, target, std::error_code(errno, std::generic_category()));
}

class PosixPartFile final : public PartFile {
 public:
  PosixPartFile(int fd, std::filesystem::path target) : fd_(fd), target_(std::move(target)) {}
  ~PosixPartFile() override { close(); }

  void write(const void* data, size_t length, int64_t offset) override {
    const auto* bytes = static_cast<const char*>(data);
    while (length > 0) {
      const ssize_t n = ::pwrite(fd_, bytes, length, static_cast<off_t>(offset));
      if (n < 0) {
        if (errno == EINTR) continue;
        fail("pwrite", target_);
      }
      bytes += n;
      length -= static_cast<size_t>(n);
      offset += n;
    }
  }

  void sync() override {
    if (::fsync(fd_) != 0) fail("fsync", target_);
  }

  void close() override {
    if (fd_ < 0) return;
    ::close(fd_);
    fd_ = -1;
  }

 private:
  int fd_;
  std::filesystem::path target_;
};

}  // namespace

std::unique_ptr<PartFile> PartFile::open(const std::filesystem::path& target, Mode mode) {
  // `w` (créer, tronquer) ou `r+` (le fichier doit exister, sans troncature).
  const int flags = mode == Mode::Truncate ? (O_WRONLY | O_CREAT | O_TRUNC) : O_WRONLY;
  const int fd = ::open(target.c_str(), flags | O_CLOEXEC, 0644);
  if (fd < 0) fail("open", target);
  return std::make_unique<PosixPartFile>(fd, target);
}

}  // namespace tentacle::offline
