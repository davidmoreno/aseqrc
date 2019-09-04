all:
	@echo "install -- Installs and enable service"

install:
	mkdir -p /opt/aseqrc/
	cp -a * /opt/aseqrc/
	cp aseqrc.service /etc/systemd/system/
