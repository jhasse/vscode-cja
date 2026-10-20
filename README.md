# cja for Visual Studio Code

CMake language support for VS Code, powered by the language server of [cja](https://github.com/jhasse/cja)
(`cja lsp`).

* **Semantic highlighting** of commands (builtin, user-defined functions and macros), keywords, variables, function
  parameters, targets, strings, numbers, constants and comments
* **Diagnostics** for syntax errors and unbalanced blocks (`if()` without `endif()` and so on) while typing
* **Go to definition** and **find references** for functions and macros, variables, targets, and the files named by
  `include()` and `add_subdirectory()`
* **Hover** with the definition (and the comment above it) of user-defined commands, variables and targets, and a link
  to the documentation of builtin commands
* **Completion** of command names, of the keywords of the current command, of target names and of variable names
  after `${`
* **Outline**, **folding** and **formatting** of the whole document or of the selection (like `cja format`)

## Requirements

cja 0.10.0 or newer:

```sh
pipx install cja
```

If `cja` isn't on your `PATH`, set `cja.path`, e.g. to `${workspaceFolder}/.venv/bin/cja`.

## Configure diagnostics

Nothing from your project is executed for the features above. Optionally, the project can also be configured with cja
to show the errors and warnings of a real configure run (e.g. unsupported arguments with `--strict`) as diagnostics.
This runs CMake code from the project (`execute_process()`, FetchContent downloads, …) and writes the build directory,
so it's off by default and only available in [trusted workspaces](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust).
Run **cja: Configure Project** from the command palette or enable `cja.configureOnSave`.

## Settings

| Setting               | Default   | Description                                       |
| --------------------- | --------- | ------------------------------------------------- |
| `cja.path`            | `"cja"`   | Path to the `cja` executable                      |
| `cja.configureOnSave` | `false`   | Configure the project when a file is saved        |
| `cja.buildDir`        | `"build"` | Build directory used for configuring              |
| `cja.strict`          | `true`    | Configure with `--strict`                         |
| `cja.configureArgs`   | `[]`      | Additional arguments, e.g. `["-DFOO=ON"]`         |
| `cja.trace.server`    | `"off"`   | Log the LSP messages in the "cja" output channel  |

## Development

```sh
npm install
npm run bundle  # or press F5 in VS Code to launch an Extension Development Host
CJA_PATH=../cja/.venv/bin/cja npm test
npm run package
```
