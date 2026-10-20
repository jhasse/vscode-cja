import { ExecFileException, execFile } from "node:child_process";
import * as os from "node:os";
import * as vscode from "vscode";
import {
  DidChangeConfigurationNotification,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";

/** First cja release with the `lsp` subcommand */
const MINIMUM_VERSION = [0, 10, 0];

let client: LanguageClient | undefined;
// The executable the running client was started with
let clientCommand: string | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  context.subscriptions.push(
    vscode.commands.registerCommand("cja.restartServer", restart),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("cja")) {
        void configurationChanged();
      }
    }),
    // Workspace values of restricted settings only apply once the workspace is trusted.
    vscode.workspace.onDidGrantWorkspaceTrust(configurationChanged),
  );
  await start();
}

export async function deactivate(): Promise<void> {
  await stop();
}

async function start(): Promise<void> {
  const command = serverCommand();
  if (!(await checkVersion(command))) {
    return;
  }
  const serverOptions: ServerOptions = { command, args: ["lsp", "--stdio"] };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "cmake" }],
    initializationOptions: settings(),
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher("**/{CMakeLists.txt,*.cmake}"),
    },
    middleware: {
      executeCommand: (name, args, next) => {
        if (!vscode.workspace.isTrusted) {
          void vscode.window.showErrorMessage(
            "Configuring runs CMake code from the project, so it's only possible in a trusted workspace.",
          );
          return undefined;
        }
        return next(name, args);
      },
    },
  };
  client = new LanguageClient("cja", "cja", serverOptions, clientOptions);
  clientCommand = command;
  // On failure the client already shows an error and logs the details in its output channel.
  await client.start().catch(() => undefined);
}

async function stop(): Promise<void> {
  const running = client;
  client = undefined;
  clientCommand = undefined;
  if (running) {
    await running.dispose().catch(() => undefined);
  }
}

async function restart(): Promise<void> {
  await stop();
  await start();
}

async function configurationChanged(): Promise<void> {
  if (serverCommand() !== clientCommand) {
    await restart();
  } else if (client?.isRunning()) {
    await client.sendNotification(DidChangeConfigurationNotification.type, {
      settings: { cja: settings() },
    });
  }
}

/** The options of the server, see "cja lsp" in cja's README */
function settings(): Record<string, unknown> {
  const config = vscode.workspace.getConfiguration("cja");
  return {
    // Configuring runs code from the project, even if it was enabled in the user settings.
    configureOnSave: vscode.workspace.isTrusted && config.get<boolean>("configureOnSave", false),
    buildDir: config.get<string>("buildDir", "build"),
    strict: config.get<boolean>("strict", true),
    configureArgs: config.get<string[]>("configureArgs", []),
  };
}

function serverCommand(): string {
  let command = vscode.workspace.getConfiguration("cja").get<string>("path") || "cja";
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder) {
    command = command.replace(/\$\{workspaceFolder\}/g, folder.uri.fsPath);
  }
  if (command === "~" || command.startsWith("~/")) {
    command = os.homedir() + command.slice(1);
  }
  return command;
}

/** Make sure cja can be run and supports "cja lsp", otherwise tell the user how to fix it. */
async function checkVersion(command: string): Promise<boolean> {
  const result = await new Promise<{ error: ExecFileException | null; stdout: string }>(
    (resolve) => {
      execFile(command, ["--version"], { timeout: 30000 }, (error, stdout) =>
        resolve({ error, stdout }),
      );
    },
  );
  let message: string | undefined;
  if (result.error?.code === "ENOENT") {
    message = `Couldn't find cja ("${command}"). Install it with "pipx install cja" or set "cja.path".`;
  } else if (result.error) {
    message = `Running "${command} --version" failed: ${result.error.message}`;
  } else {
    const match = /(\d+)\.(\d+)\.(\d+)/.exec(result.stdout);
    if (match && compareVersions(match.slice(1).map(Number), MINIMUM_VERSION) < 0) {
      message = `cja ${match[0]} doesn't include the language server, please update to ${MINIMUM_VERSION.join(".")} or newer.`;
    }
  }
  if (message === undefined) {
    return true;
  }
  const openSettings = "Open Settings";
  void vscode.window.showErrorMessage(message, openSettings).then((choice) => {
    if (choice === openSettings) {
      void vscode.commands.executeCommand("workbench.action.openSettings", "cja.path");
    }
  });
  return false;
}

function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}
