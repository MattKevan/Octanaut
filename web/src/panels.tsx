import { render } from 'preact';
import { useEffect, useReducer } from 'preact/hooks';
import { MW } from './shared';
import { PANELS } from './panels/index';

/* ---------------------------------------------------------------- host */

let active = 'play';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());

function Host() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const bump = () => force(0);
    listeners.add(bump);
    return () => { listeners.delete(bump); };
  }, []);
  const Panel = PANELS[active === 'midi' ? 'play' : active] || PANELS.play;
  return <Panel />;
}

MW.panels = {
  get current() { return active; },
  mount(host: HTMLElement) {
    render(<Host />, host);
    const left = document.querySelector('.deck-left') as HTMLElement | null;
    if (left) left.style.display = 'flex';
  },
  show(name: string) {
    active = name;
    document.querySelectorAll('.deck-side [data-panel]').forEach((b: any) => {
      b.classList.toggle('active', b.dataset.panel === name);
    });
    const left = document.querySelector('.deck-left') as HTMLElement | null;
    if (left) left.style.display = name === 'play' || name === 'midi' ? 'flex' : 'none';
    if (name === 'midi') {
      if (MW.displays.current !== 'midi') {
        if (MW.displays.current !== 'files') MW._prevDisplay = MW.displays.current;
        MW.displays.show('midi');
      }
    } else if (name === 'files') {
      if (MW.displays.current !== 'files') {
        if (MW.displays.current !== 'midi') MW._prevDisplay = MW.displays.current;
        MW.displays.show('files');
      }
    } else if (MW.displays.current === 'files' || MW.displays.current === 'midi') {
      MW.displays.show(MW._prevDisplay || 'grid');
    }
    emit();
  },
  mountMidi(host: HTMLElement) {
    const Midi = PANELS.midi;
    render(<div class="h-full overflow-auto bg-paper p-2 text-ink"><Midi /></div>, host);
  },
  unmountMidi(host: HTMLElement) {
    render(null, host);
  },
  refresh() {
    emit();
    /* A panel edit may not touch refreshAll, but it is still a song change. */
    if (MW.storage) MW.storage.schedule();
    if (MW.displays.current === 'midi') {
      const host = document.getElementById('display-body');
      if (host) MW.panels.mountMidi(host);
    }
  }
};
