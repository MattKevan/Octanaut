# OctaNAUT

An eight-channel music tracker for the browser, built to open the modules that OctaMED wrote.

The name is a nod to OctaMED, which is where all of this comes from. The reference is OctaMED Professional V4.00 (1992), and `FEATURES.md` tracks parity against its manual and retail binary. The V4 manual PDF lives at `../docs/OctaMED-V4-Manual.pdf`, with its extracted text at `../docs_txt/OctaMED4.0.doc.txt` alongside the older V2 manual text. Everything established about the original's behaviour, with its source and confidence, is collected in `../docs/OCTAMED-REFERENCE.md`.

Open `web/index.html` directly, or serve the site:

```
python3 -m http.server 8000 --directory web
# then visit http://localhost:8000/
```

The engine, grid and canvas code is plain ES2019 in classic scripts. The panel chrome is Preact with TSX, compiled to `web/js/panels.js`, and the stylesheet is compiled from Tailwind. Both compiled files are checked in, so `file://` still works as-is.

## Styling

The interface is built with Tailwind CSS v4. The source lives in `web/css/tailwind.css`, the compiled output in `web/css/app.css`.

```
npm install          # once
npm run build:css    # compile web/css/app.css
npm run build:panels # compile web/js/panels.js from TSX
npm run build        # both
npm run dev          # watch both and serve at http://localhost:3000
npm run watch:css    # rebuild CSS only
npm run watch:panels # rebuild panels only
npm run serve        # static server without the watchers
```

Buttons carry their utility classes in the markup. Three custom variants handle the states the scripts toggle: `on` for a lit gadget, `selected` for the active tab, and `playing` for the row under the playhead. The chrome (frame, title bar, deck, side rail, sequence box, status line, bottom bar) uses utilities directly in the markup. The `@layer components` block now holds only the grid, cell, meter and display primitives that are too repetitive to inline.

Fonts are bundled in `web/fonts/`:

- **Departure Mono** by Helena Zhang and Tobias Fried (MIT) for the interface.
- **Pixel Operator Mono HB 8** by Jayvee Enaguas (CC0), used only in the note editor for four-track blocks.
- **Pixel Operator Mono HB** (CC0) for note editors with more than four tracks, which carries the same five-digit cells in a narrower advance.

Everything outside the note editor – panels, status strip, tabs, requester – is Departure Mono.

## The note editor

The playhead is a fixed white bar across the exact vertical centre of the tracker area, running from the line-number gutter to the right edge. It stays visible when playback is stopped. The active cell box rides that bar and moves horizontally.

- **Up / Down**, the wheel and the scrollbar move the tracker under the bar, one whole row at a time. The line under the bar changes; the bar and the box stay put.
- **Tab**, **Shift+Tab**, **←** and **→** move the box between fields and across tracks. The line does not change.
- **Click** chooses the column under the pointer. The line stays where it is.
- **Playback** scrolls the view so the playing line stays under the bar, and the box rides with it.

Track dividers run the full height of the tracker area, through the blank space above and below the block. The grid carries symmetric padding at the top and bottom so that the first and last lines can also sit at the centre.

Meters read the real audio: every track has its own `AnalyserNode` after its volume stage, so a muted or silent track flatlines and a playing one moves. The three E gadgets follow the original screen: **E1** is the bar graph under the info line, with a slot per instrument (01–31) on the left and per note (C-1 up) on the right, raised by note triggers at the note's volume and falling like the other meters; **E2** is the V.U. meter at each track's edge, from mid-height down, in the original red-to-green ramp with grey edges; **E3** is the per-track oscilloscope, 42 samples wide, hanging off the highlighted line. All three switch off in 5–8 channel modes, and a right click away from the block editor switches them off together. Four-channel songs without free panning are hard-panned as the Amiga was: tracks 0 and 3 left, 1 and 2 right.

