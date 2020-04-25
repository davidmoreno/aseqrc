.PHONY: all setup install deb build run
all:
	@echo "run     -- Basic run the program"
	@echo "install -- Installs and enable service. Uses DESTDIR"
	@echo "build   -- Builds the React frontend"
	@echo "deb     -- Creates a debian package"

DESTDIR:=/

install:
	mkdir -p $(DESTDIR)/usr/bin/
	cp -a aseqrc.py $(DESTDIR)/usr/bin/aseqrc
	sed -i s@PATH\ =\ \".*\"@PATH\ =\ \"${DESTDIR}/usr/share/aseqrc/\"@ $(DESTDIR)/usr/bin/aseqrc
	mkdir -p $(DESTDIR)/usr/share/aseqrc/
	cp index.html $(DESTDIR)/usr/share/aseqrc/
	cp sw.js $(DESTDIR)/usr/share/aseqrc/
	cp manifest.json $(DESTDIR)/usr/share/aseqrc/
	cp -a icons $(DESTDIR)/usr/share/aseqrc/
	chmod +x $(DESTDIR)/usr/bin/aseqrc
	mkdir -p $(DESTDIR)/etc/systemd/system/
	cp aseqrc.service $(DESTDIR)/etc/systemd/system/

setup:
	yarn

node_modules: setup


PARCEL:=node_modules/.bin/parcel

build: node_modules
	${PARCEL} build src/index.html -d static --public-url /static/
	cp -a icons static
	cp src/manifest.json static/manifest.json
	sed -i s/manifest\\.js/manifest.json/g static/index.html

run:
	./aseqrc.py

deb:
	dpkg-buildpackage --no-sign
