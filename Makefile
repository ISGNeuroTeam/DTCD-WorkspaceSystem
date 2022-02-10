define ANNOUNCE_BODY
Required sections:
	build - build project into ./build directory, with configuration file and environment
	clean - clean all addition files, build directory and output archive file
	test - run all tests
	pack - make output archive
Addition sections:
	dependencies - download project dependencies to the ./$(PROJECT_NAME)/node_modules directory
	sdk - download SDK directory to the root
endef

PROJECT_NAME = DTCD-WorkspaceSystem
PLUGIN_NAME = WorkspaceSystem

GENERATE_VERSION = $(shell jq .version ./${PROJECT_NAME}/package.json )
GENERATE_BRANCH = $(shell git name-rev $$(git rev-parse HEAD) | cut -d\  -f2 | sed -re 's/^(remotes\/)?origin\///' | tr '/' '_')

SET_VERSION = $(eval VERSION=$(GENERATE_VERSION))
SET_BRANCH = $(eval BRANCH=$(GENERATE_BRANCH))
SET_PACK_NAME = $(eval PACK_NAME=$(PROJECT_NAME)-$(VERSION)-$(BRANCH).tar.gz)

DEV_STORAGE = https://storage.dev.isgneuro.com/repository/components
DTCD_SDK = DTCD-SDK
DTCD_SDK_URL = $(DEV_STORAGE)/$(DTCD_SDK)/$(DTCD_SDK)-0.1.2-master-0003.tar.gz

.SILENT:

COMPONENTS: sdk 

export ANNOUNCE_BODY

all:
	echo "$$ANNOUNCE_BODY"

build: $(PROJECT_NAME)/node_modules COMPONENTS
	# required section
	$(SET_VERSION)
	echo Removing previous build...
	rm -rf ./build/
	echo Building started...
	npm run build --prefix ./$(PROJECT_NAME)
	mv ./$(PROJECT_NAME)/build ./
	cp README.md ./build/
	cp CHANGELOG.md ./build/
	cp LICENSE.md ./build/;
	mkdir ./build/$(PROJECT_NAME)_$(VERSION) && mv ./build/$(PLUGIN_NAME).js ./build/$(PROJECT_NAME)_$(VERSION);
	if [ -d ./$(PROJECT_NAME)/dependencies/ ];\
		then echo Prepare dependencies for $(PROJECT_NAME)_$(VERSION) in build directory...;\
		cp -r ./$(PROJECT_NAME)/dependencies ./build/$(PROJECT_NAME)_$(VERSION);\
		cat ./build/$(PROJECT_NAME)_$(VERSION)/dependencies/manifest.json | jq 'map(del(.source))' > ./build/$(PROJECT_NAME)_$(VERSION)/manifest.json;\
		rm ./build/$(PROJECT_NAME)_$(VERSION)/dependencies/manifest.json;\
		cat ./$(PROJECT_NAME)/dependencies/manifest.json |  jq -r '.[] | "\(.source) \(.fileName)"' | grep -vP '^null ' | xargs -n2 -r sh -c 'curl $$1 -o ./build/$(PROJECT_NAME)_$(VERSION)/dependencies/$$2' sh;\
		else echo no dependencies folder. ;\
	fi
	echo Building completed;
	# required section

clean:
	# required section
	echo Cleaning started...
	rm -rf ./build/
	rm -rf *.tar.gz
	rm -rf ./$(DTCD_SDK)/
	rm -rf ./$(PROJECT_NAME)/node_modules/
	rm -rf ./$(PROJECT_NAME)/*-lock.*
	echo Cleaning completed.
	# required section

test: $(PROJECT_NAME)/node_modules COMPONENTS
	# required section
	echo Testing started...
	npm run test --prefix ./$(PROJECT_NAME)
	echo Testing completed.
	# required section

pack: build
	# required section
	$(SET_BRANCH)
	$(SET_VERSION)
	$(SET_PACK_NAME)
	echo Creating \"$(PACK_NAME)\" archive...
	cd ./build/ && tar czf ../$(PACK_NAME) .
	echo Archive \"$(PACK_NAME)\" created successfully.
	# required section

$(PROJECT_NAME)/node_modules:
	echo Installing project dependencies...
	if ! [ -d ./$(PROJECT_NAME)/node_modules ];\
		then npm i --prefix ./$(PROJECT_NAME) && echo Project dependencies downloaded.;\
		else echo Project dependencies is already downloaded.;\
	fi

sdk:
	echo $(DTCD_SDK_URL)
	echo Downloading $(DTCD_SDK)...
	if ! [ -d ./$(DTCD_SDK) ];\
		then curl -# -Lk $(DTCD_SDK_URL) | tar -zx ./$(DTCD_SDK) && echo $(DTCD_SDK) downloaded.;\
		else echo $(DTCD_SDK) is already downloaded.;\
	fi

dev: build
	cp -rf ./build/$(PROJECT_NAME)_$(VERSION) ./../DTCD/server/plugins
	npm run dev --prefix ./$(PROJECT_NAME)