The footer's geometry comes from OctaMED Pro 4 as measured in OctaMEDIC (`TheExiledCat/octamedic`): graph top 9, height 32, 8-pixel slots, instrument slots from x=16 and note slots from x=280, rulers at 14/264/278/624, and 4 height steps of 7 pixels. The info line carries the memory readout, editable block and song names, and NRM.

## What it does

Octanaut reads and plays:

| Format | Notes |
|---|---|
| **MMD0, MMD1, MMD2, MMD3, MMDC** | OctaMED and MED modules, including packed MMDC patterns, multi-modules, MMD2/MMD3 section tables and BPM mode. 16-bit and stereo instruments are decoded at full depth. Invalid optional metadata pointers are skipped so otherwise readable music can load. |
| **MED4** (`MED` + version 4) | OctaMED 2.x song files, samples attached or external. |
| **MED2** | MED 1.12 fixed-layout songs. |
| **ProTracker / SoundTracker / NoiseTracker** | 4 and 8 channel `.mod`, converted to MED effects on import. |
| **MSH** | OctaMED synthetic instruments, the little 50-byte patches. |
| **IFF 8SVX** and raw samples | Instrument import. |
| **LHA archives** | Drop a `.lha` and the module inside is extracted and opened. If it holds several, you get a picker. Headers at levels 0, 1 and 2; methods -lh0-, -lh1-, -lh4- to -lh7-. |

