import { useState } from 'preact/hooks';
import { B, L, N, R, T, FIELD, MW } from '../shared';

/* ---------------------------------------------------------------- Block */

export function BlockPanel() {
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
