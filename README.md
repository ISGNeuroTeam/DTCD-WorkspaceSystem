# DTCD-WorkspaceSystem

System core plugin of the [DTCD](https://github.com/ISGNeuroTeam/DTCD) application for interactive workspace.

## Getting Started

In order to use this plugin you need to download it, build and move build-file to __plugins__ folder on DTCD server.

### Prerequisites

- [Node.js](https://nodejs.org/en/) LTS version 14.x.x
- [make](https://en.wikipedia.org/wiki/Make_(software)) utility
- [DTCD](https://github.com/ISGNeuroTeam/DTCD) application

### Building

Install plugin dependencies:
- `make sdk`
- `make dependencies`

Create build directory:
- `cd ./DTCD-WorkspaceSystem`
- `npm run build`

Also you can use Makefile for complete all steps:
```
make build
```

## Running the tests

```
make test
```

## Create build package

```
make pack
```

## Clear dependencies

```
make clear
```

## Deployment

Create build package, then move archive to __plugins__ folder on DTCD server and unpack it with the following commands:
```
tar -zxf DTCD-WorkspaceSystem-*.tar.gz ./DTCD-WorkspaceSystem
mv ./DTCD-WorkspaceSystem/WorkspaceSystem.js ./
rm -rf DTCD-WorkspaceSystem
```

After unpacking the build package, remove or delete it from __plugins__ folder, for example:
```
rm DTCD-WorkspaceSystem-*.tar.gz
```

## Built With

- [Rollup.js](https://rollupjs.org/guide/en/) - JavaScript module bundler
- [DTCD-SDK](https://github.com/ISGNeuroTeam/DTCD-SDK) - SDK for plugin development

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/ISGNeuroTeam/DTCD-WorkspaceSystem/tags).

Also you can see the [CHANGELOG](CHANGELOG.md) file.

## Authors

- Konstantin Rozov (konstantin@isgneuro.com)

## License

This project is licensed under the OT.PLATFORM license agreement - see the [LICENSE](LICENSE.md) file for details.
