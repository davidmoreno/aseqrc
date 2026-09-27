# aseqrc packaging

Docker based packaging for aseqrc. Every package is compiled *inside a container
of the distribution it is meant for*, so the compiler, the C library, the ALSA
headers and the packaging tools always match the target. Non native
architectures (armhf, arm64) run through `docker --platform`, i.e. QEMU/binfmt:
the container is a real userspace of that architecture, not a cross toolchain
with a hand made sysroot.

```
make deb DISTRO=ubuntu-26.04 ARCH=armhf     ->  out/deb/ubuntu-26.04/armhf/aseqrc_..._armhf.deb
make rpm DISTRO=fedora-44    ARCH=aarch64   ->  out/rpm/fedora-44/arm64/aseqrc-....aarch64.rpm
make all JOBS=4                             ->  the whole default matrix, both formats
```

`make help` lists every target, `make matrix` shows what `make all` would build,
`make doctor` checks that this host can build at all.

---

## 1. Requirements

| | |
|---|---|
| docker | 20.10 or newer (BuildKit), with a reachable daemon |
| qemu/binfmt | only for emulated architectures, see `make doctor` |
| disk | ~1 GiB of images per distribution plus the build caches |
| cpu | an emulated armhf/arm64 build is 5-10x slower than a native one |

```sh
make doctor                       # docker, binfmt, SELinux, disk, matrix
make doctor DEEP=1                # ... and actually start a container for the target
```

If `make doctor` complains about binfmt:

```sh
sudo docker run --privileged --rm tonistiigi/binfmt --install arm,arm64
# or, from the distribution:
sudo dnf install qemu-user-static        # Fedora
sudo apt install qemu-user-static binfmt-support   # Debian/Ubuntu
```

On an SELinux enforcing host (Fedora, RHEL) the containers are started with
`--security-opt label=disable`. Without it the bind mounted tree is not
writable from inside the container; the alternative, mounting with `:z`, would
relabel the working copy so that *host* processes could no longer read it.

---

## 2. Distributions and architectures

`DISTRO` is `<kind>-<version>` and maps directly to a container image
(`ubuntu-26.04` -> `ubuntu:26.04`). Both `DISTRO`/`ARCH` and the lower case
`distro`/`arch` spellings work.

| `DISTRO` | image | format | architectures |
|---|---|---|---|
| `ubuntu-<version>`, or plain `ubuntu` = `ubuntu-26.04` | `ubuntu:<version>` | `.deb` | amd64, armhf, arm64 |
| `debian-<version>`, or plain `debian` = `debian-13` | `debian:<version>` | `.deb` | amd64, armhf, arm64 |
| `fedora-<version>`, or plain `fedora` = `fedora-44` | `fedora:<version>` | `.rpm` | amd64, arm64 |

A version can be a codename as well (`DISTRO=debian-trixie`). Fedora has no 32
bit ARM since Fedora 36, so there is no `fedora-*/armhf`: the matrix skips it
and `make rpm DISTRO=fedora-44 ARCH=armhf` fails with an explanation.

`ARCH` accepts the usual aliases:

| `ARCH` | docker platform | deb arch | rpm arch | Go |
|---|---|---|---|---|
| `amd64`, `x86_64` | `linux/amd64` | amd64 | x86_64 | `GOARCH=amd64` |
| `armhf`, `armv7l`, `armv7`, `arm` | `linux/arm/v7` | armhf | armv7hl | `GOARCH=arm GOARM=7` |
| `arm64`, `aarch64` | `linux/arm64` | arm64 | aarch64 | `GOARCH=arm64` |

Adding a distribution is a few lines in `config.mk`: a `DISTRO_FAMILY_<kind>`
naming the package format, `ARCHES_<kind>`, a `DISTRO_SHORT_<kind>` tag used in
package versions, and a `DISTRO_LATEST_<kind>`. Anything else is derived from
the `DISTRO` string.

### `make all`

