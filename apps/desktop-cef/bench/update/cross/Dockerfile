# Banc maj hors macOS (bench/update/cross-test.sh) : construire et éprouver le code Linux sur un
# vrai noyau Linux (VM colima), compiler et lier le code Windows avec mingw-w64. Ni app ni CEF.
FROM debian:bookworm-slim
RUN sed -i 's/^Types: deb$/Types: deb deb-src/' /etc/apt/sources.list.d/debian.sources \
 && apt-get update && apt-get install -y --no-install-recommends \
      g++ cmake ninja-build pkg-config make dpkg-dev xz-utils ca-certificates python3 autoconf automake libtool \
      libsodium-dev nlohmann-json3-dev libcurl4-openssl-dev g++-mingw-w64-x86-64-posix \
 && rm -rf /var/lib/apt/lists/*
# Windows : libsodium statique pour mingw, construite depuis la source Debian (archive signée),
# et nlohmann (en-têtes seuls) recopié dans le même préfixe.
RUN mkdir /tmp/s && cd /tmp/s && apt-get update && apt-get source libsodium && cd libsodium-*/ && autoreconf -fi >/dev/null 2>&1 \
 && ./configure --host=x86_64-w64-mingw32 --prefix=/opt/mingw --disable-shared --enable-static >/dev/null \
 && make -j2 >/dev/null && make install >/dev/null \
 && mkdir -p /opt/mingw/share/cmake && cp -r /usr/include/nlohmann /opt/mingw/include/ \
 && cp -r "$(dirname "$(dpkg -L nlohmann-json3-dev | grep -m1 'nlohmann_jsonConfig.cmake$')")" /opt/mingw/share/cmake/ \
 && cd / && rm -rf /tmp/s /var/lib/apt/lists/*
