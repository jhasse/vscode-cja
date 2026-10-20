import * as assert from "node:assert";
import * as vscode from "vscode";

const root = vscode.workspace.workspaceFolders![0].uri;
const lists = vscode.Uri.joinPath(root, "CMakeLists.txt");
const helpers = vscode.Uri.joinPath(root, "cmake", "helpers.cmake");

/** Retry until the language server answered with something useful */
async function poll<T>(get: () => Thenable<T>, done: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 30000;
  for (;;) {
    const value = await get();
    if (done(value) || Date.now() > deadline) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

suite("cja", () => {
  suiteSetup(async () => {
    // Use a development version of cja, e.g. CJA_PATH=../cja/.venv/bin/cja npm test
    if (process.env.CJA_PATH) {
      await vscode.workspace
        .getConfiguration("cja")
        .update("path", process.env.CJA_PATH, vscode.ConfigurationTarget.Global);
    }
    await vscode.window.showTextDocument(lists);
  });

  test("CMake files get the cmake language", async () => {
    const document = await vscode.workspace.openTextDocument(helpers);
    assert.strictEqual(document.languageId, "cmake");
  });

  test("go to definition of a function in another file", async () => {
    const locations = await poll(
      () =>
        vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
          "vscode.executeDefinitionProvider",
          lists,
          new vscode.Position(5, 1),
        ),
      (result) => result.length > 0,
    );
    assert.strictEqual(locations.length, 1);
    const location = locations[0];
    const uri = "uri" in location ? location.uri : location.targetUri;
    const range = "range" in location ? location.range : location.targetRange;
    assert.strictEqual(uri.toString(), helpers.toString());
    assert.strictEqual(range.start.line, 1);
  });

  test("hover over a user-defined function shows its comment", async () => {
    const hovers = await poll(
      () =>
        vscode.commands.executeCommand<vscode.Hover[]>(
          "vscode.executeHoverProvider",
          lists,
          new vscode.Position(5, 1),
        ),
      (result) => result.length > 0,
    );
    const text = hovers
      .flatMap((hover) => hover.contents)
      .map((content) => (typeof content === "string" ? content : content.value))
      .join("\n");
    assert.match(text, /Prints a greeting/);
  });

  test("references of a target", async () => {
    const locations = await poll(
      () =>
        vscode.commands.executeCommand<vscode.Location[]>(
          "vscode.executeReferenceProvider",
          lists,
          new vscode.Position(6, 16),
        ),
      (result) => result.length > 1,
    );
    assert.deepStrictEqual(
      locations.map((location) => location.range.start.line).sort(),
      [6, 7],
    );
  });

  test("document symbols", async () => {
    const symbols = await poll(
      () =>
        vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
          "vscode.executeDocumentSymbolProvider",
          helpers,
        ),
      (result) => result.length > 0,
    );
    assert.ok(symbols.some((symbol) => symbol.name === "greet"));
  });

  test("semantic tokens", async () => {
    const tokens = await poll(
      () =>
        vscode.commands.executeCommand<vscode.SemanticTokens | undefined>(
          "vscode.provideDocumentSemanticTokens",
          lists,
        ),
      (result) => (result?.data.length ?? 0) > 0,
    );
    assert.ok(tokens && tokens.data.length > 0);
  });

  test("formatting", async () => {
    const uri = vscode.Uri.joinPath(root, "cmake", "unformatted.cmake");
    const editor = await vscode.window.showTextDocument(uri);
    try {
      const edits = await poll(
        () =>
          vscode.commands.executeCommand<vscode.TextEdit[]>(
            "vscode.executeFormatDocumentProvider",
            uri,
            { tabSize: 2, insertSpaces: true },
          ),
        (result) => (result?.length ?? 0) > 0,
      );
      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.set(uri, edits);
      await vscode.workspace.applyEdit(workspaceEdit);
      assert.strictEqual(editor.document.getText(), 'message(STATUS "unformatted")\n');
    } finally {
      await vscode.commands.executeCommand("workbench.action.files.revert");
    }
  });

  test("diagnostics for unbalanced blocks while typing", async () => {
    const editor = await vscode.window.showTextDocument(lists);
    try {
      await editor.edit((edit) => edit.insert(new vscode.Position(0, 0), "if(FOO)\n"));
      const diagnostics = await poll(
        async () => vscode.languages.getDiagnostics(lists),
        (result) => result.length > 0,
      );
      assert.ok(diagnostics.length > 0);
      assert.strictEqual(diagnostics[0].source, "cja");
    } finally {
      await vscode.commands.executeCommand("workbench.action.files.revert");
    }
  });
});
