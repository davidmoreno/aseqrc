#!/usr/bin/env bash
# ===========================================================================
#  Aggregates everything under out/ into out/SHA256SUMS and out/manifest.json.
#
#  usage: manifest.sh [outdir]
#
#  Every build script drops a BUILDINFO file next to the package it produced,
#  which is what makes the manifest more than a list of file names: it carries
#  the distribution, the architecture, the builder image, the resolved
#  dependencies and the sha256 of every artifact.
# ===========================================================================
set -Eeuo pipefail
source "$(dirname "$(readlink -f "$0")")/common.sh"

OUT="${1:-$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)/out}"
[ -d "$OUT" ] || die "no such directory: $OUT"

cd "$OUT"

# ------------------------------------------------------------------ checksums
find . -type f \( -name '*.deb' -o -name '*.rpm' \) | sort \
	| xargs -r sha256sum > SHA256SUMS

if [ ! -s SHA256SUMS ]; then
	warn "no packages found in $OUT, nothing to do"
	rm -f manifest.json
	exit 0
fi

json_escape() {
	local s="$1"
	s="${s//\\/\\\\}"
	s="${s//\"/\\\"}"
	s="${s//$'\t'/\\t}"
	printf '%s' "$s"
}

emit_object() {
	local info="$1" dir="$2" key value pkg first=1
	printf '    {\n'
	while IFS='=' read -r key value; do
		[ -n "$key" ] || continue
		if [ "$first" = 1 ]; then first=0; else printf ',\n'; fi
		printf '      "%s": "%s"' "$(json_escape "$key")" "$(json_escape "$value")"
	done < "$info"
	for pkg in "$dir"/*.deb "$dir"/*.rpm; do
		[ -e "$pkg" ] || continue
		printf ',\n      "path": "%s"' "$(json_escape "${pkg#./}")"
	done
	printf '\n    }'
}

# ------------------------------------------------------------------- manifest
{
	printf '{\n'
	printf '  "generated": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	printf '  "git_commit": "%s",\n' "$(json_escape "${GIT_COMMIT:-unknown}")"
	printf '  "packages": [\n'
	first=1
	while IFS= read -r info; do
		if [ "$first" = 1 ]; then first=0; else printf ',\n'; fi
		emit_object "$info" "$(dirname "$info")"
	done < <(find . -name BUILDINFO -type f | sort)
	if [ "$first" = 0 ]; then printf '\n'; fi
	printf '  ]\n'
	printf '}\n'
} > manifest.json

if command -v python3 >/dev/null 2>&1; then
	python3 -c 'import json,sys; json.load(open("manifest.json"))' \
		|| die "manifest.json is not valid JSON"
elif command -v jq >/dev/null 2>&1; then
	jq -e . manifest.json >/dev/null || die "manifest.json is not valid JSON"
fi

log "$(wc -l < SHA256SUMS) package(s):"
sed 's/^/    /' SHA256SUMS >&2
log "manifest.json written to $OUT/manifest.json"
