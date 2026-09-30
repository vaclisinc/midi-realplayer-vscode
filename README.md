# MIDI RealPlayer

**Hear the MIDI you are looking at.**

An open-source multi-track MIDI player and visual workspace for VS Code.
It preserves note duration, velocity, tempo, program changes, and channel
performance data, then plays them through real SoundFont instruments.

Building music research demos or listening tests? Use the
[MIDI RealPlayer npm package](https://github.com/vaclisinc/midi-realplayer)
to embed the player in your pages.

[![Install from VS Marketplace](https://img.shields.io/badge/VS%20Marketplace-Install-007ACC?logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=vaclis.midi-realplayer)
[![GitHub release](https://img.shields.io/github/v/release/vaclisinc/midi-realplayer-vscode?label=Release)](https://github.com/vaclisinc/midi-realplayer-vscode/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-f2c94c.svg)](LICENSE)

[![Watch MIDI RealPlayer in action](assets/midi-realplayer-demo.gif)](https://www.youtube.com/watch?v=uFnpmIG5CA8)

## Features

Open a MIDI file in VS Code to listen, inspect the notes, and try a different
mix. Playback follows the file's note lengths, dynamics, tempo changes, and
controllers, with a SoundFont included so you can start listening right away.

- Switch between a piano roll and a track overview to explore the arrangement.
- Mute or solo tracks, adjust their volume, and choose different instruments.
- Seek, zoom, and follow playback as you inspect a passage.
- Use the bundled sounds or load your own SoundFont, then export your mix to WAV.

Your MIDI file stays unchanged; mix and instrument choices are remembered for
next time.

## Install

Install from the
[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=vaclis.midi-realplayer),
or search for **MIDI RealPlayer** in VS Code.

To install a GitHub release, download its `.vsix`, run
**Extensions: Install from VSIX...**, and select the file.

## Use

1. Open a `.mid` or `.midi` file.
2. Press **Play** or <kbd>Space</kbd>.
3. Seek, zoom, switch views, change a track's SoundFont preset, mute tracks, or
   adjust their volume directly in the viewer.

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
| Track preset | Sound menu beneath the track name |
| Track mix | **M** (Mute), **S** (Solo), and Vol slider |
| Follow playback | Follow control beside the transport |
| Export current mix | **Export WAV** |

## SoundFonts

The bundled
[GeneralUser GS](https://github.com/mrbumpy409/GeneralUser-GS) bank provides
ready-to-play General MIDI instruments. Use the **SoundFont** selector to switch
between **Default** and a local `.sf2`, `.sf3`, or `.dls` bank.

Each track's sound label is also a preset menu. Choose another sound from the
same General MIDI instrument family in the active bank, or choose **MIDI** to
restore the file's original program. The choice is remembered per MIDI file and
is applied consistently to playback, seeking, Solo, and WAV export. The bundled
Concert Choir remains the default choir sound and follows the MIDI's original
timing without an automatic offset.

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
