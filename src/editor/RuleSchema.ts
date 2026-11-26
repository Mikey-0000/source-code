export type Feature = 'arithmetic' | 'booleans' | 'comparisons' | 'conditions' | 'variables' | 'loops' | 'arrays' | 'functions';
export type PropValue = number | boolean;
export interface PropDef { type: 'number' | 'boolean'; default: PropValue; min?: number; max?: number; doc: string; unit?: string; readonly?: boolean; /** can only be assigned by protected (ADMIN) lines */ adminOnly?: boolean }
export interface ObjSchema { doc: string; props: Record<string, PropDef> }
export interface RuleSchema {
  objects: Record<string, ObjSchema>;
  /** array name -> ordered object names, e.g. doors -> [door1, door2, door3] */
  arrays: Record<string, string[]>;
  features: Feature[];
}
export type RuleState = Record<string, Record<string, PropValue>>;

export const FEATURE_INFO: Record<Feature, { label: string; unlock: string }> = {
  arithmetic: { label: 'Arithmetic (+ - * / %)', unlock: 'BOOT' },
  booleans: { label: 'Booleans (true / false)', unlock: 'EXCEPTION' },
  comparisons: { label: 'Comparisons (< > == != && ||)', unlock: 'EXCEPTION' },
  conditions: { label: 'Conditions (if / else)', unlock: 'EXCEPTION' },
  variables: { label: 'Variables (let)', unlock: 'EXCEPTION' },
  loops: { label: 'Bounded loops (for)', unlock: 'EXCEPTION / sector 03' },
  arrays: { label: 'Arrays ([ ] and indexing)', unlock: 'EXCEPTION / sector 03' },
  functions: { label: 'Functions (min, max, abs, clamp, round, floor, len)', unlock: 'EXCEPTION / sector 03' },
};

export const FUNCTIONS: Record<string, { argc: number; doc: string }> = {
  min: { argc: 2, doc: 'min(a, b) — the smaller number' },
  max: { argc: 2, doc: 'max(a, b) — the larger number' },
  abs: { argc: 1, doc: 'abs(x) — absolute value' },
  clamp: { argc: 3, doc: 'clamp(x, lo, hi) — limit x to a range' },
  round: { argc: 1, doc: 'round(x) — nearest integer' },
  floor: { argc: 1, doc: 'floor(x) — round down' },
  len: { argc: 1, doc: 'len(array) — number of elements' },
};

export function defaultState(schema: RuleSchema): RuleState {
  const s: RuleState = {};
  for (const [name, o] of Object.entries(schema.objects)) {
    s[name] = {};
    for (const [p, d] of Object.entries(o.props)) s[name][p] = d.default;
  }
  return s;
}
export const cloneState = (s: RuleState): RuleState => JSON.parse(JSON.stringify(s));
