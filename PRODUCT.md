# Product

## Register

product

## Users

The primary users are researchers working with multi-track MIDI and music-transcription outputs inside VS Code, beginning with the author's laboratory and extending to other developers, musicians, and research teams through the VS Code Marketplace. They commonly inspect files with up to 10–20 tracks and need to understand and audition the transcription without leaving their coding environment.

## Product Purpose

The extension opens `.mid` and `.midi` files as an interactive, read-only multi-track piano roll and plays them faithfully. Playback must preserve the MIDI tempo map, note-on and note-off timing, velocity, program and bank changes, percussion mapping, sustain pedal, and other relevant controller state. Track visibility, mute, solo, seeking, and playback state must remain consistent between the visualization and the audio engine.

The first release prioritizes trustworthy inspection and playback: play, pause, stop, precise seeking, an accurate playhead, track mute and solo, and clear instrument identification. MIDI note, velocity, and instrument editing with save support is intentionally deferred to a second release.

Success means a researcher can open a transcription, understand its track structure, start playback from any position, and hear the expected instruments and timing without exporting the file or launching a DAW.

## Brand Personality

Professional, precise, quiet. The interface should feel dependable during long research sessions and should help users concentrate on timing, orchestration, and transcription quality.

## Anti-references

Do not imitate a full DAW merely for visual effect. Avoid decorative transport hardware, gratuitous animation, oversized controls, hidden complexity, and dense production features unrelated to MIDI inspection. Never allow visual track state and audible track state to disagree.

## Design Principles

1. Fidelity is the feature: audio, timing, controller state, and visualization must agree.
2. Open to understanding: opening a MIDI file should reveal its structure immediately, without setup screens or project creation.
3. Research flow first: navigation, seeking, muting, and soloing should be fast enough for repeated analytical listening.
4. Earn complexity: expose essential transport and track controls first; defer editing and full-DAW concepts until they serve a demonstrated need.
5. Make state undeniable: current time, active tracks, instruments, loading, errors, and playback state should always be legible.

## Accessibility & Inclusion

Target WCAG 2.2 AA where applicable inside the VS Code webview. Track identity must not rely on color alone. All transport and track controls must be keyboard accessible with visible focus states and useful accessible names. Respect reduced-motion preferences and the active VS Code color theme.