```
$ make matrix
DISTRO           ARCH    FORMAT STATUS
ubuntu-26.04     amd64   deb    ok
ubuntu-26.04     armhf   deb    ok
ubuntu-26.04     arm64   deb    ok
debian-13        amd64   deb    ok
debian-13        armhf   deb    ok
debian-13        arm64   deb    ok
fedora-44        amd64   rpm    ok
fedora-44        arm64    rpm   ok
```

That list is the `MATRIX` variable, so it is easy to change without touching
anything else:

```sh
make all                                   # 8 packages, one job at a time
make all JOBS=5                            # five at a time
make deb-all JOBS=5                        # only the .deb half
make all MATRIX="ubuntu-26.04/armhf"       # a single entry
make all MATRIX="alpine-3.22/amd64"        # (not a known kind -> error, loudly)
```

Builds that do not exist (a Fedora armhf) are reported and skipped; `STRICT=1`
turns that into an error. One log per target is left in `build/logs/`, which is
what you want when five emulated builds fail at once.

---

## 3. Targets

| target | what it does |
|---|---|
| `make deb [DISTRO=] [ARCH=]` | one `.deb` (ubuntu/debian) |
| `make rpm [DISTRO=] [ARCH=]` | one `.rpm` (fedora) |
| `make any` | one package, in whatever format the distribution speaks |
| `make all [JOBS=]` | the whole matrix, both formats, then `manifest` |
| `make deb-all` / `make rpm-all` | one format of the matrix |
| `make frontend` | (re)build the shared frontend bundle |
| `make manifest` | regenerate `out/SHA256SUMS` and `out/manifest.json` |
| `make matrix` | the matrix with its support status |
| `make list` | known distributions / architectures |
| `make version` | resolved versions, commit, go toolchain |
| `make doctor [DEEP=1]` | host readiness check |
| `make shell [DISTRO=] [ARCH=]` | interactive shell in the build container |
| `make images` | pre-build every build container of the matrix |
| `make clean` / `distclean` | drop `build/` / `build/` and `out/` |

---

## 4. Variables

| variable | default | meaning |
|---|---|---|
| `DISTRO` | `ubuntu-26.04` | target distribution, `<kind>-<version>` |
| `ARCH` | `amd64` | target architecture |
| `VERSION` | `git describe` | upstream version; `-` becomes `+`, leading `v` is dropped |
| `RELEASE` | `1` | package release/revision |
| `JOBS` | `1` | parallel targets for `make all` |
| `CACHE` | `0` | `1` keeps the Go module/build caches under `build/cache` |
| `PIE` | `1` | build position independent executables |
| `GO_SOURCE` | `upstream` | `upstream` uses the pinned Go tarball, `distro` the distribution package |
| `GO_VERSION` | `1.27.1` | upstream Go version |
| `EXTRA_PACKAGES` | | extra packages to install in the build container |
| `NODE_IMAGE` | `node:24-bookworm` | container used for the frontend bundle |
| `MATRIX` | see above | the `make all` matrix |
| `STRICT` | `0` | `1` fails if a matrix entry cannot be built |
| `DOCKER` | `docker` | docker binary |
| `OUT_DIR`, `BUILD_DIR` | `packaging/out`, `packaging/build` | output and scratch |
| `GOARM_armhf` | `7` | `6` for ARMv6 boards (Raspberry Pi 1 / Zero) |
| `DOCKER_RUN_EXTRA` | | extra flags for every `docker run` |

Examples:

```sh
make deb DISTRO=ubuntu-26.04 ARCH=armhf
make rpm DISTRO=fedora-44 ARCH=aarch64
make deb DISTRO=debian-13 ARCH=x86_64 VERSION=1.0.0 RELEASE=2
make deb DISTRO=debian-13 GO_SOURCE=distro        # no Go download, offline builds
make deb DISTRO=debian-13 CACHE=1                 # much faster rebuilds
make deb DISTRO=debian-13 GOARM_armhf=6 ARCH=armhf # ARMv6 (Pi 1/Zero)
```

