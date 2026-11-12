# Feature parity with OctaMED Professional V4.00

A line-by-line check against the retail V4 manual (`../docs/OctaMED-V4-Manual.pdf`, text in `../docs_txt/OctaMED4.0.doc.txt`) and the retail binary (`amiga/v4/Octamed4/OctaMED`, version string `OctaMED Professional 4.00h (8.12.92)`). Status is what the code actually does today. V2 remains the baseline for the model and file formats that V4 inherited. `../docs/OCTAMED-REFERENCE.md` collects the behaviour we have established, where each fact came from, and what is still open.

Legend: **yes** implemented · **part** partial or approximated · **no** absent.

Two adaptations are unavoidable in a browser and are not counted as gaps: the Workbench open/close gadget, and the Amiga key, which maps to **Cmd** on a Mac or **Ctrl** with the shortcuts a browser leaves alone.


## The V4 delta

Features V4 adds to the V2 baseline, and where Octanaut stands. This is the summary to read first; the panel tables below carry the detail.

| Feature | Status | Notes |
|---|---|---|
| MOD1 (+instruments) save | yes | Writes `.med` with the MMD1 song struct, 4-byte cells, BlockInfo and expdata. Verified by re-import and libxmp. |
| MOD1 (no instruments) save | yes | Writes names without sample payloads; the loader creates placeholders for resolution. |
| MOD0 (old) multi-song save | yes | Writes a proper nextmod chain. |
| 3200-line blocks | yes | MMD1 writer, loader, model and block panel. MMD0 still caps at 256, with a clear error. |
| Blocks 00–99 | part | No explicit 100-block cap; the status bar will show more. |
| Octaves 1+2 to 9+A | yes | Panel buttons, note names and the model reach octave A. |
| Instrument finetune -8..+7 | yes | Panel, engine and MMD1 expdata. MMD0 cannot store it. |
| Last occupied instrument (`>|<`) | yes | Scans down from 1V. |
| Keypad MAP2 maps | yes | Track and instrument variants, including all-on/all-off and the extra instrument keys. |
| Programmable key editor with `x` wildcards | yes | Per-field digit editor, `x` in any field makes it transparent, C/L/R select the definition, and Alt definitions keep their note fixed at `xxx`. A range pick stores the whole range as a group, and Shift+N inserts it. |
| TRK ON SET / CLR | yes | Sets or clears the track switches. |
| Block name | yes | Stored in BlockInfo and editable in the Block panel. |
| Note echo (DIST / MIN) | yes | Range operation; fills empty lines with halved volume commands. |
| Sample list / MED_Paths | part | Lists loaded instruments and browses user-selected folders; MED_Paths is not implemented. |
| MIDI message editor and command 10 | part | Edit, send, capture and JSON save; messages are not yet written into MMD1. |
| MIDI input map editor | yes | 128-row list; each key is a note or a transport/edit function. |
| External MIDI sync | yes | Start, continue, stop and clock tempo follow the incoming MIDI clock. |
| MIDI dump, SEND OUT, SUPPR.N.OFF | yes | JSON dumps carry messages and the input map; send-out and note-off suppression work. |
| All Off / Reset modes | yes | Controller and note-off modes, plus PB+PRES and system reset. |
| Sample editor freehand, RANGE ALL, zero search, D.PIXELS, dest-note pitch | yes | Echo (rate in bytes, decay, count), filter and boost with averaging/distance, noise, mix, fades, pixel display and buffer undo are present. |
| Synth draw modes, RANGE ALL, cut/copy/paste, CLR/ALL, DBL, REV, stretch, VOL.CHG, SPEED | yes | Waveform copy, cut, exchange, mix, add, clear, undo, stretch and transform are present. |
| Notation ghost tracks, hide instrument, saved settings | part | Ghosting, instrument hide and five presets are implemented and saved in MMD0/MMD1; original-app interoperability needs verification. |
| Print HEADER / TEXT / FILE / BLKS | part | Notation print with form feeds exists. |
| Commands 05, 06, 07 | yes | 05 keeps old vibrato unless a portamento target is set, then slides and fades; 06 and 07 are present. |
| Commands 10, 16, 1C, 1E | yes | MIDI message, block loop, MIDI preset and line delay. |
| MIDI commands 0A, 0C, 0D | yes | Poly aftertouch, velocity and channel pressure. |
| FF8 / FF9 filter | yes | Sets the filter flag and the biquad. |
| INFO / ICON on save | no | |
| Delete file | yes | Deletes from the `DF0:` work disk; an OS folder still uses the File System Access API. |
| Absolute instrument names / paths | no | |
| Palette RGB editor | part | Four fixed palettes. |

