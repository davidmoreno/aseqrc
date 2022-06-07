PARCEL:=node_modules/.bin/parcel


build: static/index.html

static/index.html: node_modules src/*.tsx  src/*.ts
	${PARCEL} build src/index.html -d static --public-url /static/
	cp -a icons static
	cp src/manifest.json static/manifest.json
	sed -i s/manifest\\.js/manifest.json/g static/index.html

setup: node_modules

node_modules: package.json
	yarn


.PHONY: serve
serve:
	${PARCEL} serve src/index.html -d static --public-url /static/

clean:
	rm node_modules .cache static -rf
