# Feature parity with OctaMED Professional V4.00

A line-by-line check against the retail V4 manual and the retail binary (`amiga/v4/Octamed4/OctaMED`, version string `OctaMED Professional 4.00h (8.12.92)`). Status is what the code actually does today. V2 remains the baseline for the model and file formats that V4 inherited.

Legend: **yes** implemented · **part** partial or approximated · **no** absent.

Two adaptations are unavoidable in a browser and are not counted as gaps: the Workbench open/close gadget, and the Amiga key, which maps to **Cmd** on a Mac or **Ctrl** with the shortcuts a browser leaves alone.


## The V4 delta

Features V4 adds to the V2 baseline, and where Octanaut stands. This is the summary to read first; the panel tables below carry the detail.

| Feature | Status | Notes |
|---|---|---|
| MOD1 (+instruments) save | yes | Writes `.med` with the MMD1 song struct, 4-byte cells, BlockInfo and expdata. Verified by re-import and libxmp. |
| MOD1 (no instruments) save | no | Instrument names and MED_Paths lookup. |
| MOD0 (old) multi-song save | yes | Writes a proper nextmod chain. |
| 3200-line blocks | yes | MMD1 writer, loader, model and block panel. MMD0 still caps at 256, with a clear error. |
| Blocks 00–99 | part | No explicit 100-block cap; the status bar will show more. |
| Octaves 1+2 to 9+A | yes | Panel buttons, note names and the model reach octave A. |
| Instrument finetune -8..+7 | yes | Panel, engine and MMD1 expdata. MMD0 cannot store it. |
| Last occupied instrument (`>|<`) | yes | Scans down from 1V. |
| Keypad MAP2 maps | no | Track on/off and select-instrument only. |
| Programmable key editor with `x` wildcards | part | Keys can be picked; there is no digit editor, and range pick stores one note. |
| TRK ON SET / CLR | no | Per-track toggles only. |
| Block name | yes | Stored in BlockInfo and editable in the Block panel. |
| NRM 1/2 and 2/3 playback | no | No slowed real-time entry. |
| Note echo (DIST / MIN) | no | Sample echo exists; pattern echo does not. |
| Sample list / MED_Paths | part | Lists loaded instruments rather than a disk library. |
| MIDI message editor and command 10 | no | |
| MIDI input map editor | no | Input works without maps. |
| External MIDI sync | no | Clock out only. |
| MIDI dump, SEND OUT, SUPPR.N.OFF | no | |
| All Off / Reset modes | part | Panic and reset exist; the two-way mode selectors do not. |
| Sample editor freehand, RANGE ALL, zero search, D.PIXELS, dest-note pitch | part | Echo, filter, boost, noise, mix, fades and buffer undo are present. |
| Synth draw modes, RANGE ALL, cut/copy/paste, DBL, REV, stretch, VOL.CHG, SPEED | part | Waveform copy, exchange, mix, add, undo and transform are present. |
| Notation ghost tracks, hide instrument, saved settings | part | Show/hide and five presets exist; ghosting and saved settings do not. |
| Print HEADER / TEXT / FILE / BLKS | part | Notation print with form feeds exists. |
| Commands 05, 06, 07 | no | 05 is old vibrato; 06 and 07 are absent. |
| Commands 10, 16, 1C, 1E | no | MIDI message, block loop, MIDI preset, line delay. |
| MIDI commands 0A, 0C, 0D | no | Aftertouch, velocity, channel pressure. |
| FF8 / FF9 filter | yes | Sets the filter flag and the biquad. |
| INFO / ICON on save | no | |
| Delete file | no | Browser leaves this to the OS. |
| Absolute instrument names / paths | no | |
| Palette RGB editor | part | Four fixed palettes. |

## Controls shown but not implemented

The panels follow the V4 layouts, including controls whose features are still absent. These are the visible placeholders:

- **Files:** ICON, DEL FILE, LOAD MSG, SAVE MSG, LOAD MAP, SAVE MAP, MOD1(NO INSTR). INFO toggles a flag, but the writer always includes the extra information block.
- **Instr:** TYPE switches the instrument type but does not convert the waveform or sample data.
- **Edit:** MAP2. The programmable-key definition is shown but cannot be edited digit by digit.
- **Misc:** RGB palette sliders, RES, UNDO, WB OPEN, CLOSE, PATHS, ADD, REM, LOADGFX, MOUSE2, QUIT, CONFIRM.
- **MIDI:** EXT SYNC, the ACT.SENSING toggle, KEY-UP, the ALL OFF modes, the MIDI message editor and the input map editor.
- **Range:** NOTE ECHO with DIST and MIN, RST, and PASTE SELECT (it currently behaves like PASTE).

