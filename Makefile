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
	mkdir -p $(DESTDIR)/usr/share/aseqrc/
	cp -a aseqrc.py $(DESTDIR)/usr/share/aseqrc/
	cp -a static $(DESTDIR)/usr/share/aseqrc/
	mkdir -p $(DESTDIR)/etc/systemd/system/
	cp aseqrc.service $(DESTDIR)/etc/systemd/system/
	mkdir -p $(DESTDIR)/var/lib/aseqrc/

setup:
	yarn --ignore-engines

node_modules: package.json
	make setup

PARCEL:=node_modules/.bin/parcel

build: build-frontend build-backend

build-frontend: static/index.html

static/index.html: node_modules src/*.tsx
	${PARCEL} build src/index.html -d static --public-url /static/
	cp -a icons static
	cp src/manifest.json static/manifest.json
	sed -i s/manifest\\.js/manifest.json/g static/index.html

build-backend: aseqrc 

aseqrc: *.go alsaseq/*.go static/*
	go build

run: build
	./aseqrc

serve:
	@echo
	@echo 'Remember to run main program in another terminal, access at http://localhost:5000'
	@echo
	${PARCEL} serve src/index.html -d static --public-url /static/

deb: clean
	dpkg-buildpackage --no-sign -d

clean:
	rm node_modules -rf
	rm static -rf
	rm .cache -rf