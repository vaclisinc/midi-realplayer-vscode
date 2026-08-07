import * as path from "node:path";
import {
  copyFile,
  open,
  unlink,
  type FileHandle
} from "node:fs/promises";
import * as vscode from "vscode";

const VIEW_TYPE = "midiRealPlayer.viewer";
const SOUND_FONT_SETTING = "soundFontPath";
const BUNDLED_SOUND_FONT = "GeneralUser-GS.sf2";
const VIEWER_STATE_PREFIX = "midiRealPlayer.viewerState:";

type ViewerState = {
  followPlayhead?: boolean;
  viewMode?: "piano-roll" | "arrangement";
  arrangementTrackHeight?: number;
  pianoRollRowHeight?: number;
  tracks?: Record<string, { enabled: boolean; gain: number }>;
};

type AudioExportSession = {
  panel: vscode.WebviewPanel;
  destination: string;
  temporary: string;
  handle: FileHandle;
  expectedChunk: number;
};

class MidiDocument implements vscode.CustomDocument {
  constructor(readonly uri: vscode.Uri) {}
  dispose(): void {}
}

class MidiEditorProvider implements vscode.CustomReadonlyEditorProvider<MidiDocument> {
  private readonly panels = new Set<vscode.WebviewPanel>();
  private readonly audioExports = new Map<string, AudioExportSession>();
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
      async (message: {
        type?: string;
        state?: ViewerState;
        suggestedName?: string;
        exportId?: string;
        chunkIndex?: number;
        data?: string;
        message?: string;
      }) => {
        if (message.type === "selectSoundFont") {
          await this.selectSoundFont(panel, document.uri);
        } else if (message.type === "resetSoundFont") {
          await this.resetSoundFont(panel, document.uri);
        } else if (message.type === "persistViewerState" && message.state) {
          await this.context.workspaceState.update(
            this.getViewerStateKey(document.uri),
            message.state
          );
        } else if (message.type === "beginAudioExport") {
          await this.beginAudioExport(
            panel,
            document.uri,
            message.suggestedName ?? path.parse(document.uri.fsPath).name
          );
        } else if (
          message.type === "audioExportChunk" &&
          message.exportId &&
          typeof message.chunkIndex === "number" &&
          typeof message.data === "string"
        ) {
          await this.writeAudioExportChunk(
            panel,
            message.exportId,
            message.chunkIndex,
            message.data
          );
        } else if (message.type === "finishAudioExport" && message.exportId) {
          await this.finishAudioExport(panel, message.exportId);
        } else if (message.type === "abortAudioExport" && message.exportId) {
          await this.failAudioExport(
            panel,
            message.exportId,
            message.message ?? "Audio export was cancelled."
          );
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
      void this.discardPanelAudioExports(panel);
      this.panels.delete(panel);
      if (this.lastPanel === panel) {
        this.lastPanel = [...this.panels].at(-1);
      }
    });
  }

  private getViewerStateKey(uri: vscode.Uri): string {
    return `${VIEWER_STATE_PREFIX}${uri.toString()}`;
  }

  private async beginAudioExport(
    panel: vscode.WebviewPanel,
    midiUri: vscode.Uri,
    suggestedName: string
  ): Promise<void> {
    const destination = await vscode.window.showSaveDialog({
      title: "Export MIDI mix to audio",
      defaultUri: vscode.Uri.file(
        path.join(
          path.dirname(midiUri.fsPath),
          `${sanitizeFileName(suggestedName)}.wav`
        )
      ),
      filters: { "Wave audio": ["wav"] },
      saveLabel: "Export WAV"
    });
    if (!destination) {
      await panel.webview.postMessage({ type: "audioExportCancelled" });
      return;
    }
    if (destination.scheme !== "file") {
      await panel.webview.postMessage({
        type: "audioExportError",
        message: "Audio export currently supports local file destinations."
      });
      return;
    }

    const exportId = createNonce();
    const temporary = `${destination.fsPath}.midi-realplayer-${exportId}.tmp`;
    try {
      const handle = await open(temporary, "wx");
      this.audioExports.set(exportId, {
        panel,
        destination: destination.fsPath,
        temporary,
        handle,
        expectedChunk: 0
      });
      await panel.webview.postMessage({ type: "audioExportReady", exportId });
    } catch (error) {
      await panel.webview.postMessage({
        type: "audioExportError",
        message: getErrorMessage(error, "The export file could not be created.")
      });
    }
  }

  private async writeAudioExportChunk(
    panel: vscode.WebviewPanel,
    exportId: string,
    chunkIndex: number,
    data: string
  ): Promise<void> {
    const session = this.audioExports.get(exportId);
    if (!session || chunkIndex !== session.expectedChunk) {
      await this.failAudioExport(
        panel,
        exportId,
        "Audio export chunks arrived out of order."
      );
      return;
    }
    try {
      await session.handle.write(Buffer.from(data, "base64"));
      session.expectedChunk += 1;
      await panel.webview.postMessage({
        type: "audioExportChunkWritten",
        exportId,
        chunkIndex
      });
    } catch (error) {
      await this.failAudioExport(
        panel,
        exportId,
        getErrorMessage(error, "Audio export could not be written.")
      );
    }
  }

  private async finishAudioExport(
    panel: vscode.WebviewPanel,
    exportId: string
  ): Promise<void> {
    const session = this.audioExports.get(exportId);
    if (!session) {
      return;
    }
    this.audioExports.delete(exportId);
    try {
      await session.handle.close();
      await copyFile(session.temporary, session.destination);
      await unlink(session.temporary);
      await panel.webview.postMessage({
        type: "audioExportComplete",
        fileName: path.basename(session.destination)
      });
    } catch (error) {
      await unlink(session.temporary).catch(() => undefined);
      await panel.webview.postMessage({
        type: "audioExportError",
        message: getErrorMessage(error, "Audio export could not be finalized.")
      });
    }
  }

  private async failAudioExport(
    panel: vscode.WebviewPanel,
    exportId: string,
    message: string
  ): Promise<void> {
    const session = this.audioExports.get(exportId);
    this.audioExports.delete(exportId);
    if (session) {
      await session.handle.close().catch(() => undefined);
      await unlink(session.temporary).catch(() => undefined);
    }
    await panel.webview.postMessage({ type: "audioExportError", message });
  }

  private async discardPanelAudioExports(
    panel: vscode.WebviewPanel
  ): Promise<void> {
    const matching = [...this.audioExports.entries()].filter(
      ([, session]) => session.panel === panel
    );
    for (const [exportId, session] of matching) {
      this.audioExports.delete(exportId);
      await session.handle.close().catch(() => undefined);
      await unlink(session.temporary).catch(() => undefined);
    }
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
      label: path.basename(soundFontUri.fsPath),
      custom: true
    });
  }

  private async resetSoundFont(
    panel: vscode.WebviewPanel,
    midiUri: vscode.Uri
  ): Promise<void> {
    await vscode.workspace
      .getConfiguration("midiRealPlayer")
      .update(
        SOUND_FONT_SETTING,
        undefined,
        vscode.ConfigurationTarget.Global
      );

    const soundFontUri = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      BUNDLED_SOUND_FONT
    );
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: this.getLocalRoots(midiUri, soundFontUri)
    };
    await panel.webview.postMessage({
      type: "soundFontSelected",
      uri: panel.webview.asWebviewUri(soundFontUri).toString(),
      label: "Default",
      custom: false
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
    const interfaceFont = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "JetBrainsMono-Variable.ttf"
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
    const configuredSoundFont = this.getConfiguredSoundFont();
    const soundFontLabel = configuredSoundFont
      ? path.basename(soundFont.fsPath)
      : "Default";
    const viewerState = this.context.workspaceState.get<ViewerState>(
      this.getViewerStateKey(document.uri),
      {}
    );

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource}; font-src ${webview.cspSource}; style-src 'nonce-${nonce}' ${webview.cspSource}; script-src 'nonce-${nonce}' 'wasm-unsafe-eval' ${webview.cspSource}; connect-src ${webview.cspSource}; worker-src blob:;"
    >
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <link rel="stylesheet" href="${mainStyle}">
    <style nonce="${nonce}">
      @font-face {
        font-family: "JetBrains Mono";
        font-style: normal;
        font-weight: 400 800;
        font-display: swap;
        src: url("${escapeAttribute(interfaceFont.toString())}") format("truetype");
      }
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
    data-sound-font-custom="${configuredSoundFont ? "true" : "false"}"
    data-viewer-state="${escapeAttribute(JSON.stringify(viewerState))}"
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

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\.(mid|midi)$/i, "");
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
