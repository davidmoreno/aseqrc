#!/usr/bin/env bash
# ===========================================================================
#  Runs the `make all` matrix.
#
#  usage: matrix-run.sh <make> <jobs> <all|deb|rpm> <distro/arch/format[/UNSUPPORTED]>...
#
#  Entries flagged UNSUPPORTED are combinations that simply do not exist (a
#  Fedora armhf, for instance): they are reported and skipped, unless STRICT=1
#  turns that into an error.  One log per target ends up in build/logs/.
# ===========================================================================
set -Eeuo pipefail
source "$(dirname "$(readlink -f "$0")")/common.sh"

MAKE_CMD="${1:?usage: matrix-run.sh <make> <jobs> <all|deb|rpm> <entries...>}"
JOBS="${2:-1}"
FILTER="${3:-all}"
shift 3 || true

PKG_ROOT="${PKG_ROOT:-$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)}"
LOGDIR="${LOGDIR:-$PKG_ROOT/build/logs}"
STRICT="${STRICT:-0}"
mkdir -p "$LOGDIR"
export MAKE_CMD PKG_ROOT LOGDIR STRICT

plan=()
skipped=()

for e in "$@"; do
	IFS='/' read -r d a f extra <<<"$e"
	name="$d/$a"
	if [ -n "$extra" ]; then
		skipped+=("$name	not published for this architecture")
		continue
	fi
	if [ "$f" = SKIP ]; then
		skipped+=("$name	unknown distribution")
		continue
	fi
	if [ "$FILTER" != all ] && [ "$f" != "$FILTER" ]; then
		continue
	fi
	plan+=("$d $a $f")
done

if [ ${#skipped[@]} -gt 0 ]; then
	while IFS=$'\t' read -r name why; do
		warn "skipping $name: $why"
	done < <(printf '%s\n' "${skipped[@]}")
	if [ "$STRICT" = 1 ]; then
		die "STRICT=1 and $((${#skipped[@]})) matrix entries cannot be built"
	fi
fi

if [ ${#plan[@]} -eq 0 ]; then
	die "nothing to build (filter '$FILTER')"
fi

artifact_of() {
	local dir
	dir="$(find "$PKG_ROOT/out" -type d -path "*/$1/$2" 2>/dev/null | head -n1)"
	[ -n "$dir" ] || return 0
	ls "$dir"/*.deb "$dir"/*.rpm 2>/dev/null | head -n1 | sed "s|$PKG_ROOT/||"
}

run_one() {
	local d="$1" a="$2" f="$3"
	local name="$d/$a" log="$LOGDIR/$d-$a.log"
	{
		printf '===== %s : make %s DISTRO=%s ARCH=%s =====\n' \
			"$name" "$f" "$d" "$a"
		date -u +'started %Y-%m-%dT%H:%M:%SZ'
	} > "$log"
	if "$MAKE_CMD" -C "$PKG_ROOT" --no-print-directory "$f" \
			DISTRO="$d" ARCH="$a" >>"$log" 2>&1; then
		printf '  %-24s %-4s ok       %s\n' "$name" "$f" "$(artifact_of "$d" "$a")"
		return 0
	fi
	printf '  %-24s %-4s FAILED\n' "$name" "$f"
	printf '  ---- %s (last 30 lines) ----\n' "$log"
	tail -n 30 "$log" | sed 's/^/  | /'
	return 1
}
export -f run_one artifact_of

printf '==> building %s across %s target(s), %s parallel job(s)\n' \
	"${#plan[@]} package(s)" "${#plan[@]}" "$JOBS"

status=0
if [ "$JOBS" -le 1 ]; then
	for entry in "${plan[@]}"; do
		read -r d a f <<<"$entry"
		run_one "$d" "$a" "$f" || { status=1; break; }
	done
else
	printf '%s\n' "${plan[@]}" \
		| xargs -P "$JOBS" -n 3 bash -c 'run_one "$@"' _ || status=1
fi

printf '\n==> artifacts in %s:\n' "$PKG_ROOT/out"
find "$PKG_ROOT/out" -type f \( -name '*.deb' -o -name '*.rpm' \) 2>/dev/null \
	| sort | sed "s|$PKG_ROOT/||; s|^|    |"

exit "$status"
