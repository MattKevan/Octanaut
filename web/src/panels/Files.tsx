import { B, L, R, T, useKeys, MW } from '../shared';

/* ---------------------------------------------------------------- Files */

export function FilesPanel() {
  useKeys(['song']);
  const app = MW.app;
  const fmt = app.saveFormat || 'mmd1';
  return (
    <div class="grid h-full grid-cols-[110px_minmax(0,1fr)] gap-[2px]">
      <div class="flex flex-col gap-px">
        <L>SAVE FORMAT:</L>
        <B act="fmt-mmd1" on={fmt === 'mmd1'} cls="grow-0">MOD1(+INSTR)</B>
        <B act="fmt-mmd1n" on={fmt === 'mmd1n'} cls="grow-0">MOD1(NO INSTR)</B>
        <B act="fmt-mmd0" on={fmt === 'mmd0'} cls="grow-0">MOD0 (OLD)</B>
        <B act="fmt-st" on={fmt === 'st'} cls="grow-0">ST-MODULE</B>
      </div>
      <div class="flex min-w-0 flex-col gap-px">
        <R>
          <B act="file-info" on={!!app.saveInfo}>INFO</B>
          <B act="file-open">LOAD SONG</B>
          <B act="ins-open">LOAD INSTR</B>
          <B act="file-del">DEL FILE</B>
          <B act="file-load-msg">LOAD MSG</B>
          <B act="file-load-map">MAP</B>
        </R>
        <R>
          <B act="missing" name="Amiga icon files" disabled>ICON</B>
          <B act="file-save-song">SAVE SONG</B>
          <B act="file-save-iff">SAVE INSTR</B>
          <B act="file-save-msg">SAVE MSG</B>
          <B act="file-save-map">MAP</B>
        </R>
        <R>
          <L cls="w-[38px]">DIR:</L>
          <span class="flex h-[24px] flex-1 items-center border border-ink bg-paper px-1 text-[10px] opacity-60">browser</span>
        </R>
        <R>
          <L cls="w-[38px]">FILE:</L>
          <T value={app.song.name || ''} maxlength={40} onInput={(v: string) => { app.song.name = v; }} cls="flex-1" />
        </R>
        <R>
          <L>EXPORT</L>
          <B act="audio-wav">WAV</B>
          <B act="audio-aac">AAC</B>
          <B act="audio-mp3">MP3</B>
          <B act="file-demo">DEMO</B>
        </R>
      </div>
    </div>
  );
}
