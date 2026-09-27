.PHONY: all setup install deb build run deb-docker rpm packages packaging-help
all:
	@echo "run     -- Basic run the program"
	@echo "install -- Installs and enable service. Uses DESTDIR"
	@echo "build   -- Builds the React frontend and Go program"
	@echo "deb     -- Creates a debian package (dpkg-buildpackage, local machine)"
	@echo "serve   -- Run parcel in serve mode,. to iterate on frontend development"
	@echo ""
	@echo "Docker based packaging, in a container of the target distribution:"
	@echo "packages   -- Build debian, ubuntu and fedora packages, several arches (make -C packaging all)"
	@echo "deb-docker -- Build a .deb (DISTRO=ubuntu-26.04 ARCH=armhf; see packaging/README.md)"
	@echo "rpm        -- Build an .rpm (DISTRO=fedora-44 ARCH=aarch64; see packaging/README.md)"

DESTDIR:=/

install: build
	mkdir -p $(DESTDIR)/usr/bin/
	cp -a backend/aseqrc $(DESTDIR)/usr/bin/
	mkdir -p $(DESTDIR)/etc/systemd/system/
	cp etc/systemd-aseqrc.service $(DESTDIR)/etc/systemd/system/
	mkdir -p $(DESTDIR)/etc/avahi/services/
	cp etc/avahi-aseqrc.service $(DESTDIR)/etc/avahi/services/
	mkdir -p $(DESTDIR)/var/lib/aseqrc/


PARCEL:=node_modules/.bin/parcel

build: build-frontend build-backend

build-frontend: static/index.html

frontend/node_modules: setup
	cd frontend && make setup

static/index.html: frontend/node_modules frontend/src/*.tsx
	cd frontend && make build

build-backend: aseqrc 

aseqrc: static/index.html backend/*.go backend/alsaseq/*.go
	cd backend && make build
	cp backend/aseqrc .

run: build
	@echo 
	@echo 
	@echo Remember that you can start the frontend as serve, and just reload the page for frontend development.
	@echo At http://localhost:8001/static/
	@echo 	
	@echo 
	DEVEL=1 ./aseqrc

serve:
	cd frontend && make serve

deb: clean
	dpkg-buildpackage --no-sign -d

# Docker based packaging -----------------------------------------------------
# The sources are compiled inside a container of the distribution and
# architecture the package is for, so the toolchain, the C library and the
# packaging tools always match the target.  All the details, the list of
# distributions and architectures, and the cross architecture story (QEMU via
# docker --platform) are in packaging/README.md.
DISTRO ?= ubuntu-26.04
ARCH   ?= amd64

packages:
	$(MAKE) -C packaging all

deb-docker:
	$(MAKE) -C packaging deb DISTRO=$(DISTRO) ARCH=$(ARCH)

rpm:
	$(MAKE) -C packaging rpm DISTRO=$(DISTRO) ARCH=$(ARCH)

packaging-help:
	$(MAKE) -C packaging help

clean:
	cd backend && make clean
	cd frontend && make clean
	rm aseqrc -rf