---

## Files panel

| Feature | Status | Notes |
|---|---|---|
| File requester with Currdir / Devices / Assigns | yes | Drawn in the app's own style, driven by the File System Access API where the browser has it (folder listing, parent, double-click). Elsewhere Browse feeds the same list from the native picker. Devices and assigns do not exist in a browser. |
| Load song (MED 1.12 – 3.20, OctaMED 1–4, MMD0/1, ST modules) | yes | MMD0/1/2/3, MED4, MED2, ProTracker, plus MSH and 8SVX instruments. MED 2.00 (`MED` + v3) is rejected with a message. |
| Load instrument (raw, IFF, synth, hybrid) | yes | |
| Load ST module | yes | Folded into Load; effects converted. |
| Save MOD1 (+instruments) | yes | `.med` with samples included. |
| Save MOD1 (no instruments) | no | Instrument names and MED_Paths lookup do not exist yet. |
| Save MOD0 (old) | yes | Multi-song nextmod chain. |
| Save song + samples | yes | MMD0 already embeds the samples; that is the interoperable container. |
| Save module (MMD0) | yes | Full writer, 7,680-cell round trip verified. |
| Save ST module | yes | 4 tracks, 31 instruments, blocks over 64 lines truncated, effects translated back to MOD. Verified by re-import. |
| INFO / ICON on save | no | |
| Delete file | no | Use the OS. |
| Load / save MIDI messages and maps | no | |
| Save instrument as raw or IFF | yes | WAV and IFF 8SVX. |
| Export audio (browser extra) | part | WAV always; AAC through WebCodecs; MP3 where the browser exposes an encoder. |

## Play panel

| Feature | Status | Notes |
|---|---|---|
| Play sequence window, 5 rows, per-row move arrows | yes | Each row's arrow moves that entry up or down; + / − / INS / DEL / INS↓ edit the list. |
| + / − / INS / DEL / INS↓ | yes | Plus append and remove for the last entry. |
| Play song / Continue song / Play block / Continue block / Stop | yes | |
| "D" — play block when a note is entered | yes | The D gadget in the Play panel. |
| Primary tempo 1–240 | yes | |
| Secondary tempo 1–20 | yes | |
| LP filter on/off | yes | Real biquad on the master bus. |
| E1 / E2 / E3 equalisers | yes | As documented: E1 level bars, E2 four coloured channel sprites, E3 oscilloscopes. Unlike the Amiga build they stay on in 5-8 channel modes, so all eight tracks are metered. |
| STS (no effects on the first pulse) | yes | |
| Volume base hex / decimal | yes | Affects command C and D parsing. |
| Channel modes 4 / 5 / 6 / 7 / 8 | yes | Channel count drives the mixer and the split model. |
| Panic stop (both mouse buttons) | yes | Hold both buttons for a second and a half. |

## Instr panel

| Feature | Status | Notes |
|---|---|---|
| Sample slot number and name | yes | |
| Sample length readout | yes | |
| First / previous / next / last / last-used | yes | |
| Jump toggle | yes | Stored per instrument; the mascot pointer it drove has no browser equivalent. |
| Kill | yes | |
| Transpose | yes | |
| Repeat and repeat length | yes | |
| Default volume | yes | |
| Hold and decay | yes | Applied per note, and by command 8. |
| New synth sound gadget | yes | "New" creates a synth with a sine table. |

## Block panel

| Feature | Status | Notes |
|---|---|---|
| Track cut / copy / paste / swap | yes | |
| Block cut / copy / paste / swap | yes | |
| Del buffer | yes | |
| Track count 4 / 8 / 12 / 16 | yes | |
| Line count 1–3200 | yes | Direct entry. MMD0 export refuses blocks over 256. |
| Line highlighting 1/2/3/4/8/16/C | yes | Marks every Nth line. |
| New block / DEF | yes | |
| New here / DEF | yes | |
| Del last / Del this | yes | |
| Split / Join | yes | |
| Ins line / Del line | yes | |
| Ins track / Del track | yes | |
| Expand / Shrink with factor | yes | |

