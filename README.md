# mod-peer-checker

A Zinnia module periodically checking connectivity to libp2p bootstrap peers.

> Important: This IS NOT a reference module implementation. Station Modules are expected to pay
> rewards for the resources contributed by users, this module does not offer any rewards (yet).

## Basic use

This module is running inside Filecoin Station, and the measurements are reported to a private
InfluxDB dashboard.

Influx Data Explorer query to show the mean average number of successful checks per minute for each
peer:

```
from(bucket: "peer-checker")
    |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
    |> filter(fn: (r) => r._measurement == "check")
    |> filter(fn: (r) => r._field == "online")
    |> group(columns: ["peer"])
    |> window(period: 1m)
    |> mean()
    |> duplicate(column: "_start", as: "_time")
    |> window(every: inf)
```

## Development

You need the latest `zinnia` CLI installed, see
[Zinnia CLI Installation](https://github.com/filecoin-station/zinnia/blob/main/cli/README.md#installation)

```bash
❯ zinnia run peer-checker.js
```

### Testing

Zinnia does not support automated testing yet, see
[zinnia#44](https://github.com/filecoin-station/zinnia/issues/44). Run the module manually and check
the logs to detect possible issues.

### Linters

JavaScript and Markdown files are formatted using Prettier. You can use the Prettier VS Code
extension or run the following command to (re)format manually:

```bash
❯ npx prettier --write .
```
