# Octanaut

An eight channel music tracker for the browser, built to open the modules that OctaMED wrote.

The name is a nod to OctaMED, which is where all of this comes from.

Open `index.html` directly, or serve the folder:

```
python3 -m http.server 8000
# then visit http://localhost:8000/
```

There is no build step for the JavaScript: everything is plain ES2019 in classic scripts. The stylesheet is compiled from Tailwind, and the compiled file is checked in, so `file://` still works as-is.

## Styling

The interface is built with Tailwind CSS v4. The source lives in `app/css/tailwind.css`, the compiled output in `app/css/app.css`.

```
npm install          # once
npm run build:css    # compile app/css/app.css
npm run watch:css    # rebuild while editing
```

The Tailwind source declares the two typefaces, the paper/ink palette and the component classes used by the drawn interface (the grid, the sequence box, the panel cells, the file requester). Edit markup with utilities; edit repeated widget shapes in the `@layer components` block.

Fonts are bundled in `app/fonts/`:

- **Departure Mono** by Helena Zhang and Tobias Fried (MIT) for the interface.
- **Pixel Operator Mono HB 8** by Jayvee Enaguas (CC0), used only in the note editor for four-track blocks.
- **Pixel Operator Mono HB** (CC0) for note editors with more than four tracks, which carries the same five-digit cells in a narrower advance.

Everything outside the note editor - panels, status strip, tabs, requester - is Departure Mono.

The note grid draws its channel meters as magenta-to-cyan bars pinned to the bottom of the display, one per track, plus a cyan waveform trace per channel over the pattern. The three E gadgets follow the original: **E1** switches the level bars, **E2** the four coloured channel sprites, **E3** the oscilloscopes. They stay available in 5-8 channel modes, so all eight tracks are metered. Four-channel songs that do not carry free panning are hard-panned as the Amiga was: tracks 0 and 3 left, 1 and 2 right.

The bottom monitor is two oscilloscopes, one per stereo side: left-panned tracks feed the left pane, right-panned tracks the right (tracks 0/3 and 1/2 on a four-track song, or split evenly when a song is centred). Each pane draws one cyan bar on every ruler tick, one audio sample per tick; a one-pixel bar means silence, so the baseline stays continuous. The tick pitch, bar width and pane split were matched to the original screen: roughly 12 px per slot, three-pixel ticks, six-pixel bars centred in their slot, panes about 43/57 of the scope area.

Both the meters and the scopes read the real audio: every track has its own AnalyserNode after its volume stage, so a muted or silent track flatlines and a playing one moves. The cyan trace over the pattern is the same per-track signal, clipped to that track's column. Each play-sequence row carries its own up/down arrow for moving that entry, and the two gadgets beside the song counter step through the songs in a multi-song module.

`FEATURES.md` tracks parity with the original, panel by panel: 99 features matching, 5 partial, 6 not applicable or still missing.

---

## What it does

Octanaut reads and plays:

| Format | Notes |
|---|---|
| **MMD0, MMD1, MMD2, MMD3** | OctaMED and MED modules, including multi-modules, MMD2/MMD3 section tables and BPM mode. 16-bit and stereo instruments are decoded at full depth. |
| **MED4** (`MED` + version 4) | OctaMED 2.x song files, samples attached or external. |
| **MED2** | MED 1.12 fixed-layout songs. |
| **ProTracker / SoundTracker / NoiseTracker** | 4 and 8 channel `.mod`, converted to MED effects on import. |
| **MSH** | OctaMED synthetic instruments, the little 50-byte patches. |
| **IFF 8SVX** and raw samples | Instrument import. |
| **LHA archives** | Drop a `.lha` and the module inside is extracted and opened. If it holds several, you get a picker. Headers at levels 0, 1 and 2; methods -lh0-, -lh1-, -lh4- to -lh7-. |

It writes **MMD0** (the format OctaMED reads back), **ProTracker modules** with the effects converted, **WAV** and **IFF 8SVX** samples. It also records from a microphone, which the sample editor's Monitor and Record gadgets drive.

Playing an OctaMED demo from 1991 is the point. `File > Load demo` gives you something to poke at if you do not have a module to hand.

## The model

Octanaut keeps OctaMED's shape rather than Protracker's:

- A song is a list of **blocks** of 1-256 lines and 1-16 tracks, not a list of fixed 64-row patterns.
- A **play sequence** names which blocks play in which order, up to 256 entries.
- Up to 63 **instruments** are shared by every song in the module.
- Notes carry a note, an instrument, a command nibble and a data byte.
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
| `C` | Set volume, and `$80`-`$C0` sets the instrument's default volume |
| `E` | Synthsound waveform jump (MIDI pan in the original) |
| `F` | `00` next block, `01`-`F0` tempo, `FD` retune, `FE` stop, `FF` note off |

## Two depths

OctaMED V2 worked in 8 bits, mono, like the machine underneath it. OctaMED Soundstudio gained 16-bit and stereo instruments, and a module from 2001 will contain both. The **Depth** switch in the Play panel decides how they are rendered:

- **16BIT** — native depth and stereo, so a Soundstudio module sounds as its author meant it. 8-bit instruments stay 8-bit; nothing is invented.
- **8BIT** — what a stock Amiga would have done: stereo downmixed to mono and every sample quantised to 8 bits. Useful for hearing an old module the way it sounded on the hardware, and for hearing exactly what the extra resolution buys.

Switching re-renders every instrument, so it takes effect immediately, playing or not.

## Two playback characters

The Amiga had four audio channels. OctaMED got eight by splitting each one in software, and paid for it: paired tracks share a volume register, samples are pre-halved, the primary tempo locks, and synthsounds stop working.

Octanaut mixes every track cleanly by default, which is what the modules want on modern hardware. Tick **8ch hardware** to get the original behaviour instead: half gain on split channels, paired volume registers, and the low pass filter in circuit. Modules written for eight channels will be noticeably louder in the default mode, because their samples were halved on purpose.

## Keyboard

The map is OctaMED's, with **Cmd** (or **Ctrl** for the shortcuts a browser leaves alone) standing in for the Amiga key.

| Key | Action |
|---|---|
| `Esc` | Toggle editing |
| `Space` | Play / stop (clears a note instead when SPC=DEL) |
| `Shift`+`Space` | Continue song |
| `Alt`+`Space` | Continue block |
| `Shift`+`Alt`+`Space` | Play song |
| `F1`-`F4` | Octave for the two keyboard rows |
| `F6`-`F10` | First, quarter, middle, three-quarter, last line |
| `Ctrl`+`F1`-`F10` | Select panel |
| Cursor keys | Move between fields, wrapping across tracks |
| `Shift`+`Up`/`Down` | Previous / next block |
| `Shift`+`Left`/`Right` | **Previous / next instrument** |
| `Alt`+`Shift`+`Left`/`Right` | 16 instruments back / forward |
| `Alt`+`Left`/`Right` | Previous / next track |
| `Alt`+`Up`/`Down` | First / last block |
| `Ctrl`+`Left`/`Right` | Previous / next screenful of tracks |
| Right-button drag | Select a range |
| `z s x d c v g b h n j m , l . ; /` | Lower keyboard octave |
| `q 2 w 3 e r 5 t 6 y 7 u i 9 o 0 p` | Upper keyboard octave |
| `Shift`+`0`-`9` | Insert a programmable key |
| `Ctrl`+`Shift`+`0`-`9` | Pick the current cell into a programmable key |
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
| `0`-`9`, `A`-`V` in a number field | Type the value |

Shift+arrows no longer select a range: on the Amiga that is block and sample navigation, and a range is dragged with the right button.

## What is in the box

**Panels**: Play (play sequence, track enables, channel mode), Instr (slot, name, sample load, volume, hold/decay, loop, transpose), Block (cut/copy/paste/swap for tracks and whole blocks, line and track insert/delete, expand/shrink, split/join), Edit (edit and space toggles, octaves, cursor advance), Range (selection, spread, automatic slide and volume generators, per-track selection), Transp (semitone and octave shifts scoped to song, block, track or range, note and instrument exchange, annotation), Vol (per-track and master volume), MIDI (Web MIDI output, channel and preset per instrument), Files, Misc.

**Displays**: the note grid, a notation view drawn from the current block, the synthsound editor with editable volume and waveform programs, the sample editor with loop markers and range operations, and an instrument list.

**Synthsounds** run the real bytecode: ten volume commands and fourteen waveform commands, executed once per timing pulse, driving up to 64 single-cycle waveforms. The renderer detects program loops so held notes sustain instead of stopping after a fixed length.

## Recording system audio

The sample editor's **Input** selector offers three sources:

