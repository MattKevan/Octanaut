import { useState } from 'preact/hooks';
import { B, L, N, R, useKeys, MW } from '../shared';

/* ---------------------------------------------------------------- Range */

export function RangePanel() {
  useKeys(['selection', 'selectedTracks']);
  const app = MW.app;
  const b = app.song.blocks[app.cursor.block];
  const sel = app.selection;
  const [echoDist, setEchoDist] = useState(2);
  const [echoMin, setEchoMin] = useState(1);
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
        <B act="chord-rst" cls="w-[32px]">RST</B>
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
        <B act="note-echo" cls="w-[64px]">NOTE ECHO</B>
        <L cls="w-[34px]">DIST</L>
        <N id="echo-dist" value={echoDist} min={1} max={16} onChange={setEchoDist} cls="w-[30px]" />
        <L cls="w-[30px]">MIN</L>
        <N id="echo-min" value={echoMin} min={1} max={64} onChange={setEchoMin} cls="w-[30px]" />
        <L cls="w-[44px]">RANGE:</L>
        <span class="flex h-[20px] flex-1 items-center border border-ink bg-paper px-1 text-[10px]">{rangeText}</span>
      </R>
    </div>
  );
}
