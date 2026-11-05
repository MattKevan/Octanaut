import { B, L, N, R, T, useKeys, MW } from '../shared';

/* ---------------------------------------------------------------- MIDI */

export function MidiPanel() {
  useKeys(['currentIns']);
  const app = MW.app;
  const inst = app.song.instruments[app.currentIns - 1];
  const msg = app.midiMessages && app.midiMessages[app.midiMsgIndex] ? app.midiMessages[app.midiMsgIndex] : { name: '', data: [] };
  const hexData = (msg.data || []).map((b: number) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  const setHex = (v: string) => {
    const bytes = (v.match(/[0-9a-fA-F]{2}/g) || []).map((x: string) => parseInt(x, 16) & 0xff);
    msg.data = bytes;
    MW.panels.refresh();
  };
  const midi = MW.midi || { supported: false, enabled: false, outputs: [], inputs: [] };
  const ch = inst ? inst.midiChannel || 0 : 0;
  const mapEntry = app.midiMap && app.midiMap[app.midiMapIndex];
  const mapName = mapEntry && mapEntry.kind === 'fn' ? mapEntry.fn : 'note';
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
        <B act="midi-alloff-cc" on={MW.app.midiAllOff !== 'note'} cls="w-[30px]">OFF</B>
      </R>
      <R>
        <B act="midi-sync" on={!!MW.player.sync} cls="w-[62px]">SEND SYNC</B>
        <B act="midi-extsync" on={!!app.extSync} cls="w-[58px]">EXT SYNC</B>
        <B act="midi-sensing" on={MW.midi.sensingOn !== false} cls="w-[70px]">ACT.SENSING</B>
        <L cls="w-[48px]">ALL OFF:</L>
        <B act="midi-alloff-cc" on={MW.app.midiAllOff !== 'note'} cls="w-[58px]">$Bx7B00</B>
        <B act="midi-alloff-note" on={MW.app.midiAllOff === 'note'} cls="w-[58px]">N.OFF:S</B>
      </R>
      <R>
        <L cls="w-[40px]">READ:</L>
        <B act="midi-keyup" on={!!app.midiKeyUp} cls="w-[48px]">KEY-UP</B>
        <B act="midi-vel" on={!!app.readVelocity} cls="w-[48px]">VOLUME</B>
        <L cls="w-[44px]">RESET:</L>
        <B act="midi-reset-pb" cls="w-[54px]">PB+PRES</B>
        <B act="midi-reset-ff" cls="w-[34px]">$FF</B>
        <B act="midi-lc-on" cls="w-[54px]">LOC.CTRL</B>
        <B act="midi-lc-off" cls="w-[34px]">OFF</B>
      </R>
      <R>
        <L cls="w-[42px]">MSG #:</L>
        <B act="midi-msg-prev" cls="w-[20px]">&lt;</B>
        <span class="flex h-[20px] w-[32px] items-center justify-center border border-ink bg-paper text-[11px]">{(app.midiMsgIndex || 0) + 1}/{app.midiMessages.length}</span>
        <B act="midi-msg-next" cls="w-[20px]">&gt;</B>
        <B act="midi-msg-new" cls="w-[34px]">NEW</B>
        <B act="midi-msg-insert" cls="w-[52px]">N.HERE</B>
        <B act="midi-msg-del" cls="w-[34px]">DEL</B>
        <B act="midi-msg-clear" cls="w-[44px]">CLEAR</B>
        <L cls="w-[54px]">MSG SIZE:</L>
        <B act="midi-msg-dec" cls="w-[20px]">&lt;</B>
        <span class="flex h-[20px] w-[30px] items-center justify-center border border-ink bg-paper text-[11px]">{msg.data.length}</span>
        <B act="midi-msg-inc" cls="w-[20px]">&gt;</B>
        <B act="midi-msg-capture" on={!!app.midiCapture} cls="w-[40px]">CAPT.</B>
        <B act="midi-msg-send" cls="w-[42px]">SEND</B>
      </R>
      <R>
        <B act="midi-msg-auto" on={app.midiMsgAuto !== false} cls="w-[92px]">AUTO-TERMINATE</B>
        <L cls="w-[38px]">NAME:</L>
        <T value={msg.name || ''} maxlength={40} onInput={(v: string) => { msg.name = v; }} cls="flex-1" />
      </R>
      <R>
        <L cls="w-[36px]">DATA:</L>
        <T value={hexData} onInput={setHex} cls="flex-1" placeholder="F0 ... F7" />
      </R>
      <R>
        <L cls="w-[30px]">MAP:</L>
        <B act="midi-map-active" on={!!app.midiMapActive} cls="w-[44px]">ACTIVE</B>
        <B act="midi-map-reset" cls="w-[42px]">RESET</B>
        <L cls="w-[40px]">FUNCT:</L>
        <B act="midi-map-prev" cls="w-[20px]">&lt;</B>
        <span class="flex h-[20px] w-[72px] items-center justify-center border border-ink bg-paper text-[10px]">{mapName}</span>
        <B act="midi-map-next" cls="w-[20px]">&gt;</B>
        <B act="midi-map-new" cls="w-[32px]">NEW</B>
        <B act="midi-map-del" cls="w-[32px]">DEL</B>
        <B act="midi-dump-save" cls="w-[52px]">SAVE DUMP</B>
        <B act="midi-dump-load" cls="w-[52px]">LOAD DUMP</B>
        <L cls="w-[26px]">KEY</L>
        <N value={app.midiMapIndex} min={0} max={127} onChange={(v: number) => { app.midiMapIndex = v; MW.panels.refresh(); }} cls="w-[38px]" />
      </R>
      <div class="max-h-[84px] overflow-auto border border-ink bg-paper">
        {Array.from({ length: 128 }, (_, i) => {
          const entry = app.midiMap && app.midiMap[i];
          const label = entry && entry.kind === 'fn' ? entry.fn : 'note';
          return (
            <button key={i} type="button"
              class={`flex w-full items-center gap-2 px-1 text-left text-[10px] leading-[14px] ${i === app.midiMapIndex ? 'bg-ink text-paper' : ''}`}
              onClick={() => { app.midiMapIndex = i; MW.panels.refresh(); }}>
              <span class="w-[26px] text-right">{i}</span>
              <span class="w-[34px]">{MW.noteName(i - 23, app.hb)}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
