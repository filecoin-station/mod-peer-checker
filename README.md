# mod-peer-checker

A Zinnia module periodically checking connectivity to libp2p bootstrap peers.

> Important: This IS NOT a reference module implementation. Station Modules are expected to pay
> rewards for the resources contributed by users, this module does not offer any rewards (yet).

## Basic use

This module is running inside Filecoin Station, and the measurements are reported to a private
InfluxDB dashboard.

## Development

You need the latest `zinnia` CLI installed, see
[Zinnia CLI Installation](https://github.com/filecoin-station/zinnia/blob/main/cli/README.md#installation)

```bash
❯ zinnia run peer-checker.js
```

JavaScript and Markdown files are formatted using Prettier. You can use the Prettier VS Code
extension or run the following command to (re)format manually:

```bash
❯ npx prettier --write .
```
