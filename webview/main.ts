import { Midi } from "@tonejs/midi";
import { BasicMIDI } from "spessasynth_core";
import { Sequencer, WorkletSynthesizer } from "spessasynth_lib";
import {
  buildFilteredMidi,
  findLogicalTrackSources
} from "./midi-filter";
import { getInstrumentThumbnailIndex } from "./instrument-thumbnails";
import { resolvePianoRollSeek } from "./piano-roll-seek";
import { resolvePreset } from "./preset-resolution";

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
const body = document.body;
const app = requireElement<HTMLDivElement>("#app");

const midiUri = body.dataset.midiUri ?? "";
const fileName = body.dataset.fileName ?? "sequence.mid";
const workletUri = body.dataset.workletUri ?? "";
let soundFontUri = body.dataset.soundFontUri ?? "";
let soundFontLabel = body.dataset.soundFontLabel ?? "Choose SoundFont";

const trackColors = [
  "oklch(74% 0.13 205)",
  "oklch(79% 0.14 78)",
  "oklch(70% 0.12 18)",
  "oklch(72% 0.11 145)",
  "oklch(69% 0.11 255)",
  "oklch(69% 0.11 310)",
  "oklch(76% 0.1 190)",
  "oklch(77% 0.12 62)",
  "oklch(68% 0.11 28)",
  "oklch(70% 0.1 158)",
  "oklch(71% 0.1 270)",
  "oklch(70% 0.1 325)"
];
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
let animationFrame = 0;
let canvas: HTMLCanvasElement;
let scrubber: HTMLInputElement;
let timeReadout: HTMLElement;
let positionReadout: HTMLElement;
let playButton: HTMLButtonElement;
let soundFontButton: HTMLButtonElement;
let soundFontLabelElement: HTMLElement;
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
      return {
        sourceTrackIndex: sourceIndex,
        sourceChannel: source.channel,
        name: track.name.trim() || `Untitled Track ${visualIndex + 1}`,
        instrument,
        presetFallback: false,
        channel: source.channel,
        instrumentFamily: track.instrument.family || "music",
        isDrums,
        notes: track.notes.map((note) => ({
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity,
          ticks: note.ticks
        })),
        enabled: true,
        color: trackColors[visualIndex % trackColors.length]!
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
        <div class="transport-buttons">
          <button class="transport-button" id="go-start" type="button" aria-label="Go to start" title="Go to start">↤</button>
          <button class="transport-button primary" id="play-pause" type="button" aria-label="Play" title="Play or pause (Space)">▶</button>
          <button class="transport-button" id="stop" type="button" aria-label="Stop" title="Stop">■</button>
        </div>
        <div class="time-group" aria-live="off">
          <span class="time-readout" id="time-readout">00:00.000</span>
          <span class="position-readout" id="position-readout">1.1.000</span>
        </div>
        <input class="scrubber" id="scrubber" type="range" min="0" max="${parsedMidi.duration}" value="0" step="0.001" aria-label="Playback position">
        <button class="soundfont-button" id="soundfont-button" type="button" data-state="missing" aria-label="Choose SoundFont">
          <span class="soundfont-dot" aria-hidden="true"></span>
          <span class="soundfont-type" aria-hidden="true">SF</span>
          <span class="soundfont-label" id="soundfont-label">${escapeHtml(soundFontLabel)}</span>
        </button>
      </footer>
      <div class="status-toast" id="status-toast" role="status" hidden></div>
    </main>
  `;

  canvas = requireElement("#piano-roll");
  scrubber = requireElement("#scrubber");
  timeReadout = requireElement("#time-readout");
  positionReadout = requireElement("#position-readout");
  playButton = requireElement("#play-pause");
  soundFontButton = requireElement("#soundfont-button");
  soundFontLabelElement = requireElement("#soundfont-label");
  statusToast = requireElement("#status-toast");
  renderTrackList();
}

function bindApplication(): void {
  const resizeObserver = new ResizeObserver(() => renderCanvas());
  resizeObserver.observe(canvas);

  requireElement<HTMLButtonElement>("#go-start").addEventListener("click", () => {
    seekTo(0);
  });
  requireElement<HTMLButtonElement>("#stop").addEventListener("click", stop);
  playButton.addEventListener("click", () => void togglePlayback());
  scrubber.addEventListener("input", () => {
    seekTo(Number(scrubber.value));
  });
  soundFontButton.addEventListener("click", () => {
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
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      zoomView(event.deltaY > 0 ? 1.25 : 0.8);
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
    if (
      event.code === "Space" &&
      !(event.target instanceof HTMLButtonElement) &&
      !(event.target instanceof HTMLInputElement)
    ) {
      event.preventDefault();
      void togglePlayback();
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
    };
    if (message.type === "soundFontSelected" && message.uri) {
      soundFontUri = message.uri;
      soundFontLabel = message.label ?? "SoundFont";
      void loadSoundFont(soundFontUri, soundFontLabel);
    }
  });
}

function renderTrackList(): void {
  const list = requireElement<HTMLDivElement>("#track-list");
  list.innerHTML = tracks
    .map(
      (track, index) => `
        <div class="track-row" data-track="${index}" data-enabled="${track.enabled}">
          <span class="track-number">${index + 1}</span>
          <span
            class="track-identity${track.notes.length === 0 ? " track-identity-empty" : ""}"
            data-family-index="${getInstrumentThumbnailIndex(
              track.instrumentFamily,
              track.isDrums
            )}"
            style="--track-color: ${track.color}"
            aria-hidden="true"
          ></span>
          <span class="track-copy">
            <span class="track-name" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</span>
            ${renderTrackMeta(track, index)}
          </span>
          <button
            class="track-toggle"
            type="button"
            role="switch"
            aria-checked="${track.enabled}"
            aria-label="${track.enabled ? "Turn off" : "Turn on"} ${escapeHtml(track.name)}"
            title="${track.enabled ? "Mute track" : "Enable track"}"
          ><span class="track-toggle-knob" aria-hidden="true"></span></button>
        </div>
      `
    )
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
      } else if (sequencer) {
        queueSequenceRebuild();
      }
    });
  });
}

async function loadSoundFont(uri: string, label: string): Promise<void> {
  setSoundFontState("loading", `Loading ${label}…`);
  soundFontLabelElement.textContent = label;

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
      playButton.textContent = "▶";
      playButton.setAttribute("aria-label", "Play");
      currentTime = parsedMidi.duration;
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
      >⚠ Sound: ${escapeHtml(track.instrument)} → ${escapeHtml(track.resolvedPreset)}</span>
    `;
  }
  return `<span class="track-meta" data-track-meta="${index}">Sound: ${escapeHtml(track.instrument)}</span>`;
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
  if (wasPlaying) {
    await audioContext?.resume();
    sequencer.play();
  }
  updatePlayButton();
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
  if (!sequencer || !audioContext || soundFontState !== "ready") {
    vscode.postMessage({ type: "selectSoundFont" });
    return;
  }
  if (sequencer.paused) {
    if (currentTime >= parsedMidi.duration - 0.001) {
      seekTo(0);
    }
    await audioContext.resume();
    sequencer.play();
  } else {
    currentTime = sequencer.currentTime;
    sequencer.pause();
    synthesizer?.stopAll(false);
  }
  updatePlayButton();
}