---

## 5. What goes into a package

Both formats install the same runtime layout:

```
/usr/bin/aseqrc                          the Go binary, frontend embedded
/usr/lib/systemd/system/aseqrc.service   enabled and started by the scripts
/etc/avahi/services/aseqrc.service       mDNS advertisement (config file, kept on upgrade)
/var/lib/aseqrc/                         state directory, owned by aseqrc:aseqrc (0750)
/usr/share/doc/aseqrc/…                  README (rpm) / copyright (deb)
```

An `aseqrc` system user and group are created on install (the deb uses
`adduser` and removes them on purge; the rpm uses `useradd` in `%pre` and leaves
them behind, as Fedora packaging policy recommends). The account is added to the
`audio` group, which is what it needs to reach the ALSA sequencer and the raw
MIDI devices.

The systemd unit is not a "static" unit: the scripts run
`systemctl enable --now`-equivalent steps, and `AmbientCapabilities=CAP_NET_BIND_SERVICE`
in the unit is what lets the unprivileged account bind port 80.

Dependencies are not hard coded: the deb runs `dpkg-shlibdeps` against the
staged binary inside the target container (that is how `libasound2` versus the
renamed `libasound2t64` on Ubuntu 24.04+ and Debian 13 comes out right), and the
rpm relies on rpmbuild's automatic ELF dependency generator
(`libasound.so.2()(64bit)`, `libc.so.6(GLIBC_2.34)(64bit)`, …).

---

## 6. How a build works

```
    host                                container (target distro + arch)
    ────                                ───────────────────────────────
    make frontend  ─────────────────►   node:24-bookworm (native, once)
                                        yarn install && parcel build
                        build/frontend/static  ──┐  (architecture independent)
                                                 │
    make deb|rpm ───► docker build --platform …  │  builder image with gcc,
                       (build-essential,         │  libasound2-dev, dpkg-dev / rpm-build, Go
                        libasound2-dev, …)       │
                     docker run ─────────────────┴─► build-deb.sh / build-rpm.sh
                                                      copy backend/ to a scratch tree
                                                      graft in the frontend bundle
                                                      go build (cgo, ALSA, sqlite)
                                                      stage, resolve deps, package
                        out/<fmt>/<distro>/<arch>/ ◄──
```

Two deliberate decisions:

* **The frontend is built once, natively.** The Parcel bundle is JavaScript and
  byte identical on every architecture; rebuilding it under QEMU for every armhf
  package would multiply the slowest part of the build by the number of targets.
  Only the Go compile happens in the emulated container.
* **The package is assembled from a staging tree** (`dpkg-deb --build`,
  `rpmbuild -bb` of a binary-only spec) instead of going through debhelper or a
  full source rpm. That keeps the armhf/arm64 builds to a single Go compile, and
  it leaves the repository's own `debian/` directory and the top level
  `make deb` (dpkg-buildpackage) exactly as they were. The metadata that matters
  — dependencies — is still generated by the target's own tools.

### Cross compilation

`docker run --platform linux/arm/v7` is used rather than a cross toolchain
because cgo is involved (go-sqlite3 and the ALSA bindings) and because the
packages need target-native metadata: `dpkg-shlibdeps`, rpm's ELF dependency
generator and the `Architecture:` field all have to run as the target
architecture. With emulation there is no sysroot to get wrong, no
`dpkg --add-architecture` plus ports-mirror plumbing for Ubuntu armhf, and
Fedora's missing armhf problem never comes up. The price is CPU time.

The `--platform` flag is not enough on its own: docker keeps one image per tag,
so a base image pulled for another architecture can be silently reused
(BuildKit only prints `InvalidBaseImagePlatform`). Every build therefore pulls
the base image for the right platform (`docker build --pull --platform …`) and
then verifies inside the container that `uname -m`, `gcc -dumpmachine`, the
native package manager and, as a last line of defence, the ELF header of the
finished binary all agree with the requested architecture.

