# MIDI RealPlayer

**Hear the MIDI you are looking at.**

A free, open-source multi-track MIDI player and piano-roll viewer for VS Code.
MIDI RealPlayer preserves note duration, velocity, tempo, program changes, and
channel performance data, then renders the result through real SoundFont
instruments.

[![Install from VS Marketplace](https://img.shields.io/badge/VS%20Marketplace-Install-007ACC?logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=vaclis.midi-realplayer)
[![GitHub release](https://img.shields.io/github/v/release/vaclisinc/midi-realplayer-vscode?label=Release)](https://github.com/vaclisinc/midi-realplayer-vscode/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-f2c94c.svg)](LICENSE)

[![Watch MIDI RealPlayer in action](assets/midi-realplayer-demo.gif)](https://www.youtube.com/watch?v=uFnpmIG5CA8)

<p align="center">
  <a href="https://www.youtube.com/watch?v=uFnpmIG5CA8"><strong>Watch the full demo on YouTube →</strong></a>
</p>

## Why MIDI RealPlayer?

Many MIDI previewers draw a useful piano roll but play every event as the same
short sound. That makes it difficult to inspect transcription output, compare
arrangements, or understand what a multi-instrument file actually contains.

MIDI RealPlayer keeps the visualization and synthesis engine in agreement:

- **Notes sound for their encoded duration.** Note-on and note-off timing define
  the audible onset and offset.
- **Performance data stays expressive.** Velocity, sustain, pitch bend,
  controllers, tempo changes, bank selection, and program changes are preserved.
- **Tracks behave like tracks.** Switch a track off and its corresponding MIDI
  events are both hidden and silenced.
- **Seeking is musically correct.** Starting inside a sustained note reconstructs
  the sequence state and chases the note instead of waiting for the next onset.
- **Instruments sound like instruments.** General MIDI programs and drums are
  rendered through a SoundFont bank rather than a single generic oscillator.

## Features

### Real multi-track playback

- Unified, color-coded piano roll for `.mid` and `.midi` files
- Independent audible and visual On/Off control for every displayed track
- Original track names, including named tracks with no note events
- Multiple MIDI channels exposed correctly even when stored in one physical track
- Instrument-family colors for faster visual scanning

### SoundFont instruments

- Bundled GeneralUser GS bank: open a MIDI file and press Play
- General MIDI program, bank, and drum-channel support
- Optional custom `.sf2`, `.sf3`, or `.dls` sound banks
- Clear Default/Custom selector with remembered local configuration
- Explicit warning when a requested preset must fall back to another sound

### DAW-style navigation

- Click the piano roll or drag the transport to seek
- Pointer-anchored horizontal zoom
- Horizontal pan for long arrangements
- Fit-to-song view
- Optional playhead following, enabled by default
- Go to Start, Play/Pause, Stop, elapsed time, and musical-position readouts

### Built for inspection and research

- MIDI-event-accurate timing with the original tempo map
- Correct playback after pause, resume, seek, mute, and unmute
- Adjacent repeated notes remain visually distinct
- Read-only workflow keeps source MIDI files untouched
- Tested against conductor tracks, empty tracks, combined-channel tracks, and
  mid-note seeking

## Install

Install **MIDI RealPlayer** from the
[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=vaclis.midi-realplayer),
or search for `MIDI RealPlayer` in the VS Code Extensions view.

To install a downloaded release manually:

1. Download the `.vsix` from [GitHub Releases](https://github.com/vaclisinc/midi-realplayer-vscode/releases).
2. In VS Code, open **Extensions: Install from VSIX...**
3. Select the downloaded package.

## Quick start

1. Open a `.mid` or `.midi` file in VS Code.
2. Press **Play** or hit <kbd>Space</kbd>.
3. Toggle tracks, seek through the arrangement, or zoom into the section you
   want to inspect.

No SoundFont download or first-run setup is required.

## Controls

| Action | Control |
| --- | --- |
| Play / Pause | Transport button or <kbd>Space</kbd> |
| Stop | Stop button |
| Go to start | Go to Start button |
| Seek | Click the piano roll or drag the transport scrubber |
| Fine seek | <kbd>Left</kbd> / <kbd>Right</kbd> while the piano roll is focused |
| Seek by five seconds | <kbd>Shift</kbd> + <kbd>Left</kbd> / <kbd>Right</kbd> |
| Zoom | `+`, `−`, Fit, or <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + mouse wheel |
| Horizontal pan | <kbd>Shift</kbd> + mouse wheel or horizontal trackpad gesture |
| Follow playhead | Follow control beside the transport |
| Enable / disable track | Colored switch on the track card |

## SoundFonts

The bundled
[GeneralUser GS](https://github.com/mrbumpy409/GeneralUser-GS) bank provides a
ready-to-play General MIDI setup.

Open the **SoundFont** selector in the lower-right corner to:

- choose **Default** and use the bundled bank; or
- choose **Custom...** and load a local `.sf2`, `.sf3`, or `.dls` file.

The custom path is stored in `midiRealPlayer.soundFontPath`. Sound quality and
preset coverage depend on the selected bank.

## Project status

MIDI RealPlayer `0.1.x` is a read-only player and inspection tool. MIDI note,
velocity, instrument, and arrangement editing with save support are candidates
for a future editing release.

The current version is designed for real-world multi-track files and typical
10–20-track transcription outputs, while remaining useful for larger
arrangements.

## How it works

- [SpessaSynth](https://github.com/spessasus/SpessaSynth) performs SoundFont/DLS
  synthesis inside an AudioWorklet.
- [@tonejs/midi](https://github.com/Tonejs/Midi) provides piano-roll MIDI parsing.
- MIDI filtering and state reconstruction keep track controls, seeking, and
  audible playback synchronized.

## Development

Requirements:

- Node.js 22
- VS Code 1.100 or newer

```sh
git clone https://github.com/vaclisinc/midi-realplayer-vscode.git
cd midi-realplayer-vscode
npm install
npm run typecheck
npm test
npm run build
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host, then
open a MIDI file.

Build an installable package with:

```sh
npm run package
```

## Contributing

Bug reports, reproducible MIDI edge cases, feature proposals, and pull requests
are welcome.

- [Open an issue](https://github.com/vaclisinc/midi-realplayer-vscode/issues)
- [View the changelog](CHANGELOG.md)
- When reporting playback behavior, attach or link a minimal MIDI file whenever
  its license allows redistribution.

## License and acknowledgements

MIDI RealPlayer is released under the [MIT License](LICENSE).

The bundled GeneralUser GS SoundFont is by S. Christian Collins and is
distributed under its own license, included as
`media/GeneralUser-GS-LICENSE.txt`. SpessaSynth is licensed under Apache-2.0.

---

Built by [vaclis](https://github.com/vaclisinc) for musicians, researchers, and
anyone tired of inaccurate MIDI previews.
