#!/usr/bin/env bash
# ===========================================================================
#  Shared helpers for the in-container build scripts.
#
#  The scripts are run by `docker run` from packaging/Makefile with the tree
#  mounted read only at /src, the pre-built frontend bundle at /frontend and
#  the output directory at /out.  Everything they need to know about the target
#  arrives in PKG_* environment variables (see PKG_ENV in packaging/Makefile).
# ===========================================================================

if [ -t 2 ] && [ -z "${NO_COLOR:-}" ]; then
	C_RESET=$'\033[0m'; C_BLUE=$'\033[1;34m'; C_YELLOW=$'\033[1;33m'; C_RED=$'\033[1;31m'
else
	C_RESET=''; C_BLUE=''; C_YELLOW=''; C_RED=''
fi

log()  { printf '%s==>%s %s\n'    "$C_BLUE"   "$C_RESET" "$*" >&2; }
warn() { printf '%sWARN:%s %s\n'  "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()  { printf '%sERROR:%s %s\n' "$C_RED"    "$C_RESET" "$*" >&2; exit 1; }

set -E
trap 'rc=$?; printf "%sERROR:%s %s line %s failed (status %s)\n" \
        "$C_RED" "$C_RESET" "${BASH_SOURCE[0]}" "$LINENO" "$rc" >&2; exit "$rc"' ERR

require_env() {
	local missing=() v
	for v in "$@"; do
		[ -n "${!v:-}" ] || missing+=("$v")
	done
	[ ${#missing[@]} -eq 0 ] || die "missing environment: ${missing[*]}"
}

# Containers run as root (bind mounts, apt/dnf, rpmbuild), so hand the results
# back to whoever invoked make.  PKG_CHOWN_EXTRA covers bind mounts that are not
# directories of their own (the Go caches, when CACHE=1).
finalize_permissions() {
	local path
	for path in "$@" ${PKG_CHOWN_EXTRA:-}; do
		[ -e "$path" ] || continue
		chown -R "${PKG_HOST_UID:-0}:${PKG_HOST_GID:-${PKG_HOST_UID:-0}}" "$path" 2>/dev/null \
			|| warn "could not chown $path (rootless docker?)"
	done
}

# Copy the backend into a writable scratch tree and graft in the pre-built
# frontend bundle: the Go build embeds it (//go:embed static) and the bundle is
# the same on every architecture, so it is built once outside of the target
# container instead of running Parcel under QEMU for every armhf package.
prepare_worktree() {
	WORK="$(mktemp -d "${TMPDIR:-/tmp}/aseqrc-build.XXXXXX")"
	log "work tree: $WORK"
	mkdir -p "$WORK/backend"
	tar -C "$PKG_SRC/backend" -cf - \
		--exclude=./aseqrc --exclude=./connections.db --exclude=./static . \
		| tar -C "$WORK/backend" -xf -
	[ -d "$PKG_FRONTEND/static" ] \
		|| die "no frontend bundle in $PKG_FRONTEND (run 'make frontend' first)"
	rm -rf "$WORK/backend/static"
	cp -a "$PKG_FRONTEND/static" "$WORK/backend/static"
	trap 'rm -rf "${WORK:-}"' EXIT
}

build_binary() {
	local out="$1" ldflags
	local -a extra=()
	ldflags="-s -w"
	ldflags="$ldflags -X main.version=${PKG_VERSION}"
	ldflags="$ldflags -X main.buildCommit=${PKG_GIT_COMMIT:-unknown}"
	ldflags="$ldflags -X main.buildDistro=${PKG_DISTRO}"
	ldflags="$ldflags -X main.buildArch=${PKG_ARCH}"
	if [ "${PKG_PIE:-0}" = 1 ]; then
		extra+=(-buildmode=pie)
	fi

	log "go build $(go version | awk '{print $3}') for GOARCH=$PKG_GOARCH${PKG_GOARM:+ GOARM=$PKG_GOARM} (CGO_ENABLED=1)"
	(
		cd "$WORK/backend"
		export CGO_ENABLED=1
		export GOARCH="$PKG_GOARCH"
		export GOTOOLCHAIN=local
		export GOFLAGS="${PKG_GOFLAGS:--trimpath}"
		if [ -n "${PKG_GOARM:-}" ]; then
			export GOARM="$PKG_GOARM"
		fi
		go build "${extra[@]}" -ldflags "$ldflags" -o "$out" .
	)
	verify_binary_arch "$out"
}

# Docker keeps a single image per tag, so a base image that was pulled for
# another architecture can silently be used for this build (buildkit only
# prints "InvalidBaseImagePlatform").  Everything that follows would then
# produce a package of the wrong architecture, or an obscure assembler error,
# so check that this container really is the machine that was asked for.
verify_container_arch() {
	local want_deb want_rpm want_machine got

	case "$PKG_ARCH" in
		amd64)
			want_deb=amd64; want_rpm=x86_64; want_machine=x86_64
			;;
		armhf)
			want_deb=armhf; want_rpm=armv7hl; want_machine=armv7l
			;;
		arm64)
			want_deb=arm64; want_rpm=aarch64; want_machine=aarch64
			;;
		*)
			die "unsupported architecture: $PKG_ARCH"
			;;
	esac

	got="$(uname -m)"
	if [ "$got" != "$want_machine" ]; then
		die "$PKG_DISTRO/$PKG_ARCH: this container is $got, expected $want_machine.
       Docker reused the base image '$PKG_IMAGE' that was pulled for another
       architecture.  Remove it and retry:
           docker rmi $PKG_IMAGE
         make ..."
	fi

	# gcc reports its own target triple: x86_64-linux-gnu on Debian,
	# x86_64-redhat-linux on Fedora, arm-linux-gnueabihf on 32 bit ARM...
	got="$(gcc -dumpmachine)"
	case "$PKG_ARCH:$got" in
		amd64:x86_64*)
			;;
		armhf:arm-*gnueabihf)
			;;
		arm64:aarch64*)
			;;
		*)
			die "$PKG_DISTRO/$PKG_ARCH: the C compiler targets $got, which is not a $PKG_ARCH compiler"
			;;
	esac

	case "$PKG_FAMILY" in
		deb)
			got="$(dpkg --print-architecture)"
			[ "$got" = "$want_deb" ] \
				|| die "$PKG_DISTRO/$PKG_ARCH: dpkg reports $got, expected $want_deb"
			;;
		rpm)
			got="$(rpm --eval '%{_arch}')"
			[ "$got" = "$want_rpm" ] \
				|| die "$PKG_DISTRO/$PKG_ARCH: rpm reports $got, expected $want_rpm"
			;;
	esac

	log "container: $(uname -m), gcc $(gcc -dumpmachine), $(go version | awk '{print $3}')"
}

