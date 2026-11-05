import { useReducer, useRef } from 'preact/hooks';
import { MW, useKeys } from '../shared';

/* ---------------------------------------------------------------- Play */

function TempoSlider(props: any) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pct = MW.clamp((props.value - 1) / (props.max - 1), 0, 1) * 100;
  const setFrom = (e: any) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = MW.clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
    props.onChange(1 + f * (props.max - 1));
  };
  return (
    <div
      ref={ref}
      class={`relative h-full min-w-0 flex-1 border border-l-2 border-t-2 border-ink bg-paper [background-image:repeating-conic-gradient(rgba(0,0,0,0.35)_0_25%,transparent_0_50%)] [background-size:2px_2px] ${props.cls || ''}`}
      onPointerDown={(e: any) => {
        dragging.current = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        setFrom(e);
      }}
      onPointerMove={(e: any) => { if (dragging.current) setFrom(e); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
    >
      <div class="absolute top-1 bottom-1 w-[10px] border border-ink bg-paper shadow-[1px_1px_0_0_#000]" style={{ left: `calc(${pct.toFixed(2)}% - 5px)` }} />
    </div>
  );
}

function PB(props: any) {
  const cls = 'flex h-full items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper';
  return (
    <button
      type="button"
      data-act={props.act}
      data-name={props.name}
      class={`${cls} ${props.on ? 'on' : ''} ${props.cls || ''}`}
      title={props.title}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export function PlayPanel() {
  useKeys(['transport']);
  const app = MW.app;
  const song = app.song;
  const [, force] = useReducer((n: number) => n + 1, 0);
  const eq = app.eq || [true, true, true];
  const tempo = song.deftempo || 33;
  const tempo2 = song.tempo2 || 6;

  const setTempo = (kind: string, value: number) => {
    const max = kind === 'tempo' ? 240 : 32;
    const v = MW.clamp(Math.round(value), 1, max);
    if (kind === 'tempo') {
      song.deftempo = v;
      if (!MW.player.playing) MW.player.tempo = v;
    } else {
      song.tempo2 = v;
      if (!MW.player.playing) MW.player.tempo2 = v;
    }
    force(0);
  };
  const stepTempo = (kind: string, d: number) =>
    setTempo(kind, (kind === 'tempo' ? song.deftempo : song.tempo2) + d);

  return (
    <div class="flex h-full flex-col">
      <div class="flex h-[46px] shrink-0 items-stretch">
        <TempoSlider kind="tempo" value={tempo} max={240} cls="flex-[1.68]" onChange={(v: number) => setTempo('tempo', v)} />
        <PB cls="w-[24px] shrink-0 text-[16px]" onClick={() => stepTempo('tempo', -1)} title="Slower">‹</PB>
        <PB cls="w-[24px] shrink-0 text-[16px]" onClick={() => stepTempo('tempo', 1)} title="Faster">›</PB>
        <TempoSlider kind="tempo2" value={tempo2} max={32} cls="flex-1" onChange={(v: number) => setTempo('tempo2', v)} />
        <PB cls="w-[24px] shrink-0 text-[16px]" onClick={() => stepTempo('tempo2', -1)} title="Fewer pulses per line">‹</PB>
        <PB cls="w-[24px] shrink-0 text-[16px]" onClick={() => stepTempo('tempo2', 1)} title="More pulses per line">›</PB>
      </div>

      <div class="flex h-[33px] shrink-0 items-stretch">
        <span class="flex w-[45px] shrink-0 items-center pl-1 text-[16px] leading-none">VOL:</span>
        <PB act="vol-hex" on={!!song.flags.volhex} cls="w-[43px]">HEX</PB>
        <PB act="vol-dec" on={!song.flags.volhex} cls="w-[46px]">DEC</PB>
        <PB act="misc-filter" on={!!song.flags.filteron} cls="w-[78px]">FILTER</PB>
        <PB act="eq-1" on={!!eq[0]} cls="min-w-0 flex-1">E1</PB>
        <PB act="eq-2" on={!!eq[1]} cls="min-w-0 flex-1">E2</PB>
        <PB act="eq-3" on={!!eq[2]} cls="min-w-0 flex-1">E3</PB>
        <PB act="stslide" on={!!song.flags.stslide} cls="w-[55px]">STS</PB>
        <span class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink w-[58px]">SPD</span>
        <span class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink w-[100px]">
          <b id="spd-readout" class="font-normal tabular-nums">{String(tempo).padStart(3, '0')}/{String(tempo2).padStart(2, '0')}</b>
        </span>
      </div>

      <div class="grid h-[55px] shrink-0 grid-cols-[130px_72px_minmax(0,1fr)]">
        <div class="grid grid-rows-2">
          <div class="flex items-stretch">
            <span class="flex min-w-0 flex-1 items-center justify-end pr-2 text-[16px] leading-none">CH.MODE:</span>
            <PB act={app.depth === 'enhanced' ? 'depth-classic' : 'depth-enhanced'} on={app.depth === 'enhanced'} cls="w-[34px]" title="High quality output">HQ</PB>
          </div>
          <div class="flex items-stretch">
            {[4, 5, 6, 7, 8].map(n => (
              <PB key={n} act={`chmode-${n}`} on={song.channels === n} cls="min-w-0 flex-1">{n}</PB>
            ))}
          </div>
        </div>
        <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper border-l-0" id="btn-stop" title="Stop (Space)" onClick={() => MW.player.stop()}>STOP</button>
        <div class="grid grid-rows-2 border-l border-ink">
          <div class="flex items-stretch">
            <button class={`flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-[1.6] ${MW.player.playing ? 'playing' : ''}`} id="btn-play" title="Play song" onClick={() => MW.player.play(true)}>PLAY SONG</button>
            <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-1" id="btn-cont" title="Continue from here" onClick={() => MW.player.play(false)}>CONT. SONG</button>
          </div>
          <div class="flex items-stretch">
            <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-[1.6]" id="btn-play-block" title="Play the current block" onClick={() => MW.player.playBlock(app.cursor.block)}>PLAY BLOCK</button>
            <PB act="play-on-note" on={!!app.playOnNote} cls="w-[38px]" title="Play a note as you enter it">D</PB>
            <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-1" id="btn-cont-block" title="Continue the block from the cursor" onClick={() => MW.player.playBlock(app.cursor.block)}>CONT. BLOCK</button>
          </div>
        </div>
      </div>
    </div>
  );
}
