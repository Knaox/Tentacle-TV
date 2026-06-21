#!/bin/bash
# Build FFmpeg 7.1 LGPL pour tvOS (arm64 device + simulateur) — REMUX ONLY.
# Pas d'encodeur/décodeur (copie de flux) → LGPL propre, petit, sans brevets.
set -e
SRC=/tmp/ffmpeg-tvos-build/ffmpeg-7.1
OUT=/tmp/ffmpeg-tvos-build/out
MINVER=15.1
NCPU=$(sysctl -n hw.ncpu)

build() {
  local SDK=$1 NAME=$2 TRIPLE=$3
  local SYSROOT; SYSROOT=$(xcrun -sdk "$SDK" --show-sdk-path)
  local CC; CC=$(xcrun -sdk "$SDK" -f clang)
  local PREFIX=$OUT/$NAME
  echo "######## BUILD $NAME ($TRIPLE) ########"
  cd "$SRC"
  make distclean >/dev/null 2>&1 || true
  ./configure \
    --prefix="$PREFIX" \
    --enable-cross-compile --target-os=darwin --arch=arm64 \
    --cc="$CC" --sysroot="$SYSROOT" \
    --extra-cflags="-target $TRIPLE -fembed-bitcode-marker" \
    --extra-ldflags="-target $TRIPLE" \
    --enable-static --disable-shared \
    --disable-programs --disable-doc --disable-everything --disable-autodetect --disable-gpl \
    --enable-zlib --enable-securetransport \
    --enable-avformat --enable-avcodec --enable-swresample \
    --enable-demuxer=matroska,mov,mpegts,hls \
    --enable-muxer=mov,mp4,mpegts \
    --enable-protocol=file,http,https,tcp,tls,crypto \
    --enable-bsf=hevc_mp4toannexb,h264_mp4toannexb,extract_extradata \
    --enable-parser=hevc,h264,aac,ac3,dca \
    --disable-asm
  make -j"$NCPU"
  make install
}

build appletvos        device    arm64-apple-tvos${MINVER}
build appletvsimulator simulator arm64-apple-tvos${MINVER}-simulator

echo "######## XCFRAMEWORKS ########"
mkdir -p "$OUT/xcframeworks"
for L in avformat avcodec avutil swresample; do
  rm -rf "$OUT/xcframeworks/$L.xcframework"
  xcodebuild -create-xcframework \
    -library "$OUT/device/lib/lib$L.a"    -headers "$OUT/device/include" \
    -library "$OUT/simulator/lib/lib$L.a" -headers "$OUT/simulator/include" \
    -output "$OUT/xcframeworks/$L.xcframework"
done
echo "######## DONE ########"
ls -la "$OUT/xcframeworks"
