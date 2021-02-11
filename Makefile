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

GENERATE_VERSION = $(shell jq .version ./${PROJECT_NAME}/package.json )
GENERATE_BRANCH = $(shell git name-rev $$(git rev-parse HEAD) | cut -d\  -f2 | sed -re 's/^(remotes\/)?origin\///' | tr '/' '_')

SET_VERSION = $(eval VERSION=$(GENERATE_VERSION))
SET_BRANCH = $(eval BRANCH=$(GENERATE_BRANCH))
SET_PACK_NAME = $(eval PACK_NAME=$(PROJECT_NAME)-$(VERSION)-$(BRANCH).tar.gz)

DEV_STORAGE = http://storage.dev.isgneuro.com/repository/components
DTCD_SDK = DTCD-SDK
DTCD_SDK_URL = $(DEV_STORAGE)/$(DTCD_SDK)/$(DTCD_SDK)-0.1.1-master-0002.tar.gz

.SILENT:

COMPONENTS: sdk dependencies

export ANNOUNCE_BODY

all:
	echo "$$ANNOUNCE_BODY"

build: COMPONENTS
	# required section
	echo Removing previous build...
	rm -rf ./build/
	echo Building started...
	npm run build --prefix ./$(PROJECT_NAME)
	mv ./$(PROJECT_NAME)/build/ ./
	cp README.md ./build/
	cp CHANGELOG.md ./build/
	cp LICENSE.md ./build/
	mkdir ./build/$(PROJECT_NAME) && mv ./build/WorkspaceSystem.js ./build/$(PROJECT_NAME)
	echo Building completed.
	# required section

clean:
	# required section
	echo Cleaning started...
	rm -rf ./build/
	rm -rf *.tar.gz
	rm -rf ./$(DTCD_SDK)/
	rm -rf ./$(PROJECT_NAME)/node_modules/
	rm -rf ./$(PROJECT_NAME)/package-lock.json
	echo Cleaning completed.
	# required section

test: COMPONENTS
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

dependencies:
	echo Installing project dependencies...
	if ! [ -d ./$(PROJECT_NAME)/node_modules ];\
		then npm i --prefix ./$(PROJECT_NAME) && echo Project dependencies downloaded.;\
		else echo Project dependencies is already downloaded.;\
	fi

sdk:
	echo Downloading $(DTCD_SDK)...
	if ! [ -d ./$(DTCD_SDK) ];\
		then curl -# $(DTCD_SDK_URL) | tar -zx ./$(DTCD_SDK) && echo $(DTCD_SDK) downloaded.;\
		else echo $(DTCD_SDK) is already downloaded.;\
	fi
