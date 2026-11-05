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
  const Panel = PANELS[active] || PANELS.play;
  return <Panel />;
}

MW.panels = {
  get current() { return active; },
  mount(host: HTMLElement) {
    render(<Host />, host);
    const left = document.querySelector('.deck-left') as HTMLElement | null;
    if (left) left.style.display = 'block';
  },
  show(name: string) {
    active = name;
    document.querySelectorAll('.deck-side [data-panel]').forEach((b: any) => {
      b.classList.toggle('active', b.dataset.panel === name);
    });
    const left = document.querySelector('.deck-left') as HTMLElement | null;
    if (left) left.style.display = name === 'play' ? 'block' : 'none';
    if (name === 'files') {
      if (MW.displays.current !== 'files') {
        MW._prevDisplay = MW.displays.current;
        MW.displays.show('files');
      }
    } else if (MW.displays.current === 'files') {
      MW.displays.show(MW._prevDisplay || 'grid');
    }
    emit();
  },
  refresh() {
    emit();
  }
};
