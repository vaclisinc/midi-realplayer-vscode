# Changelog

## 0.1.5

- Snap clicks inside a piano-roll note to that note's onset so the selected note is retriggered instead of skipped.
- Add a four-millisecond engine pre-roll when seeking to a note onset.
- Render MIDI notes as compact rounded bars with visible seams between adjacent repeated pitches.
- Align the piano-roll palette and playhead more closely with the MIDI RealPlayer icon.
- Change the Marketplace publisher ID to `vaclis`.

## 0.1.4

- Preserve the original MIDI track name as the primary track label.
- Use numbered `Untitled Track` labels only when the source name is empty.
- Show the MIDI-requested sound without exposing low-level channel numbers.
- Show an explicit `requested → playing` warning only when the SoundFont falls back to another preset.
- Replace abstract track markers with bundled, original thumbnails for all 16 General MIDI instrument families.
- Refine the viewer into a quieter workstation layout with compact track switches, a unified transport strip, and legible timeline labels at full-song zoom.

## 0.1.3

- Correctly expose multiple MIDI channels stored inside one physical track.
- Keep named tracks with no note events visible in the track list.
- Apply On/Off directly to unique synthesizer channels without reloading the song.
- Preserve monotonic playback time across pause and resume.
- Add regression coverage for combined-channel tracks and empty tracks.

## 0.1.2

- Fix track On/Off playback being shifted by a hidden conductor/meta track.
- Guarantee that disabling every visible track removes every playable MIDI event.
- Add regression tests for individual-track and all-tracks-off playback.

## 0.1.1

- Bundle GeneralUser GS as the ready-to-play default SoundFont.
- Keep local SF2, SF3, and DLS selection as an optional override.
- Include the upstream GeneralUser GS license in the extension package.

## 0.1.0

- Add a read-only custom editor for `.mid` and `.midi` files.
- Add a unified, color-coded multi-track piano roll.
- Add exact time and musical-position readouts.
- Add play, pause, stop, seeking, fit, and zoom controls.
- Add synchronized visual and audible track On/Off switches.
- Add local SF2, SF3, and DLS SoundFont selection.
- Add responsive compact layouts and keyboard accessibility.
