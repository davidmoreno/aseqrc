# ===========================================================================
#  aseqrc -- docker based packaging
#
#      make deb DISTRO=ubuntu-26.04 ARCH=armhf
#      make rpm DISTRO=fedora-44    ARCH=aarch64
#      make all JOBS=4
#      make help
#
#  Every package is compiled inside a container of the distribution it is meant
#  for, so the compiler, the C library, the ALSA headers and the packaging tools
#  always match the target.  Non native architectures go through
#  docker --platform (QEMU/binfmt), which gives a real userspace for armhf and
#  arm64 instead of a cross toolchain with a hand made sysroot.
#
#  See README.md next to this file.
# ===========================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

PKG_ROOT  := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
REPO_ROOT := $(abspath $(PKG_ROOT)/..)

include $(PKG_ROOT)/config.mk

# --------------------------------------------------------------------------
#  plumbing
# --------------------------------------------------------------------------
CTR_GOMOD   := /go/pkg/mod
CTR_GOCACHE := /go/cache

ifeq ($(CACHE),1)
CACHE_MOUNTS := -v $(BUILD_DIR)/cache/gomod:$(CTR_GOMOD) \
                -v $(BUILD_DIR)/cache/gobuild-$(RES_ARCH):$(CTR_GOCACHE)
PKG_CHOWN_EXTRA := $(CTR_GOMOD) $(CTR_GOCACHE)
else
CACHE_MOUNTS :=
PKG_CHOWN_EXTRA :=
endif

PKG_ENV := \
	-e PKG_DISTRO=$(RES_DISTRO) \
	-e PKG_IMAGE=$(RES_IMAGE) \
	-e PKG_FAMILY=$(RES_FAMILY) \
	-e PKG_ARCH=$(RES_ARCH) \
	-e PKG_DEBARCH=$(RES_DEBARCH) \
	-e PKG_RPMARCH=$(RES_RPMARCH) \
	-e PKG_GOARCH=$(RES_GOARCH) \
	-e PKG_GOARM=$(RES_GOARM) \
	-e PKG_VERSION=$(VERSION) \
	-e PKG_RELEASE=$(RELEASE) \
	-e PKG_DEB_VERSION=$(DEB_VERSION) \
	-e PKG_DISTRO_TAG=$(DISTRO_TAG) \
	-e PKG_GIT_COMMIT=$(GIT_COMMIT) \
	-e PKG_GIT_BRANCH=$(GIT_BRANCH) \
	-e PKG_SOURCE_DATE_EPOCH=$(SOURCE_DATE_EPOCH) \
	-e PKG_PLATFORM=$(RES_PLATFORM) \
	-e PKG_PIE=$(PIE) \
	-e PKG_SRC=$(CTR_SRC) \
	-e PKG_FRONTEND=$(CTR_FRONTEND) \
	-e PKG_OUT=$(CTR_OUT) \
	-e PKG_HOST_UID=$(HOST_UID) \
	-e PKG_HOST_GID=$(HOST_GID) \
	-e PKG_CHOWN_EXTRA="$(PKG_CHOWN_EXTRA)" \
	-e PKG_BUILDER_IMAGE=$(RES_BUILDER_IMAGE)

# One image per distribution/architecture holding all the build dependencies.
# Docker's layer cache does the heavy lifting; --pull re-resolves the base image
# for the requested platform, which is what keeps a base image pulled for
# another architecture from being reused for this one (docker keeps a single
# image per tag, and buildkit only warns about the mismatch).
define build_builder_image
@echo "==> $(RES_DISTRO)/$(RES_ARCH): build container $(RES_BUILDER_IMAGE)"; \
DOCKER_BUILDKIT=$(DOCKER_BUILDKIT) $(DOCKER) build \
	--pull \
	--platform $(RES_PLATFORM) \
	--build-arg=BASE_IMAGE=$(RES_IMAGE) \
	--build-arg=GO_SOURCE=$(GO_SOURCE) \
	--build-arg=GO_VERSION=$(GO_VERSION) \
	--build-arg=GO_TARBALL_ARCH=$(RES_GOTARBALL) \
	"--build-arg=EXTRA_PACKAGES=$(EXTRA_PACKAGES)" \
	-t $(RES_BUILDER_IMAGE) \
	-f $(PKG_ROOT)/docker/Dockerfile.$(RES_FAMILY) \
	$(PKG_ROOT)/docker
