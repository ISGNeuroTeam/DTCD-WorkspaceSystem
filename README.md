# DTCD-WorkspaceSystem

System core plugin of the [DTCD](https://github.com/ISGNeuroTeam/DTCD) application for interactive workspace.

## Getting Started

In order to use this plugin you need to download it, build and move it to plugins directory of complex_rest dtcd_mockserver_plugin.

### Prerequisites

- [Node.js](https://nodejs.org/en/) LTS version 14.x.x
- [DTCD](https://github.com/ISGNeuroTeam/DTCD) v0.3.0

## Building

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

Use `make pack` to get a deployable tarball. Move it to plugins directory of complex_rest dtcd_mockserver_plugin.

## Built With

- [DTCD-SDK](https://github.com/ISGNeuroTeam/DTCD-SDK) v0.1.2
- [Rollup.js](https://rollupjs.org/guide/en/) v2.35.1
- [gridstack](https://gridstackjs.com/) v4.2.3

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/ISGNeuroTeam/DTCD-WorkspaceSystem/tags).

Also you can see the [CHANGELOG](CHANGELOG.md) file.

## Authors

- Konstantin Rozov (konstantin@isgneuro.com)
- Kuramshin Roman (rkuramshin@isgneuro.com)
- Belikov Sergei (sbelikov@isgneuro.com)

## License

This project is licensed under the OT.PLATFORM license agreement - see the [LICENSE](LICENSE.md) file for details.