## Controls shown but not implemented

The panels follow the V4 layouts. These controls are disabled because they map to Amiga OS or hardware operations that a browser cannot provide:

- **Files:** ICON.
- **Misc:** WB OPEN, CLOSE, LOADGFX, MOUSE2.

These are implemented with browser equivalents rather than the original file formats:

- **Files:** `DF0:` is a writable work disk in IndexedDB. SAVE writes real module bytes there; EXPORT downloads to the Mac; an OS folder still uses the File System Access API. DEL FILE removes from `DF0:` or the chosen folder. `DH0:` is a read-only Modland mount: it browses the bundled OctaMED index, downloads a module only when chosen, validates it, and caches it locally. Messages and maps save and load as JSON. The working song and editor state autosave to IndexedDB, so a reload restores what was last on screen.
- **Misc:** the RGB palette edits the custom track colour. Paths use directory handles. QUIT closes the tab where the browser allows it, and CONFIRM toggles save prompts.
- **MIDI:** KEY-UP is a transport toggle. SysEx messages save as JSON, not inside MMD1.

The remaining functional gaps are note-length capture for MIDI key-up, the sample and synth range tools, notation print modes and the `MED_Paths` sample library.

---

## Files panel

| Feature | Status | Notes |
|---|---|---|
| File requester with Currdir / Devices / Assigns | yes | Drawn in the app's own style, with `DF0:`, `DH0:` and an OS folder as volumes. `DF0:` lists instantly from IndexedDB; `DH0:` is the read-only Modland archive, searched from the bundled OctaMED index; the OS volume uses the File System Access API where the browser has it, and Browse feeds the same list from the native picker elsewhere. |
| Load song (MED 1.12 – 3.20, OctaMED 1–4, MMD0/1, ST modules) | yes | MMD0/1/2/3 and packed MMDC, MED4, MED2, ProTracker, plus MSH and 8SVX instruments. MED 2.00 (`MED` + v3) is rejected with a message. |
| Load instrument (raw, IFF, synth, hybrid) | yes | |
| Load ST module | yes | Folded into Load; effects converted. |
| Save MOD1 (+instruments) | yes | `.med` with samples included. |
| Save MOD1 (no instruments) | yes | Writes instrument names only; placeholders load silently until samples are found. |
| Save MOD0 (old) | yes | Multi-song nextmod chain. |
| Save song + samples | yes | MMD0 already embeds the samples; that is the interoperable container. |
| Save module (MMD0) | yes | Full writer, 7,680-cell round trip verified. |
| Save ST module | yes | 4 tracks, 31 instruments, blocks over 64 lines truncated, effects translated back to MOD. Verified by re-import. |
| INFO / ICON on save | no | |
| Delete file | yes | Removes the selected file from `DF0:` or the open OS folder. |
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
| E1 / E2 / E3 equalisers | yes | E1 is the instrument/note bar graph under the info line, E2 the per-track V.U. meter from mid-height down, E3 the 42-sample oscilloscope hanging off the play line. All three switch off in split channel modes, and a right click outside the block editor toggles them. |
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

## Status bar

