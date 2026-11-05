import { B, L, N, R, T, useKeys, MW } from '../shared';

/* ---------------------------------------------------------------- Instr */

export function InstrPanel() {
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
    if ((type === 'synth' || type === 'hybrid') && !i.synth) {
      i.synth = MW.createSynth();
      const data = i.data || new Float32Array(0);
      const wave = new Float32Array(64);
      for (let k = 0; k < wave.length; k++) wave[k] = data[k] || 0;
      i.synth.waveforms = [wave];
      i.synth.voltbl = [0x40, 0xff];
      i.synth.wftbl = [0x00, 0xff];
    }
    if (type === 'sample' && i.synth) {
      const rendered = MW.renderSynth(i, 44100, 50, 2);
      if (rendered) {
        i.data = Float32Array.from(rendered);
        i.dataR = null;
        i.bits16 = false;
        i.stereo16 = false;
      }
    }
    i.type = type;
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
