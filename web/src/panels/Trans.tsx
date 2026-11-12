import { B, L, R, T, FIELD, useKeys, MW } from '../shared';

/* ---------------------------------------------------------------- Trans */

export function TransPanel() {
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
        <input id="tr-from" type="text" maxLength={3} value={MW.noteName(0, app.hb)} class={`${FIELD} w-[44px] text-center`} aria-label="Note to change" />
        <B act="note-change" cls="w-[26px]">→</B>
        <input id="tr-to" type="text" maxLength={3} value={MW.noteName(0, app.hb)} class={`${FIELD} w-[44px] text-center`} aria-label="Replacement note" />
        <B act="note-exchange" cls="w-[26px]">⇄</B>
        <B act="tr-up" cls="w-[38px]">1/2↑</B>
        <B act="tr-down" cls="w-[38px]">1/2↓</B>
        <B act="tr-up12" cls="w-[38px]">OCT↑</B>
        <B act="tr-down12" cls="w-[38px]">OCT↓</B>
      </R>
      <R>
        <B act="ins-delete" cls="w-[34px]">DEL</B>
        <input id="tr-ins-from" type="text" maxLength={2} value={app.currentIns ? MW.insName(app.currentIns) : '00'} class={`${FIELD} w-[36px] text-center`} aria-label="Instrument to change" />
        <B act="ins-change" cls="w-[26px]">→</B>
        <input id="tr-ins-to" type="text" maxLength={2} value="00" class={`${FIELD} w-[36px] text-center`} aria-label="Replacement instrument" />
        <B act="ins-exchange" cls="w-[26px]">⇄</B>
        <L cls="w-[100px]">PLAY TRANSPOSE:</L>
        <B onClick={() => setPlay((app.song.playtransp || 0) - 1)} cls="w-[22px]">&lt;</B>
        <input type="range" min="-24" max="24" value={app.song.playtransp || 0} class="h-[20px] min-w-0 flex-1"
          onChange={(e: any) => setPlay(+e.currentTarget.value)} />
        <B onClick={() => setPlay((app.song.playtransp || 0) + 1)} cls="w-[22px]">&gt;</B>
        <span class="flex h-[20px] w-[30px] items-center justify-center border border-ink bg-paper text-[11px]">{String(app.song.playtransp || 0).padStart(2, '0')}</span>
      </R>
      <R>
        <L cls="w-[34px]">TEXT:</L>
        <T value={app.song.annotation || ''} onInput={(v: string) => { app.song.annotation = v; }} cls="flex-1" />
      </R>
    </div>
  );
}