function stop(): void {
  sequencer?.pause();
  synthesizer?.stopAll(true);
  seekTo(0);
  updatePlayButton();
}

function seekTo(time: number, engineTime = time): void {
  currentTime = clamp(time, 0, parsedMidi.duration);
  if (sequencer) {
    sequencer.currentTime = clamp(engineTime, 0, parsedMidi.duration);
  }
  updateReadouts();
  renderCanvas();
}

function updateFrame(): void {
  if (sequencer && !sequencer.paused) {
    currentTime = clamp(
      sequencer.currentTime,
      0,
      parsedMidi.duration
    );
    updateReadouts();
    renderCanvas();
  }
  animationFrame = requestAnimationFrame(updateFrame);
}

function updatePlayButton(): void {
  const playing = sequencer ? !sequencer.paused : false;
  playButton.textContent = playing ? "Ⅱ" : "▶";
  playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
}

function updateReadouts(): void {
  scrubber.value = String(currentTime);
  timeReadout.textContent = formatTime(currentTime);
  positionReadout.textContent = formatMusicalPosition(currentTime);
}

function zoomView(factor: number): void {
  const duration = parsedMidi.duration;
  const currentWindow = viewEnd - viewStart;
  const nextWindow = clamp(currentWindow * factor, 2, duration);
  const center =
    currentTime >= viewStart && currentTime <= viewEnd
      ? currentTime
      : (viewStart + viewEnd) / 2;
  viewStart = clamp(center - nextWindow / 2, 0, duration - nextWindow);
  viewEnd = viewStart + nextWindow;
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
    if (black) {
      context.fillStyle = "color-mix(in oklch, " + raised + ", " + background + " 45%)";
      context.fillRect(keyboardWidth, y, gridWidth, rowHeight);
      context.fillStyle = "color-mix(in oklch, " + text + ", " + background + " 72%)";
      context.fillRect(0, y, keyboardWidth * 0.62, Math.max(1, rowHeight - 0.5));
    } else {
      context.fillStyle = "color-mix(in oklch, " + text + ", " + background + " 88%)";
      context.fillRect(0, y, keyboardWidth, Math.max(1, rowHeight - 0.5));
    }
    context.strokeStyle = border;
    context.globalAlpha = 0.24;
    context.beginPath();
    context.moveTo(keyboardWidth, y);
    context.lineTo(width, y);
    context.stroke();
    context.globalAlpha = 1;
    if (pitchClass === 0 && rowHeight >= 5) {
      context.fillStyle = muted;
      context.font = "10px var(--vscode-font-family, system-ui)";
      context.textBaseline = "middle";
      context.fillText(`C${Math.floor(pitch / 12) - 1}`, 4, y + rowHeight / 2);
    }
  }

  const quarter = parsedMidi.header.ppq;
  const startTick = Math.max(
    0,
    Math.floor(parsedMidi.header.secondsToTicks(viewStart) / quarter) * quarter
  );
  const endTick = parsedMidi.header.secondsToTicks(viewEnd) + quarter;
  context.font = "10px var(--vscode-font-family, system-ui)";
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
  soundFontButton.setAttribute(
    "aria-label",
    state === "ready"
      ? `SoundFont: ${soundFontLabel}. Choose another SoundFont`
      : "Choose SoundFont"
  );
  showStatus(message);
  updatePlayButton();
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
