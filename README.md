# MIDI RealPlayer

**Hear the MIDI you are looking at.**

An open-source multi-track MIDI player and visual workspace for VS Code.
It preserves note duration, velocity, tempo, program changes, and channel
performance data, then plays them through real SoundFont instruments.

[![Install from VS Marketplace](https://img.shields.io/badge/VS%20Marketplace-Install-007ACC?logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=vaclis.midi-realplayer)
[![GitHub release](https://img.shields.io/github/v/release/vaclisinc/midi-realplayer-vscode?label=Release)](https://github.com/vaclisinc/midi-realplayer-vscode/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-f2c94c.svg)](LICENSE)

[![Watch MIDI RealPlayer in action](assets/midi-realplayer-demo.gif)](https://www.youtube.com/watch?v=uFnpmIG5CA8)

## Why MIDI RealPlayer?

Many MIDI previewers draw the right notes but play every event as the same
short sound. MIDI RealPlayer keeps playback and visualization synchronized:

- Notes play for their encoded duration and velocity.
- General MIDI programs and drums use SoundFont instruments.
- Track On/Off and volume controls affect both what you see and hear.
- Piano Roll and Tracks views reveal both note detail and song structure.
- Seeking into a sustained note reconstructs the active sound correctly.
- Tempo, sustain, pitch bend, controllers, banks, and program changes survive
  playback.
- The current mix can be rendered directly to WAV without FFmpeg.

## Highlights

- Instrument-colored Piano Roll and DAW-style Tracks views for `.mid` and `.midi`
- Original track names and multiple channels from combined MIDI tracks
- Per-track On/Off and volume controls, remembered for each MIDI file
- Click-to-seek, transport scrubbing, horizontal pan, and pointer-based zoom
- Adjustable pitch-row and arrangement-lane heights
- Adaptive musical ruler with bar, beat, and subdivision marks
- Optional playhead following with Fit-to-song view
- Bundled GeneralUser GS SoundFont, ready on first launch
- Custom `.sf2`, `.sf3`, and `.dls` SoundFont support
- Offline WAV export of the enabled tracks and current volume mix
- Source-safe workflow that never modifies the MIDI file

## Install

Install from the
[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=vaclis.midi-realplayer),
or search for **MIDI RealPlayer** in VS Code.

To install a GitHub release, download its `.vsix`, run
**Extensions: Install from VSIX...**, and select the file.

## Use

1. Open a `.mid` or `.midi` file.
2. Press **Play** or <kbd>Space</kbd>.
3. Seek, zoom, switch views, mute tracks, or adjust their volume directly in
   the viewer.

No SoundFont setup is required.

## Controls

| Action | Control |
| --- | --- |
| Play / Pause | Transport button or <kbd>Space</kbd> |
| Stop / Go to start | Transport controls |
| Seek | Piano roll, transport scrubber, or <kbd>Left</kbd> / <kbd>Right</kbd> |
| Zoom | `+`, `−`, Fit, or <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + mouse wheel |
| Pan | <kbd>Shift</kbd> + mouse wheel or horizontal trackpad gesture |
| Switch view | **Roll** / **Tracks** above the timeline |
| Vertical scale | `↕` slider above the timeline |
| Track sound | Colored On/Off switch and Vol slider |
| Follow playback | Follow control beside the transport |
| Export current mix | **Export WAV** |

## SoundFonts

The bundled
[GeneralUser GS](https://github.com/mrbumpy409/GeneralUser-GS) bank provides
ready-to-play General MIDI instruments. Use the **SoundFont** selector to switch
between **Default** and a local `.sf2`, `.sf3`, or `.dls` bank.

Sound quality and preset coverage depend on the selected bank. If a requested
preset is unavailable, the track displays the actual fallback sound.

## Development

Requires Node.js 22 and VS Code 1.100 or newer.

```sh
git clone https://github.com/vaclisinc/midi-realplayer-vscode.git
cd midi-realplayer-vscode
npm install
npm run typecheck
npm test
npm run build
```

Press <kbd>F5</kbd> to launch an Extension Development Host. Run
`npm run package` to build a `.vsix`.

## Contributing

Issues and pull requests are welcome. For playback bugs, include a minimal MIDI
file when its license permits redistribution.

- [Open an issue](https://github.com/vaclisinc/midi-realplayer-vscode/issues)
- [View the changelog](CHANGELOG.md)

## License and credits

MIDI RealPlayer is available under the [MIT License](LICENSE).

Playback uses
[SpessaSynth](https://github.com/spessasus/SpessaSynth) and the bundled
GeneralUser GS SoundFont by S. Christian Collins. The SoundFont license is
included in `media/GeneralUser-GS-LICENSE.txt`.

Built by [vaclis](https://github.com/vaclisinc) for musicians, researchers, and
anyone tired of inaccurate MIDI previews.
