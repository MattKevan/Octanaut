import { B, L, N, R, useKeys, MW } from '../shared';

/* ---------------------------------------------------------------- Edit */

/* The key editor shows one of twelve definitions: the ten Shift keys or
   the Left/Right Alt templates. C/L/R pick the group, < > pick the key. */

export function EditPanel() {
  useKeys(['editMode', 'spaceAsDel', 'chordMode', 'octave', 'advance']);
  const app = MW.app;
  const mode = app.progAlt === 'L' || app.progAlt === 'R' ? app.progAlt : 'C';
  const def = mode === 'L' ? app.altL : mode === 'R' ? app.altR : app.prog[app.progTarget];
  const alt = mode !== 'C';
  const noteTxt = alt || def.note == null ? 'xxx' : MW.noteName(def.note, app.hb);
  const insTxt = def.ins == null ? 'xx' : (def.ins ? MW.insName(def.ins) : '00');
  const cmdTxt = def.cmd == null ? 'xx' : MW.hex(def.cmd);
  const datTxt = def.dat == null ? 'xx' : MW.hex(def.dat);
  const target = app.progAlt === 'L' ? 'L.Alt' : app.progAlt === 'R' ? 'R.Alt' : 'Shift-' + app.progTarget;

  const liveDef = () => {
    const a = MW.app;
    if (a.progAlt === 'L') return a.altL;
    if (a.progAlt === 'R') return a.altR;
    return a.prog[a.progTarget];
  };
  const writeDef = (next: any) => {
    const a = MW.app;
    if (a.progAlt === 'L') a.altL = next;
    else if (a.progAlt === 'R') a.altR = next;
    else a.prog[a.progTarget] = next;
    MW.panels.refresh();
  };
  const setField = (field: string, raw: string) => {
    const value = String(raw || '').trim().toLowerCase();
    const next = { ...liveDef() };
    /* a field edit replaces a range definition with a single cell */
    delete next.cells;
    if (!value || /^x+$/.test(value)) next[field] = null;
    else if (field === 'note') next.note = MW.noteIndex(value.toUpperCase()) || 0;
    else if (field === 'ins') next.ins = parseInt(value, 32) || 0;
    else next[field] = parseInt(value, 16) || 0;
    writeDef(next);
  };
  const select = (which: string) => { app.progAlt = which; MW.panels.refresh(); };
  const toggleTrack = (t: number) => {
    app.mutedTracks[t] = !app.mutedTracks[t];
    MW.player.channels[t].muted = app.mutedTracks[t];
    MW.grid.render();
    MW.panels.refresh();
  };
  const cell = (value: string, label: string, field: string, width: string, readOnly = false) => (
    <input value={value} readonly={readOnly} maxLength={field === 'note' ? 3 : 2}
      aria-label={label} title={label + ': type x for a wildcard'}
      class={`template-cell ${width} text-center`}
      onFocus={(e: any) => e.currentTarget.select()}
      onKeyDown={(e: any) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        setField(field, 'xx');
      }}
      onInput={(e: any) => { if (!readOnly) setField(field, e.currentTarget.value); }} />
  );
  return (
    <div class="flex h-full flex-col gap-px">
      <R>
        <L cls="w-[54px]">TRK ON:</L>
        {Array.from({ length: 16 }, (_, t) => (
          <B key={t} onClick={() => toggleTrack(t)} on={!app.mutedTracks[t]} cls="flex-1 px-0">{t.toString(16).toUpperCase()}</B>
        ))}
        <B onClick={() => { for (let t = 0; t < 16; t++) { app.mutedTracks[t] = false; MW.player.channels[t].muted = false; } MW.grid.render(); MW.panels.refresh(); }} cls="w-[34px]">SET</B>
        <B onClick={() => { for (let t = 0; t < 16; t++) { app.mutedTracks[t] = true; MW.player.channels[t].muted = true; } MW.grid.render(); MW.panels.refresh(); }} cls="w-[34px]">CLR</B>
      </R>
      <div class="flex min-h-0 flex-1 items-stretch gap-[2px]">
        <div class="flex min-w-0 flex-1 flex-col gap-px">
          <R>
            <L cls="w-[48px]">KEYPAD:</L>
            <B onClick={() => { app.padMode = 'track'; MW.panels.refresh(); }} on={app.padMode === 'track'} cls="w-[74px]">TRK ON/OFF</B>
            <B onClick={() => { app.padMode = 'instr'; MW.panels.refresh(); }} on={app.padMode === 'instr'} cls="w-[70px]">SEL.INSTR</B>
            <B act="pad-map2" on={!!app.padMap2} cls="w-[42px]">MAP2</B>
          </R>
          <R>
            <L cls="w-[48px]">OCTAVE:</L>
            {Array.from({ length: 9 }, (_, i) => (
              <B key={i} act={`oct-${i}`} on={app.octave === i} cls="w-[26px]">{i + 1}</B>
            ))}
          </R>
          <R>
            <L cls="w-[34px]">ADV.</L>
            <B act="play-on-note" on={!!app.playOnNote} cls="w-[24px]" title="Hear notes while moving the cursor">♪</B>
            {[['up', '↑'], ['down', '↓'], ['nexttrk', '»'], ['prevtrk', '«'], ['right', '>'], ['left', '<']].map(([k, l]) => (
              <B key={k} act={`adv-${k}`} on={app.advance === k} cls="w-[24px]">{l}</B>
            ))}
          </R>
        </div>
        <div class="flex w-[22px] shrink-0 flex-col gap-px">
          <B onClick={() => select('C')} on={mode === 'C'} cls="h-[24px] grow-0! px-0" title="Edit the numbered key">C</B>
          <B onClick={() => select('L')} on={mode === 'L'} cls="h-[24px] grow-0! px-0" title="Edit the Left Alt key">L</B>
          <B onClick={() => select('R')} on={mode === 'R'} cls="h-[24px] grow-0! px-0" title="Edit the Right Alt key">R</B>
        </div>
        <div class="flex w-[300px] shrink-0 flex-col gap-px">
          <R>
            <span class="flex h-[24px] w-[20px] items-center justify-center border border-ink bg-paper text-[11px]">{app.progTarget}</span>
            <span class="flex h-[24px] w-[12px] items-center justify-center text-[10px]">=</span>
            <span class="flex h-[24px] min-w-0 flex-1 items-center border border-ink bg-paper px-1 text-[11px] leading-none" title={target}>
              {cell(noteTxt, 'Definition note', 'note', 'w-[30px]', alt)}
              {cell(insTxt, 'Definition instrument', 'ins', 'w-[24px]')}
              {cell(cmdTxt, 'Definition command', 'cmd', 'w-[22px]')}
              {cell(datTxt, 'Definition data', 'dat', 'w-[24px]')}
            </span>
            <B act="edit-space" on={!!app.spaceAsDel} cls="w-[72px]">SPACE=DEL</B>
          </R>
          <R>
            <B act="prog-prev" cls="w-[20px]" title="Previous key">&lt;</B>
            <B act="prog-next" cls="w-[20px]" title="Next key">&gt;</B>
            <B onClick={() => select('L')} on={mode === 'L'} cls="w-[44px]">L.ALT</B>
            <B onClick={() => select('R')} on={mode === 'R'} cls="w-[44px]">R.ALT</B>
            <B act="edit-toggle" on={!!app.editMode} cls="w-[58px]">EDIT ON</B>
          </R>
          <R>
            <L cls="w-[34px]">PICK:</L>
            <B act="pick-note" cls="w-[42px]">NOTE</B>
            <B act="pick-range" cls="w-[44px]">RANGE</B>
            <B act="pick-buffer" cls="w-[34px]">BUF</B>
            <L cls="w-[26px]">SPC</L>
            <N value={app.step} min={1} max={16} onChange={(v: number) => { app.step = v; }} cls="w-[34px]" />
          </R>
        </div>
      </div>
    </div>
  );
}