### Reproducibility

`SOURCE_DATE_EPOCH` is taken from the last commit, the Go build uses `-trimpath`
and the archives are built with a fixed owner (`--root-owner-group`) and
compressor. Versions come from `git describe`. Two runs of the same target
produce the same sha256, with or without a warm build cache.

---

## 7. Output

```
out/
├── deb/
│   ├── ubuntu-26.04/amd64/aseqrc_23.09+7+gcd8e7cc-1~ubuntu2604_amd64.deb
│   │                       └── BUILDINFO
│   └── debian-13/armhf/…
├── rpm/
│   └── fedora-44/arm64/aseqrc-23.09+7+gcd8e7cc-1.fc44.aarch64.rpm
│                       └── BUILDINFO
├── SHA256SUMS
└── manifest.json
```

The distro is part of the version string, so two `.deb` files with different
dependencies can never look interchangeable: `1~ubuntu2604`, `1~deb13`, and
`1.fc44` for rpm (through `%{?dist}`).

`BUILDINFO` (and therefore `manifest.json`) records distribution,
architecture, builder image and its digest, the Go toolchain, the resolved
dependencies, size and sha256 of every artifact, plus the commit:

```json
{
  "distro": "ubuntu-26.04",
  "arch": "armhf",
  "platform": "linux/arm/v7",
  "builder_image": "aseqrc-builder:deb-ubuntu-26.04-armhf-upstream1.27.1",
  "builder_id": "sha256:f3c6c5ad8ebe…",
  "depends": "libasound2t64 (>= 1.0.16), libc6 (>= 2.34), adduser",
  "sha256_deb": "99e383a35…",
  "path": "deb/ubuntu-26.04/armhf/aseqrc_…_armhf.deb"
}
```

`out/` is a plain directory tree: `rsync` it to a web server and it is already
usable with `apt` (`deb/…`) or `dnf` (`rpm/…`) if you generate the repository
metadata from it (`dpkg-scanpackages`, `createrepo_c`).

---

## 8. When something goes wrong

**`InvalidBaseImagePlatform` / assembler errors like `bad instruction 'stp …'`**
A base image of the wrong architecture was reused. The build now fails with
`this container is armv7l, expected aarch64`, but to clear the stale image:

```sh
docker rmi ubuntu:26.04        # or whatever PKG_IMAGE the message names
```

**`dpkg-shlibdeps` or `rpmbuild` errors** — rerun the target with
`make shell DISTRO=… ARCH=…` and try it by hand; everything is also in
`build/logs/<distro>-<arch>.log`.

**A build is slow.** `CACHE=1` keeps `/go/pkg/mod` and the per-architecture
build cache between runs (34s -> 6s for a native rebuild, much more for an
emulated one). `GO_SOURCE=distro` avoids downloading a Go toolchain. The
builder images themselves are layer cached: `make images` pre-warms them.

**The frontend is not rebuilt** — it is cached by a content hash of
`frontend/{package.json,yarn.lock,src,icons,img,…}`. `make clean` drops it.

**`make all` in parallel printed an interleaved mess** — every target's output
is in its own file under `build/logs/`.

---

## 9. Notes for maintainers

* `packaging/` is self contained: the existing `debian/` (used by the root
  `make deb`, dpkg-buildpackage/dh) is untouched, and root `Makefile` gained
  `packages`, `deb-docker`, `rpm` and `packaging-help` passthroughs.
* The rpm spec is binary-only on purpose (`packaging/rpm/aseqrc.spec`); the Go
  build happens in `scripts/build-rpm.sh`. A source rpm for a distribution
  submission would want the usual `%build` with `BuildRequires: golang`, which
  is a different exercise.
* The frontend bundle is the same for every architecture. If that ever stops
  being true (native node modules, for instance), build it per target by
  mounting the tree instead of `build/frontend` in `run_pkg_builder`.
* `packaging/scripts/*.sh` must stay executable: git tracks that bit and the
  containers execute them directly.
