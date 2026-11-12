import { B, L, R, useKeys, MW } from '../shared';

/* ---------------------------------------------------------------- Vol */

export function VolPanel() {
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
        {t.toString(16).toUpperCase()}:{String(song.trkvol[t] ?? 64).padStart(2, '0')}
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
            <span class="flex h-[20px] w-[34px] items-center justify-center border border-ink bg-paper text-[11px]">{song.trkvol[trk] ?? 64}</span>
            <B onClick={() => setVol(trk, (song.trkvol[trk] ?? 64) - 10)} cls="w-[24px]">«</B>
            <B onClick={() => setVol(trk, (song.trkvol[trk] ?? 64) - 1)} cls="w-[22px]">‹</B>
            <B onClick={() => setVol(trk, (song.trkvol[trk] ?? 64) + 1)} cls="w-[22px]">›</B>
            <B onClick={() => setVol(trk, (song.trkvol[trk] ?? 64) + 10)} cls="w-[24px]">»</B>
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