# The artifact itself is the last word: whatever the toolchain thought it was
# doing, the ELF header has to name the architecture the package is for.
verify_binary_arch() {
	local file="$1" want desc

	case "$PKG_ARCH" in
		amd64) want='x86-64' ;;
		armhf) want='ARM, EABI5' ;;
		arm64) want='aarch64' ;;
		*)     want='' ;;
	esac

	desc="$(file -b "$file")"
	case "$desc" in
		*"$want"*) log "built: $desc" ;;
		*) die "the binary is not $PKG_ARCH: $desc" ;;
	esac
}

# Everything both formats put on disk, so the two scripts cannot drift apart.
# $1 = staging root
stage_common_files() {
	local stage="$1"
	install -D -m 0755 "$WORK/aseqrc" "$stage/usr/bin/aseqrc"
	install -D -m 0644 "$PKG_SRC/etc/systemd-aseqrc.service" \
		"$stage/usr/lib/systemd/system/aseqrc.service"
	install -D -m 0644 "$PKG_SRC/etc/avahi-aseqrc.service" \
		"$stage/etc/avahi/services/aseqrc.service"
	install -d -m 0750 "$stage/var/lib/aseqrc"
}

write_buildinfo() {
	local dir="$1"
	shift
	mkdir -p "$dir"
	{
		printf 'built_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
		printf 'source_date_epoch=%s\n' "${PKG_SOURCE_DATE_EPOCH:-}"
		printf 'git_commit=%s\n' "${PKG_GIT_COMMIT:-unknown}"
		printf 'git_branch=%s\n' "${PKG_GIT_BRANCH:-unknown}"
		printf 'version=%s\n' "$PKG_VERSION"
		printf 'release=%s\n' "${PKG_RELEASE:-}"
		printf 'distro=%s\n' "$PKG_DISTRO"
		printf 'arch=%s\n' "$PKG_ARCH"
		printf 'platform=%s\n' "${PKG_PLATFORM:-}"
		printf 'builder_image=%s\n' "${PKG_BUILDER_IMAGE:-}"
		printf 'builder_id=%s\n' "${PKG_BUILDER_ID:-unknown}"
		printf 'go=%s\n' "$(go version | awk '{print $3}')"
		printf 'pie=%s\n' "${PKG_PIE:-0}"
		for line in "$@"; do
			printf '%s\n' "$line"
		done
	} > "$dir/BUILDINFO"
}
