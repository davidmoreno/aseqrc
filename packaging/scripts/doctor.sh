#!/usr/bin/env bash
# ===========================================================================
#  Checks that this host can build packages with packaging/Makefile.
#
#  Called by `make doctor`; the interesting values come in through DO_*
#  environment variables.  DEEP=1 additionally starts a container for the
#  requested distribution/architecture to prove that the QEMU handlers really
#  work (slower, but it is the only way to be sure).
# ===========================================================================
set -uo pipefail

DO_DOCKER="${DO_DOCKER:-docker}"
DO_DISTRO="${DO_DISTRO:-ubuntu-26.04}"
DO_ARCH="${DO_ARCH:-amd64}"
DO_PLATFORM="${DO_PLATFORM:-linux/amd64}"
DO_IMAGE="${DO_IMAGE:-ubuntu:26.04}"
DO_FAMILY="${DO_FAMILY:-deb}"
DO_SUPPORTED="${DO_SUPPORTED:-1}"
DO_ARCHES="${DO_ARCHES:-}"
DO_DEEP="${DO_DEEP:-0}"
DO_MATRIX="${DO_MATRIX:-}"
DO_SELINUX="${DO_SELINUX:-}"
DO_GO="${DO_GO:-upstream 1.27.1}"
DO_NODE_IMAGE="${DO_NODE_IMAGE:-node:24-bookworm}"
DO_PKG_ROOT="${DO_PKG_ROOT:-$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)}"
DO_OUT="${DO_OUT:-$DO_PKG_ROOT/out}"
DO_CACHE="${DO_CACHE:-0}"

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
	R=$'\033[1;31m'; Y=$'\033[1;33m'; G=$'\033[1;32m'; B=$'\033[1;34m'; N=$'\033[0m'
else
	R=''; Y=''; G=''; B=''; N=''
fi

fails=0
warns=0

ok()   { printf '  %sok%s    %s\n'   "$G" "$N" "$*"; }
bad()  { printf '  %sFAIL%s  %s\n'   "$R" "$N" "$*"; fails=$((fails + 1)); }
meh()  { printf '  %swarn%s  %s\n'   "$Y" "$N" "$*"; warns=$((warns + 1)); }
section() { printf '\n%s%s%s\n' "$B" "$*" "$N"; }

section "target"
printf '  distribution  %s\n' "$DO_DISTRO"
printf '  architecture  %s (%s)\n' "$DO_ARCH" "$DO_PLATFORM"
printf '  image         %s\n' "$DO_IMAGE"
printf '  format        %s\n' "$DO_FAMILY"
if [ "$DO_SUPPORTED" = 1 ]; then
	ok "combination published by the distribution"
else
	bad "$DO_DISTRO is not published for $DO_ARCH (available: $DO_ARCHES)"
fi
printf '  go            %s\n' "$DO_GO"
printf '  frontend      %s\n' "$DO_NODE_IMAGE"
printf '  out           %s\n' "$DO_OUT"

section "docker"
if ! command -v "$DO_DOCKER" >/dev/null 2>&1; then
	bad "'$DO_DOCKER' not found in PATH"
else
	ok "$(command -v "$DO_DOCKER")"
	if version="$("$DO_DOCKER" version --format '{{.Server.Version}}' 2>/dev/null)"; then
		ok "daemon reachable, version $version"
	else
		bad "cannot talk to the docker daemon (is it running? are you in the docker group?)"
	fi
	if buildx="$("$DO_DOCKER" buildx version 2>/dev/null)"; then
		ok "buildx: $buildx"
	else
		meh "no buildx; plain 'docker build' is enough for this Makefile"
	fi
fi

section "qemu / binfmt"
# A platform needs the qemu handler registered, otherwise docker silently
# refuses to start the container (or, worse, execs it natively and fails).
need_handlers=""
binfmt_fail=0
case "$DO_PLATFORM" in
	linux/arm/v7) need_handlers="qemu-arm" ;;
	linux/arm64)  need_handlers="qemu-aarch64" ;;
	linux/amd64)  need_handlers="" ;;
