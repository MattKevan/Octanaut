import { PlayPanel } from './Play';
import { FilesPanel } from './Files';
import { InstrPanel } from './Instr';
import { BlockPanel } from './Block';
import { EditPanel } from './Edit';
import { MiscPanel } from './Misc';
import { VolPanel } from './Vol';
import { RangePanel } from './Range';
import { TransPanel } from './Trans';
import { MidiPanel } from './MIDI';

export const PANELS: Record<string, () => any> = {
  play: PlayPanel,
  files: FilesPanel,
  instr: InstrPanel,
  block: BlockPanel,
  edit: EditPanel,
  misc: MiscPanel,
  vol: VolPanel,
  range: RangePanel,
  transp: TransPanel,
  midi: MidiPanel
};
