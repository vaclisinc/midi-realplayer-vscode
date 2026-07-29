import { Midi } from "@tonejs/midi";
import { BasicMIDI } from "spessasynth_core";
import { Sequencer, WorkletSynthesizer } from "spessasynth_lib";
import {
  buildFilteredMidi,
  findLogicalTrackSources
} from "./midi-filter";
import {
  getInstrumentFamilyClass,
  getInstrumentFamilyColor,
  getInstrumentThumbnailIndex,
  resolveInstrumentFamily
} from "./instrument-thumbnails";
import { getActiveNotesAtTime } from "./note-chase";
import { resolvePianoRollSeek } from "./piano-roll-seek";
import { resolvePreset } from "./preset-resolution";
import {
  centerViewWindow,
  followPlaybackView,
  panViewWindow,
  resetViewWindowToStart,
  zoomViewWindow
} from "./view-window";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

type TrackModel = {
  sourceTrackIndex: number;
  sourceChannel?: number;
  name: string;
  instrument: string;
  resolvedPreset?: string;
  presetFallback: boolean;
  channel?: number;
  instrumentFamily: string;
  isDrums: boolean;
  notes: Array<{
    midi: number;
    time: number;
    duration: number;
    velocity: number;
    ticks: number;
  }>;
  enabled: boolean;
  color: string;
};

type SoundFontState = "missing" | "loading" | "ready" | "error";

const vscode = acquireVsCodeApi();
const savedWebviewState = vscode.getState() as
  | { followPlayhead?: boolean }
  | undefined;
const body = document.body;
const app = requireElement<HTMLDivElement>("#app");

const midiUri = body.dataset.midiUri ?? "";
const fileName = body.dataset.fileName ?? "sequence.mid";
const workletUri = body.dataset.workletUri ?? "";
let soundFontUri = body.dataset.soundFontUri ?? "";
let soundFontLabel = body.dataset.soundFontLabel ?? "Choose SoundFont";
let soundFontIsCustom = body.dataset.soundFontCustom === "true";

let parsedMidi: Midi;
let originalMidi: BasicMIDI;
let tracks: TrackModel[] = [];
let currentTime = 0;
let viewStart = 0;
let viewEnd = 1;
let minPitch = 21;
let maxPitch = 108;
let soundFontState: SoundFontState = "missing";
let audioContext: AudioContext | undefined;
let synthesizer: WorkletSynthesizer | undefined;
let sequencer: Sequencer | undefined;
let rebuildQueue = Promise.resolve();
let useDirectChannelMuting = false;
let pendingEngineTime = 0;
let animationFrame = 0;
let followPlayhead = savedWebviewState?.followPlayhead ?? true;
let canvas: HTMLCanvasElement;
let scrubber: HTMLInputElement;
let timeReadout: HTMLElement;
let positionReadout: HTMLElement;
let playButton: HTMLButtonElement;
let playIcon: SVGElement;
let pauseIcon: SVGElement;
let followPlayheadButton: HTMLButtonElement;
let followPlayheadState: HTMLElement;
let soundFontButton: HTMLButtonElement;
let soundFontModeElement: HTMLElement;
let soundFontMenu: HTMLElement;
let defaultSoundFontOption: HTMLButtonElement;
let customSoundFontOption: HTMLButtonElement;
let statusToast: HTMLElement;

void initialize();

async function initialize(): Promise<void> {
  try {
    const response = await fetch(midiUri);
    if (!response.ok) {
      throw new Error(`VS Code could not read ${fileName}.`);
    }
    const binary = await response.arrayBuffer();
    parsedMidi = new Midi(binary.slice(0));
    originalMidi = BasicMIDI.fromArrayBuffer(binary.slice(0), fileName);
    createTrackModels();
    if (tracks.length === 0) {
      renderEmptyState();
      return;
    }
    viewEnd = Math.max(parsedMidi.duration, 0.001);
    updatePitchRange();
    renderApplication();
    bindApplication();
    renderAll();
    app.setAttribute("aria-busy", "false");

    if (soundFontUri) {
      await loadSoundFont(soundFontUri, soundFontLabel);
    } else {
      setSoundFontState(
        "missing",
        "Choose a SoundFont to hear the instruments in this MIDI file."
      );
      window.setTimeout(hideStatus, 3600);
    }
    animationFrame = requestAnimationFrame(updateFrame);
  } catch (error) {
    renderError(error);
  }
}

