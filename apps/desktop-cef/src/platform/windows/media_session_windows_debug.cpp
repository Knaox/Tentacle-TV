// Couture Windows de « À l'écoute » : la relecture des bancs (`Backend::debugState`) — ce que
// SMTC tient RÉELLEMENT, relu par ses propres accesseurs, en JSON. La ligne de temps n'a pas
// d'accesseur chez SMTC (seul un lecteur de sessions, `Windows.Media.Control`, la relit) :
// elle n'y figure pas.

#include "platform/windows/media_session_windows.h"

#include <cstdio>

namespace tentacle::media_session::win {
namespace {

// Un HSTRING rendu par un accesseur : converti en UTF-8, puis libéré.
std::string take(HSTRING value) {
  std::string out;
  UINT32 length = 0;
  const wchar_t* raw = WindowsGetStringRawBuffer(value, &length);
  if (raw && length > 0) {
    const int size = WideCharToMultiByte(CP_UTF8, 0, raw, static_cast<int>(length), nullptr, 0, nullptr, nullptr);
    if (size > 0) {
      out.resize(static_cast<size_t>(size));
      WideCharToMultiByte(CP_UTF8, 0, raw, static_cast<int>(length), out.data(), size, nullptr, nullptr);
    }
  }
  if (value) WindowsDeleteString(value);
  return out;
}

void appendString(std::string& out, const std::string& text) {
  out += '"';
  for (const unsigned char c : text) {
    switch (c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default:
        if (c < 0x20) {
          char escaped[8];
          std::snprintf(escaped, sizeof escaped, "\\u%04x", static_cast<unsigned>(c));
          out += escaped;
        } else {
          out += static_cast<char>(c);
        }
    }
  }
  out += '"';
}

void appendField(std::string& out, const char* key, const std::string& json) {
  if (out.back() != '{') out += ',';
  appendString(out, key);
  out += ':';
  out += json;
}

std::string flag(HRESULT hr, boolean value) { return FAILED(hr) ? "null" : (value ? "true" : "false"); }

template <class T>
std::string readFlag(T* object, HRESULT (STDMETHODCALLTYPE T::*get)(boolean*)) {
  boolean value = FALSE;
  const HRESULT hr = (object->*get)(&value);
  return flag(hr, value);
}

template <class T>
std::string readText(T* object, HRESULT (STDMETHODCALLTYPE T::*get)(HSTRING*)) {
  HSTRING value = nullptr;
  if (FAILED((object->*get)(&value))) return "null";
  std::string out;
  appendString(out, take(value));
  return out;
}

const char* statusName(wm::MediaPlaybackStatus status) {
  switch (status) {
    case wm::MediaPlaybackStatus_Closed: return "\"Closed\"";
    case wm::MediaPlaybackStatus_Changing: return "\"Changing\"";
    case wm::MediaPlaybackStatus_Stopped: return "\"Stopped\"";
    case wm::MediaPlaybackStatus_Playing: return "\"Playing\"";
    case wm::MediaPlaybackStatus_Paused: return "\"Paused\"";
    default: return "null";
  }
}

const char* typeName(wm::MediaPlaybackType type) {
  switch (type) {
    case wm::MediaPlaybackType_Music: return "\"Music\"";
    case wm::MediaPlaybackType_Video: return "\"Video\"";
    case wm::MediaPlaybackType_Image: return "\"Image\"";
    case wm::MediaPlaybackType_Unknown: return "\"Unknown\"";
    default: return "null";
  }
}

std::string displayJson(wm::ISystemMediaTransportControlsDisplayUpdater* updater) {
  std::string out = "{";
  wm::MediaPlaybackType type{};
  appendField(out, "type", SUCCEEDED(updater->get_Type(&type)) ? typeName(type) : "null");
  ComPtr<wss::IRandomAccessStreamReference> thumbnail;
  appendField(out, "thumbnail", flag(updater->get_Thumbnail(&thumbnail), thumbnail != nullptr));
  ComPtr<wm::IMusicDisplayProperties> music;
  if (SUCCEEDED(updater->get_MusicProperties(&music)) && music) {
    appendField(out, "title", readText(music.Get(), &wm::IMusicDisplayProperties::get_Title));
    appendField(out, "artist", readText(music.Get(), &wm::IMusicDisplayProperties::get_Artist));
    ComPtr<wm::IMusicDisplayProperties2> album;
    if (SUCCEEDED(music.As(&album)))
      appendField(out, "album", readText(album.Get(), &wm::IMusicDisplayProperties2::get_AlbumTitle));
  }
  ComPtr<wm::IVideoDisplayProperties> video;
  if (SUCCEEDED(updater->get_VideoProperties(&video)) && video) {
    appendField(out, "videoTitle", readText(video.Get(), &wm::IVideoDisplayProperties::get_Title));
    appendField(out, "subtitle", readText(video.Get(), &wm::IVideoDisplayProperties::get_Subtitle));
  }
  return out + '}';
}

}  // namespace

std::string debugJson(wm::ISystemMediaTransportControls* smtc, bool active) {
  if (!smtc) return "null";
  using S = wm::ISystemMediaTransportControls;
  std::string out = "{";
  appendField(out, "active", active ? "true" : "false");
  appendField(out, "enabled", readFlag(smtc, &S::get_IsEnabled));
  wm::MediaPlaybackStatus status{};
  appendField(out, "playbackStatus", SUCCEEDED(smtc->get_PlaybackStatus(&status)) ? statusName(status) : "null");
  ComPtr<wm::ISystemMediaTransportControls2> timeline;
  DOUBLE rate = 0;
  const bool hasRate = SUCCEEDED(smtc->QueryInterface(__uuidof(wm::ISystemMediaTransportControls2),
                                                      reinterpret_cast<void**>(timeline.GetAddressOf()))) &&
                       SUCCEEDED(timeline->get_PlaybackRate(&rate));
  appendField(out, "rate", hasRate ? std::to_string(rate) : "null");
  ComPtr<wm::ISystemMediaTransportControlsDisplayUpdater> updater;
  appendField(out, "display",
              SUCCEEDED(smtc->get_DisplayUpdater(&updater)) && updater ? displayJson(updater.Get()) : "null");
  std::string commands = "{";
  appendField(commands, "play", readFlag(smtc, &S::get_IsPlayEnabled));
  appendField(commands, "pause", readFlag(smtc, &S::get_IsPauseEnabled));
  appendField(commands, "stop", readFlag(smtc, &S::get_IsStopEnabled));
  appendField(commands, "next", readFlag(smtc, &S::get_IsNextEnabled));
  appendField(commands, "previous", readFlag(smtc, &S::get_IsPreviousEnabled));
  appendField(out, "commands", commands + '}');
  return out + '}';
}

}  // namespace tentacle::media_session::win
