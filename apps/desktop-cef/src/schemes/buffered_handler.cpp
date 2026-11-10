// Une réponse de schéma tenue en mémoire (voir buffered_handler.h).

#include "schemes/buffered_handler.h"

#include <algorithm>
#include <cstring>

namespace tentacle::schemes {

namespace {
const char* reasonOf(int status) {
  switch (status) {
    case 200: return "OK";
    case 204: return "No Content";
    case 400: return "Bad Request";
    case 403: return "Forbidden";
    case 404: return "Not Found";
    case 405: return "Method Not Allowed";
    case 413: return "Payload Too Large";
    default: return "";
  }
}
}  // namespace

SchemeResponse emptyResponse(int status, CefResponse::HeaderMap headers) {
  SchemeResponse r;
  r.status = status;
  r.statusText = reasonOf(status);
  r.headers = std::move(headers);
  return r;
}

bool BufferedHandler::Open(CefRefPtr<CefRequest> request, bool& handleRequest,
                           CefRefPtr<CefCallback> callback) {
  handleRequest = false;
  {
    std::lock_guard lock(mutex_);
    callback_ = callback;
  }
  CefRefPtr<BufferedHandler> self(this);
  start_(request, [self](SchemeResponse response) {
    CefRefPtr<CefCallback> cb;
    {
      std::lock_guard lock(self->mutex_);
      if (self->ready_) return;  // une seule réponse
      self->response_ = std::move(response);
      self->ready_ = true;
      cb = std::move(self->callback_);
    }
    if (cb) cb->Continue();
  });
  return true;
}

void BufferedHandler::GetResponseHeaders(CefRefPtr<CefResponse> response, int64_t& responseLength,
                                         CefString& redirectUrl) {
  std::lock_guard lock(mutex_);
  response->SetStatus(response_.status);
  response->SetStatusText(response_.statusText);
  if (!response_.mimeType.empty()) response->SetMimeType(response_.mimeType);
  response->SetHeaderMap(response_.headers);
  responseLength = int64_t(response_.body.size());
}

bool BufferedHandler::Read(void* dataOut, int bytesToRead, int& bytesRead,
                           CefRefPtr<CefResourceReadCallback> callback) {
  std::lock_guard lock(mutex_);
  const size_t left = response_.body.size() - offset_;
  if (left == 0) {
    bytesRead = 0;
    return false;  // fin
  }
  const size_t n = std::min(left, size_t(bytesToRead));
  std::memcpy(dataOut, response_.body.data() + offset_, n);
  offset_ += n;
  bytesRead = int(n);
  return true;
}

void BufferedHandler::Cancel() {
  std::lock_guard lock(mutex_);
  callback_ = nullptr;
}

}  // namespace tentacle::schemes
