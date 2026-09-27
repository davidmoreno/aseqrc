#!/usr/bin/env bash
# ===========================================================================
#  Builds the Parcel/React bundle that the Go binary embeds.
#
#  Runs in a plain node container on the host architecture: the output is
#  JavaScript, byte identical everywhere, so there is no reason to rebuild it
#  once per distribution/architecture (which would mean running Parcel under
#  QEMU for every armhf and arm64 package).
# ===========================================================================
set -Eeuo pipefail
source "$(dirname "$(readlink -f "$0")")/common.sh"

require_env PKG_SRC PKG_OUT
: "${PKG_SRC:=/src}"
: "${PKG_OUT:=/out}"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/aseqrc-frontend.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
log "work tree: $WORK"

# Only the files the frontend build needs: the host's node_modules (if any)
# belongs to another machine's architecture and node version.
mkdir -p "$WORK/frontend"
tar -C "$PKG_SRC/frontend" -cf - \
	--exclude=./node_modules --exclude=./static --exclude=./.cache . \
	| tar -C "$WORK/frontend" -xf -

cd "$WORK/frontend"

log "yarn install"
if ! yarn install --frozen-lockfile --non-interactive; then
	warn "yarn.lock is out of date, retrying with a non frozen install"
	yarn install --non-interactive
fi

log "parcel build"
make build

[ -f static/index.html ] || die "parcel did not produce static/index.html"

rm -rf "$PKG_OUT/static"
cp -a static "$PKG_OUT/static"

files="$(find "$PKG_OUT/static" -type f | wc -l)"
size="$(du -sk --apparent-size "$PKG_OUT/static" | cut -f1)"
hash="$(cd "$PKG_OUT/static" && find . -type f -print0 | sort -z \
	| xargs -0 sha256sum | sha256sum | cut -c1-12)"

log "bundle: $files files, ${size} KiB, content hash $hash"
{
	printf 'files=%s\n' "$files"
	printf 'kib=%s\n' "$size"
	printf 'content_hash=%s\n' "$hash"
	printf 'node=%s\n' "$(node --version)"
	printf 'yarn=%s\n' "$(yarn --version)"
} > "$PKG_OUT/FRONTEND_BUILDINFO"

finalize_permissions "$PKG_OUT"