esac
for h in $need_handlers; do
	if [ -f "/proc/sys/fs/binfmt_misc/$h" ]; then
		ok "$h registered"
	else
		bad "$h is not registered: $DO_PLATFORM containers cannot run"
		binfmt_fail=1
	fi
done
if [ -z "$need_handlers" ]; then
	ok "native architecture, no emulation needed"
elif [ "$binfmt_fail" = 1 ]; then
	printf '        install with: %s\n' \
		"sudo $DO_DOCKER run --privileged --rm tonistiigi/binfmt --install arm,arm64"
	printf '        or:           %s\n' \
		"sudo dnf install qemu-user-static  /  sudo apt install qemu-user-static binfmt-support"
fi

if [ "$DO_DEEP" = 1 ]; then
	section "deep check ($DO_IMAGE on $DO_PLATFORM)"
	if out="$("$DO_DOCKER" run --rm --platform "$DO_PLATFORM" "$DO_IMAGE" \
			sh -c 'echo "$(uname -m) $(grep -o "VERSION_ID=.*" /etc/os-release)"')"; then
		ok "container starts: $out"
	else
		bad "container failed to start ($DO_IMAGE on $DO_PLATFORM)"
	fi
fi

section "selinux"
case "$DO_SELINUX" in
	Enforcing)
		ok "Enforcing: the containers run with --security-opt label=disable"
		printf '        (bind mounts would not be writable otherwise, and :z would\n'
		printf '         relabel your working copy)\n'
		;;
	Permissive) meh "Permissive" ;;
	"")         ok "not enabled" ;;
	*)          ok "$DO_SELINUX" ;;
esac

section "host"
if command -v make >/dev/null 2>&1; then
	ok "$(make --version | head -n1)"
fi
for dir in "$DO_PKG_ROOT" "$DO_OUT" "$DO_PKG_ROOT/build"; do
	if mkdir -p "$dir" 2>/dev/null && [ -w "$dir" ]; then
		ok "writable: $dir"
	else
		bad "not writable: $dir"
	fi
done
avail="$(df -Pk "$DO_PKG_ROOT" 2>/dev/null | awk 'NR==2 {print $4}')"
if [ -n "$avail" ]; then
	if [ "$avail" -lt 5000000 ]; then
		meh "only $((avail / 1024)) MiB free: a build container is a few hundred MiB, plus QEMU caches"
	else
		ok "$((avail / 1024 / 1024)) GiB free"
	fi
fi
if [ "$DO_CACHE" = 1 ]; then
	ok "Go caches persist under $DO_PKG_ROOT/build/cache"
fi

section "scripts"
for s in "$DO_PKG_ROOT"/scripts/*.sh; do
	if [ -x "$s" ]; then
		ok "executable: ${s#"$DO_PKG_ROOT"/}"
	else
		bad "not executable: ${s#"$DO_PKG_ROOT"/} (chmod +x it, git keeps the mode)"
	fi
done

if [ -n "$DO_MATRIX" ]; then
	section "matrix"
	for e in $DO_MATRIX; do
		IFS='/' read -r d a f extra <<<"$e"
		if [ -n "$extra" ]; then
			printf '  %sskip%s  %-16s %-7s %s\n' "$Y" "$N" "$d" "$a" "not published"
		else
			printf '  %sok%s    %-16s %-7s %s\n' "$G" "$N" "$d" "$a" "$f"
		fi
	done
fi

printf '\n'
if [ "$fails" -gt 0 ]; then
	printf '%s%d problem(s)%s, %d warning(s). Cannot build yet.\n' "$R" "$fails" "$N" "$warns"
	exit 1
fi
printf '%sready%s to build %s/%s (%d warning(s)).\n' "$G" "$N" "$DO_DISTRO" "$DO_ARCH" "$warns"
printf 'try: make deb DISTRO=%s ARCH=%s\n' "$DO_DISTRO" "$DO_ARCH"
