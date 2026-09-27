#!/usr/bin/env bash
# ===========================================================================
#  Builds the .rpm.  Runs inside the target distribution's container
#  (packaging/docker/Dockerfile.rpm), so rpmbuild, gcc and the ALSA headers
#  belong to the distribution and architecture the package is meant for.
#
#  The Go binary is compiled first (so the shared frontend bundle is only built
#  once, on the host architecture) and the spec only packages the result.  That
#  also means rpmbuild's automatic ELF dependency generator runs against the
#  real target binary and turns -lasound into libasound.so.2()(64bit) itself.
# ===========================================================================
set -Eeuo pipefail
source "$(dirname "$(readlink -f "$0")")/common.sh"

require_env PKG_DISTRO PKG_ARCH PKG_RPMARCH PKG_GOARCH PKG_VERSION \
	PKG_RELEASE PKG_SRC PKG_FRONTEND PKG_OUT PKG_FAMILY PKG_IMAGE

PKG_GOFLAGS="${PKG_GOFLAGS:--trimpath}"
export PKG_GOFLAGS

log "$(grep -E '^PRETTY_NAME=' /etc/os-release | cut -d= -f2-) / $(rpm --eval '%{_arch}')"
verify_container_arch

prepare_worktree
build_binary "$WORK/aseqrc"

# ---------------------------------------------------------------- rpmbuild
RPMTOP="$WORK/rpmbuild"
mkdir -p "$RPMTOP"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}

SPEC="$RPMTOP/SPECS/aseqrc.spec"
sed -e "s|@LICENSE@|GPL-3.0-or-later|g" "$PKG_SRC/packaging/rpm/aseqrc.spec" > "$SPEC"
cat >> "$SPEC" <<EOF

%changelog
* $(LC_ALL=C date -u '+%a %b %d %Y') David Moreno <dmoreno@coralbits.com> - $PKG_VERSION-$PKG_RELEASE
- Automated build for $PKG_DISTRO/$PKG_ARCH from $PKG_SRC
EOF

log "rpmbuild"
SOURCE_DATE_EPOCH="${PKG_SOURCE_DATE_EPOCH:-}" \
	rpmbuild -bb \
		--define "_topdir $RPMTOP" \
		--define "src_root $PKG_SRC" \
		--define "pkg_version $PKG_VERSION" \
		--define "pkg_release $PKG_RELEASE" \
		--define "pkg_binary $WORK/aseqrc" \
		--define "pkg_distro $PKG_DISTRO" \
		--define "pkg_arch $PKG_ARCH" \
		"$SPEC"

RPMFILE="$(find "$RPMTOP/RPMS" -name '*.rpm' -type f | head -n1)"
[ -n "$RPMFILE" ] || die "rpmbuild produced no package"
RPMNAME="$(basename "$RPMFILE")"
OUTDIR="$PKG_OUT/$PKG_FAMILY/$PKG_DISTRO/$PKG_ARCH"
mkdir -p "$OUTDIR"
cp -a "$RPMFILE" "$OUTDIR/$RPMNAME"

# -------------------------------------------------------------- reporting
log "info:"
rpm -qpi "$OUTDIR/$RPMNAME" | sed 's/^/    /' >&2
log "requires:"
rpm -qp --requires "$OUTDIR/$RPMNAME" | sed 's/^/    /' >&2
log "contents:"
rpm -qpl "$OUTDIR/$RPMNAME" | sed 's/^/    /' >&2

sha256="$(sha256sum "$OUTDIR/$RPMNAME" | cut -d' ' -f1)"
size="$(stat -c %s "$OUTDIR/$RPMNAME")"
requires="$(rpm -qp --requires "$OUTDIR/$RPMNAME" | tr '\n' ' ' | sed -e 's/  */ /g' -e 's/ $//')"
provides="$(rpm -qp --provides "$OUTDIR/$RPMNAME" | tr '\n' ' ' | sed -e 's/  */ /g' -e 's/ $//')"

write_buildinfo "$OUTDIR" \
	"format=rpm" \
	"file_rpm=$RPMNAME" \
	"rpmarch=$PKG_RPMARCH" \
	"requires=$requires" \
	"provides=$provides" \
	"sha256_rpm=$sha256" \
	"size_rpm=$size"

finalize_permissions "$PKG_OUT/$PKG_FAMILY/$PKG_DISTRO"
log "wrote $OUTDIR/$RPMNAME ($((size / 1024)) KiB, sha256 ${sha256:0:16}...)"
