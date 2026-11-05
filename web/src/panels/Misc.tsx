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
    <div class="flex h-full flex-col gap-px">
      <R>
        <L cls="w-[16px]">R</L>
        <input type="range" min="0" max="255" value={rgb.r} class="h-[20px] w-[120px]" onChange={(e: any) => setRGB('r', +e.currentTarget.value)} />
        <span class={`${FIELD} w-[28px] text-center`}>{rgb.r}</span>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(n => (
          <B key={n} onClick={() => MW.missing('RGB palette')} cls={`w-[18px] ${n === 0 ? 'bg-ink' : ''}`}> </B>
        ))}
        <B act="pal-reset" cls="w-[34px]">RES</B>
        <B act="pal-undo" cls="w-[38px]">UNDO</B>
      </R>
      <R>
        <L cls="w-[16px]">G</L>
        <input type="range" min="0" max="255" value={rgb.g} class="h-[20px] w-[120px]" onChange={(e: any) => setRGB('g', +e.currentTarget.value)} />
        <span class={`${FIELD} w-[28px] text-center`}>{rgb.g}</span>
        <B act="ptkey" on={!!app.ptkey} cls="w-[46px]">PTKEY</B>
        <B act="missing" name="Workbench" disabled cls="w-[44px]">WB OPEN</B>
        <B act="missing" name="Workbench" disabled cls="w-[44px]">CLOSE</B>
      </R>
      <R>
        <L cls="w-[16px]">B</L>
        <input type="range" min="0" max="255" value={rgb.b} class="h-[20px] w-[120px]" onChange={(e: any) => setRGB('b', +e.currentTarget.value)} />
        <span class={`${FIELD} w-[28px] text-center`}>{rgb.b}</span>
        <B act="name-flat" on={!!app.hb} cls="w-[44px]">H↔B</B>
        <B act="missing" name="Load graphics" disabled cls="w-[58px]">LOADGFX</B>
        <B act="missing" name="Mouse pointer" disabled cls="w-[50px]">MOUSE2</B>
      </R>
      <R>
        <B act="paths-info" cls="w-[52px]">PATHS</B>
        <B act="paths-add" cls="w-[34px]">ADD</B>
        <B act="paths-rem" cls="w-[34px]">REM</B>
        <B act="misc-clear-all" cls="w-[70px]">CLEAR ALL</B>
        <B act="misc-clear" cls="w-[106px]">CLEAR SONG ONLY</B>
        <B act="quit-app" cls="w-[38px]">QUIT</B>
        <B act="confirm-toggle" on={app.confirmOn !== false} cls="w-[54px]">CONFIRM</B>
      </R>
      <R>
        <B act="no16" on={!!app.no16} cls="w-[42px]">NO16</B>
        <B act="dep2" on={!!app.dep2} cls="w-[42px]">DEP2</B>
        <B act="prefs-save" cls="w-[72px]">SAVE PREFS</B>
        <B act="prefs-reset" cls="w-[72px]">FORGET</B>
        <B act="pal-cycle" cls="w-[46px]">COLOUR</B>
      </R>
    </div>
  );
}