endef

define run_pkg_builder
@echo "==> $(RES_DISTRO)/$(RES_ARCH): building $(RES_FAMILY) package"; \
$(DOCKER) run --rm --platform $(RES_PLATFORM) $(SELINUX_OPT) $(DOCKER_RUN_EXTRA) \
	$(PKG_ENV) \
	-e PKG_BUILDER_ID="$$($(DOCKER) image inspect -f '{{.Id}}' $(RES_BUILDER_IMAGE) 2>/dev/null || echo unknown)" \
	$(CACHE_MOUNTS) \
	-v $(REPO_ROOT):$(CTR_SRC):ro \
	-v $(FRONTEND_DIR):$(CTR_FRONTEND):ro \
	-v $(OUT_DIR):$(CTR_OUT) \
	-w /tmp \
	$(RES_BUILDER_IMAGE) \
	$(CTR_SRC)/packaging/scripts/build-$(RES_FAMILY).sh
endef

# --------------------------------------------------------------------------
#  validation
# --------------------------------------------------------------------------
.PHONY: support-check
support-check:
	@if [ -z "$(RES_FAMILY)" ]; then \
		echo "ERROR: unknown distribution '$(RES_DISTRO)'." >&2; \
		echo "       Known kinds: $(KNOWN_DISTRO_KINDS) (run 'make list')" >&2; \
		exit 1; \
	fi
	@if [ -z "$(RES_ARCH)" ] || [ -z "$(RES_PLATFORM)" ]; then \
		echo "ERROR: unknown architecture '$(ARCH_IN)'. Known: amd64 armhf arm64" >&2; \
		exit 1; \
	fi
	@if [ -z "$(call ARCH_SUPPORTED,$(RES_DISTRO),$(RES_ARCH))" ]; then \
		echo "ERROR: $(RES_DISTRO) is not published for $(RES_ARCH)." >&2; \
		echo "       Available for $(RES_DISTRO): $(RES_ARCHES)" >&2; \
		exit 1; \
	fi
	@mkdir -p $(OUT_DIR)/$(RES_FAMILY)/$(RES_DISTRO)/$(RES_ARCH)
# Create these here, as the user, so docker does not leave root owned parents
# behind that `make clean` could not delete.
ifeq ($(CACHE),1)
	@mkdir -p $(BUILD_DIR)/cache/gomod $(BUILD_DIR)/cache/gobuild-$(RES_ARCH)
endif

.PHONY: format-check-deb format-check-rpm
format-check-deb:
	@if [ "$(RES_FAMILY)" != deb ]; then \
		echo "ERROR: $(RES_DISTRO) is a $(RES_FAMILY) distribution, it cannot make a .deb." >&2; \
		echo "       Use: make rpm DISTRO=$(RES_DISTRO) ARCH=$(RES_ARCH)" >&2; \
		exit 1; \
	fi

format-check-rpm:
	@if [ "$(RES_FAMILY)" != rpm ]; then \
		echo "ERROR: $(RES_DISTRO) is a $(RES_FAMILY) distribution, it cannot make an .rpm." >&2; \
		echo "       Use: make deb DISTRO=$(RES_DISTRO) ARCH=$(RES_ARCH)" >&2; \
		exit 1; \
	fi

# --------------------------------------------------------------------------
#  frontend bundle (built once, used by every package)
# --------------------------------------------------------------------------
.PHONY: frontend
frontend: $(FRONTEND_STAMP)

$(FRONTEND_STAMP):
	@mkdir -p $(FRONTEND_DIR)
	@echo "==> building the frontend bundle with $(NODE_IMAGE) (architecture independent)"
	@$(DOCKER) run --rm $(SELINUX_OPT) $(DOCKER_RUN_EXTRA) \
		-e PKG_SRC=$(CTR_SRC) -e PKG_OUT=$(CTR_OUT) \
		-e PKG_HOST_UID=$(HOST_UID) -e PKG_HOST_GID=$(HOST_GID) \
		-v $(REPO_ROOT):$(CTR_SRC):ro \
		-v $(FRONTEND_DIR):$(CTR_OUT) \
		-w /tmp $(NODE_IMAGE) \
		$(CTR_SRC)/packaging/scripts/build-frontend.sh
	@touch $@

