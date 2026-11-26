import type { Theme } from '../../art/Environment';
import type { RuleSchema } from '../../editor/RuleSchema';

export interface PlatformDef { id: string; x: number; y: number; w: number; kind: 'solid' | 'moving' | 'ghost' | 'broken'; /** tile coords of motion end point */ to?: [number, number]; period?: number; rule?: string; invisibleUntilCollision?: boolean }
export interface DoorDef { id: string; x: number; y: number; h: number; rule: string; label?: string }
export interface LaserDef { id: string; x: number; y: number; len: number; dir: 'h' | 'v'; rule: string }
export interface EnemyDef { id: string; x: number; y: number; x0: number; x1: number; speed: number; rule: string }
export interface CameraDef { id: string; x: number; y: number; aim: number; sweep: number; minCorruption: number }
export interface TerminalDef { id: string; x: number; y: number; title: string; lines: string[]; opensEditor?: boolean; fuse?: number }
export interface MemoryDef { id: string; x: number; y: number; title: string; text: string; minCorruption?: number }
export interface TriggerDef { id: string; x: number; y: number; w: number; h: number; event: 'reveal' | 'dialogue' | 'boss'; lines?: string[] }
export interface DecorDef { kind: 'monitor' | 'cable' | 'vent' | 'sign'; x: number; y: number; text?: string; w?: number }
export interface BossDef { kind: 'watcher'; x: number; y: number }

export interface LevelDef {
  id: string; chapter: number; chapterName: string; name: string; subtitle: string; theme: Theme;
  grid: string[]; start: [number, number]; exit: [number, number];
  checkpoints: { id: string; x: number; y: number }[];
  terminals: TerminalDef[]; memories: MemoryDef[]; platforms: PlatformDef[]; doors: DoorDef[]; lasers: LaserDef[]; enemies: EnemyDef[]; cameras: CameraDef[]; triggers: TriggerDef[]; decor: DecorDef[];
  boss?: BossDef;
  schema: RuleSchema; template: string[]; locked: string[]; fileName: string;
  objective: string; hints: string[]; intro?: string[];
  /** player-rule overrides used by physics (names of rule objects) */
  editorAvailable: boolean;
}
