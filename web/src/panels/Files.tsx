import { B, L, R, T, useKeys, MW } from '../shared';

/* ---------------------------------------------------------------- Files */

export function FilesPanel() {
  useKeys(['song']);
  const app = MW.app;
  const fmt = app.saveFormat || 'mmd1';
  return (
    <div class="flex h-full flex-col gap-px">
      <R>
        <L cls="w-[82px] justify-end">SAVE FORMAT:</L>
        <B act="file-info" on={!!app.saveInfo} cls="w-[46px]">INFO</B>
        <B act="file-open" cls="flex-1">LOAD SONG</B>
        <B act="ins-open" cls="flex-1">LOAD INSTR</B>
        <B act="file-del" cls="w-[58px]">DEL FILE</B>
        <B act="file-load-msg" cls="w-[62px]">LOAD MSG</B>
        <B act="file-load-map" cls="w-[42px]">MAP</B>
      </R>
      <R>
        <L cls="w-[82px]" />
        <B act="missing" name="Amiga icon files" disabled cls="w-[46px]">ICON</B>
        <B act="file-save-song" cls="flex-1">SAVE SONG</B>
        <B act="file-save-iff" cls="flex-1">SAVE INSTR</B>
        <B act="file-save-msg" cls="w-[62px]">SAVE MSG</B>
        <B act="file-save-map" cls="w-[42px]">MAP</B>
      </R>
      <R>
        <B act="fmt-mmd1" on={fmt === 'mmd1'} cls="w-[82px]">MOD1(+INSTR)</B>
        <L cls="w-[32px]">DIR:</L>
        <span class="flex h-[20px] flex-1 items-center border border-ink bg-paper px-1 text-[10px] opacity-60">browser</span>
      </R>
      <R>
        <B act="fmt-mmd1n" on={fmt === 'mmd1n'} cls="w-[82px]">MOD1(NO INSTR)</B>
        <L cls="w-[32px]">FILE:</L>
        <T value={app.song.name || ''} maxlength={40} onInput={(v: string) => { app.song.name = v; }} cls="flex-1" />
      </R>
      <R>
        <B act="fmt-mmd0" on={fmt === 'mmd0'} cls="w-[82px]">MOD0 (OLD)</B>
        <B act="fmt-st" on={fmt === 'st'} cls="w-[82px]">ST-MODULE</B>
        <L cls="w-[42px]">EXPORT</L>
        <B act="audio-wav" cls="w-[42px]">WAV</B>
        <B act="audio-aac" cls="w-[42px]">AAC</B>
        <B act="audio-mp3" cls="w-[42px]">MP3</B>
        <B act="file-demo" cls="flex-1">DEMO</B>
      </R>
    </div>
  );
}