function createTrackModels(): void {
  const logicalTrackSources = findLogicalTrackSources(originalMidi);
  tracks = parsedMidi.tracks.map((track, visualIndex): TrackModel => {
      const source = logicalTrackSources[visualIndex] ?? {
        trackIndex: -1,
        channel: track.notes.length > 0 ? track.channel : undefined
      };
      const sourceIndex =
        source.trackIndex;
      const instrument =
        track.notes.length === 0
          ? "No note events"
          : track.channel === 9
          ? "Drums"
          : titleCase(track.instrument.name || "Acoustic Grand Piano");
      const isDrums = source.channel === 9;
      const instrumentFamily = track.instrument.family || "music";
      return {
        sourceTrackIndex: sourceIndex,
        sourceChannel: source.channel,
        name: track.name.trim() || `Untitled Track ${visualIndex + 1}`,
        instrument,
        presetFallback: false,
        channel: source.channel,
        instrumentFamily,
        isDrums,
        notes: track.notes.map((note) => ({
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity,
          ticks: note.ticks
        })),
        enabled: true,
        color: getInstrumentFamilyColor(instrumentFamily, isDrums, visualIndex)
      };
    });
  const channels = tracks
    .map((track) => track.sourceChannel)
    .filter((channel): channel is number => channel !== undefined);
  useDirectChannelMuting = new Set(channels).size === channels.length;
}

function renderApplication(): void {
  app.innerHTML = `
    <main class="app-shell">
      <aside class="track-rail" aria-label="MIDI tracks">
        <header class="section-heading">
          <h1>Tracks</h1>
          <span class="track-count">${tracks.length}</span>
        </header>
        <div class="track-list" id="track-list"></div>
      </aside>
      <section class="piano-roll-region" aria-label="Piano roll">
        <canvas id="piano-roll" tabindex="0" aria-label="Multi-track MIDI piano roll. Click a note to restart it, or click empty space to seek."></canvas>
        <div class="view-tools" aria-label="Piano roll zoom">
          <button id="zoom-out" type="button" aria-label="Zoom out">−</button>
          <button id="fit-view" type="button" aria-label="Fit full MIDI">Fit</button>
          <button id="zoom-in" type="button" aria-label="Zoom in">+</button>
        </div>
      </section>
      <footer class="transport" aria-label="MIDI transport">
        <div class="transport-cluster">
          <div class="transport-buttons">
            <button class="transport-button" id="go-start" type="button" aria-label="Go to start" title="Go to start">
              <svg class="transport-icon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.25 2.5v11M12.75 3.25 6.5 8l6.25 4.75"/>
              </svg>
            </button>
            <button class="transport-button primary" id="play" type="button" aria-label="Play" title="Play (Space)">
              <svg class="transport-icon transport-icon-fill" id="play-icon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4.25 2.75 13 8l-8.75 5.25z"/>
              </svg>
              <svg class="transport-icon transport-icon-fill" id="pause-icon" viewBox="0 0 16 16" aria-hidden="true" hidden>
                <rect x="3.5" y="2.75" width="3.25" height="10.5"/>
                <rect x="9.25" y="2.75" width="3.25" height="10.5"/>
              </svg>
            </button>
            <button class="transport-button" id="stop" type="button" aria-label="Stop" title="Stop">
              <svg class="transport-icon transport-icon-fill" viewBox="0 0 16 16" aria-hidden="true">
                <rect x="3.25" y="3.25" width="9.5" height="9.5"/>
              </svg>
            </button>
          </div>
          <span class="transport-divider" aria-hidden="true"></span>
          <button class="transport-follow-toggle" id="follow-playhead" type="button" aria-pressed="${followPlayhead}">
            <span>Follow</span>
            <span class="transport-follow-state" id="follow-playhead-state">${followPlayhead ? "On" : "Off"}</span>
          </button>
        </div>
        <div class="time-group" aria-live="off">
          <span class="time-readout" id="time-readout">00:00.000</span>
          <span class="position-readout" id="position-readout">1.1.000</span>
        </div>
        <input class="scrubber" id="scrubber" type="range" min="0" max="${parsedMidi.duration}" value="0" step="0.001" aria-label="Playback position">
        <button class="soundfont-button" id="soundfont-button" type="button" data-state="missing" aria-haspopup="menu" aria-expanded="false">
          <span class="soundfont-dot" aria-hidden="true"></span>
          <span class="soundfont-title">
            <span class="soundfont-title-full">SoundFont</span>
            <span class="soundfont-title-short">SF</span>
          </span>
          <span class="soundfont-mode" id="soundfont-mode">${soundFontIsCustom ? "Custom" : "Default"}</span>
          <svg class="soundfont-chevron" viewBox="0 0 12 12" aria-hidden="true">
            <path d="m2.5 4.25 3.5 3.5 3.5-3.5"/>
          </svg>
        </button>
        <div class="soundfont-menu" id="soundfont-menu" role="menu" aria-label="Choose SoundFont" hidden>
          <button class="soundfont-option" id="soundfont-default" type="button" role="menuitemradio" aria-checked="${!soundFontIsCustom}">
            <span>Default</span>
          </button>
          <button class="soundfont-option" id="soundfont-custom" type="button" role="menuitemradio" aria-checked="${soundFontIsCustom}">
            <span>Custom…</span>
          </button>
        </div>
      </footer>
      <div class="status-toast" id="status-toast" role="status" hidden></div>
    </main>
  `;

  canvas = requireElement("#piano-roll");
  scrubber = requireElement("#scrubber");
  timeReadout = requireElement("#time-readout");
  positionReadout = requireElement("#position-readout");
  playButton = requireElement("#play");
  playIcon = requireElement("#play-icon");
  pauseIcon = requireElement("#pause-icon");
  followPlayheadButton = requireElement("#follow-playhead");
  followPlayheadState = requireElement("#follow-playhead-state");
  soundFontButton = requireElement("#soundfont-button");
  soundFontModeElement = requireElement("#soundfont-mode");
  soundFontMenu = requireElement("#soundfont-menu");
  defaultSoundFontOption = requireElement("#soundfont-default");
  customSoundFontOption = requireElement("#soundfont-custom");
  statusToast = requireElement("#status-toast");
  renderTrackList();
}

