# ===========================================================================
#  packaging/config.mk
#
#  Distribution / architecture registry and the derived build metadata used by
#  packaging/Makefile.  Everything here can be overridden from the command
#  line, for example:
#
#      make deb DISTRO=debian-13 ARCH=arm64 VERSION=1.2.3 RELEASE=2
#
# ===========================================================================

PKG_ROOT  ?= $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
REPO_ROOT ?= $(abspath $(PKG_ROOT)/..)

BUILD_DIR    ?= $(PKG_ROOT)/build
OUT_DIR      ?= $(PKG_ROOT)/out
FRONTEND_DIR ?= $(BUILD_DIR)/frontend

# Where the build containers see the tree.
CTR_SRC      := /src
CTR_FRONTEND := /frontend
CTR_OUT      := /out

# -------------------------------------------------------------- the defaults
DEFAULT_DISTRO ?= ubuntu-26.04
DEFAULT_ARCH   ?= amd64

# A bare `DISTRO=ubuntu` resolves to the newest release we know about.
DISTRO_LATEST_ubuntu ?= 26.04
DISTRO_LATEST_debian ?= 13
DISTRO_LATEST_fedora ?= 44

KNOWN_DISTRO_KINDS ?= ubuntu debian fedora

# Which package format each distribution kind speaks, and the short tag used to
# disambiguate packages built for different releases of the same distribution.
DISTRO_FAMILY_ubuntu ?= deb
DISTRO_FAMILY_debian ?= deb
DISTRO_FAMILY_fedora ?= rpm

DISTRO_SHORT_ubuntu ?= ubuntu
DISTRO_SHORT_debian ?= deb
DISTRO_SHORT_fedora ?= fc

# ------------------------------------------------------------------ archives
#
# Fedora dropped 32 bit ARM after Fedora 36, so there simply is no Fedora armhf
# to build for.  Ubuntu and Debian still publish arm/v7 (armhf) images.
#
ARCHES_ubuntu ?= amd64 armhf arm64
ARCHES_debian ?= amd64 armhf arm64
ARCHES_fedora ?= amd64 arm64

# Fallback per package format, for distributions not listed above.
ARCHES_deb ?= amd64 armhf arm64
ARCHES_rpm ?= amd64 arm64

# ------------------------------------------------------- architecture mapping
PLATFORM_amd64 ?= linux/amd64
PLATFORM_armhf ?= linux/arm/v7
PLATFORM_arm64 ?= linux/arm64

DEBARCH_amd64 ?= amd64
DEBARCH_armhf ?= armhf
DEBARCH_arm64 ?= arm64

RPMARCH_amd64 ?= x86_64
RPMARCH_armhf ?= armv7hl
RPMARCH_arm64 ?= aarch64

GOARCH_amd64 ?= amd64
GOARCH_armhf ?= arm
GOARCH_arm64 ?= arm64
GOARM_armhf  ?= 7

# Architecture names used by the Go release tarballs on https://go.dev/dl.
GOTARBALL_amd64 ?= amd64
GOTARBALL_armhf ?= armv6l
GOTARBALL_arm64 ?= arm64

# Aliases people actually type.
ARCH_ALIAS_amd64   ?= amd64
ARCH_ALIAS_x86_64  ?= amd64
ARCH_ALIAS_x86-64  ?= amd64
ARCH_ALIAS_armhf   ?= armhf
ARCH_ALIAS_armv7l  ?= armhf
ARCH_ALIAS_armv7   ?= armhf
ARCH_ALIAS_arm     ?= armhf
ARCH_ALIAS_arm64   ?= arm64
ARCH_ALIAS_aarch64 ?= arm64

# ------------------------------------------------------------- make helpers
DISTRO_KIND_OF   = $(firstword $(subst -, ,$(1)))
DISTRO_FAMILY_OF = $(DISTRO_FAMILY_$(call DISTRO_KIND_OF,$(1)))
DISTRO_IMAGE_OF  = $(call DISTRO_KIND_OF,$(1)):$(patsubst $(call DISTRO_KIND_OF,$(1))-%,%,$(1))

# $(call ARCH_SUPPORTED,ubuntu-26.04,armhf) -> non empty when the combination
# is one that the distribution actually publishes.
ARCH_SUPPORTED = $(filter $(2),$(or $(ARCHES_$(call DISTRO_KIND_OF,$(1))),$(ARCHES_$(call DISTRO_FAMILY_OF,$(1)))))

# ------------------------------------------------------------- the requested
# Both spellings are accepted, DISTRO/ARCH and distro/arch.
DISTRO_IN ?= $(or $(DISTRO),$(distro),$(DEFAULT_DISTRO))
ARCH_IN   ?= $(or $(ARCH),$(arch),$(DEFAULT_ARCH))

D_KIND := $(call DISTRO_KIND_OF,$(DISTRO_IN))
D_VER  := $(patsubst $(D_KIND)-%,%,$(DISTRO_IN))
ifeq ($(D_VER),$(D_KIND))
D_VER  := $(DISTRO_LATEST_$(D_KIND))
endif

RES_DISTRO   := $(D_KIND)-$(D_VER)
RES_IMAGE    := $(D_KIND):$(D_VER)
RES_FAMILY   := $(DISTRO_FAMILY_$(D_KIND))
RES_SHORT    := $(or $(DISTRO_SHORT_$(D_KIND)),$(D_KIND))
RES_ARCH     := $(or $(ARCH_ALIAS_$(ARCH_IN)),$(ARCH_IN))

