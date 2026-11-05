import { useEffect, useReducer } from 'preact/hooks';

export const MW: any = (globalThis as any).MW;

/* ---------------------------------------------------------------- helpers */

export const BTN =
  'flex h-[20px] min-w-0 items-center justify-center border border-ink bg-paper px-1 text-[10px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper';
export const LAB = 'flex h-[20px] shrink-0 items-center px-1 text-[10px] uppercase leading-none whitespace-nowrap';
export const FIELD = 'h-[20px] min-w-0 border border-ink bg-paper px-1 text-[11px] leading-none text-ink outline-none';
export const ROW = 'flex items-stretch gap-px';

export function B(props: any) {
  const { act, on, cls, children, title, name, onClick, disabled } = props;
  return (
    <button
      type="button"
      title={title}
      data-act={act}
      data-name={name}
      disabled={disabled}
      class={`${BTN} ${on ? 'on' : ''} ${disabled ? 'opacity-40' : ''} ${cls || ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function L(props: any) {
  return <span class={`${LAB} ${props.cls || ''}`}>{props.children}</span>;
}

export function R(props: any) {
  return <div class={`${ROW} ${props.cls || ''}`}>{props.children}</div>;
}

export function T(props: any) {
  return (
    <input
      class={`${FIELD} ${props.cls || ''}`}
      value={props.value ?? ''}
      placeholder={props.placeholder}
      maxlength={props.maxlength}
      onInput={(e: any) => props.onInput && props.onInput(e.currentTarget.value)}
    />
  );
}

export function N(props: any) {
  return (
    <input
      id={props.id}
      type="number"
      class={`${FIELD} ${props.cls || ''}`}
      value={props.value ?? 0}
      min={props.min}
      max={props.max}
      onChange={(e: any) => props.onChange && props.onChange(parseInt(e.currentTarget.value, 10) || 0)}
    />
  );
}

export function useKeys(keys: string[]) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const key = keys.join('|');
  useEffect(() => {
    if (!MW.store) return;
    return MW.store.subscribe(keys, force);
  }, [key]);
}

export function fmt2(n: number) {
  return String(n).padStart(2, '0');
}
