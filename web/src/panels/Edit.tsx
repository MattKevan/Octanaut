import { B, L, N, R, FIELD, useKeys, MW } from '../shared';

/* ---------------------------------------------------------------- Edit */

export function EditPanel() {
  useKeys(['editMode', 'spaceAsDel', 'chordMode', 'octave', 'advance']);
  const app = MW.app;
  const def = app.prog && app.prog[app.progTarget];
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
        <B act="pad-map2" on={!!app.padMap2} cls="w-[42px]">MAP2</B>
        <B act="alt-clear" cls="w-[22px]">C</B>
        <B act="alt-pick-l" cls="w-[22px]">L</B>
        <B act="alt-pick-r" cls="w-[22px]">R</B>
        <B act="prog-prev" cls="w-[16px]">&lt;</B>
        <span class="flex h-[20px] w-[20px] items-center justify-center border border-ink bg-paper text-[11px]">{app.progTarget}</span>
        <B act="prog-next" cls="w-[16px]">&gt;</B>
        <span class="flex h-[20px] w-[12px] items-center justify-center text-[10px]">=</span>
        <input value={MW.noteName(def ? def.note || 0 : 0, app.hb)} class={`${FIELD} w-[36px] text-center`}
          onInput={(e: any) => { if (!def) return; def.note = MW.noteIndex(e.currentTarget.value); }} />
        <input value={MW.insName(def ? def.ins || 0 : 0)} class={`${FIELD} w-[30px] text-center`}
          onInput={(e: any) => { if (!def) return; def.ins = parseInt(e.currentTarget.value, 32) || 0; }} />
        <input value={(def ? def.cmd || 0 : 0).toString(16).toUpperCase().padStart(2, '0')} class={`${FIELD} w-[28px] text-center`}
          onInput={(e: any) => { if (!def) return; def.cmd = parseInt(e.currentTarget.value, 16) || 0; }} />
        <input value={(def ? def.dat || 0 : 0).toString(16).toUpperCase().padStart(2, '0')} class={`${FIELD} w-[28px] text-center`}
          onInput={(e: any) => { if (!def) return; def.dat = parseInt(e.currentTarget.value, 16) || 0; }} />
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
