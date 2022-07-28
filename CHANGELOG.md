# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0]

### Added

- settings of panels border

## [0.7.0]

### Added

- resetSystem method in order to uninstall panels while leaving workspace
- switching tab panels by URL

### Changed

- size and title of TabBtn
- click handler of widgets
- API endpoint to `/dtcd_workspaces`

## [0.6.0]

### Added

- redirect to 404 page if workspace configuration not found
- tab panel in workspaces

## [0.5.0]

### Added

- settings form of system

### Changed

- styles of drag elements in edit mode

## [0.4.0]

### Added

- version support of panel plugins
- version of systems in adapters

### Changed

- build process in order to make directory name with current version of pluing

## [0.3.0]

### Added

- setColumn public method
- routing by URL param "workspace"
- workspace templates
- default built-in configurstion of workspace
- footer and heaader
- set and get plugin config methods
- ability to open panel in modal window
- getter currentWorkspaceColumn

### Changed

- EventSystem config object properties

### Fixed

- incorrect closing tag of "gridstack-content-container" div
- bug with deleting panels from dashboard crash error

## [0.2.0] - 2021-02-11

### Changed

- code source directory name to DTCD-WorkspaceSystem
- downloading DTCD-SDK from [storage](http://storage.dev.isgneuro.com)
- paths in source files to DTCD-SDK
- [Makefile](Makefile) to current project structure

## [0.1.0] - 2021-02-09

- Added main functional
