all:
	@echo "run     -- Basic run the program"
	@echo "install -- Installs and enable service. Uses DESTDIR"
	@echo "deb     -- Creates a debian package"

DESTDIR:=/

install:
	mkdir -p $(DESTDIR)/usr/bin/
	cp -a aseqrc.py $(DESTDIR)/usr/bin/aseqrc
	sed -i s@PATH\ =\ \".*\"@PATH\ =\ \"${DESTDIR}/usr/share/aseqrc/\"@ $(DESTDIR)/usr/bin/aseqrc
	mkdir -p $(DESTDIR)/usr/share/aseqrc/
	cp index.html $(DESTDIR)/usr/share/aseqrc/
	cp sw.js $(DESTDIR)/usr/share/aseqrc/
	chmod +x $(DESTDIR)/usr/bin/aseqrc
	mkdir -p $(DESTDIR)/etc/systemd/system/
	cp aseqrc.service $(DESTDIR)/etc/systemd/system/

run:
	./aseqrc.py

deb:
	dpkg-buildpackage --no-sign