RES_PLATFORM := $(PLATFORM_$(RES_ARCH))
RES_DEBARCH  := $(DEBARCH_$(RES_ARCH))
RES_RPMARCH  := $(RPMARCH_$(RES_ARCH))
RES_GOARCH   := $(GOARCH_$(RES_ARCH))
RES_GOARM    := $(GOARM_$(RES_ARCH))
RES_GOTARBALL := $(GOTARBALL_$(RES_ARCH))
RES_ARCHES   := $(or $(ARCHES_$(D_KIND)),$(ARCHES_$(RES_FAMILY)))

# -------------------------------------------------------------- the versions
GIT_DESCRIBE ?= $(shell cd $(REPO_ROOT) 2>/dev/null && git describe --tags --always --dirty 2>/dev/null)
GIT_COMMIT   ?= $(shell cd $(REPO_ROOT) 2>/dev/null && git rev-parse --short=12 HEAD 2>/dev/null || echo unknown)
GIT_BRANCH   ?= $(shell cd $(REPO_ROOT) 2>/dev/null && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)

# Neither dpkg nor rpm likes '-' in a version (rpm uses it to separate version
# from release), while git describe is full of them, so
# v23.09-7-gcd8e7cc-dirty becomes 23.09+7+gcd8e7cc+dirty.
VERSION ?= $(patsubst v%,%,$(subst -,+,$(GIT_DESCRIBE)))
VERSION := $(if $(strip $(VERSION)),$(VERSION),0.0.0)
RELEASE ?= 1

SOURCE_DATE_EPOCH ?= $(shell cd $(REPO_ROOT) 2>/dev/null && git log -1 --format=%ct 2>/dev/null || date +%s)

# Distro tag keeps packages built for different releases of the same
# distribution apart: 1~ubuntu2604, 1~deb13, and 1.fc44 for rpm (via %dist).
DISTRO_TAG  ?= $(RES_SHORT)$(subst .,,$(D_VER))
DEB_VERSION ?= $(VERSION)-$(RELEASE)~$(DISTRO_TAG)
RPM_RELEASE ?= $(RELEASE)

# ------------------------------------------------------------------ container
DOCKER           ?= docker
DOCKER_BUILDKIT  ?= 1
DOCKER_RUN_EXTRA ?=
NODE_IMAGE       ?= node:24-bookworm
GO_SOURCE        ?= upstream
GO_VERSION       ?= 1.27.1
EXTRA_PACKAGES   ?=
BUILDER_PREFIX   ?= aseqrc-builder

# 1 = position independent executables (what modern distributions expect).
PIE   ?= 1
# Parallel package builds for `make all`.
JOBS  ?= 1
# 1 = keep the Go module and build caches under build/ between runs.
CACHE ?= 0

HOST_UID ?= $(shell id -u)
HOST_GID ?= $(shell id -g)

# On an SELinux enforcing host a plain bind mount is not writable from inside
# the container.  Relabelling the whole source tree (`:z`) would lock the user
# out of their own repository, so the container simply runs unconfined instead.
SELINUX_STATUS ?= $(shell getenforce 2>/dev/null || true)
SELINUX_OPT    ?= $(if $(filter Enforcing,$(SELINUX_STATUS)),--security-opt label=disable,)

# The toolchain is part of the image identity: switching GO_SOURCE must not
# silently reuse an image built with the other one.
RES_BUILDER_IMAGE := $(BUILDER_PREFIX):$(RES_FAMILY)-$(RES_DISTRO)-$(RES_ARCH)-$(GO_SOURCE)$(GO_VERSION)

# ---------------------------------------------------------- frontend bundle
#
# The Parcel bundle is JavaScript: identical on every architecture and every
# distribution.  It is built once, natively, and reused for every target so the
# slow armhf/arm64 emulated containers only ever have to run the Go compiler.
FRONTEND_HASH_INPUTS := Makefile .babelrc package.json tsconfig.json yarn.lock src icons img
FRONTEND_HASH := $(shell cd $(REPO_ROOT)/frontend 2>/dev/null && \
	find $(FRONTEND_HASH_INPUTS) -type f -print0 2>/dev/null | sort -z | \
	xargs -0 sha256sum 2>/dev/null | sha256sum | cut -c1-12)
FRONTEND_STAMP := $(FRONTEND_DIR)/.stamp-$(FRONTEND_HASH)

# ------------------------------------------------------------------ the matrix
#
# What `make all` builds: the current releases people actually run.  armhf only
# where it exists (Raspberry Pi OS 32 bit), arm64 everywhere.
MATRIX ?= \
	ubuntu-26.04/amd64 ubuntu-26.04/armhf ubuntu-26.04/arm64 \
	debian-13/amd64    debian-13/armhf    debian-13/arm64 \
	fedora-44/amd64    fedora-44/arm64

# distro/arch/format[/UNSUPPORTED] for every matrix entry.  matrix-run.sh turns
# these into builds, skipping (or failing on, with STRICT=1) the ones that do
# not exist.
ALL_ENTRIES := $(foreach e,$(MATRIX),\
	$(e)/$(or $(call DISTRO_FAMILY_OF,$(firstword $(subst /, ,$(e)))),SKIP)\
	$(if $(call ARCH_SUPPORTED,$(firstword $(subst /, ,$(e))),$(lastword $(subst /, ,$(e)))),,/UNSUPPORTED))
