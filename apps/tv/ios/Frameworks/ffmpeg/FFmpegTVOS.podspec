Pod::Spec.new do |s|
  s.name             = 'FFmpegTVOS'
  s.version          = '7.1.0'
  s.summary          = 'FFmpeg 7.1 LGPL (remux-only) prebuilt xcframeworks for tvOS'
  s.description       = 'libavformat/avcodec/avutil/swresample, LGPL, no encoders/decoders (stream copy / remux only), built for arm64 device + simulator.'
  s.homepage         = 'https://ffmpeg.org'
  s.license          = { :type => 'LGPL-2.1', :text => 'FFmpeg LGPL v2.1+ build (no GPL components).' }
  s.authors          = { 'FFmpeg' => 'https://ffmpeg.org' }
  s.source           = { :http => 'https://ffmpeg.org/releases/ffmpeg-7.1.tar.xz' }
  s.platform         = :tvos, '15.1'

  s.vendored_frameworks = [
    'avformat.xcframework',
    'avcodec.xcframework',
    'avutil.xcframework',
    'swresample.xcframework',
  ]

  # Dépendances système de FFmpeg (zlib/bz2/iconv) + SecureTransport (https).
  s.libraries = 'z', 'bz2', 'iconv'
  s.frameworks = 'Security', 'CoreFoundation', 'CoreMedia', 'VideoToolbox', 'AudioToolbox'
end
