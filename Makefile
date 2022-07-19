.PHONY: all setup install deb build run
all:
	@echo "run     -- Basic run the program"
	@echo "install -- Installs and enable service. Uses DESTDIR"
	@echo "build   -- Builds the React frontend and Go program"
	@echo "deb     -- Creates a debian package"
	@echo "serve   -- Run parcel in serve mode,. to iterate on frontend development"

DESTDIR:=/

install: build
	mkdir -p $(DESTDIR)/usr/bin/
	cp -a backend/aseqrc $(DESTDIR)/usr/bin/
	mkdir -p $(DESTDIR)/etc/systemd/system/
	cp etc/aseqrc.service $(DESTDIR)/etc/systemd/system/
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
	./aseqrc

serve:
	cd frontend && make serve

deb: clean
	dpkg-buildpackage --no-sign -d

clean:
	cd backend && make clean
	cd frontend && make clean
	rm aseqrc -rf