- **Microphone**, or any input device the system exposes.
- **System audio (share screen)** — uses display capture with audio. Chrome and Edge offer tab and window audio; on macOS whole-screen audio is not available this way.
- **This app's output** — resamples whatever Octanaut is playing, which is the quick way to make an instrument out of part of a module.

On macOS the reliable route for "record from the computer" is a virtual audio device. Install [BlackHole](https://existential.audio/blackhole/) (or Loopback), set it as your output in Audio MIDI Setup, then pick it from the input list — it appears alongside the microphone after you press **Find**. Safari does not capture system audio through display capture, so a loopback device is the way there too.

Recording never monitors the input back through the speakers, so a microphone will not feed back.

## Audio and browsers

Safari will not start audio that was not created inside a click, and it fails silently rather than asking. Octanaut creates the audio context on the first pointer or key press anywhere on the page, retries on every play, and re-unlocks when the tab comes back. The **Misc** panel shows the live context state (`running`, sample rate, latency) with a **Test tone** button, so if something is quiet you can tell straight away whether the problem is the context or the module.

Samples are resampled to the context rate once on load rather than played at a low playback rate, which keeps pitch handling identical across browsers (Safari runs at 48 kHz, most others at 44.1).

## Design notes

The interface is built in OctaMED's own idiom: grey bevelled chrome over a black screen, a timer in the title bar, the play sequence as a five-row box on the left with its own up/down arrows, tempo and filter gadgets along the top, transport under the gadget row, and a status line carrying the sequence position, block, octave, the E / SP / CHRD flags and sixteen track lamps.

The panel selector is the two-column grid on the right, in the same order: Files/Misc, Play/Vol, Instr/MIDI, Block/Trans, Edit/Range. The display selector sits under it. The bottom strip is the Amiga's monitor area: sixteen channel meters on the left and a live oscilloscope on the right, both switchable with the E1 and E3 gadgets.

The colours are the machine's: grey chrome, black screen, white notes, amber commands and alternating red and blue track rules. E2 switches the rules off for a plainer grid.

## Known gaps

- **MIDI input** is not implemented (output is).
- Browsers hold audio back until the page has been clicked once. Octanaut resumes the audio context on the first click or key press and says so if it is still blocked.
- **Synthsound sequence editing** changes values and inserts/deletes lines, but does not let you type command names inline; the binary instruments round-trip unchanged through MMD0.
- **The sample editor** has reverse, normalise, fades, crop and loop setting. It has no echo, mix or noise generator yet.
- **MED 2.00** (`MED` + version 3) song files are rejected with a message rather than parsed; save them as MMD0 in OctaMED first.
- Notation is a single-staff sketch per track, not a paginated score, and does not print.

## Layout

```
app/
  index.html
  css/app.css
  js/core.js        model, note tables, tempo conversion
  js/loaders.js     MMD0-3, MED4, MED2, MOD, MSH, 8SVX
  js/lha.js         LHA/LZH archives, levels 0-2, -lh0- to -lh7-
  js/writer.js      MMD0 writer
  js/synth.js       synthsound renderer
  js/engine.js      tick scheduler, Web Audio voices, effects
  js/ui-grid.js     note grid
  js/ui-panels.js   the ten panels
  js/ui-displays.js notation, sample, synth, instrument list
  js/app.js         editing operations, keyboard, file IO
```

The loader and writer are standalone: `MW.loadModule(arrayBuffer)` and `MW.writeMMD0(song)` work without a DOM, which is how the demo modules were round-trip tested (7,680 cells, no differences).

`node test/run.js` runs the headless checks: the LHA decoders against the reference archives, and Med's command byte staying whole for MMD1 and later.

## Command bytes

MMD0 packs the command into a nibble beside the instrument. MMD1, MMD2 and MMD3 give it a whole byte, and from 0x10 up those bytes are commands in their own right — 0x19 is sample offset, 0x1F is note delay/retrigger, and so on. Reading them as `cmd & 0x0f` turns 0x19 into 0x09, i.e. secondary tempo, which drags the playback exactly in the sections that use sample offsets. The loader keeps the full byte and the player handles the extended set explicitly; anything it does not know is ignored rather than reinterpreted as a low command.

The grid shows six digits per cell - instrument, command and data, with the command always in two hex digits as OctaMED v4 and later do. The command column accepts both entry styles: type `1` then `9` for 0x19, or a single `9` for 0x09 (shown as `09`).

