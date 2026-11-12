import { B, L, R, FIELD, useKeys, MW } from '../shared';

/* ---------------------------------------------------------------- Misc */

export function MiscPanel() {
  useKeys(['song']);
  const app = MW.app;
  const rgb = app.paletteRGB || { r: 136, g: 136, b: 136 };
  const setRGB = (key: string, value: number) => {
    app.paletteRGB[key] = value;
    MW.runAction('pal-set');
  };
  return (
    <div class="grid h-full grid-cols-[minmax(190px,2fr)_minmax(0,3fr)] gap-1">
      <div class="flex min-w-0 flex-col gap-px">
        {(['r', 'g', 'b'] as const).map(key => (
          <R key={key}>
            <L cls="w-[16px]">{key.toUpperCase()}</L>
            <input type="range" min="0" max="255" value={rgb[key]} class="h-[24px] min-w-0 flex-1" onChange={(e: any) => setRGB(key, +e.currentTarget.value)} />
            <span class={`${FIELD} w-[32px] text-center`}>{rgb[key]}</span>
          </R>
        ))}
        <R>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(n => (
            <B key={n} onClick={() => MW.missing('RGB palette')} cls={`w-[18px] ${n === 0 ? 'bg-ink' : ''}`}> </B>
          ))}
          <B act="pal-reset">RES</B><B act="pal-undo">UNDO</B>
        </R>
      </div>
      <div class="flex min-w-0 flex-col gap-px">
        <R><B act="ptkey" on={!!app.ptkey}>PTKEY</B><L>PATHS:</L><B act="paths-add">ADD</B><B act="paths-rem">REM</B><B act="misc-clear-all">CLEAR ALL</B></R>
        <R><B act="name-flat" on={!!app.hb}>H↔B</B><B act="missing" name="Workbench" disabled>WB OPEN</B><B act="missing" name="Workbench" disabled>CLOSE</B><B act="misc-clear">CLEAR SONG ONLY</B></R>
        <R><B act="missing" name="Load graphics" disabled>LOADGFX</B><B act="missing" name="Mouse pointer" disabled>MOUSE2</B><B act="quit-app">QUIT</B></R>
        <R><B act="prefs-save">SAVE PREFS</B><B act="no16" on={!!app.no16}>NO16</B><B act="dep2" on={!!app.dep2}>DEP2</B><B act="confirm-toggle" on={app.confirmOn !== false}>CONFIRM</B></R>
        <R><B act="paths-info">PATHS</B><B act="prefs-reset">FORGET</B><B act="pal-cycle">COLOUR</B></R>
      </div>
    </div>
  );
}
