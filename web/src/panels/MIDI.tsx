import { useEffect, useReducer, useState } from 'preact/hooks';
import { B, L, N, R, T, useKeys, MW } from '../shared';

export function MidiPanel() {
  useKeys(['currentIns']);
  const app = MW.app;
  const inst = app.song.instruments[app.currentIns - 1];
  const msg = app.midiMessages[app.midiMsgIndex] || { name: '', data: [] };
  const hexData = (msg.data || []).map((b: number) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  const midi = MW.midi || { supported: false, enabled: false, outputs: [], inputs: [] };
  const ch = inst ? inst.midiChannel || 0 : 0;
  const mapEntry = app.midiMap && app.midiMap[app.midiMapIndex];
  const mapName = mapEntry && mapEntry.kind === 'fn' ? mapEntry.fn : 'note';
  const setCh = (n: number) => { if (inst) { inst.midiChannel = n; MW.panels.refresh(); } };
  const [draft, setDraft] = useState(hexData);
  const [, redrawMessage] = useReducer((n: number, _action: number) => n + 1, 0);
  useEffect(() => { setDraft(hexData); }, [app.midiMsgIndex, msg]);
  const finishHex = () => {
    const bytes = MW.parseMidiHex(draft);
    if (bytes === null) {
      MW.toast('Enter complete hexadecimal bytes separated by spaces', true);
      setDraft((msg.data || []).map((b: number) => b.toString(16).toUpperCase().padStart(2, '0')).join(' '));
      return;
    }
    msg.data = bytes;
    setDraft(bytes.map((b: number) => b.toString(16).toUpperCase().padStart(2, '0')).join(' '));
    redrawMessage(0);
  };
  return (
    <div class="midi-panel">
      <div class="midi-upper">
        <div class="midi-settings">
          <R><L>MIDI CH:</L><B onClick={() => setCh(0)} on={ch === 0}>NO MIDI</B>
            {Array.from({ length: 16 }, (_, i) => <B key={i} onClick={() => setCh(i + 1)} on={ch === i + 1} cls="px-0">{i + 1}</B>)}
          </R>
          <R><L>MIDI PRESET #:</L><N value={inst ? inst.midiPreset || 0 : 0} min={0} max={128} onChange={(v: number) => { if (inst) inst.midiPreset = v; }} cls="w-[48px]" />
            <select aria-label="MIDI output" class="h-[24px] min-w-0 flex-1 border border-ink bg-paper px-1 text-[10px]" onChange={(e: any) => { if (midi.outputs[e.currentTarget.value]) midi.port = midi.outputs[e.currentTarget.value]; }}>
              {midi.outputs.map((o: any, i: number) => <option value={i}>{o.name}</option>)}{!midi.outputs.length && <option>no outputs</option>}
            </select>
          </R>
          <R><B act="midi-enable" on={!!midi.enabled}>MIDI ACTIVE</B><B act="midi-input" on={!!app.midiInput}>INPUT</B><L>CHANNEL</L>
            <N value={app.midiInChannel || 0} min={0} max={16} onChange={(v: number) => { app.midiInChannel = v; }} cls="w-[38px]" />
            <B act="midi-sendout" on={!!app.midiSendOut}>SEND OUT</B><B act="midi-suppress" on={!!(inst && inst.suppressOff)}>SUPPR.N.OFF</B>
          </R>
          <R><B act="midi-sync" on={!!MW.player.sync}>SEND SYNC</B><B act="midi-extsync" on={!!app.extSync}>EXT SYNC</B><B act="midi-sensing" on={midi.sensingOn !== false}>ACT.SENSING</B>
            <L>ALL OFF:</L><B act="midi-alloff-cc" on={app.midiAllOff !== 'note'}>$Bx7B00</B><B act="midi-alloff-note" on={app.midiAllOff === 'note'}>N.OFF:S</B>
          </R>
          <R><L>READ:</L><B act="midi-keyup" on={!!app.midiKeyUp}>KEY-UP</B><B act="midi-vel" on={!!app.readVelocity}>VOLUME</B><L>RESET:</L><B act="midi-reset-pb">PB+PRES</B><B act="midi-reset-ff">$FF</B></R>
        </div>
        <div class="midi-map-area">
          <div class="midi-local"><L>LOC. CTRL</L><B act="midi-lc-on">ON</B><B act="midi-lc-off">OFF</B></div>
          <div class="midi-map-list" aria-label="MIDI input map">
            {Array.from({ length: 128 }, (_, i) => {
              const entry = app.midiMap && app.midiMap[i];
              const label = entry && entry.kind === 'fn' ? entry.fn : 'note';
              return <button key={i} type="button" class={`midi-map-item ${i === app.midiMapIndex ? 'on' : ''}`} onClick={() => { app.midiMapIndex = i; MW.panels.refresh(); }}><span>{String(i).padStart(3, '0')}</span><span>{i < 24 ? '---' : MW.noteName(i - 23, app.hb)}</span><span>{label}</span></button>;
            })}
          </div>
          <div class="midi-map-actions"><B act="midi-map-active" on={!!app.midiMapActive}>ACTIVE</B><B act="midi-map-reset">RESET</B><L>FUNCT:</L><span class="midi-map-current">{mapName}</span><R><B act="midi-map-prev">&lt;</B><B act="midi-map-next">&gt;</B></R><R><B act="midi-map-new">NEW</B><B act="midi-map-del">DEL</B></R></div>
        </div>
      </div>
      <div class="midi-lower">
        <textarea aria-label="MIDI message bytes" class="midi-message-data" value={draft} placeholder="F0 ... F7" spellcheck={false} onInput={(e: any) => setDraft(e.currentTarget.value)} onBlur={finishHex} />
        <div class="midi-message-actions">
          <R><L>MSG #:</L><span class="midi-message-value">{(app.midiMsgIndex || 0) + 1}/{app.midiMessages.length}</span><B act="midi-msg-prev">&lt;</B><B act="midi-msg-next">&gt;</B></R>
          <R><B act="midi-msg-new">NEW</B><B act="midi-msg-insert">N.HERE</B><B act="midi-msg-del">DEL</B><B act="midi-msg-clear">CLEAR</B></R>
          <R><L>MSG SIZE:</L><span class="midi-message-value">{msg.data.length}</span><B act="midi-msg-dec">&lt;</B><B act="midi-msg-inc">&gt;</B></R>
          <R><B act="midi-msg-capture" on={!!app.midiCapture}>CAPT.</B><B act="midi-msg-send">SEND</B><B act="midi-msg-auto" on={app.midiMsgAuto !== false}>AUTO-TERMINATE</B></R>
          <R><L>NAME:</L><T value={msg.name || ''} maxlength={40} onInput={(v: string) => { msg.name = v; }} cls="flex-1" /></R>
          <R><B act="midi-dump-save">SAVE DUMP</B><B act="midi-dump-load">LOAD DUMP</B></R>
        </div>
      </div>
    </div>
  );
}
