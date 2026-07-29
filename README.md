# MIDI Instrument Viewer

Open multi-track `.mid` and `.midi` files directly in VS Code, inspect them as a unified piano roll, and play them with a real SoundFont instrument bank.

## Why this exists

Many MIDI preview extensions render useful piano rolls but reduce playback to short, identical note onsets. MIDI Instrument Viewer keeps the visualization and the audio engine in agreement:

- Note-on and note-off timing determine the audible note length.
- Velocity is preserved.
- The original tempo map and tempo changes are preserved.
- Program changes, bank selection, drums, sustain, pitch bend, and controller events are passed to the synthesizer.
- Turning a track off hides and silences its corresponding MIDI channel or track events.
- Seeking reconstructs the sequence state at the selected position.
- Named empty tracks remain visible so the track list matches the source MIDI structure.

## Open and play

1. Open a `.mid` or `.midi` file.
2. Press Play or use the Space bar.

GeneralUser GS is bundled as the default General MIDI instrument bank, so no
first-run download or file selection is required.

Select the SoundFont name in the bottom-right corner to override the built-in
bank with a local `.sf2`, `.sf3`, or `.dls` file. The selected path is remembered
in the VS Code setting `midiInstrument.soundFontPath`. Clear that setting to
return to the bundled bank.

## Controls

- **Play/Pause:** transport button or Space
- **Stop:** stop button
- **Seek:** timeline slider or click the piano roll
- **Fine seek:** focus the piano roll and use Left/Right Arrow
- **Five-second seek:** Shift + Left/Right Arrow
- **Zoom:** `+`, `−`, and Fit controls; Ctrl/Cmd + mouse wheel
- **Track On/Off:** the switch beside each track

## Current scope

Version 0.1 is a read-only research previewer. It is optimized for typical 10–20 track transcription outputs.

MIDI note, velocity, and instrument editing with save support is planned for a later version.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

Press F5 in VS Code to start an Extension Development Host, then open a MIDI file.

To build an installable package:

```sh
npm run package
```

## Playback engine

Playback uses [SpessaSynth](https://github.com/spessasus/SpessaSynth), an Apache-2.0 SoundFont/DLS synthesizer running in an AudioWorklet. Piano-roll parsing uses [@tonejs/midi](https://github.com/Tonejs/Midi).

The bundled [GeneralUser GS](https://github.com/mrbumpy409/GeneralUser-GS)
SoundFont is by S. Christian Collins and is distributed under its own license,
included in the extension package as `media/GeneralUser-GS-LICENSE.txt`.

## Known limitations

- Sound quality and instrument coverage depend on the selected SoundFont.
- Controller-only tracks are not shown as rows, although their metadata remains in the MIDI sequence.
- Rapid track changes are applied to playback sequentially to avoid corrupting the active sequencer state.
- The Marketplace publisher ID in `package.json` must be changed to the publisher account used for release.
