#!/usr/bin/env bash
# ===========================================================================
#  Builds the .deb.  Runs inside the target distribution's container
#  (packaging/docker/Dockerfile.deb), so dpkg, gcc, the ALSA headers and
#  dpkg-shlibdeps all belong to the distribution and architecture the package
#  is meant for.
#
#  The package is built directly from a staging tree with dpkg-deb instead of
#  going through debhelper: that keeps the armhf/arm64 builds to a single Go
#  compile (no Parcel under QEMU) and leaves the repository's own debian/
#  directory, used by the top level `make deb`, untouched.
# ===========================================================================
set -Eeuo pipefail
source "$(dirname "$(readlink -f "$0")")/common.sh"

require_env PKG_DISTRO PKG_ARCH PKG_DEBARCH PKG_GOARCH PKG_VERSION \
	PKG_DEB_VERSION PKG_SRC PKG_FRONTEND PKG_OUT PKG_FAMILY PKG_IMAGE

MAINTAINER="David Moreno <dmoreno@coralbits.com>"
PKG_GOFLAGS="${PKG_GOFLAGS:--trimpath}"
export PKG_GOFLAGS

log "$(cat /etc/os-release | grep -E '^PRETTY_NAME=' | cut -d= -f2-) / $(dpkg --print-architecture)"
verify_container_arch

prepare_worktree
build_binary "$WORK/aseqrc"

# ---------------------------------------------------------------- staging
STAGE="$WORK/stage"
log "staging the package tree"
stage_common_files "$STAGE"
install -D -m 0644 "$PKG_SRC/LICENSE" "$STAGE/usr/share/doc/aseqrc/copyright"
mkdir -p "$STAGE/DEBIAN"

for script in postinst prerm postrm; do
	install -D -m 0755 "$PKG_SRC/packaging/deb/$script" "$STAGE/DEBIAN/$script"
done
printf '%s\n' /etc/avahi/services/aseqrc.service > "$STAGE/DEBIAN/conffiles"

# ------------------------------------------------------------ dependencies
#
# dpkg-shlibdeps reads the actual ELF and the shlibs file of the target
# archive, which is how libasound2t64 (>= 24.04) versus libasound2 (< 24.04)
# and the glibc version come out right for every distribution.
log "resolving shared library dependencies with dpkg-shlibdeps"
SHLIBS_DIR="$WORK/meta"
mkdir -p "$SHLIBS_DIR/debian"
# A source stanza plus the one binary package: dpkg-shlibdeps only needs this
# to know which package it is generating ${shlibs:Depends} for.
cat > "$SHLIBS_DIR/debian/control" <<-EOF
	Source: aseqrc
	Section: sound
	Priority: optional
	Maintainer: $MAINTAINER
	Standards-Version: 4.6.2

	Package: aseqrc
	Architecture: $PKG_DEBARCH
	Depends: \${shlibs:Depends}
	Description: metadata stub used to run dpkg-shlibdeps
EOF

shlibs=""
if ! shlibs="$(cd "$SHLIBS_DIR" && dpkg-shlibdeps -O -e "$STAGE/usr/bin/aseqrc" 2>"$SHLIBS_DIR/shlibs.err")"; then
	cat "$SHLIBS_DIR/shlibs.err" >&2
	die "dpkg-shlibdeps failed"
fi
[ -s "$SHLIBS_DIR/shlibs.err" ] && cat "$SHLIBS_DIR/shlibs.err" >&2

depends="${shlibs#shlibs:Depends=}"
[ -n "$depends" ] || die "dpkg-shlibdeps did not report any dependency"
depends="$depends, adduser"
log "Depends: $depends"

installed_size="$(du -sk --apparent-size "$STAGE" | cut -f1)"

# ----------------------------------------------------------------- control
sed -e "s|@PACKAGE@|aseqrc|g" \
	-e "s|@VERSION@|$PKG_DEB_VERSION|g" \
	-e "s|@ARCH@|$PKG_DEBARCH|g" \
	-e "s|@DEPENDS@|${depends//&/\\&}|g" \
	-e "s|@INSTALLED_SIZE@|$installed_size|g" \
	-e "s|@DISTRO@|$PKG_DISTRO|g" \
	-e "s|@BUILD_ID@|${PKG_GIT_COMMIT:-unknown}|g" \
	"$PKG_SRC/packaging/deb/control.in" > "$STAGE/DEBIAN/control"

# ------------------------------------------------------------------- build
OUTDIR="$PKG_OUT/$PKG_FAMILY/$PKG_DISTRO/$PKG_ARCH"
mkdir -p "$OUTDIR"
DEBNAME="aseqrc_${PKG_DEB_VERSION}_${PKG_DEBARCH}.deb"
log "dpkg-deb --build -> $DEBNAME"
SOURCE_DATE_EPOCH="${PKG_SOURCE_DATE_EPOCH:-}" \
	dpkg-deb --root-owner-group -Zxz --build "$STAGE" "$OUTDIR/$DEBNAME"

# -------------------------------------------------------------- reporting
log "control:"
dpkg-deb -I "$OUTDIR/$DEBNAME" | sed 's/^/    /' >&2
log "contents:"
dpkg-deb -c "$OUTDIR/$DEBNAME" | sed 's/^/    /' >&2

sha256="$(sha256sum "$OUTDIR/$DEBNAME" | cut -d' ' -f1)"
size="$(stat -c %s "$OUTDIR/$DEBNAME")"

write_buildinfo "$OUTDIR" \
	"format=deb" \
	"file_deb=$DEBNAME" \
	"deb_version=$PKG_DEB_VERSION" \
	"debarch=$PKG_DEBARCH" \
	"depends=$depends" \
	"installed_size=$installed_size" \
	"sha256_deb=$sha256" \
	"size_deb=$size"

finalize_permissions "$PKG_OUT/$PKG_FAMILY/$PKG_DISTRO"
log "wrote $OUTDIR/$DEBNAME ($((size / 1024)) KiB, sha256 ${sha256:0:16}...)"
