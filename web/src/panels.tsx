import { render, type ComponentChildren } from 'preact';
import { useEffect, useReducer, useState } from 'preact/hooks';

const MW: any = (globalThis as any).MW;

/* ---------------------------------------------------------------- helpers */

const BTN =
  'flex h-[20px] min-w-0 items-center justify-center border border-ink bg-paper px-1 text-[10px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper';
const LAB = 'flex h-[20px] shrink-0 items-center px-1 text-[10px] uppercase leading-none whitespace-nowrap';
const FIELD = 'h-[20px] min-w-0 border border-ink bg-paper px-1 text-[11px] leading-none text-ink outline-none';
const ROW = 'flex items-stretch gap-px';

function B(props: any) {
  const { act, on, cls, children, title, name, onClick } = props;
  return (
    <button
      type="button"
      title={title}
      data-act={act}
      data-name={name}
      class={`${BTN} ${on ? 'on' : ''} ${cls || ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function L(props: any) {
  return <span class={`${LAB} ${props.cls || ''}`}>{props.children}</span>;
}

function R(props: any) {
  return <div class={`${ROW} ${props.cls || ''}`}>{props.children}</div>;
}

function T(props: any) {
  return (
    <input
      class={`${FIELD} ${props.cls || ''}`}
      value={props.value ?? ''}
      placeholder={props.placeholder}
      maxlength={props.maxlength}
      onInput={(e: any) => props.onInput && props.onInput(e.currentTarget.value)}
    />
  );
}

function N(props: any) {
  return (
    <input
      type="number"
      class={`${FIELD} ${props.cls || ''}`}
      value={props.value ?? 0}
      min={props.min}
      max={props.max}
      onChange={(e: any) => props.onChange && props.onChange(parseInt(e.currentTarget.value, 10) || 0)}
    />
  );
}

function useKeys(keys: string[]) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const key = keys.join('|');
  useEffect(() => {
    if (!MW.store) return;
    return MW.store.subscribe(keys, force);
  }, [key]);
}

function fmt2(n: number) {
  return String(n).padStart(2, '0');
}

/* ---------------------------------------------------------------- Play */

function PlayPanel() {
  useKeys(['transport']);
  const app = MW.app;
  const song = app.song;
  const tempo = song.deftempo || 33;
  const tempo2 = song.tempo2 || 6;
  const eq = app.eq || [true, true, true];
  const setTempo = (kind: string, value: number) => {
    const v = MW.clamp(Math.round(value), 1, kind === 'tempo' ? 240 : 32);
    if (kind === 'tempo') {
      song.deftempo = v;
      if (!MW.player.playing) MW.player.tempo = v;
    } else {
      song.tempo2 = v;
      if (!MW.player.playing) MW.player.tempo2 = v;
    }
    MW.panels.refresh();
  };
  const stepTempo = (kind: string, d: number) =>
    setTempo(kind, (kind === 'tempo' ? song.deftempo : song.tempo2) + d);
  const slider = (kind: string, value: number, max: number, cls: string) => (
    <input
      type="range"
      min="1"
      max={max}
      value={value}
      class={`h-[20px] min-w-0 ${cls}`}
      onChange={(e: any) => setTempo(kind, +e.currentTarget.value)}
    />
  );

  return (
    <div class="flex h-full flex-col gap-px">
      <R>
        {slider('tempo', tempo, 240, 'flex-[1.6]')}
        <B onClick={() => stepTempo('tempo', -1)} cls="w-[20px]">&lt;</B>
        <B onClick={() => stepTempo('tempo', 1)} cls="w-[20px]">&gt;</B>
        {slider('tempo2', tempo2, 32, 'flex-1')}
        <B onClick={() => stepTempo('tempo2', -1)} cls="w-[20px]">&lt;</B>
        <B onClick={() => stepTempo('tempo2', 1)} cls="w-[20px]">&gt;</B>
      </R>
      <R>
        <L cls="w-[34px]">VOL:</L>
        <B act="vol-hex" on={!!song.flags.volhex} cls="w-[38px]">HEX</B>
        <B act="vol-dec" on={!song.flags.volhex} cls="w-[38px]">DEC</B>
        <B act="misc-filter" on={!!song.flags.filteron} cls="w-[62px]">FILTER</B>
        <B act="eq-1" on={!!eq[0]} cls="flex-1">E1</B>
        <B act="eq-2" on={!!eq[1]} cls="flex-1">E2</B>
        <B act="eq-3" on={!!eq[2]} cls="flex-1">E3</B>
        <B act="stslide" on={!!song.flags.stslide} cls="w-[40px]">STS</B>
        <L cls="w-[34px]">SPD</L>
        <span class="flex h-[20px] items-center justify-center border border-ink bg-paper px-1 text-[11px] tabular-nums">
          {String(tempo).padStart(3, '0')}/{fmt2(tempo2)}
        </span>
      </R>
      <R>
        <L cls="w-[70px] justify-end">CH.MODE:</L>
        <B act={app.depth === 'enhanced' ? 'depth-classic' : 'depth-enhanced'} on={app.depth === 'enhanced'} cls="w-[32px]">HQ</B>
        <B onClick={() => MW.player.stop()} cls="w-[58px]">STOP</B>
        <B onClick={() => MW.player.play(true)} cls="flex-[1.6]">PLAY SONG</B>
        <B onClick={() => MW.player.play(false)} cls="flex-1">CONT. SONG</B>
      </R>
      <R>
        {[4, 5, 6, 7, 8].map(n => (
          <B key={n} act={`chmode-${n}`} on={song.channels === n} cls="flex-1">{n}</B>
        ))}
        <B onClick={() => MW.player.playBlock(app.cursor.block)} cls="flex-[1.6]">PLAY BLOCK</B>
        <B act="play-on-note" on={!!app.playOnNote} cls="w-[24px]">D</B>
        <B onClick={() => MW.player.playBlock(app.cursor.block)} cls="flex-1">CONT. BLOCK</B>
      </R>
    </div>
  );
}

/* ---------------------------------------------------------------- Files */

function FilesPanel() {
  useKeys(['song']);
  const app = MW.app;
  const fmt = app.saveFormat || 'mmd1';
  return (
    <div class="flex h-full flex-col gap-px">
      <R>
        <L cls="w-[82px] justify-end">SAVE FORMAT:</L>
        <B act="file-info" on={!!app.saveInfo} cls="w-[46px]">INFO</B>
        <B act="file-open" cls="flex-1">LOAD SONG</B>
        <B act="ins-open" cls="flex-1">LOAD INSTR</B>
        <B act="file-del" cls="w-[58px]">DEL FILE</B>
        <B act="file-load-msg" cls="w-[62px]">LOAD MSG</B>
        <B act="file-load-map" cls="w-[42px]">MAP</B>
      </R>
      <R>
        <L cls="w-[82px]" />
        <B act="file-icon" cls="w-[46px]">ICON</B>
        <B act="file-save-song" cls="flex-1">SAVE SONG</B>
        <B act="file-save-iff" cls="flex-1">SAVE INSTR</B>
        <B act="file-save-msg" cls="w-[62px]">SAVE MSG</B>
        <B act="file-save-map" cls="w-[42px]">MAP</B>
      </R>
      <R>
        <B act="fmt-mmd1" on={fmt === 'mmd1'} cls="w-[82px]">MOD1(+INSTR)</B>
        <L cls="w-[32px]">DIR:</L>
        <span class="flex h-[20px] flex-1 items-center border border-ink bg-paper px-1 text-[10px] opacity-60">browser</span>
      </R>
      <R>
        <B act="fmt-mmd1n" on={fmt === 'mmd1n'} cls="w-[82px]">MOD1(NO INSTR)</B>
        <L cls="w-[32px]">FILE:</L>
        <T value={app.song.name || ''} maxlength={40} onInput={(v: string) => { app.song.name = v; }} cls="flex-1" />
      </R>
      <R>
        <B act="fmt-mmd0" on={fmt === 'mmd0'} cls="w-[82px]">MOD0 (OLD)</B>
        <B act="fmt-st" on={fmt === 'st'} cls="w-[82px]">ST-MODULE</B>
        <L cls="w-[42px]">EXPORT</L>
        <B act="audio-wav" cls="w-[42px]">WAV</B>
        <B act="audio-aac" cls="w-[42px]">AAC</B>
        <B act="audio-mp3" cls="w-[42px]">MP3</B>
        <B act="file-demo" cls="flex-1">DEMO</B>
      </R>
    </div>
  );
}

/* ---------------------------------------------------------------- Instr */

function InstrPanel() {
  useKeys(['currentIns']);
  const app = MW.app;
  const inst = app.song.instruments[app.currentIns - 1];
  const vol = inst ? inst.volume ?? 64 : 64;
  const setInst = (fn: (i: any) => void) => {
    const i = app.song.instruments[app.currentIns - 1];
    if (!i) return;
    fn(i);
    MW.panels.refresh();
  };
  const setType = (type: string) => setInst(i => {
    i.type = type;
    if ((type === 'synth' || type === 'hybrid') && !i.synth) i.synth = MW.createSynth();
  });
  return (
    <div class="flex h-full flex-col gap-px">
      <R>
        <span class="flex h-[20px] w-[24px] items-center justify-center border border-ink bg-paper text-[10px]">
          {MW.insName(app.currentIns)}
        </span>
        <T value={inst ? inst.name || '' : ''} maxlength={39} onInput={(v: string) => setInst(i => { i.name = v; })} cls="flex-1" />
        <L cls="w-[36px]">LEN:</L>
        <span class="flex h-[20px] w-[64px] items-center justify-end border border-ink bg-paper px-1 text-[11px] tabular-nums">
          {inst && inst.data ? inst.data.length : 0}
        </span>
      </R>
      <R>
        <B act="ins-first" cls="w-[24px]">|&lt;</B>
        <B act="ins-prev" cls="w-[24px]">&lt;</B>
        <B act="ins-next" cls="w-[24px]">&gt;</B>
        <B act="ins-last" cls="w-[24px]">&gt;|</B>
        <B act="ins-lastoccupied" cls="w-[30px]">&gt;|&lt;</B>
        <L cls="w-[52px]">TRANSPOSE</L>
        <B onClick={() => setInst(i => { i.transpose = Math.max(-48, (i.transpose || 0) - 1); })} cls="w-[16px]">-</B>
        <span class="flex h-[20px] w-[30px] items-center justify-center border border-ink bg-paper text-[11px]">{inst ? inst.transpose || 0 : 0}</span>
        <B onClick={() => setInst(i => { i.transpose = Math.min(48, (i.transpose || 0) + 1); })} cls="w-[16px]">+</B>
        <L cls="w-[46px]">FINETUNE</L>
        <B onClick={() => setInst(i => { i.finetune = Math.max(-8, (i.finetune || 0) - 1); })} cls="w-[16px]">-</B>
        <span class="flex h-[20px] w-[26px] items-center justify-center border border-ink bg-paper text-[11px]">{inst ? inst.finetune || 0 : 0}</span>
        <B onClick={() => setInst(i => { i.finetune = Math.min(7, (i.finetune || 0) + 1); })} cls="w-[16px]">+</B>
        <L cls="w-[32px]">HLD:</L>
        <N value={inst ? inst.hold || 0 : 0} min={0} max={255} onChange={(v: number) => setInst(i => { i.hold = v; })} cls="w-[34px]" />
        <L cls="w-[32px]">R/B:</L>
        <N value={inst ? inst.loop || 0 : 0} min={0} onChange={(v: number) => setInst(i => { i.loop = v; })} cls="w-[52px]" />
      </R>
      <R>
        <B act="ins-kill" cls="w-[54px]">FLUSH</B>
        <B act="ins-open" cls="w-[46px]">LOAD</B>
        <L cls="w-[32px]">DEC:</L>
        <N value={inst ? inst.decay || 0 : 0} min={0} max={255} onChange={(v: number) => setInst(i => { i.decay = v; })} cls="w-[34px]" />
        <L cls="w-[32px]">R/L:</L>
        <N value={inst ? inst.looplen || 0 : 0} min={0} onChange={(v: number) => setInst(i => { i.looplen = v; })} cls="w-[52px]" />
      </R>
      <R>
        <L cls="w-[42px]">TYPE:</L>
        <B onClick={() => setType('sample')} on={inst && inst.type === 'sample'} cls="w-[58px]">SAMPLE</B>
        <B onClick={() => setType('synth')} on={inst && inst.type === 'synth'} cls="w-[52px]">SYNTH</B>
        <B onClick={() => setType('hybrid')} on={inst && inst.type === 'hybrid'} cls="w-[54px]">HYBRID</B>
        <L cls="w-[34px]">VOL:</L>
        <span class="flex h-[20px] w-[50px] items-center justify-center border border-ink bg-paper text-[11px] tabular-nums">
          {vol}/{vol.toString(16).toUpperCase().padStart(2, '0')}
        </span>
        <B onClick={() => setInst(i => { i.volume = Math.max(0, (i.volume ?? 64) - 1); })} cls="w-[18px]">&lt;</B>
        <input type="range" min="0" max="64" value={vol} class="h-[20px] min-w-0 flex-1"
          onChange={(e: any) => setInst(i => { i.volume = +e.currentTarget.value; })} />
        <B onClick={() => setInst(i => { i.volume = Math.min(64, (i.volume ?? 64) + 1); })} cls="w-[18px]">&gt;</B>
      </R>
    </div>
  );
}

/* ---------------------------------------------------------------- Block */

function BlockPanel() {
  const app = MW.app;
  const b = app.song.blocks[app.cursor.block];
  const [factor, setFactor] = useState(2);
  const lines = (n: number) => MW.ops.setLines(MW.clamp(n, 1, 3200));
  return (
    <div class="flex h-full flex-col gap-px">
      <R>
        <L cls="w-[30px]">TRK:</L>
        <B act="trk-cut" cls="w-[42px]">CUT</B>
        <B act="trk-copy" cls="w-[46px]">COPY</B>
        <B act="trk-paste" cls="w-[46px]">PASTE</B>
        <B act="trk-swap" cls="w-[46px]">SWAP</B>
        <B act="track-ins" cls="w-[58px]">INS.TRK</B>
        <L cls="w-[36px]">TRKS:</L>
        {[4, 8, 12, 16].map(n => (
          <B key={n} act={`blk-tracks-${n}`} on={b.tracks === n} cls="w-[28px]">{n}</B>
        ))}
      </R>
      <R>
        <L cls="w-[30px]">BLK:</L>
        <B act="blk-cut" cls="w-[42px]">CUT</B>
        <B act="blk-copy" cls="w-[46px]">COPY</B>
        <B act="blk-paste" cls="w-[46px]">PASTE</B>
        <B act="blk-swap" cls="w-[46px]">SWAP</B>
        <B act="track-del" cls="w-[58px]">DEL.TRK</B>
        <L cls="w-[38px]">LINES:</L>
        <N value={b.lines} min={1} max={3200} onChange={lines} cls="w-[46px]" />
        <B onClick={() => lines(b.lines - 1)} cls="w-[18px]">&lt;</B>
        <B onClick={() => lines(b.lines + 1)} cls="w-[18px]">&gt;</B>
        <B onClick={() => lines(b.lines - 10)} cls="w-[20px]">&lt;&lt;</B>
        <B onClick={() => lines(b.lines + 10)} cls="w-[20px]">&gt;&gt;</B>
      </R>
      <R>
        <B act="blk-expand" cls="w-[54px]">EXPAND</B>
        <input type="number" min="2" max="9" value={factor} class={`${FIELD} w-[28px]`}
          onChange={(e: any) => setFactor(parseInt(e.currentTarget.value, 10) || 2)} />
        <B act="blk-shrink" cls="w-[54px]">SHRINK</B>
        <B act="line-ins" cls="w-[44px]">INS.L.</B>
        <B act="line-del" cls="w-[44px]">DEL.L.</B>
        <B act="del-buffer" cls="w-[58px]">DEL BUFF</B>
        {[1, 2, 3, 4, 8, 16].map(n => (
          <B key={n} act={`hl-${n}`} cls="w-[20px]">{n}</B>
        ))}
        <B act="hl-clear" cls="w-[20px]">C</B>
      </R>
      <R>
        <B act="blk-new" cls="w-[64px]">NEW BLOCK</B>
        <B act="blk-new-def" cls="w-[34px]">DEF</B>
        <B act="blk-new-here" cls="w-[64px]">NEW HERE</B>
        <B act="blk-new-here-def" cls="w-[34px]">DEF</B>
        <B act="blk-del-last" cls="w-[70px]">DELETE LAST</B>
        <B act="blk-del" cls="w-[70px]">DELETE THIS</B>
        <B act="blk-split" cls="w-[42px]">SPLIT</B>
        <B act="blk-join" cls="w-[42px]">JOIN</B>
      </R>
      <R>
        <L cls="w-[42px]">NAME:</L>
        <T value={b.name || ''} maxlength={40} onInput={(v: string) => { b.name = v; }} cls="flex-1" />
      </R>
    </div>
  );
}

/* ---------------------------------------------------------------- Edit */

function EditPanel() {
  useKeys(['editMode', 'spaceAsDel', 'chordMode', 'octave', 'advance']);
  const app = MW.app;
  const def = app.prog && app.prog[app.progTarget];
  const defText = def
    ? `${MW.noteName(def.note || 0, app.hb)} ${MW.insName(def.ins || 0)} ${MW.hex(def.cmd || 0)}${MW.hex(def.dat || 0)}`
    : '--- 00000';
  const toggleTrack = (t: number) => {
    app.mutedTracks[t] = !app.mutedTracks[t];
    MW.player.channels[t].muted = app.mutedTracks[t];
    MW.grid.render();
    MW.panels.refresh();
  };
  return (
    <div class="flex h-full flex-col gap-px">
      <R>
        <L cls="w-[54px]">TRK ON:</L>
        {Array.from({ length: 16 }, (_, t) => (
          <B key={t} onClick={() => toggleTrack(t)} on={!app.mutedTracks[t]} cls="flex-1 px-0">{t.toString(16).toUpperCase()}</B>
        ))}
        <B onClick={() => { for (let t = 0; t < 16; t++) { app.mutedTracks[t] = false; MW.player.channels[t].muted = false; } MW.grid.render(); }} cls="w-[34px]">SET</B>
        <B onClick={() => { for (let t = 0; t < 16; t++) { app.mutedTracks[t] = true; MW.player.channels[t].muted = true; } MW.grid.render(); }} cls="w-[34px]">CLR</B>
      </R>
      <R>
        <L cls="w-[48px]">KEYPAD:</L>
        <B act="pad-mode" on={app.padMode === 'track'} cls="w-[74px]">TRK ON/OFF</B>
        <B act="pad-mode" on={app.padMode === 'instr'} cls="w-[70px]">SEL.INSTR</B>
        <B act="missing" name="MAP2" cls="w-[42px]">MAP2</B>
        <B act="alt-clear" cls="w-[22px]">C</B>
        <B act="alt-pick-l" cls="w-[22px]">L</B>
        <B act="alt-pick-r" cls="w-[22px]">R</B>
        <span class="flex h-[20px] w-[30px] items-center justify-center border border-ink bg-paper text-[11px]">{app.progTarget}</span>
        <span class="flex h-[20px] flex-1 items-center justify-center border border-ink bg-paper px-1 text-[10px] tabular-nums">= {defText}</span>
        <B act="edit-space" on={!!app.spaceAsDel} cls="w-[72px]">SPACE=DEL</B>
      </R>
      <R>
        <L cls="w-[48px]">OCTAVE:</L>
        {Array.from({ length: 9 }, (_, i) => (
          <B key={i} act={`oct-${i}`} on={app.octave === i} cls="w-[26px]">{i + 1}</B>
        ))}
        <B act="edit-toggle" on={!!app.editMode} cls="w-[58px]">EDIT ON</B>
      </R>
      <R>
        <L cls="w-[34px]">ADV.</L>
        {[['up', '↑'], ['down', '↓'], ['nexttrk', '»'], ['prevtrk', '«'], ['right', '>'], ['left', '<']].map(([k, l]) => (
          <B key={k} act={`adv-${k}`} on={app.advance === k} cls="w-[24px]">{l}</B>
        ))}
        <L cls="w-[34px]">PICK:</L>
        <B act="pick-note" cls="w-[42px]">NOTE</B>
        <B act="pick-range" cls="w-[44px]">RANGE</B>
        <B act="pick-buffer" cls="w-[34px]">BUF</B>
        <L cls="w-[26px]">SPC</L>
        <N value={app.step} min={1} max={16} onChange={(v: number) => { app.step = v; }} cls="w-[34px]" />
      </R>
    </div>
  );
}

/* ---------------------------------------------------------------- Misc */

function MiscPanel() {
  useKeys(['song']);
  const app = MW.app;
  return (
    <div class="flex h-full flex-col gap-px">
      <R>
        <L cls="w-[16px]">R</L>
        <input type="range" min="0" max="64" value="0" class="h-[20px] w-[120px]" onChange={() => MW.missing('RGB palette')} />
        <span class={`${FIELD} w-[28px] text-center`}>0</span>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(n => (
          <B key={n} onClick={() => MW.missing('RGB palette')} cls={`w-[18px] ${n === 0 ? 'bg-ink' : ''}`}> </B>
        ))}
        <B act="missing" name="Palette restore" cls="w-[34px]">RES</B>
        <B act="missing" name="Palette undo" cls="w-[38px]">UNDO</B>
      </R>
      <R>
        <L cls="w-[16px]">G</L>
        <input type="range" min="0" max="64" value="0" class="h-[20px] w-[120px]" onChange={() => MW.missing('RGB palette')} />
        <span class={`${FIELD} w-[28px] text-center`}>0</span>
        <B act="ptkey" on={!!app.ptkey} cls="w-[46px]">PTKEY</B>
        <B act="missing" name="Workbench open" cls="w-[44px]">WB OPEN</B>
        <B act="missing" name="Workbench close" cls="w-[44px]">CLOSE</B>
      </R>
      <R>
        <L cls="w-[16px]">B</L>
        <input type="range" min="0" max="64" value="0" class="h-[20px] w-[120px]" onChange={() => MW.missing('RGB palette')} />
        <span class={`${FIELD} w-[28px] text-center`}>0</span>
        <B act="name-flat" on={!!app.hb} cls="w-[44px]">H↔B</B>
        <B act="missing" name="Load graphics" cls="w-[58px]">LOADGFX</B>
        <B act="missing" name="Mouse pointer" cls="w-[50px]">MOUSE2</B>
      </R>
      <R>
        <B act="missing" name="Paths" cls="w-[52px]">PATHS</B>
        <B act="missing" name="Paths add" cls="w-[34px]">ADD</B>
        <B act="missing" name="Paths remove" cls="w-[34px]">REM</B>
        <B act="misc-clear-all" cls="w-[70px]">CLEAR ALL</B>
        <B act="misc-clear" cls="w-[106px]">CLEAR SONG ONLY</B>
        <B act="missing" name="Quit" cls="w-[38px]">QUIT</B>
        <B act="missing" name="Confirm" cls="w-[54px]">CONFIRM</B>
      </R>
      <R>
        <B act="no16" on={!!app.no16} cls="w-[42px]">NO16</B>
        <B act="dep2" on={!!app.dep2} cls="w-[42px]">DEP2</B>
        <B act="prefs-save" cls="w-[72px]">SAVE PREFS</B>
        <B act="prefs-reset" cls="w-[72px]">FORGET</B>
        <B act="pal-cycle" cls="w-[46px]">COLOUR</B>
      </R>
    </div>
  );
}

/* ---------------------------------------------------------------- Vol */

function VolPanel() {
  useKeys(['song']);
  const app = MW.app;
  const song = app.song;
  const trk = app.volTrack || 0;
  const setTrack = (t: number) => { app.volTrack = t; MW.panels.refresh(); };
  const setVol = (t: number, v: number) => { song.trkvol[t] = MW.clamp(v, 0, 64); MW.panels.refresh(); };
  const setMaster = (v: number) => { song.mastervol = MW.clamp(v, 0, 64); MW.panels.refresh(); };
  const cells: any[] = [];
  for (let t = 0; t < 16; t++) {
    cells.push(
      <B key={t} onClick={() => setTrack(t)} on={trk === t} cls="flex-1 px-0">
        {t.toString(16).toUpperCase()}:{String(song.trkvol[t] || 64).padStart(2, '0')}
      </B>
    );
  }
  return (
    <div class="flex h-full flex-col gap-px">
      <div class="flex items-start gap-2">
        <div class="flex flex-1 flex-col gap-px">
          <L>THE RELATIVE VOLUMES OF TRACKS 0–15:</L>
          <R>{cells.slice(0, 8)}</R>
          <R>{cells.slice(8)}</R>
          <R>
            <L cls="w-[36px]">{trk.toString(16).toUpperCase()}:</L>
            <span class="flex h-[20px] w-[34px] items-center justify-center border border-ink bg-paper text-[11px]">{song.trkvol[trk] || 64}</span>
            <B onClick={() => setVol(trk, (song.trkvol[trk] || 64) - 10)} cls="w-[24px]">«</B>
            <B onClick={() => setVol(trk, (song.trkvol[trk] || 64) - 1)} cls="w-[22px]">‹</B>
            <B onClick={() => setVol(trk, (song.trkvol[trk] || 64) + 1)} cls="w-[22px]">›</B>
            <B onClick={() => setVol(trk, (song.trkvol[trk] || 64) + 10)} cls="w-[24px]">»</B>
            <L cls="w-[44px]">MASTER</L>
            <span class="flex h-[20px] w-[34px] items-center justify-center border border-ink bg-paper text-[11px]">{song.mastervol}</span>
            <B onClick={() => setMaster(song.mastervol - 10)} cls="w-[24px]">«</B>
            <B onClick={() => setMaster(song.mastervol - 1)} cls="w-[22px]">‹</B>
            <B onClick={() => setMaster(song.mastervol + 1)} cls="w-[22px]">›</B>
            <B onClick={() => setMaster(song.mastervol + 10)} cls="w-[24px]">»</B>
          </R>
        </div>
        <div class="w-[210px] shrink-0 border border-ink p-2 text-center text-[10px] leading-tight">
          <div>OCTANAUT</div>
          <div>BROWSER TRACKER</div>
          <div class="my-1">—</div>
          <div>EIGHT CHANNELS</div>
          <div>MED MODULES</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Range */

function RangePanel() {
  useKeys(['selection', 'selectedTracks']);
  const app = MW.app;
  const b = app.song.blocks[app.cursor.block];
  const sel = app.selection;
  const rangeText = sel
    ? `${Math.min(sel.t0, sel.t1)}–${Math.max(sel.t0, sel.t1)} / ${Math.min(sel.l0, sel.l1)}–${Math.max(sel.l0, sel.l1)}`
    : '---';
  const selectTrack = () => {
    app.selection = { l0: 0, l1: b.lines - 1, t0: app.cursor.track, t1: app.cursor.track };
    MW.grid.render();
    MW.touchStatus('selection', ['selection']);
  };
  return (
    <div class="flex h-full flex-col gap-px">
      <R>
        <L cls="w-[48px]">SELECT:</L>
        {Array.from({ length: 16 }, (_, t) => (
          <B key={t} onClick={() => { app.selectedTracks[t] = !app.selectedTracks[t]; MW.touchStatus('selection', ['selectedTracks']); }}
            on={!!app.selectedTracks[t]} cls="flex-1 px-0">{t.toString(16).toUpperCase()}</B>
        ))}
        <B onClick={() => { for (let t = 0; t < 16; t++) app.selectedTracks[t] = true; MW.touchStatus('selection', ['selectedTracks']); }} cls="w-[30px]">SET</B>
        <B onClick={() => { for (let t = 0; t < 16; t++) app.selectedTracks[t] = false; MW.touchStatus('selection', ['selectedTracks']); }} cls="w-[30px]">CLR</B>
      </R>
      <R>
        <B onClick={selectTrack} cls="w-[82px]">SELECT TRACK</B>
        <B act="rng-cut" cls="w-[42px]">CUT</B>
        <B act="rng-copy" cls="w-[46px]">COPY</B>
        <B act="rng-paste" cls="w-[46px]">PASTE</B>
        <B act="rng-paste" cls="w-[78px]">PASTE SELECT</B>
        <B act="chord-toggle" on={!!app.chordMode} cls="w-[48px]">CHORD</B>
        <B act="missing" name="Chord reset" cls="w-[32px]">RST</B>
      </R>
      <R>
        <B act="sel-all" cls="w-[82px]">SELECT BLOCK</B>
        <B act="rng-clear" cls="w-[46px]">CLEAR</B>
        <B act="sel-cancel" cls="w-[52px]">CANCEL</B>
        <L cls="w-[54px]">SPREAD:</L>
        <B act="spread-2" cls="w-[20px]">2</B>
        <B act="spread-3" cls="w-[20px]">3</B>
        <B act="spread-4" cls="w-[20px]">4</B>
        <L cls="w-[44px]">SLIDE:</L>
        <B act="mk-slide1" cls="w-[20px]">1</B>
        <B act="mk-slide2" cls="w-[20px]">2</B>
        <B act="mk-volslide" cls="w-[34px]">VOL</B>
      </R>
      <R>
        <B act="missing" name="Note echo" cls="w-[64px]">NOTE ECHO</B>
        <L cls="w-[34px]">DIST</L>
        <N value={1} min={1} max={16} onChange={() => MW.missing('Note echo')} cls="w-[30px]" />
        <L cls="w-[30px]">MIN</L>
        <N value={1} min={1} max={64} onChange={() => MW.missing('Note echo')} cls="w-[30px]" />
        <L cls="w-[44px]">RANGE:</L>
        <span class="flex h-[20px] flex-1 items-center border border-ink bg-paper px-1 text-[10px]">{rangeText}</span>
      </R>
    </div>
  );
}

/* ---------------------------------------------------------------- Trans */

function TransPanel() {
  useKeys(['cursor', 'currentIns']);
  const app = MW.app;
  const scope = app.transposeScope || 'block';
  const instScope = app.transposeInstrScope || 'all';
  const setPlay = (v: number) => { app.song.playtransp = MW.clamp(v, -24, 24); MW.panels.refresh(); };
  return (
    <div class="flex h-full flex-col gap-px">
      <R>
        <L cls="w-[48px]">AFFECT:</L>
        {[['song', 'SONG'], ['block', 'BLOCK'], ['track', 'TRACK'], ['sel', 'SEL.TRKS'], ['range', 'RANGE']].map(([k, l]) => (
          <B key={k} act={`scope-${k}`} on={scope === k} cls="flex-1">{l}</B>
        ))}
        <L cls="w-[42px]">INSTR:</L>
        <B act="instscope-all" on={instScope === 'all'} cls="w-[40px]">ALL</B>
        <B act="instscope-curr" on={instScope === 'curr'} cls="w-[46px]">CURR</B>
      </R>
      <R>
        <L cls="w-[40px]">INSTR:</L>
        <L cls="w-[40px]">NOTE:</L>
        <input id="tr-from" type="number" min="1" max="120" value="1" class={`${FIELD} w-[40px]`} />
        <B act="note-change" cls="w-[26px]">→</B>
        <input id="tr-to" type="number" min="1" max="120" value="1" class={`${FIELD} w-[40px]`} />
        <B act="note-exchange" cls="w-[26px]">⇄</B>
        <B act="tr-up" cls="w-[38px]">1/2↑</B>
        <B act="tr-down" cls="w-[38px]">1/2↓</B>
        <B act="tr-up12" cls="w-[38px]">OCT↑</B>
        <B act="tr-down12" cls="w-[38px]">OCT↓</B>
      </R>
      <R>
        <B act="ins-delete" cls="w-[34px]">DEL</B>
        <input id="tr-ins-from" type="number" min="1" max="63" value={app.currentIns} class={`${FIELD} w-[36px]`} />
        <B act="ins-change" cls="w-[26px]">→</B>
        <input id="tr-ins-to" type="number" min="1" max="63" value="1" class={`${FIELD} w-[36px]`} />
        <B act="ins-exchange" cls="w-[26px]">⇄</B>
        <L cls="w-[100px]">PLAY TRANSPOSE:</L>
        <input type="range" min="-24" max="24" value={app.song.playtransp || 0} class="h-[20px] min-w-0 flex-1"
          onChange={(e: any) => setPlay(+e.currentTarget.value)} />
        <span class="flex h-[20px] w-[30px] items-center justify-center border border-ink bg-paper text-[11px]">{app.song.playtransp || 0}</span>
      </R>
      <R>
        <L cls="w-[34px]">TEXT:</L>
        <T value={app.song.annotation || ''} onInput={(v: string) => { app.song.annotation = v; }} cls="flex-1" />
      </R>
    </div>
  );
}

/* ---------------------------------------------------------------- MIDI */

function MidiPanel() {
  useKeys(['currentIns']);
  const app = MW.app;
  const inst = app.song.instruments[app.currentIns - 1];
  const midi = MW.midi || { supported: false, enabled: false, outputs: [], inputs: [] };
  const ch = inst ? inst.midiChannel || 0 : 0;
  const setCh = (n: number) => {
    const i = app.song.instruments[app.currentIns - 1];
    if (i) { i.midiChannel = n; MW.panels.refresh(); }
  };
  return (
    <div class="flex h-full flex-col gap-px">
      <R>
        <L cls="w-[52px]">MIDI CH:</L>
        <B onClick={() => setCh(0)} on={ch === 0} cls="w-[54px]">NO MIDI</B>
        {Array.from({ length: 16 }, (_, i) => (
          <B key={i} onClick={() => setCh(i + 1)} on={ch === i + 1} cls="flex-1 px-0">{i + 1}</B>
        ))}
      </R>
      <R>
        <L cls="w-[82px]">MIDI PRESET #:</L>
        <N value={inst ? inst.midiPreset || 0 : 0} min={0} max={128}
          onChange={(v: number) => { const i = app.song.instruments[app.currentIns - 1]; if (i) i.midiPreset = v; }} cls="w-[40px]" />
        <select class="h-[20px] min-w-0 flex-1 border border-ink bg-paper px-1 text-[10px]"
          onChange={(e: any) => { if (midi.outputs[e.currentTarget.value]) midi.port = midi.outputs[e.currentTarget.value]; }}>
          {midi.outputs.map((o: any, i: number) => <option value={i}>{o.name}</option>)}
          {!midi.outputs.length && <option>no outputs</option>}
        </select>
      </R>
      <R>
        <B act="midi-enable" on={!!midi.enabled} cls="w-[72px]">MIDI ACTIVE</B>
        <B act="midi-input" on={!!app.midiInput} cls="w-[44px]">INPUT</B>
        <L cls="w-[52px]">CHANNEL</L>
        <N value={app.midiInChannel || 0} min={0} max={16} onChange={(v: number) => { app.midiInChannel = v; }} cls="w-[32px]" />
        <B act="midi-sendout" on={!!app.midiSendOut} cls="w-[54px]">SEND OUT</B>
        <B act="midi-suppress" on={!!(inst && inst.suppressOff)} cls="w-[70px]">SUPPR.N.OFF</B>
        <B act="missing" name="All off mode" cls="w-[30px]">OFF</B>
      </R>
      <R>
        <B act="midi-sync" on={!!MW.player.sync} cls="w-[62px]">SEND SYNC</B>
        <B act="missing" name="External sync" cls="w-[58px]">EXT SYNC</B>
        <B act="missing" name="Active sensing" on={true} cls="w-[70px]">ACT.SENSING</B>
        <L cls="w-[48px]">ALL OFF:</L>
        <B act="midi-panic" cls="w-[58px]">$Bx7B00</B>
        <B act="midi-panic" cls="w-[58px]">N.OFF:S</B>
      </R>
      <R>
        <L cls="w-[40px]">READ:</L>
        <B act="missing" name="MIDI key-up" cls="w-[48px]">KEY-UP</B>
        <B act="midi-vel" on={!!app.readVelocity} cls="w-[48px]">VOLUME</B>
        <L cls="w-[44px]">RESET:</L>
        <B act="midi-reset-pb" cls="w-[54px]">PB+PRES</B>
        <B act="midi-reset-ff" cls="w-[34px]">$FF</B>
        <B act="midi-lc-on" cls="w-[54px]">LOC.CTRL</B>
        <B act="midi-lc-off" cls="w-[34px]">OFF</B>
      </R>
      <R>
        <L cls="w-[42px]">MSG #:</L>
        <span class="flex h-[20px] w-[32px] items-center justify-center border border-ink bg-paper text-[11px]">0</span>
        <B act="missing" name="MIDI message editor" cls="w-[34px]">NEW</B>
        <B act="missing" name="MIDI message editor" cls="w-[52px]">N.HERE</B>
        <B act="missing" name="MIDI message editor" cls="w-[34px]">DEL</B>
        <B act="missing" name="MIDI message editor" cls="w-[44px]">CLEAR</B>
        <L cls="w-[54px]">MSG SIZE:</L>
        <span class="flex h-[20px] w-[34px] items-center justify-center border border-ink bg-paper text-[11px]">0</span>
        <B act="missing" name="MIDI message editor" cls="w-[40px]">CAPT.</B>
        <B act="missing" name="MIDI message editor" cls="w-[42px]">SEND</B>
      </R>
      <R>
        <B act="missing" name="MIDI message editor" cls="w-[92px]">AUTO-TERMINATE</B>
        <L cls="w-[38px]">NAME:</L>
        <span class="flex h-[20px] flex-1 items-center border border-ink bg-paper px-1 text-[10px] opacity-60"> </span>
      </R>
      <R>
        <L cls="w-[30px]">MAP:</L>
        <B act="missing" name="MIDI input map" cls="w-[44px]">ACTIVE</B>
        <B act="missing" name="MIDI input map" cls="w-[42px]">RESET</B>
        <L cls="w-[40px]">FUNCT:</L>
        <B act="missing" name="MIDI input map" cls="w-[24px]">N</B>
        <B act="missing" name="MIDI input map" cls="w-[32px]">NEW</B>
        <B act="missing" name="MIDI input map" cls="w-[32px]">DEL</B>
      </R>
    </div>
  );
}

/* ---------------------------------------------------------------- host */

const PANELS: Record<string, () => any> = {
  play: PlayPanel,
  files: FilesPanel,
  instr: InstrPanel,
  block: BlockPanel,
  edit: EditPanel,
  misc: MiscPanel,
  vol: VolPanel,
  range: RangePanel,
  transp: TransPanel,
  midi: MidiPanel
};

let active = 'play';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());

function Host() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const bump = () => force(0);
    listeners.add(bump);
    return () => { listeners.delete(bump); };
  }, []);
  const Panel = PANELS[active] || PlayPanel;
  return <Panel />;
}

MW.panels = {
  get current() { return active; },
  mount(host: HTMLElement) {
    render(<Host />, host);
    const left = document.querySelector('.deck-left') as HTMLElement | null;
    if (left) left.style.display = 'block';
  },
  show(name: string) {
    active = name;
    document.querySelectorAll('#rail button').forEach((b: any) => {
      b.classList.toggle('active', b.dataset.panel === name);
    });
    const left = document.querySelector('.deck-left') as HTMLElement | null;
    if (left) left.style.display = name === 'play' ? 'block' : 'none';
    emit();
  },
  refresh() {
    emit();
  }
};