| Feature | Status | Notes |
|---|---|---|
| Sequence index, place-value clicks | yes | The digit clicked sets the step (1, 10, 100, 1000) and only moves the play-sequence position; the current block is untouched. The index follows the player while playing. |
| Block number index | yes | Same place-value stepping and the chosen block comes into the editor. |
| Octave pair | yes | Left click raises an octave and loops through 1+2 … 9+A; right click lowers. |
| E / SP / CHRD | yes | Click to toggle edit mode, note spacing and chord entry. Esc toggles edit mode (even from a field) and `~` toggles SP. |
| Mute track lamps | yes | Click a lamp to mute or unmute that track. |
| Instrument number and name | yes | Left click steps forward and right click back; the name follows the current instrument. |
| Song selector | yes | ◀ ▶ and the number step through the songs in memory. |

## Edit panel

| Feature | Status | Notes |
|---|---|---|
| Per-track on/off switches | yes | In the panel, and the status lamps. |
| Edit on/off, SPC, space value 1–16 | yes | SPC sets how far the cursor advances, which is the quantise step during real-time entry. Esc toggles edit mode and `~` toggles the status bar's SP. |
| Octave pairs 1+2 – 9+A | yes | Nine panel buttons; note names run to octave A. |
| Programmable keys 0–9 | yes | Shift+digit inserts and Ctrl+Shift+digit picks (read from the physical digit, so shifted symbols work). Definitions are edited in the panel and accept `x` wildcards. |
| Left Alt / Right Alt templates | yes | Pick from the cursor cell; hold the matching Alt while entering a note to apply. The side is tracked from the Alt keydown, since the note event cannot report it, and the physical key is used so macOS Option substitutions still work. |
| Pick note / pick range / pick buffer | yes | Ctrl+Shift+digit picks the cursor note; the Edit panel picks from the range or the copy buffer. |
| Clr key definition | part | Clearing a definition is done by typing `x` over its fields; there is no single CLR gadget. |
| SPACE = DEL | yes | |
| Keypad maps: track on/off, select instrument, MAP2 variants | yes | Both base maps and both MAP2 variants. |
| TRK ON SET / CLR | yes | Sets or clears the track switches. |
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
| NRM 1/2 and 2/3 playback | yes | The NRM gadget on the memory strip cycles NRM → 2/3 → 1/2 and scales the scheduler's pulse, so playback slows for real-time entry. |
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
| Notation editor | part | Grand staff, note entry, signatures, track visibility and ghosting, instrument hide/transposition, five presets and printing are implemented. Rests and exact original engraving remain incomplete. |
| Synthsound editor | part | Twin waveforms, freehand drawing, range selection and edits, volume, speed, transform and program editing are implemented. Exact original editing semantics for paste and stretch still need comparison. |
| Sample editor | part | Freehand, RANGE ALL, zoom, buffer operations, sample effects with echo decay, filter/boost averaging and distance, the pixel display, pitch and loop controls are implemented. Exact effect formulas still need comparison with the original. |
| Sample list | part | Lists loaded instruments and user-selected folders; `MED_Paths` is not supported. |

## Playback engine

| Feature | Status | Notes |
|---|---|---|
| Commands 0 1 2 3 4 8 9 A B C D E F | yes | E jumps within a synthsound program and pans a MIDI channel. 05 remains old vibrato. |
| Commands 05 / 06 / 07 | yes | Slide+fade (05 keeps the old vibrato unless a portamento target is set), vibrato+fade (the whole argument is the fade speed and the vibrato continues) and tremolo. |
| Extended commands 10-2F (MMD1+) | yes | MIDI message (10), block loop (16), sample offset (19), slide pitch once (11/12), vibrato (14), set finetune (15), stop note (18), fine volume slide (1A/1B), MIDI program change (1C), pattern break (1D), line delay (1E), note delay/retrigger (1F). Others are ignored rather than misread as a low command. |
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
| MIDI message editor and command 10 | part | Edit, send, capture and JSON save; messages are not yet written into MMD1. |
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
4. **MIDI data in saved modules.** Commands 10 and 1C work while playing, but MIDI messages are not written into MMD1, so a saved module loses them.
5. **Editor polish.** Sample/synth range tools and notation print modes.
6. **Filesystem-adjacent features.** INFO/ICON on save, delete file, absolute instrument names, paths add/remove and the RGB palette editor.
7. **MP3 export.** WAV and AAC work without extra code; MP3 waits for a browser encoder or a bundled one.