# --------------------------------------------------------------------------
#  the packages
# --------------------------------------------------------------------------
.PHONY: deb rpm
deb: format-check-deb support-check frontend
	$(call build_builder_image)
	$(call run_pkg_builder)

rpm: format-check-rpm support-check frontend
	$(call build_builder_image)
	$(call run_pkg_builder)

# Build one package in whatever format the distribution speaks:
#   make any DISTRO=fedora-44 ARCH=aarch64
.PHONY: any
any: support-check frontend
	$(call build_builder_image)
	$(call run_pkg_builder)

# --------------------------------------------------------------------------
#  the common matrix
# --------------------------------------------------------------------------
.PHONY: all deb-all rpm-all
# The manifest is regenerated even when something failed (there is usually
# something worth looking at), but the failure still has to reach make: without
# the explicit exit status below the last command would decide it.
all:
	@rc=0; $(PKG_ROOT)/scripts/matrix-run.sh "$(MAKE)" "$(JOBS)" all $(ALL_ENTRIES) || rc=$$?; \
	$(MAKE) --no-print-directory manifest; exit $$rc

deb-all:
	@rc=0; $(PKG_ROOT)/scripts/matrix-run.sh "$(MAKE)" "$(JOBS)" deb $(ALL_ENTRIES) || rc=$$?; \
	$(MAKE) --no-print-directory manifest; exit $$rc

rpm-all:
	@rc=0; $(PKG_ROOT)/scripts/matrix-run.sh "$(MAKE)" "$(JOBS)" rpm $(ALL_ENTRIES) || rc=$$?; \
	$(MAKE) --no-print-directory manifest; exit $$rc

# --------------------------------------------------------------------------
#  information
# --------------------------------------------------------------------------
.PHONY: matrix
matrix:
	@printf '%-16s %-7s %-6s %s\n' DISTRO ARCH FORMAT STATUS
	@for e in $(ALL_ENTRIES); do \
		IFS=/ read -r d a f extra <<<"$$e"; \
		if [ -n "$$extra" ]; then s="NOT AVAILABLE"; else s="ok"; fi; \
		printf '%-16s %-7s %-6s %s\n' "$$d" "$$a" "$$f" "$$s"; \
	done

.PHONY: list
list:
	@printf '%-16s %-20s %-16s %-6s %s\n' 'DISTRO=...' 'plain name' 'image' 'format' 'architectures'
	@$(foreach k,$(KNOWN_DISTRO_KINDS),printf '  %-14s %-20s %-16s %-6s %s\n' \
		'$(k)-<ver>' '$(k) = $(DISTRO_LATEST_$(k))' '$(k):<ver>' '$(DISTRO_FAMILY_$(k))' '$(ARCHES_$(k))';)
	@printf '\narchitectures (ARCH=...): amd64 | x86_64, armhf | armv7l, arm64 | aarch64\n'
	@printf '\nthe default matrix, this is what make all builds (override with MATRIX=...):\n'
	@for e in $(MATRIX); do printf '  %s\n' "$$e"; done

.PHONY: version
version:
	@echo "version            $(VERSION)"
	@echo "release            $(RELEASE)"
	@echo "deb version        $(DEB_VERSION)"
	@echo "git describe       $(GIT_DESCRIBE)"
	@echo "git commit         $(GIT_COMMIT) ($(GIT_BRANCH))"
	@echo "source date epoch  $(SOURCE_DATE_EPOCH)"
	@echo "go                 $(GO_SOURCE) $(GO_VERSION)"

# --------------------------------------------------------------------------
#  containers
# --------------------------------------------------------------------------
.PHONY: image-one images
image-one: support-check
	$(call build_builder_image)

