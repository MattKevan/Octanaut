# Feature parity with OctaMED V2.00 / OctaMED Professional

A line-by-line check against the manual shipped on the original disk (`Docs/OctaMED2.0.doc`) and the screen layout of the Professional build. Status is what the code actually does today.

Legend: **yes** implemented · **part** partial or approximated · **no** absent.

Two adaptations are unavoidable in a browser and are not counted as gaps: the Workbench open/close gadget, and the Amiga key, which maps to **Cmd** on a Mac or **Ctrl** with the shortcuts a browser leaves alone.

---

## Files panel

| Feature | Status | Notes |
|---|---|---|
| File requester with Currdir / Devices / Assigns | yes | Drawn in the app's own style, driven by the File System Access API where the browser has it (folder listing, parent, double-click). Elsewhere Browse feeds the same list from the native picker. Devices and assigns do not exist in a browser. |
| Load song (MED 1.12 – 3.20, OctaMED 1–2, MMD0, ST modules) | yes | MMD0/1/2/3, MED4, MED2, ProTracker, plus MSH and 8SVX instruments. MED 2.00 (`MED` + v3) is rejected with a message. |
| Load instrument (raw, IFF, synth, hybrid) | yes | |
| Load ST module | yes | Folded into Load; effects converted. |
| Save song (native, compressed) | no | Writes MMD0 only. |
| Save song + samples | yes | MMD0 already embeds the samples; that is the interoperable container. |
| Save module (MMD0) | yes | Full writer, 7,680-cell round trip verified. |
| Save ST module | yes | 4 tracks, 31 instruments, blocks over 64 lines truncated, effects translated back to MOD. Verified by re-import. |
| Icon gadget on save | no | |
| Delete file | no | Use the OS. |
| Save instrument as raw or IFF | yes | WAV and IFF 8SVX. |

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
| Line count with < > and ±10 | yes | Direct entry. |
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
| Octave pairs 1+2 – 4+5 | yes | |
| Programmable keys 0–9 | yes | Shift+digit inserts, Ctrl+Shift+digit picks. No on-screen editor for them. |
| Left Alt / Right Alt templates | yes | Pick from the cursor cell; hold Alt while entering a note to apply. |
| Pick note / pick range / pick buffer | yes | Ctrl+Shift+digit picks the cursor note; the Edit panel picks from the range or the copy buffer. |
| Clr key definition | yes | The Alt template clear. |
| SPACE = DEL | yes | |
| Keypad mode: track on/off or select instrument | yes | |
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
| Screen colours | yes | Four colour sets, cycling from the Misc panel. |
| Pointer jumping Off / 8th / Smp | no | Not meaningful in the browser. |
| Clear all / Clr song only / Quit | part | Clear song and clear all; no quit. |
| Paths add / remove | no | |
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
| Notation editor | yes | Staff rendering, click to place notes, eight lengths, 3/4 and 4/4, key signature, per-track show/hide, five PSET presets, clear track, and Print with optional form feeds between blocks. |
| Synthsound editor | yes | Two waveform displays (bank and buffer), copy either way, exchange, mix, add together, undo, preset shapes, add/delete waveform, linear transform between two waveforms, editable volume and waveform programs. No range cut/copy/paste or stretch. |
| Sample editor | yes | Zoom, monitor and record from the microphone, buffer size, octave rate change, reverse, normalise, fades, crop, filter, boost, echo, noise, mix, buffer save/restore, loop from range, zero search, R>SY. |
| Sample list | part | Lists the loaded instruments rather than a `MED_paths` library. |

## Playback engine

| Feature | Status | Notes |
|---|---|---|
| Commands 0 1 2 3 4 5 8 9 A B C D E F | yes | E jumps within a synthsound program and pans a MIDI channel. |
| Extended commands 10-2F (MMD1+) | yes | Sample offset (19), slide pitch once (11/12), vibrato (14), set finetune (15), stop note (18), fine volume slide (1A/1B), pattern break (1D), note delay/retrigger (1F). Others are ignored rather than misread as a low command. |
| FF1 double strike / FF2 delayed / FF3 triple | yes | |
| FF8 / FF9 filter | yes | Sets the filter flag. |
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
| Active sensing, sync, local control | yes | Active sensing and 24 PPQN clock out while sending sync; local control on/off gadgets. External sync is not implemented. |
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

The honest remainder, all small:

1. **Icon gadget on save** and **delete file** — filesystem jobs a browser leaves to the OS.
2. **External MIDI sync** (receiving clock); sending is done.
3. **Synth range cut/copy/paste and stretch.**
4. **Paths add / remove**, which only matters when samples live on other disks.
