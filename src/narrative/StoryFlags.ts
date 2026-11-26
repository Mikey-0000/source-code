import { loadSave, writeSave, emptySave, type SaveData } from '../storage/SaveGame';
/** Thin typed wrapper around the persisted flag bag, shared by the game and EDEN OS. */
class StoryFlags {
  data: SaveData = loadSave() ?? emptySave();
  reload() { this.data = loadSave() ?? emptySave(); }
  reset() { this.data = emptySave(); }
  get(k: string) { return this.data.flags[k]; }
  bool(k: string) { return this.data.flags[k] === true; }
  num(k: string) { const v = this.data.flags[k]; return typeof v === 'number' ? v : 0; }
  set(k: string, v: boolean | number | string) { this.data.flags[k] = v; this.save(); }
  save() { writeSave(this.data); }
}
export const story = new StoryFlags();