It writes **MMD1** (`.med`, V4's native format), **MMD0** (the older interoperable format), **ProTracker modules** with the effects converted, **WAV**, **AAC** and **IFF 8SVX** samples. Audio export renders the song offline, so it does not depend on real-time playback. MP3 appears when the browser exposes an encoder, which Chromium currently does not. It also records from a microphone, which the sample editor's Monitor and Record gadgets drive.

Playing an OctaMED demo from 1991 is the point. `File > Load demo` gives you something to poke at if you do not have a module to hand.

## The model

Octanaut keeps OctaMED's shape:

- A song is a list of **blocks** of 1–3200 lines and 1–16 tracks. Block length is variable. MMD1 keeps the full V4 range; MMD0 stops at 256 and refuses longer blocks rather than truncating them.
- A **play sequence** names which blocks play in which order, up to 256 entries.
- Up to 63 **instruments** are shared by every song in the module.
- Notes carry a note, an instrument, a command and a data byte.
- Instruments are samples, synthsounds, hybrid sounds or MIDI assignments.
- **Hold and decay** are per-instrument values, written into the pattern with command `8`.

## Effects

The full MED command set is implemented:

| Cmd | Effect |
|---|---|
| `0` | Arpeggio, two semitone offsets cycled every tick |
| `1` / `2` | Slide up / down |
| `3` | Portamento to a target note |
| `4` | Vibrato (speed and depth nibbles) |
| `5` | Old vibrato |
| `8` | Set hold and decay for this note |
| `9` | Secondary tempo |
| `A` / `D` | Volume slide |
| `B` | Position jump in the play sequence |
| `C` | Set volume, and `$80`–`$C0` sets the instrument's default volume |
| `E` | Synthsound waveform jump (MIDI pan in the original) |
| `F` | `00` next block, `01`–`F0` tempo, `FD` retune, `FE` stop, `FF` note off |

V4's ProTracker-compatible `05` slide with fade, `06` vibrato with fade and `07` tremolo are not implemented. The extended V4 commands `10` (MIDI message), `16` (block loop), `1C` (MIDI preset) and `1E` (line delay) are also absent.

## Two depths

OctaMED V2 worked in 8 bits, mono, like the machine underneath it. OctaMED Soundstudio gained 16-bit and stereo instruments, and a module from 2001 will contain both. The **Depth** switch in the Play panel decides how they are rendered:

- **16BIT** – native depth and stereo, so a Soundstudio module sounds as its author meant it. 8-bit instruments stay 8-bit; nothing is invented.
- **8BIT** – what a stock Amiga would have done: stereo downmixed to mono and every sample quantised to 8 bits. Useful for hearing an old module the way it sounded on the hardware, and for hearing exactly what the extra resolution buys.

Switching re-renders every instrument, so it takes effect immediately, playing or not.

## Two playback characters

The Amiga had four audio channels. OctaMED got eight by splitting each one in software, and paid for it: paired tracks share a volume register, samples are pre-halved, the primary tempo locks, and synthsounds stop working.

Octanaut mixes every track cleanly by default, which is how those modules were meant to sound on modern hardware. Tick **8ch hardware** to get the original behaviour instead: half gain on split channels, paired volume registers, and the low-pass filter in circuit. Modules written for eight channels will be noticeably louder in the default mode, because their samples were halved on purpose.

## Keyboard

The map is OctaMED's, with **Cmd** (or **Ctrl** for the shortcuts a browser leaves alone) standing in for the Amiga key.

| Key | Action |
|---|---|
| `Esc` | Toggle editing |
| `Space` | Play / stop (clears a note instead when SPC=DEL) |
| `Shift`+`Space` | Continue song |
| `Alt`+`Space` | Continue block |
| `Shift`+`Alt`+`Space` | Play song |
| `F1`–`F5` | Octave for the two keyboard rows |
| `F6`–`F10` | First, quarter, middle, three-quarter, last line |
| `Ctrl`+`F1`–`F10` | Select panel |
| Up / Down | Scroll the tracker one row |
| Left / Right | Move between fields, wrapping across tracks |
| `Shift`+`Up`/`Down` | Previous / next block |
| `Shift`+`Left`/`Right` | **Previous / next instrument** |
| `Alt`+`Shift`+`Left`/`Right` | 16 instruments back / forward |
| `Alt`+`Left`/`Right` | Previous / next track |
| `Alt`+`Up`/`Down` | First / last block |
| `Ctrl`+`Left`/`Right` | Previous / next screenful of tracks |
| Right-button drag | Select a range |
| `z s x d c v g b h n j m , l . ; /` | Lower keyboard octave |
| `q 2 w 3 e r 5 t 6 y 7 u i 9 o 0 p` | Upper keyboard octave |
| `Shift`+`0`–`9` | Insert a programmable key |
| `Ctrl`+`Shift`+`0`–`9` | Pick the current cell into a programmable key |
| `Delete` | Clear the field; `Shift` clears the cell; `Alt` clears the command |
| `Return` | Write the hold marker (`-|-`) |
| `Backspace` | Delete a line; `Shift` inserts one; `Alt` deletes the track; `Alt`+`Shift` inserts one |
| `Tab` | Mark a line |
| `~` | Make space clear notes instead of playing |
| `Ctrl`+`A` | Cycle cursor advance |
| `Ctrl`+`F` | Show sample memory |
| `Ctrl`+`Space` | MIDI reset |
| Cmd/Ctrl + `X` `C` `V` | Cut / copy / paste track, with `Shift` for the block |
| Cmd/Ctrl + `T` | Build a slide (with `Shift` for the other variant) |
| Cmd/Ctrl + `L` `P` `F` `I` `R` | Load, play, filter, instrument name, repeat |
| `0`–`9`, `A`–`V` in a number field | Type the value |

Shift+arrows do not select a range: on the Amiga that is block and sample navigation, and a range is dragged with the right button.

## Panels and displays

**Panels**: Play (play sequence, track enables, channel mode), Instr (slot, name, sample load, volume, hold/decay, loop, transpose), Block (cut/copy/paste/swap for tracks and whole blocks, line and track insert/delete, expand/shrink, split/join), Edit (edit and space toggles, octaves, cursor advance), Range (selection, spread, automatic slide and volume generators, per-track selection), Transp (semitone and octave shifts scoped to song, block, track or range, note and instrument exchange, annotation), Vol (per-track and master volume), MIDI (Web MIDI output, channel and preset per instrument), Files, Misc.

**Displays**: the note grid, a notation view drawn from the current block, the synthsound editor with editable volume and waveform programs, the sample editor with loop markers and range operations, and an instrument list.

**Synthsounds** run the real bytecode: ten volume commands and fourteen waveform commands, executed once per timing pulse, driving up to 64 single-cycle waveforms. The renderer detects program loops so held notes sustain instead of stopping after a fixed length.

## MIDI

Web MIDI drives note input and output in Chromium. An instrument with a MIDI channel leaves the mixer and sends its notes, preset changes and controller values down the selected port. The MIDI panel also covers clock out, active sensing, local control and panic. Safari's Web MIDI support is limited, and the message editor, input maps and external sync described in the V4 manual are still missing.

## Recording system audio

The sample editor's **Input** selector offers three sources:

- **Microphone**, or any input device the system exposes.
- **System audio (share screen)** – uses display capture with audio. Chrome and Edge offer tab and window audio; on macOS whole-screen audio is not available this way.
- **This app's output** – resamples whatever Octanaut is playing, which is the quick way to make an instrument out of part of a module.

On macOS the reliable route for "record from the computer" is a virtual audio device. Install [BlackHole](https://existential.audio/blackhole/) (or Loopback), set it as your output in Audio MIDI Setup, then pick it from the input list. It appears alongside the microphone after you press **Find**. Safari does not capture system audio through display capture, so a loopback device is the way there too.

Recording never monitors the input back through the speakers, so a microphone will not feed back.

## Audio and browsers

Safari will not start audio that was not created inside a click, and it fails without a prompt. Octanaut creates the audio context on the first pointer or key press anywhere on the page, retries on every play, and re-unlocks when the tab comes back. The **Misc** panel shows the live context state (`running`, sample rate, latency) with a **Test tone** button, so if something is quiet you can tell straight away whether the problem is the context or the module.

Samples are resampled to the context rate once on load, which keeps pitch handling identical across browsers (Safari runs at 48 kHz, most others at 44.1).

## Design notes

The interface is built in OctaMED's own idiom: grey bevelled chrome over a black screen, a timer in the title bar, the play sequence as a five-row box on the left with its own up/down arrows, tempo and filter gadgets along the top, transport under the gadget row, and a status line carrying the sequence position, block, octave, the E / SP / CHRD flags and sixteen track lamps.

The panel and display selectors share one five-row, three-column grid on the right: the ten panels in the first two columns, the five editors in the third. The Files panel opens a directory browser in the main window, with folder, browse, parent and refresh controls. The bottom strip is the Amiga's monitor area: two stereo oscilloscopes and the four E2 sprites, with **E3** switching the scope bars. The sixteen **E1** level bars ride over the pattern grid.

The colours are the machine's: grey chrome, black screen, white notes, amber commands and alternating red and blue track rules. E2 switches the rules off for a plainer grid.

The app state lives in one object wrapped by `MW.store`. A panel subscribes to the keys it shows and repaints when one of them changes; the grid, the canvas overlays and the audio engine keep drawing and scheduling imperatively. `store.set` assigns a patch and notifies the keys that actually changed, while `store.commit` notifies after an in-place edit such as moving the cursor.

## Known gaps

- **MIDI messages and maps** are partial: SysEx messages can be edited, captured, sent and saved as JSON; external clock and transport follow; the input map has all 128 keys. Key-up recording and writing SysEx into MMD1 are still missing.
- **The sample list** shows loaded instruments and can browse user-selected folders, but does not use `MED_Paths` or resolve missing names automatically.
- **The sample and synth editors** support freehand drawing and range operations; Sample D.PIXELS and exact original effect algorithms remain incomplete.
- **Amiga-only controls** (ICON, Workbench open/close, LOADGFX, MOUSE2) are disabled. They have no browser equivalent.
- **MP3 export** depends on a browser audio encoder. Chromium exposes AAC but not MP3, so there the WAV and AAC buttons are the reliable pair.
- Browsers hold audio back until the page has been clicked once. Octanaut resumes the audio context on the first click or key press and says so if it is still blocked.
- **Synthsound sequence editing** supports command keys and hexadecimal values, plus insert/delete; its precise cursor behaviour still needs comparison with OctaMED.
- **The sample editor** has freehand drawing, RANGE ALL, zero-crossing searches, reverse, fades and other sample effects. Pitch and destination accept note-key entry; D.PIXELS remains unavailable.
- **MED 2.00** (`MED` + version 3) song files produce an error message; save them as MMD0 in OctaMED first.
- **Notation** uses a combined grand staff, supports ghost tracks and instrument hiding, and saves view settings. Rests, exact engraving and interoperability with OctaMED need further work.

## Layout

```
app/
  package.json      Tailwind and test scripts
  tsconfig.json     type checking for the core
  test/             unit tests and headless checks
  web/              the served site
    index.html
    css/tailwind.css  Tailwind source
    css/app.css       compiled output, checked in
    fonts/            Departure Mono and Pixel Operator
    js/core.js        model, note tables, tempo conversion
    js/store.js       app state, patch/commit and subscriptions
    js/storage.js     IndexedDB autosave and restore
    js/disk.js        DF0: work disk in IndexedDB
    js/modland.js     DH0: Modland index, fetch and cache
    js/loaders.js     MMD0-3, MMDC, MED4, MED2, MOD, MSH, 8SVX
    js/lha.js         LHA/LZH archives, levels 0-2, -lh0- to -lh7-
    js/writer.js      MMD0 and MMD1 writers
    js/synth.js       synthsound renderer
    js/engine.js      tick scheduler, Web Audio voices, effects
    js/ui-grid.js     note grid
    js/panels.js      compiled Preact panel bundle
    js/ui-displays.js notation, sample, synth, instrument list
    src/panels.tsx    panel host and store controller
    src/shared.tsx    shared panel helpers and hooks
    src/panels/       one component file per panel
    js/app.js         editing operations, keyboard, file IO
```

The loader and writer are standalone: `MW.loadModule(arrayBuffer)` and `MW.writeMMD0(song)` work without a DOM, which is how the demo modules were round-trip tested (7,680 cells, no differences).

`npm run test:corpus` checks the local Modland collection in `../fixtures/modland`, verifying each file's manifest checksum and loading its song data. Pass another fixture directory with `npm run test:corpus -- /path/to/modland`. The music files are local test data and must not be committed or distributed. Loading successfully does not establish playback fidelity.

Run these from `app/`. `npm test` runs the type check, the store and audio-mixing unit tests, and the headless regression checks. `node test/run.js` runs the 32 checks on their own: the LHA decoders against the reference archives, Med's command byte staying whole for MMD1 and later, and the MMD0 and MMD1 writers round-tripping notes, tempo, blocks and V4 metadata. `npm run typecheck` checks the files that opt in with `// @ts-check`, currently the model, the loaders, the LHA decoder, the writers, the synth renderer, the audio engine, the audio export, the store and the TSX panel components. The UI scripts can join them one file at a time.

`FEATURES.md` tracks parity with OctaMED Professional V4.00, panel by panel: 146 features matching, 16 partial, 6 absent.

## Command bytes

MMD0 packs the command into a nibble beside the instrument. MMD1, MMD2 and MMD3 give it a whole byte, and from 0x10 up those bytes are commands in their own right: 0x19 is sample offset, 0x1F is note delay/retrigger, and so on. Reading them as `cmd & 0x0f` turns 0x19 into 0x09, i.e. secondary tempo, which drags the playback exactly in the sections that use sample offsets. The loader keeps the full byte and the player handles the extended set explicitly. Unknown bytes are ignored, so they cannot be mistaken for a low command.

The grid shows five digits per cell: instrument, command and data. OctaMED v4 prints the ordinary 0-F commands as a single hex digit (`--- 010F` is instrument 01, command 0, data 0F). Extended MMD1 commands from 0x10 up need a second digit and widen that cell to six, so a later module's 0x19 still reads correctly. The command column accepts both entry styles: type `1` then `9` for 0x19, or a single `9` for 0x09.
