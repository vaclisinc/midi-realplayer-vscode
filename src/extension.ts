import * as path from "node:path";
import * as vscode from "vscode";

const VIEW_TYPE = "midiRealPlayer.viewer";
const SOUND_FONT_SETTING = "soundFontPath";
const BUNDLED_SOUND_FONT = "GeneralUser-GS.sf2";

class MidiDocument implements vscode.CustomDocument {
  constructor(readonly uri: vscode.Uri) {}
  dispose(): void {}
}

class MidiEditorProvider implements vscode.CustomReadonlyEditorProvider<MidiDocument> {
  private readonly panels = new Set<vscode.WebviewPanel>();
  private lastPanel: vscode.WebviewPanel | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  openCustomDocument(uri: vscode.Uri): MidiDocument {
    return new MidiDocument(uri);
  }

  async resolveCustomEditor(
    document: MidiDocument,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    this.panels.add(panel);
    this.lastPanel = panel;

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: this.getLocalRoots(document.uri)
    };
    panel.webview.html = this.getHtml(document, panel.webview);

    const receiveSubscription = panel.webview.onDidReceiveMessage(
      async (message: { type?: string }) => {
        if (message.type === "selectSoundFont") {
          await this.selectSoundFont(panel, document.uri);
        }
      }
    );

    panel.onDidChangeViewState(({ webviewPanel }) => {
      if (webviewPanel.active) {
        this.lastPanel = webviewPanel;
      }
    });

    panel.onDidDispose(() => {
      receiveSubscription.dispose();
      this.panels.delete(panel);
      if (this.lastPanel === panel) {
        this.lastPanel = [...this.panels].at(-1);
      }
    });
  }

  async selectSoundFontFromCommand(): Promise<void> {
    if (!this.lastPanel) {
      void vscode.window.showInformationMessage(
        "Open a MIDI file before selecting a SoundFont."
      );
      return;
    }
    const activeEditor = vscode.window.activeTextEditor?.document.uri;
    await this.selectSoundFont(
      this.lastPanel,
      activeEditor ?? vscode.Uri.file(this.context.extensionPath)
    );
  }

  private async selectSoundFont(
    panel: vscode.WebviewPanel,
    midiUri: vscode.Uri
  ): Promise<void> {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      title: "Select a General MIDI SoundFont",
      filters: {
        "Sound banks": ["sf2", "sf3", "dls"]
      }
    });
    const soundFontUri = selected?.[0];
    if (!soundFontUri) {
      return;
    }

    await vscode.workspace
      .getConfiguration("midiRealPlayer")
      .update(
        SOUND_FONT_SETTING,
        soundFontUri.fsPath,
        vscode.ConfigurationTarget.Global
      );

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: this.getLocalRoots(midiUri, soundFontUri)
    };
    await panel.webview.postMessage({
      type: "soundFontSelected",
      uri: panel.webview.asWebviewUri(soundFontUri).toString(),
      label: path.basename(soundFontUri.fsPath)
    });
  }

  private getConfiguredSoundFont(): vscode.Uri | undefined {
    const configured = vscode.workspace
      .getConfiguration("midiRealPlayer")
      .get<string>(SOUND_FONT_SETTING, "")
      .trim();
    return configured ? vscode.Uri.file(configured) : undefined;
  }

  private getSoundFont(): vscode.Uri {
    return (
      this.getConfiguredSoundFont() ??
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        BUNDLED_SOUND_FONT
      )
    );
  }

  private getLocalRoots(
    midiUri: vscode.Uri,
    selectedSoundFont = this.getSoundFont()
  ): vscode.Uri[] {
    const roots = [
      vscode.Uri.joinPath(this.context.extensionUri, "media"),
      vscode.Uri.joinPath(midiUri, "..")
    ];
    if (selectedSoundFont) {
      roots.push(vscode.Uri.joinPath(selectedSoundFont, ".."));
    }
    return roots;
  }

  private getHtml(document: MidiDocument, webview: vscode.Webview): string {
    const nonce = createNonce();
    const mainScript = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "main.js")
    );
    const mainStyle = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "main.css")
    );
    const instrumentSprite = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "gm-instrument-families.png"
      )
    );
    const worklet = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "spessasynth_processor.min.js"
      )
    );
    const midiUri = webview.asWebviewUri(document.uri);
    const soundFont = this.getSoundFont();
    const soundFontUri = webview.asWebviewUri(soundFont).toString();
    const soundFontLabel = this.getConfiguredSoundFont()
      ? path.basename(soundFont.fsPath)
      : "GeneralUser GS · Built in";

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource}; style-src 'nonce-${nonce}' ${webview.cspSource}; script-src 'nonce-${nonce}' 'wasm-unsafe-eval' ${webview.cspSource}; connect-src ${webview.cspSource}; worker-src blob:;"
    >
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <link rel="stylesheet" href="${mainStyle}">
    <style nonce="${nonce}">
      :root { --instrument-sprite: url("${escapeAttribute(instrumentSprite.toString())}"); }
    </style>
    <title>MIDI RealPlayer</title>
  </head>
  <body
    data-midi-uri="${escapeAttribute(midiUri.toString())}"
    data-file-name="${escapeAttribute(path.basename(document.uri.fsPath))}"
    data-worklet-uri="${escapeAttribute(worklet.toString())}"
    data-sound-font-uri="${escapeAttribute(soundFontUri)}"
    data-sound-font-label="${escapeAttribute(soundFontLabel)}"
  >
    <div id="app" aria-busy="true">
      <section class="loading-screen" role="status">
        <div class="loading-mark" aria-hidden="true"></div>
        <div>
          <strong>Reading MIDI structure</strong>
          <span>This should only take a moment.</span>
        </div>
      </section>
    </div>
    <script nonce="${nonce}" src="${mainScript}"></script>
  </body>
</html>`;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new MidiEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      supportsMultipleEditorsPerDocument: true,
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }),
    vscode.commands.registerCommand(
      "midiRealPlayer.selectSoundFont",
      () => provider.selectSoundFontFromCommand()
    )
  );
}

function createNonce(): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length: 32 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join("");
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
