build: aseqrc

aseqrc: static *.go alsaseq/*.go
	go build

../frontend/static:
	cd ../frontend/ && make build

static: ../frontend/static
	rm -rf static
	cp -a ../frontend/static .

clean:
	rm static -rf
	rm -rf aseqrc