function bindApplication(): void {
  const resizeObserver = new ResizeObserver(() => renderCanvas());
  resizeObserver.observe(canvas);

  requireElement<HTMLButtonElement>("#go-start").addEventListener("click", () => {
    seekToStart();
  });
  requireElement<HTMLButtonElement>("#stop").addEventListener("click", stop);
  playButton.addEventListener("click", () => void togglePlayback());
  followPlayheadButton.addEventListener("click", toggleFollowPlayhead);
  scrubber.addEventListener("input", () => {
    const targetTime = Number(scrubber.value);
    const nextView = centerViewWindow(
      targetTime,
      viewStart,
      viewEnd,
      parsedMidi.duration
    );
    viewStart = nextView.start;
    viewEnd = nextView.end;
    seekTo(targetTime);
  });
  soundFontButton.addEventListener("click", toggleSoundFontMenu);
  defaultSoundFontOption.addEventListener("click", () => {
    closeSoundFontMenu();
    if (soundFontIsCustom) {
      vscode.postMessage({ type: "resetSoundFont" });
    }
  });
  customSoundFontOption.addEventListener("click", () => {
    closeSoundFontMenu();
    vscode.postMessage({ type: "selectSoundFont" });
  });
  requireElement<HTMLButtonElement>("#zoom-in").addEventListener("click", () => {
    zoomView(0.5);
  });
  requireElement<HTMLButtonElement>("#zoom-out").addEventListener("click", () => {
    zoomView(2);
  });
  requireElement<HTMLButtonElement>("#fit-view").addEventListener("click", () => {
    viewStart = 0;
    viewEnd = parsedMidi.duration;
    renderCanvas();
  });
  updateFollowPlayheadButton();

  canvas.addEventListener("pointerdown", (event) => {
    const bounds = canvas.getBoundingClientRect();
    const keyboardWidth = 48;
    const headerHeight = 28;
    const ratio = clamp(
      (event.clientX - bounds.left - keyboardWidth) /
        Math.max(1, bounds.width - keyboardWidth),
      0,
      1
    );
    const clickedTime = viewStart + ratio * (viewEnd - viewStart);
    const canvasY = event.clientY - bounds.top;
    const gridHeight = Math.max(1, bounds.height - headerHeight);
    const rowHeight = gridHeight / Math.max(1, maxPitch - minPitch + 1);
    const clickedMidi =
      event.clientX - bounds.left >= keyboardWidth && canvasY >= headerHeight
        ? clamp(
            maxPitch - Math.floor((canvasY - headerHeight) / rowHeight),
            minPitch,
            maxPitch
          )
        : undefined;
    const target = resolvePianoRollSeek(tracks, clickedTime, clickedMidi);
    seekTo(target.displayTime, target.engineTime);
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const bounds = canvas.getBoundingClientRect();
        const keyboardWidth = 48;
        const anchorRatio = clamp(
          (event.clientX - bounds.left - keyboardWidth) /
            Math.max(1, bounds.width - keyboardWidth),
          0,
          1
        );
        const anchorTime =
          viewStart + anchorRatio * (viewEnd - viewStart);
        zoomView(
          Math.exp(event.deltaY * 0.006),
          anchorTime,
          anchorRatio
        );
        return;
      }

      const panDelta =
        Math.abs(event.deltaX) > 0.5
          ? event.deltaX
          : event.shiftKey
            ? event.deltaY
            : 0;
      if (panDelta === 0) {
        return;
      }
      event.preventDefault();
      const nextView = panViewWindow(
        (panDelta / 600) * (viewEnd - viewStart),
        viewStart,
        viewEnd,
        parsedMidi.duration
      );
      viewStart = nextView.start;
      viewEnd = nextView.end;
      renderCanvas();
    },
    { passive: false }
  );
  canvas.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      seekTo(
        currentTime +
          (event.key === "ArrowLeft" ? -1 : 1) *
            (event.shiftKey ? 5 : 0.1)
      );
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !soundFontMenu.hidden) {
      event.preventDefault();
      closeSoundFontMenu();
      soundFontButton.focus();
      return;
    }
    if (
      !soundFontMenu.hidden &&
      (event.key === "ArrowDown" || event.key === "ArrowUp")
    ) {
      event.preventDefault();
      const onDefault = document.activeElement === defaultSoundFontOption;
      (onDefault ? customSoundFontOption : defaultSoundFontOption).focus();
      return;
    }
    if (
      event.code === "Space" &&
      !(event.target instanceof HTMLButtonElement) &&
      !(event.target instanceof HTMLInputElement)
    ) {
      event.preventDefault();
      void togglePlayback();
    }
  });
  window.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (
      target instanceof Node &&
      !soundFontMenu.hidden &&
      !soundFontMenu.contains(target) &&
      !soundFontButton.contains(target)
    ) {
      closeSoundFontMenu();
    }
  });
  window.addEventListener("beforeunload", () => {
    cancelAnimationFrame(animationFrame);
    synthesizer?.destroy();
    void audioContext?.close();
  });
  window.addEventListener("message", (event: MessageEvent) => {
    const message = event.data as {
      type?: string;
      uri?: string;
      label?: string;
      custom?: boolean;
    };
    if (message.type === "soundFontSelected" && message.uri) {
      soundFontUri = message.uri;
      soundFontLabel = message.label ?? "SoundFont";
      soundFontIsCustom = message.custom ?? true;
      updateSoundFontControl();
      void loadSoundFont(soundFontUri, soundFontLabel);
    }
  });
}