## Edit panel

| Feature | Status | Notes |
|---|---|---|
| Per-track on/off switches | yes | In the panel, and the status lamps. |
| Edit on/off, SPC, space value 1–16 | yes | SPC sets how far the cursor advances, which is the quantise step during real-time entry. |
| Octave pairs 1+2 – 9+A | yes | Nine panel buttons; note names run to octave A. |
| Programmable keys 0–9 | part | Shift+digit inserts, Ctrl+Shift+digit picks. No digit editor or `x` wildcards, and range pick stores only the first note. |
| Left Alt / Right Alt templates | yes | Pick from the cursor cell; hold Alt while entering a note to apply. |
| Pick note / pick range / pick buffer | yes | Ctrl+Shift+digit picks the cursor note; the Edit panel picks from the range or the copy buffer. |
| Clr key definition | yes | The Alt template clear. |
| SPACE = DEL | yes | |
| Keypad maps: track on/off, select instrument, MAP2 variants | part | Two of the four V4 maps. |
| TRK ON SET / CLR | no | Per-track toggles only. |
| Cursor advance, six directions | yes | Ctrl+A cycles. |

## Range panel

| Feature | Status | Notes |
|---|---|---|
| Select track / select block | yes | |
| Range by right-button drag | yes | As on the Amiga. |
| Clear / Cut / Copy / Paste / Paste sel | yes | |
| Cancel | yes | |
| Spread 2 / 3 / 4 | yes | Copies a track across following tracks. |
| S1 / S2 automatic slides | yes | Portamento and slide-pair variants. |
| VOL volume slide generator | yes | |
| Track select 0–F, ST, CL | yes | |
| Chord entry | yes | Held notes spread across selected tracks. |

## Transp panel

| Feature | Status | Notes |
|---|---|---|
| Affect song / block / track / selected tracks / range | yes | |
| Instr all / current | yes | |
| Semitone and octave shift | yes | |
| Note change and exchange | yes | |
| Instrument change / exchange / delete | yes | |
| Play transpose | yes | |
| Annotation text | yes | Saved into MMD0. |

## Vol panel

| Feature | Status | Notes |
|---|---|---|
| Per-track relative volume 1–64 | yes | |
| Master volume | yes | |

## Misc panel

| Feature | Status | Notes |
|---|---|---|
| Screen colours | part | Four fixed sets; no RGB palette editor. |
| Pointer jumping Off / 8th / Smp | no | Not meaningful in the browser. |
| Clear all / Clr song only / Quit | part | Clear song and clear all; no quit. |
| Paths add / remove | no | |
| Absolute instrument names | no | |
| NRM 1/2 and 2/3 playback | no | |
| H→B note naming | yes | Changes B to H and A# to B in the grid. |
| Workbench open/close | n/a | |
| Save preferences | yes | localStorage: octave, advance, step, space-as-delete, follow, equalisers, hardware mode, H→B and the programmable keys. "Forget saved" clears it. |
| Dep2 (4 colours) | yes | |
| NO16 | yes | |
| PTKEY (Protracker keyboard) | yes | Space toggles editing, TAB steps tracks, Shift/Alt F3-F5 cut, copy and paste track or block. |

## Displays

| Feature | Status | Notes |
|---|---|---|
| Vertical note display | yes | Editing, block marks, playhead, selection. |
| Notation editor | part | Staff rendering, click to place notes, eight lengths, 3/4 and 4/4, key signature, per-track show/hide, five PSET presets, clear track, and print with optional form feeds. No ghost tracks, hide-instrument mode or saved view settings. |
| Synthsound editor | part | Two waveform displays, copy either way, exchange, mix, add, undo, preset shapes, add/delete waveform, linear transform, and the volume/waveform programs. No freehand draw modes, RANGE ALL, range cut/copy/paste/DBL/REV, stretch, VOL.CHG or SPEED. |
| Sample editor | part | Zoom, monitor and record, buffer size, octave rate change, reverse, normalise, fades, crop, filter, boost, echo, noise, mix, buffer save/restore, loop from range and R>SY. Missing freehand drawing, RANGE ALL, pitch-to-note, zero search and D.PIXELS. |
| Sample list | part | Lists the loaded instruments rather than a `MED_paths` library. |