images:
	@echo "==> building every build container of the matrix"
	@for e in $(ALL_ENTRIES); do \
		IFS=/ read -r d a f extra <<<"$$e"; \
		if [ -n "$$extra" ]; then echo "--- skipping $$d/$$a (not published)"; continue; fi; \
		$(MAKE) --no-print-directory image-one DISTRO="$$d" ARCH="$$a" || exit 1; \
	done

# An interactive shell in the build container: handy when a build fails.
.PHONY: shell
shell: support-check frontend
	$(call build_builder_image)
	@echo "==> shell in $(RES_BUILDER_IMAGE) ($(RES_DISTRO)/$(RES_ARCH))"
	@$(DOCKER) run --rm -it --platform $(RES_PLATFORM) $(SELINUX_OPT) $(DOCKER_RUN_EXTRA) \
		$(PKG_ENV) \
		$(CACHE_MOUNTS) \
		-v $(REPO_ROOT):$(CTR_SRC):ro \
		-v $(FRONTEND_DIR):$(CTR_FRONTEND):ro \
		-v $(OUT_DIR):$(CTR_OUT) \
		-w /tmp \
		$(RES_BUILDER_IMAGE) bash

# --------------------------------------------------------------------------
#  checks and cleanup
# --------------------------------------------------------------------------
.PHONY: doctor check
doctor check:
	@DO_DISTRO="$(RES_DISTRO)" \
	 DO_ARCH="$(RES_ARCH)" \
	 DO_PLATFORM="$(RES_PLATFORM)" \
	 DO_IMAGE="$(RES_IMAGE)" \
	 DO_FAMILY="$(RES_FAMILY)" \
	 DO_SUPPORTED="$(if $(call ARCH_SUPPORTED,$(RES_DISTRO),$(RES_ARCH)),1,0)" \
	 DO_ARCHES="$(RES_ARCHES)" \
	 DO_DEEP="$(DEEP)" \
	 DO_MATRIX="$(ALL_ENTRIES)" \
	 DO_SELINUX="$(SELINUX_STATUS)" \
	 DO_GO="$(GO_SOURCE) $(GO_VERSION)" \
	 DO_DOCKER="$(DOCKER)" \
	 DO_NODE_IMAGE="$(NODE_IMAGE)" \
	 DO_PKG_ROOT="$(PKG_ROOT)" \
	 DO_OUT="$(OUT_DIR)" \
	 DO_CACHE="$(CACHE)" \
	 $(PKG_ROOT)/scripts/doctor.sh

.PHONY: manifest sha256sums
manifest sha256sums:
	@$(PKG_ROOT)/scripts/manifest.sh "$(OUT_DIR)"

.PHONY: clean distclean
clean:
	rm -rf $(BUILD_DIR)

distclean: clean
	rm -rf $(OUT_DIR)

# --------------------------------------------------------------------------
#  help
# --------------------------------------------------------------------------
.PHONY: help
help:
	@echo "aseqrc packaging -- docker based builds for deb and rpm"
	@echo
	@echo "  make deb [DISTRO=x] [ARCH=y]   build a .deb  (ubuntu/debian)"
	@echo "  make rpm [DISTRO=x] [ARCH=y]   build an .rpm (fedora)"
	@echo "  make all [JOBS=n]              the whole default matrix, both formats"
	@echo "  make deb-all | rpm-all         only one format of the matrix"
	@echo "  make manifest                  regenerate out/SHA256SUMS + manifest.json"
	@echo
	@echo "  make matrix                    show what 'make all' would build"
	@echo "  make list                      known distributions and architectures"
	@echo "  make version                   resolved versions"
	@echo "  make doctor [DEEP=1]           check docker, qemu/binfmt, SELinux, disk"
	@echo "  make shell [DISTRO=x ARCH=y]   interactive shell in the build container"
	@echo "  make images                    pre-build every build container"
	@echo "  make frontend                  (re)build the shared frontend bundle"
	@echo "  make clean | distclean         drop build/ | build/ and out/"
	@echo
	@echo "Examples:"
	@echo "  make deb DISTRO=ubuntu-26.04 ARCH=armhf"
	@echo "  make rpm DISTRO=fedora-44    ARCH=aarch64"
	@echo "  make deb DISTRO=debian-13 ARCH=x86_64 VERSION=1.0.0 RELEASE=2"