function renderTrackList(): void {
  const list = requireElement<HTMLDivElement>("#track-list");
  list.innerHTML = tracks
    .map((track, index) => {
      const displayFamily = resolveInstrumentFamily(
        track.instrumentFamily,
        track.isDrums,
        track.name,
        track.notes.length > 0
      );
      return `
        <div
          class="track-row track-family-${getInstrumentFamilyClass(
            displayFamily,
            track.isDrums
          )}"
          data-track="${index}"
          data-enabled="${track.enabled}"
        >
          <span
            class="track-cover${track.notes.length === 0 ? " track-cover-empty" : ""}"
          >
            <span
              class="track-cover-art"
              data-family-index="${getInstrumentThumbnailIndex(
                displayFamily,
                track.isDrums
              )}"
              aria-hidden="true"
            ></span>
            <span class="track-cover-number">[${String(index + 1).padStart(2, "0")}]</span>
            <span class="track-name" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</span>
            <span class="track-copy">
              ${renderTrackMeta(track, index)}
            </span>
          </span>
          <span class="track-state">
            <span class="track-state-label" aria-hidden="true">${track.enabled ? "On" : "Off"}</span>
            <button
              class="track-toggle"
              type="button"
              role="switch"
              aria-checked="${track.enabled}"
              aria-label="${track.enabled ? "Turn off" : "Turn on"} ${escapeHtml(track.name)}"
              title="${track.enabled ? "Mute track" : "Enable track"}"
            ><span class="track-toggle-knob" aria-hidden="true"></span></button>
          </span>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll<HTMLButtonElement>(".track-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest<HTMLElement>(".track-row");
      const index = Number(row?.dataset.track ?? -1);
      const track = tracks[index];
      if (!track) {
        return;
      }
      track.enabled = !track.enabled;
      renderTrackList();
      updatePitchRange();
      renderCanvas();
      if (synthesizer && useDirectChannelMuting) {
        applyTrackMuteState(track);
        if (track.enabled && sequencer && !sequencer.paused) {
          chaseActiveNotes(sequencer.currentTime, [track]);
        }
      } else if (sequencer) {
        queueSequenceRebuild();
      }
    });
  });
}

async function loadSoundFont(uri: string, label: string): Promise<void> {
  setSoundFontState("loading", `Loading ${label}…`);

  try {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`VS Code could not read ${label}.`);
    }
    const soundBank = await response.arrayBuffer();

    sequencer?.pause();
    synthesizer?.stopAll(true);
    synthesizer?.destroy();
    await audioContext?.close();

    audioContext = new AudioContext();
    await audioContext.audioWorklet.addModule(workletUri);
    synthesizer = new WorkletSynthesizer(audioContext);
    synthesizer.connect(audioContext.destination);
    await synthesizer.isReady;
    await synthesizer.soundBankManager.addSoundBank(soundBank, "main");
    sequencer = new Sequencer(synthesizer, {
      skipToFirstNoteOn: false,
      initialPlaybackRate: 1
    });
    sequencer.eventHandler.addEvent("songEnded", "viewer-ended", () => {
      currentTime = parsedMidi.duration;
      updateTransportButtons();
      updateReadouts();
    });
    sequencer.eventHandler.addEvent("midiError", "viewer-error", (error) => {
      showStatus(
        `This MIDI could not be played: ${error.message || "the sequence is not supported."}`
      );
    });
    synthesizer.eventHandler.addEvent(
      "programChange",
      "viewer-program-change",
      ({ channel }) => {
        refreshResolvedPreset(channel);
      }
    );
    await rebuildSequence(false);
    refreshResolvedPresets();
    applyAllTrackMuteStates();
    setSoundFontState("ready", `${label} is ready.`);
    window.setTimeout(hideStatus, 1800);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The SoundFont could not be loaded.";
    setSoundFontState("error", `${message} Choose another SF2, SF3, or DLS file.`);
  }
}

function refreshResolvedPresets(): void {
  const channels = new Set(
    tracks
      .map((track) => track.sourceChannel)
      .filter((channel): channel is number => channel !== undefined)
  );
  for (const channel of channels) {
    refreshResolvedPreset(channel, false);
  }
  updateTrackMetaElements();
}

function refreshResolvedPreset(
  channel: number,
  render = true
): void {
  if (!synthesizer) {
    return;
  }
  const requested = synthesizer.midiChannels[channel]?.patch;
  if (!requested) {
    return;
  }
  const resolution = resolvePreset(
    synthesizer.presetList,
    requested,
    synthesizer.midiParameters.system
  );
  for (const track of tracks) {
    if (track.sourceChannel !== channel) {
      continue;
    }
    track.resolvedPreset = resolution?.name;
    track.presetFallback = resolution?.fallback ?? false;
  }
  if (render) {
    updateTrackMetaElements(channel);
  }
}

function updateTrackMetaElements(channel?: number): void {
  tracks.forEach((track, index) => {
    if (channel !== undefined && track.sourceChannel !== channel) {
      return;
    }
    const current = document.querySelector<HTMLElement>(
      `[data-track-meta="${index}"]`
    );
    if (current) {
      current.outerHTML = renderTrackMeta(track, index);
    }
  });
}

function renderTrackMeta(track: TrackModel, index: number): string {
  if (track.channel === undefined) {
    return `<span class="track-meta" data-track-meta="${index}">No notes</span>`;
  }
  if (track.presetFallback && track.resolvedPreset) {
    const warning =
      `MIDI requested ${track.instrument}, but the SoundFont is playing ` +
      `${track.resolvedPreset}.`;
    return `
      <span
        class="track-meta track-meta-warning"
        data-track-meta="${index}"
        title="${escapeHtml(warning)}"
        aria-label="${escapeHtml(warning)}"
      >⚠ ${escapeHtml(track.instrument)} → ${escapeHtml(track.resolvedPreset)}</span>
    `;
  }
  return `<span class="track-meta" data-track-meta="${index}">${escapeHtml(track.instrument)}</span>`;
}

async function rebuildSequence(resumePreviousState = true): Promise<void> {
  if (!sequencer || !synthesizer) {
    return;
  }
  const wasPlaying = resumePreviousState && !sequencer.paused;
  const restoreTime = clamp(
    resumePreviousState ? sequencer.currentTime : currentTime,
    0,
    parsedMidi.duration
  );

  sequencer.pause();
  synthesizer.stopAll(true);
  const disabledTracks = tracks
    .filter((track) => !track.enabled)
    .map((track) => ({
      trackIndex: track.sourceTrackIndex,
      channel: track.sourceChannel
    }))
    .filter((track) => track.trackIndex >= 0);
  if (tracks.every((track) => !track.enabled)) {
    disabledTracks.splice(
      0,
      disabledTracks.length,
      ...originalMidi.tracks.map((_, trackIndex) => ({
        trackIndex,
        channel: undefined
      }))
    );
  }
  const binary = buildFilteredMidi(originalMidi, disabledTracks);

  await new Promise<void>((resolve) => {
    const eventId = `viewer-rebuild-${Date.now()}-${Math.random()}`;
    sequencer!.eventHandler.addEvent(
      "songChange",
      eventId,
      () => {
        sequencer?.eventHandler.removeEvent("songChange", eventId);
        resolve();
      }
    );
    sequencer!.loadNewSongList([{ binary, fileName }]);
  });

  sequencer.currentTime = restoreTime;
  currentTime = restoreTime;
  pendingEngineTime = restoreTime;
  if (wasPlaying) {
    await audioContext?.resume();
    sequencer.play();
    chaseActiveNotes(currentTime);
  }
  updateTransportButtons();
}

function applyTrackMuteState(track: TrackModel): void {
  if (!synthesizer || track.sourceChannel === undefined) {
    return;
  }
  const channel = synthesizer.midiChannels[track.sourceChannel];
  channel?.setSystemParameter("isMuted", !track.enabled);
  if (!track.enabled) {
    synthesizer.sendMessage([
      0xb0 | track.sourceChannel,
      120,
      0
    ]);
  }
}

function applyAllTrackMuteStates(): void {
  if (!useDirectChannelMuting) {
    return;
  }
  for (const track of tracks) {
    applyTrackMuteState(track);
  }
}

function queueSequenceRebuild(): void {
  rebuildQueue = rebuildQueue
    .then(() => rebuildSequence())
    .catch((error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "The enabled tracks could not be applied.";
      showStatus(`Track playback could not be updated: ${message}`);
    });
}

async function togglePlayback(): Promise<void> {
  if (sequencer && !sequencer.paused) {
    pausePlayback();
    return;
  }
  await startPlayback();
}

async function startPlayback(): Promise<void> {
  if (!sequencer || !audioContext || soundFontState !== "ready") {
    vscode.postMessage({ type: "selectSoundFont" });
    return;
  }
  if (!sequencer.paused) {
    return;
  }
  if (currentTime >= parsedMidi.duration - 0.001) {
    seekToStart();
  }
  if (followPlayhead) {
    revealPlayhead();
  }
  await audioContext.resume();
  sequencer.currentTime = clamp(
    pendingEngineTime,
    0,
    parsedMidi.duration
  );
  sequencer.play();
  chaseActiveNotes(currentTime);
  updateTransportButtons();
}

function pausePlayback(): void {
  if (!sequencer || sequencer.paused) {
    return;
  }
  currentTime = sequencer.currentTime;
  sequencer.pause();
  synthesizer?.stopAll(false);
  pendingEngineTime = currentTime;
  updateTransportButtons();
}

function stop(): void {
  sequencer?.pause();
  synthesizer?.stopAll(true);
  seekToStart();
  updateTransportButtons();
}

function seekToStart(): void {
  const nextView = resetViewWindowToStart(
    viewStart,
    viewEnd,
    parsedMidi.duration
  );
  viewStart = nextView.start;
  viewEnd = nextView.end;
  seekTo(0);
}

function seekTo(time: number, engineTime = time): void {
  currentTime = clamp(time, 0, parsedMidi.duration);
  pendingEngineTime = clamp(engineTime, 0, parsedMidi.duration);
  if (sequencer) {
    sequencer.currentTime = pendingEngineTime;
    if (!sequencer.paused) {
      chaseActiveNotes(currentTime);
    }
  }
  updateReadouts();
  renderCanvas();
}

function chaseActiveNotes(
  time: number,
  candidateTracks: TrackModel[] = tracks
): void {
  if (!synthesizer) {
    return;
  }
  for (const note of getActiveNotesAtTime(candidateTracks, time)) {
    synthesizer.noteOn(note.channel, note.midi, note.velocity);
  }
}

function updateFrame(): void {
  if (sequencer && !sequencer.paused) {
    currentTime = clamp(
      sequencer.currentTime,
      0,
      parsedMidi.duration
    );
    if (followPlayhead) {
      const nextView = followPlaybackView(
        currentTime,
        viewStart,
        viewEnd,
        parsedMidi.duration
      );
      viewStart = nextView.start;
      viewEnd = nextView.end;
    }
    updateReadouts();
    renderCanvas();
  }
  animationFrame = requestAnimationFrame(updateFrame);
}

function updateTransportButtons(): void {
  const playing = sequencer ? !sequencer.paused : false;
  playIcon.toggleAttribute("hidden", playing);
  pauseIcon.toggleAttribute("hidden", !playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
  playButton.title = playing ? "Pause (Space)" : "Play (Space)";
}

function toggleFollowPlayhead(): void {
  followPlayhead = !followPlayhead;
  vscode.setState({ followPlayhead });
  updateFollowPlayheadButton();
  if (followPlayhead && sequencer && !sequencer.paused) {
    revealPlayhead();
  }
}

function updateFollowPlayheadButton(): void {
  followPlayheadButton.setAttribute(
    "aria-pressed",
    String(followPlayhead)
  );
  followPlayheadButton.setAttribute(
    "aria-label",
    `Follow playhead, ${followPlayhead ? "on" : "off"}`
  );
  followPlayheadButton.title =
    "Keep playhead visible during playback";
  followPlayheadState.textContent = followPlayhead ? "On" : "Off";
}

function revealPlayhead(): void {
  const nextView = followPlaybackView(
    currentTime,
    viewStart,
    viewEnd,
    parsedMidi.duration
  );
  viewStart = nextView.start;
  viewEnd = nextView.end;
  renderCanvas();
}

function updateReadouts(): void {
  scrubber.value = String(currentTime);
  timeReadout.textContent = formatTime(currentTime);
  positionReadout.textContent = formatMusicalPosition(currentTime);
}

function zoomView(
  factor: number,
  anchorTime = currentTime,
  anchorRatio?: number
): void {
  const duration = parsedMidi.duration;
  const currentWindow = viewEnd - viewStart;
  const resolvedRatio =
    anchorRatio ??
    (anchorTime >= viewStart && anchorTime <= viewEnd && currentWindow > 0
      ? (anchorTime - viewStart) / currentWindow
      : 0.5);
  const nextView = zoomViewWindow(
    anchorTime,
    resolvedRatio,
    factor,
    viewStart,
    viewEnd,
    duration
  );
  viewStart = nextView.start;
  viewEnd = nextView.end;
  renderCanvas();
}

function updatePitchRange(): void {
  const pitches = tracks
    .filter((track) => track.enabled)
    .flatMap((track) => track.notes.map((note) => note.midi));
  if (pitches.length === 0) {
    minPitch = 21;
    maxPitch = 108;
    return;
  }
  minPitch = clamp(Math.min(...pitches) - 1, 0, 127);
  maxPitch = clamp(Math.max(...pitches) + 1, 0, 127);
}

function renderAll(): void {
  updateReadouts();
  renderCanvas();
}

function renderCanvas(): void {
  if (!canvas || !parsedMidi) {
    return;
  }
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) {
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * dpr);
  canvas.height = Math.round(bounds.height * dpr);
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.scale(dpr, dpr);

  const styles = getComputedStyle(document.documentElement);
  const background = styles.getPropertyValue("--surface-base").trim();
  const raised = styles.getPropertyValue("--surface-raised").trim();
  const border = styles.getPropertyValue("--border").trim();
  const muted = styles.getPropertyValue("--text-muted").trim();
  const text = styles.getPropertyValue("--text").trim();
  const focus = styles.getPropertyValue("--focus").trim();
  const playhead = styles.getPropertyValue("--playhead").trim() || focus;
  const pianoKeyLight = styles.getPropertyValue("--piano-key-light").trim();
  const pianoKeyDark = styles.getPropertyValue("--piano-key-dark").trim();
  const pianoKeyBorder = styles.getPropertyValue("--piano-key-border").trim();
  const pianoKeyLabel = styles.getPropertyValue("--piano-key-label").trim();
  const interfaceFont =
    styles.getPropertyValue("--interface-font").trim() || "monospace";
  const width = bounds.width;
  const height = bounds.height;
  const headerHeight = 28;
  const keyboardWidth = 48;
  const gridWidth = Math.max(1, width - keyboardWidth);
  const gridHeight = Math.max(1, height - headerHeight);
  const pitchCount = Math.max(1, maxPitch - minPitch + 1);
  const rowHeight = gridHeight / pitchCount;
  const windowDuration = Math.max(0.001, viewEnd - viewStart);

  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = raised;
  context.fillRect(0, 0, width, headerHeight);
  context.fillRect(0, headerHeight, keyboardWidth, gridHeight);

  for (let pitch = minPitch; pitch <= maxPitch; pitch++) {
    const y = headerHeight + (maxPitch - pitch) * rowHeight;
    const pitchClass = pitch % 12;
    const black = [1, 3, 6, 8, 10].includes(pitchClass);
    context.fillStyle = pianoKeyLight;
    context.fillRect(0, y, keyboardWidth, Math.max(1, rowHeight - 0.5));
    if (black) {
      context.fillStyle =
        "color-mix(in oklch, " + raised + ", " + background + " 45%)";
      context.fillRect(keyboardWidth, y, gridWidth, rowHeight);
      context.fillStyle = pianoKeyDark;
      context.fillRect(0, y, keyboardWidth * 0.62, Math.max(1, rowHeight - 0.5));
    }
    context.strokeStyle = border;
    context.globalAlpha = 0.24;
    context.beginPath();
    context.moveTo(keyboardWidth, y);
    context.lineTo(width, y);
    context.stroke();
    context.globalAlpha = 1;
    if (pitchClass === 0 && rowHeight >= 5) {
      context.fillStyle = pianoKeyLabel;
      context.font = `10px ${interfaceFont}`;
      context.textBaseline = "middle";
      context.fillText(`C${Math.floor(pitch / 12) - 1}`, 4, y + rowHeight / 2);
    }
  }
  context.strokeStyle = pianoKeyBorder;
  context.globalAlpha = 1;
  context.beginPath();
  context.moveTo(keyboardWidth - 0.5, headerHeight);
  context.lineTo(keyboardWidth - 0.5, height);
  context.stroke();

  const quarter = parsedMidi.header.ppq;
  const startTick = Math.max(
    0,
    Math.floor(parsedMidi.header.secondsToTicks(viewStart) / quarter) * quarter
  );
  const endTick = parsedMidi.header.secondsToTicks(viewEnd) + quarter;
  context.font = `10px ${interfaceFont}`;
  context.textBaseline = "middle";
  let lastMinorGridX = -Infinity;
  let lastMeasureLabelX = -Infinity;

  for (let tick = startTick; tick <= endTick; tick += quarter) {
    const seconds = parsedMidi.header.ticksToSeconds(tick);
    const x =
      keyboardWidth +
      ((seconds - viewStart) / windowDuration) * gridWidth;
    if (x < keyboardWidth - 1 || x > width + 1) {
      continue;
    }
    const measures = parsedMidi.header.ticksToMeasures(tick);
    const isMeasure = Math.abs(measures - Math.round(measures)) < 0.001;
    if (!isMeasure && x - lastMinorGridX < 4) {
      continue;
    }
    lastMinorGridX = x;
    context.strokeStyle = border;
    context.globalAlpha = isMeasure ? 0.5 : 0.16;
    context.lineWidth = isMeasure ? 1 : 0.5;
    context.beginPath();
    context.moveTo(x, isMeasure ? 0 : headerHeight);
    context.lineTo(x, height);
    context.stroke();
    context.globalAlpha = 1;
    if (isMeasure && x - lastMeasureLabelX >= 28) {
      context.fillStyle = muted;
      context.fillText(String(Math.round(measures) + 1), x + 5, headerHeight / 2);
      lastMeasureLabelX = x;
    }
  }

  context.save();
  context.beginPath();
  context.rect(keyboardWidth, headerHeight, gridWidth, gridHeight);
  context.clip();

  for (const track of tracks) {
    if (!track.enabled) {
      continue;
    }
    for (const note of track.notes) {
      const noteEnd = note.time + Math.max(note.duration, 0.004);
      if (noteEnd < viewStart || note.time > viewEnd) {
        continue;
      }
      const x =
        keyboardWidth +
        ((note.time - viewStart) / windowDuration) * gridWidth;
      const noteWidth = Math.max(
        1.5,
        (Math.max(note.duration, 0.004) / windowDuration) * gridWidth
      );
      const y =
        headerHeight +
        (maxPitch - note.midi) * rowHeight +
        rowHeight * 0.14;
      const noteHeight = Math.max(1.5, rowHeight * 0.72);
      const noteInset = Math.min(0.35, noteWidth * 0.12);
      const drawWidth = Math.max(1, noteWidth - noteInset * 2);
      const radius = Math.min(2.5, drawWidth / 2, noteHeight / 2);
      context.fillStyle = track.color;
      context.globalAlpha = 0.42 + note.velocity * 0.58;
      context.beginPath();
      context.roundRect(x + noteInset, y, drawWidth, noteHeight, radius);
      context.fill();
      context.globalAlpha = 1;
    }
  }
  context.restore();

  const playheadX =
    keyboardWidth +
    ((currentTime - viewStart) / windowDuration) * gridWidth;
  if (playheadX >= keyboardWidth && playheadX <= width) {
    context.strokeStyle = playhead;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(playheadX, 0);
    context.lineTo(playheadX, height);
    context.stroke();
    context.fillStyle = playhead;
    context.beginPath();
    context.moveTo(playheadX - 5, 0);
    context.lineTo(playheadX + 5, 0);
    context.lineTo(playheadX, 7);
    context.closePath();
    context.fill();
  }

  context.strokeStyle = border;
  context.globalAlpha = 0.9;
  context.beginPath();
  context.moveTo(keyboardWidth, 0);
  context.lineTo(keyboardWidth, height);
  context.moveTo(0, headerHeight);
  context.lineTo(width, headerHeight);
  context.stroke();
  context.globalAlpha = 1;
}

function setSoundFontState(state: SoundFontState, message: string): void {
  soundFontState = state;
  soundFontButton.dataset.state = state;
  updateSoundFontControl();
  showStatus(message);
  updateTransportButtons();
}

function updateSoundFontControl(): void {
  soundFontModeElement.textContent = soundFontIsCustom
    ? "Custom"
    : "Default";
  soundFontButton.setAttribute(
    "aria-label",
    `SoundFont: ${soundFontLabel}. Open SoundFont menu`
  );
  defaultSoundFontOption.setAttribute(
    "aria-checked",
    String(!soundFontIsCustom)
  );
  customSoundFontOption.setAttribute(
    "aria-checked",
    String(soundFontIsCustom)
  );
}

function toggleSoundFontMenu(): void {
  const nextOpen = soundFontMenu.hidden;
  soundFontMenu.hidden = !nextOpen;
  soundFontButton.setAttribute("aria-expanded", String(nextOpen));
  if (nextOpen) {
    hideStatus();
    (soundFontIsCustom
      ? customSoundFontOption
      : defaultSoundFontOption
    ).focus();
  }
}

function closeSoundFontMenu(): void {
  soundFontMenu.hidden = true;
  soundFontButton.setAttribute("aria-expanded", "false");
}

function showStatus(message: string): void {
  statusToast.textContent = message;
  statusToast.hidden = false;
}

function hideStatus(): void {
  statusToast.hidden = true;
}

function renderEmptyState(): void {
  app.innerHTML = `
    <section class="empty-screen" role="status">
      <div aria-hidden="true">♪</div>
      <div>
        <strong>No playable notes found</strong>
        <span>${escapeHtml(fileName)} contains no paired note-on and note-off events to display.</span>
      </div>
    </section>
  `;
  app.setAttribute("aria-busy", "false");
}

function renderError(error: unknown): void {
  const reason =
    error instanceof Error ? error.message : "The file is not a supported MIDI sequence.";
  app.innerHTML = `
    <section class="error-screen" role="alert">
      <div aria-hidden="true">!</div>
      <div>
        <strong>MIDI could not be opened</strong>
        <span>${escapeHtml(reason)} Check that the file is a valid .mid or .midi file.</span>
      </div>
    </section>
  `;
  app.setAttribute("aria-busy", "false");
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const milliseconds = Math.floor((safe % 1) * 1000);
  return `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function formatMusicalPosition(seconds: number): string {
  const ticks = parsedMidi.header.secondsToTicks(seconds);
  const measures = parsedMidi.header.ticksToMeasures(ticks);
  const bar = Math.floor(measures) + 1;
  const signature =
    [...parsedMidi.header.timeSignatures]
      .reverse()
      .find((item) => item.ticks <= ticks)?.timeSignature ?? [4, 4];
  const beatsPerBar = signature[0] ?? 4;
  const fraction = measures - Math.floor(measures);
  const exactBeat = fraction * beatsPerBar;
  const beat = Math.floor(exactBeat) + 1;
  const subdivision = Math.floor(
    (exactBeat - Math.floor(exactBeat)) * parsedMidi.header.ppq
  );
  return `${bar}.${beat}.${String(subdivision).padStart(3, "0")}`;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required interface element is missing: ${selector}`);
  }
  return element;
}
