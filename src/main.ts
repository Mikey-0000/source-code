import './styles/main.css';
import { applyBodyClasses, settings } from './core/Settings';
import { el } from './core/Util';
import { BootSequence, TitleMenu, SettingsPanel, showCredits, showGuide } from './ui/Menus';
import { GameScene } from './game/scenes/GameScene';
import { VirtualDesktop } from './os/VirtualDesktop';
import { audio } from './audio/AudioEngine';
import { assets } from './art/Assets';
import { story } from './narrative/StoryFlags';
import { wipeSave } from './storage/SaveGame';
import { input } from './core/Input';

applyBodyClasses();
const app = document.getElementById('app')!;
el('div', 'crt-overlay', document.body); el('div', 'vignette', document.body);
let title: TitleMenu | null = null; let game: GameScene | null = null;

function showTitle() {
  audio.startDrone('title');
  if (title) { title.hide(false); return; }
  title = new TitleMenu(app, { onNew: () => void startGame(true), onContinue: () => void startGame(false), onSettings: () => { title!.hide(true); new SettingsPanel(app, () => title!.hide(false)); }, onGuide: () => { title!.hide(true); showGuide(app, () => title!.hide(false)); }, onCredits: () => { title!.hide(true); showCredits(app, () => title!.hide(false)); } });
}
async function startGame(fresh: boolean) {
  title?.hide(true); if (fresh) { wipeSave(); story.reset(); } else story.reload();
  if (!game) game = new GameScene(app, { onQuit: () => { game!.hide(); showTitle(); }, onRoot: () => enterRoot() });
  else game.show();
  await game.begin(fresh ? 0 : story.data.levelIndex);
}
function enterRoot() {
  audio.startDrone('root'); game?.hide(); new VirtualDesktop(app, () => { showTitle(); }); input.endFrame();
}
async function main() {
  assets(); // build all procedural art up-front
  const q = new URLSearchParams(location.search);
  if (q.has('skipboot')) { audio.init(); showTitle(); } else { const boot = new BootSequence(app); await boot.run(); showTitle(); }
  (window as unknown as { __eden: unknown }).__eden = { get game() { return game; }, startGame, enterRoot, story, settings, input };
}
void main();