## Playback engine

| Feature | Status | Notes |
|---|---|---|
| Commands 0 1 2 3 4 8 9 A B C D E F | yes | E jumps within a synthsound program and pans a MIDI channel. 05 remains old vibrato. |
| Commands 05 / 06 / 07 | no | V4's slide+fade, vibrato+fade and tremolo are absent. |
| Extended commands 10-2F (MMD1+) | yes | Sample offset (19), slide pitch once (11/12), vibrato (14), set finetune (15), stop note (18), fine volume slide (1A/1B), pattern break (1D), note delay/retrigger (1F). Others are ignored rather than misread as a low command. |
| FF1 double strike / FF2 delayed / FF3 triple | yes | |
| FF8 / FF9 filter | yes | Sets the filter flag and the biquad. |
| FFA / FFB MIDI hold pedal | yes | |
| FFD retune without retrigger | yes | |
| FFE stop, FFF note off | yes | |
| Hold / decay with `-\|-` | yes | |
| 8-channel split model (authentic mode) | yes | Half gain, shared volume registers. |
| Synthsound programs, all 24 commands | yes | Including envelopes and VWF as the vibrato shape. |
| Hybrid sounds | yes | |
| Tempo via command 9 and F | yes | |
| Position jump | yes | |

## MIDI

| Feature | Status | Notes |
|---|---|---|
| Note out per instrument channel | yes | Web MIDI, opt-in. |
| Program change per preset | yes | |
| Note-off suppression | yes | |
| Reset, panic | yes | |
| Active sensing, sync, local control | part | Active sensing and 24 PPQN clock out; local control on/off. External sync is not implemented. |
| MIDI message editor and command 10 | no | |
| MIDI input map editor | no | |
| MIDI dump save / load | no | |
| SEND OUT, SUPPR.N.OFF | no | |
| ALL OFF / RESET mode selectors | part | Panic and reset exist, not the mode selectors. |
| MIDI input for note entry | yes | Any connected input; notes enter at the cursor when editing, otherwise play the current instrument. Optional velocity into the data column. |

## Modules and files

| Feature | Status | Notes |
|---|---|---|
| Instruments shared across songs | yes | |
| LHA archive loading | yes | Level 0/1/2 headers, -lh0- to -lh7-. Verified against lhasa on 11 reference archives. |
| 16-bit instruments (type 0x10) | yes | Decoded big-endian at full resolution. |
| Stereo instruments (type 0x20) | yes | Both channels kept; downmixed to mono in 8-bit mode. |
| 8-bit / 16-bit render mode | yes | Depth switch in the Play panel, persisted. |
| MMD2/MMD3 section tables | yes | Sections flattened into one play sequence. |
| BPM mode and lines per beat | yes | flags2 bit 0x20 and the beat mask. |
| Multi-modules | yes | Click the song gadget in the status line to switch between them. |
| Remap instruments on load | yes | Asks before merging instruments from an incoming module. |
| Save as multi-module | yes | Writes a proper nextmod chain; every song shares the instrument table. Verified by re-import. |

---

## What is left

The V4 gaps that matter most:

1. **MOD1 without instruments.** `.med` always embeds the samples. The instrument-less variant, which resolves names through MED_Paths, is still absent.
2. **MIDI messages and maps.** No SysEx message editor, input map editor, external sync, dump or send-out. Basic note out and input work.
3. **Sample list and MED_Paths.** The list shows loaded instruments; it cannot browse a library, add paths or resolve missing instrument names.
4. **Command coverage.** 05/06/07 (slide+fade, vibrato+fade, tremolo), 10 (MIDI message), 16 (block loop), 1C (MIDI preset), 1E (line delay) and the MIDI 0A/0C/0D forms are absent.
5. **Editor polish.** Octaves 1+2 to 9+A, keypad MAP2, programmable-key wildcards and group entry, NRM, note echo, sample/synth range tools and notation ghosting.
6. **Filesystem-adjacent features.** INFO/ICON on save, delete file, absolute instrument names, paths add/remove and the RGB palette editor.
7. **MP3 export.** WAV and AAC work without extra code; MP3 waits for a browser encoder or a bundled one.
