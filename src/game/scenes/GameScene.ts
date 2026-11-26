import { el, sleep, clamp } from '../../core/Util';
import { input } from '../../core/Input';
import { settings } from '../../core/Settings';
import { audio } from '../../audio/AudioEngine';
import { PostFX } from '../../effects/PostFX';
import { VIEW_H, VIEW_W, TILE } from '../../art/Palette';
import { canvas } from '../../art/Painter';
import { World, type InputState } from '../systems/World';
import { Renderer } from '../systems/Renderer';
import { LEVELS } from '../levels/Levels';
import type { LevelDef } from '../levels/LevelTypes';
import { compileRules, type CompileResult } from '../../editor/RuleInterpreter';
import { defaultState, type RuleState } from '../../editor/RuleSchema';
import { Hud, DialogueBox, ConsolePanel, EditorPanel } from '../../ui/Panels';
import { SettingsPanel } from '../../ui/Menus';
import { story } from '../../narrative/StoryFlags';
import { contribution, stageOf, STAGE_NAMES, STAGE_TEXT } from '../systems/Corruption';
import { heightAt, airTime, jumpVelocity } from '../physics/Physics';
import { emptySave } from '../../storage/SaveGame';

export interface SceneHooks { onQuit(): void; onRoot(): void }

export class GameScene {
  root: HTMLElement; stageEl: HTMLElement; out: HTMLCanvasElement; view: HTMLCanvasElement; vctx: CanvasRenderingContext2D; post: PostFX; renderer = new Renderer();
  hud: Hud; dialogue: DialogueBox; consoleP: ConsolePanel; panel: EditorPanel; banner: HTMLElement; overlay: HTMLElement; titlebar: HTMLElement;
  world!: World; level!: LevelDef; levelIndex = 0; cam = { x: 0, y: 0 }; running = false; time = 0; acc = 0; last = 0;
  panelOpen = false; debug = false; busy = false; paused = false; editorFocused = false; arc: [number, number][] | null = null; selected: string | null = null;
  rulesSrc = ''; appliedSrc = ''; appliedState!: RuleState; stage = 0; glitch = 0; scripted: { frames: number; inp: InputState } | null = null; previewTimer = 0; warnedAdmin = false; shake = 0; hintIdx = 0; saveT = 0; lastBlindTotal = 0;

  constructor(parent: HTMLElement, private hooks: SceneHooks) {
    this.root = el('div', 'game', parent); this.root.hidden = true;
    this.titlebar = el('div', 'titlebar', this.root); el('span', 'tb-name', this.titlebar, 'PROJECT_EDEN.exe — Debug session'); el('span', 'tb-warn', this.titlebar, 'UNAUTHORISED'); el('span', 'tb-id', this.titlebar, 'NULL_001');
    const main = el('div', 'main', this.root); this.stageEl = el('div', 'stage', main);
    this.out = el('canvas', 'out', this.stageEl); this.out.setAttribute('aria-label', 'Game view'); [this.view] = canvas(VIEW_W, VIEW_H); this.vctx = this.view.getContext('2d')!; this.post = new PostFX(this.out);
    this.hud = new Hud(this.stageEl); this.dialogue = new DialogueBox(this.stageEl); this.banner = el('div', 'stage-banner', this.stageEl); this.banner.hidden = true; this.overlay = el('div', 'overlay', this.stageEl); this.overlay.hidden = true;
    this.panel = new EditorPanel(main); this.consoleP = new ConsolePanel(this.root);
    this.panel.onCompile = () => this.compile(); this.panel.onRestore = () => this.restoreDefaults(); this.panel.onHint = () => this.nextHint(); this.panel.onDebug = () => this.toggleDebug();
    this.panel.editor.onChange = () => { clearTimeout(this.previewTimer); this.previewTimer = window.setTimeout(() => this.preview(), 140); };
    this.panel.editor.onFocusChange = f => { this.editorFocused = f; this.updateBanner(); if (f) this.preview(); };
    this.panel.editor.root.addEventListener('ce-leave', () => this.updateBanner());
    new ResizeObserver(() => this.fit()).observe(this.stageEl); addEventListener('resize', () => this.fit());
    this.stageEl.addEventListener('click', e => this.onStageClick(e));
  }

  // ────────── lifecycle ──────────
  async startNew() { story.reset(); story.data.checkpoint = {}; story.save(); await this.begin(0); }
  async continueGame() { story.reload(); await this.begin(story.data.levelIndex); }
  async begin(index: number) {
    this.root.hidden = false; audio.init(); this.fit(); await this.loadLevel(index); this.startLoop();
  }
  private startLoop() { if (this.running) return; this.running = true; this.last = performance.now(); requestAnimationFrame(t => this.frame(t)); }
  hide() { this.running = false; this.root.hidden = true; audio.stopDrone(); }
  show() { this.root.hidden = false; }

  async loadLevel(index: number, introCard = true) {
    this.busy = true; this.levelIndex = clamp(index, 0, LEVELS.length - 1); this.level = LEVELS[this.levelIndex]; const L = this.level;
    this.renderer.setLevel(L); this.consoleP.clear(); this.panelOpen = false; this.applyLayout();
    const saved = story.data.rules[L.id]; this.rulesSrc = saved ?? L.template.join('\n');
    let res = compileRules({ source: this.rulesSrc, schema: L.schema, lockedLines: L.locked }); if (!res.ok) { this.rulesSrc = L.template.join('\n'); res = compileRules({ source: this.rulesSrc, schema: L.schema, lockedLines: L.locked }); }
    this.appliedSrc = this.rulesSrc; this.appliedState = res.state;
    const cp = story.data.checkpoint[L.id]; const prior = this.priorCorruption();
    this.world = new World(L, res.state, cp ? { x: cp.x, y: cp.y } : undefined, prior + contribution(L, res.state));
    for (const m of L.memories) if (story.data.memories.includes(m.id)) this.world.collected.add(m.id);
    this.world.stats.deaths = 0; this.cam.x = this.world.x - VIEW_W / 2; this.cam.y = this.world.y - VIEW_H / 2; this.clampCam(true);
    this.panel.setLevel(L, this.rulesSrc, res.state); this.updateCorruption(true); this.hud.setObjective(L.objective); this.hud.setLocation(`CH.${L.chapter} ${L.chapterName} / ${L.name}`); this.hud.showHint(null); this.hintIdx = 0;
    story.data.levelIndex = this.levelIndex; story.save();
    audio.startDrone(L.boss ? 'boss' : L.theme === 'exception' ? 'exception' : 'boot'); this.glitch = 1; audio.sfx('glitch');
    this.consoleP.log('INFO', `Loaded ${L.id}. Rule file: ${L.fileName}. ${L.editorAvailable || story.data.editorRevealed ? 'Press Tab to open the editor.' : ''}`);
    this.updateTitlebar();
    this.startLoop();
    if (introCard) { void this.hud.titleCard(`CHAPTER ${L.chapter} — ${L.chapterName}`, L.name, L.subtitle); await sleep(settings.reducedMotion ? 700 : 1200); }
    this.busy = false;
    if (L.intro && !story.bool('intro_' + L.id)) { story.set('intro_' + L.id, true); await this.say('SYSTEM', L.intro, 'sys'); }
    if (L.editorAvailable || story.data.editorRevealed) this.hud.toast('[Tab] open source editor');
  }
  private priorCorruption() { let c = 0; for (const l of LEVELS) { if (l.id === this.level.id) break; c += story.num('cc_' + l.id); } return c; }
  private updateTitlebar() { this.titlebar.style.display = this.panelOpen ? '' : 'none'; }

  // ────────── layout ──────────
  private applyLayout() { this.root.classList.toggle('debug-open', this.panelOpen); this.updateTitlebar(); this.updateBanner(); requestAnimationFrame(() => this.fit()); }
  fit() {
    const r = this.stageEl.getBoundingClientRect(); if (!r.width) return; const aspect = VIEW_W / VIEW_H; let w = r.width, h = r.width / aspect; if (h > r.height) { h = r.height; w = h * aspect; }
    this.out.style.width = Math.floor(w) + 'px'; this.out.style.height = Math.floor(h) + 'px'; this.post.resize(Math.floor(w), Math.floor(h));
  }
  private updateBanner() { const t = this.paused ? 'PAUSED' : this.editorFocused ? 'SIMULATION PAUSED — EDITING' : this.panelOpen && this.world?.boss && this.world.boss.blind > 0 ? 'TIMED CHALLENGE' : ''; this.banner.hidden = !t; this.banner.textContent = t; }
  openPanel(focus: boolean) { if (!this.level.editorAvailable && !story.data.editorRevealed) return; this.panelOpen = true; this.applyLayout(); this.hud.toast(''); if (focus) setTimeout(() => this.panel.editor.focus(), 60); this.preview(); audio.sfx('click'); }
  closePanel() { this.panelOpen = false; this.panel.editor.ta.blur(); this.editorFocused = false; this.arc = null; this.applyLayout(); }
  toggleDebug() { this.debug = !this.debug; this.consoleP.log('INFO', this.debug ? 'DEBUG MODE ON — collision overlays visible. Click an entity to inspect it.' : 'DEBUG MODE OFF.'); audio.sfx('beep'); }

  // ────────── main loop ──────────
  private frame(now: number) {
    if (!this.running) return; requestAnimationFrame(t => this.frame(t)); if (!this.world) return;
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now; this.time += dt;
    const canPlay = !this.busy && !this.paused && !this.editorFocused && !this.dialogue.open && !!this.world;
    if (!this.busy && !this.dialogue.open && !this.root.hidden) this.handleKeys();
    if (canPlay) { this.acc += dt; story.data.stats.playMs += dt * 1000; let first = true; while (this.acc >= 1 / 60) { this.acc -= 1 / 60; this.step(first); first = false; } } else this.acc = 0;
    input.endFrame();
    this.updateCamera(); this.hudUpdate();
    this.glitch = Math.max(this.glitch * 0.93 - 0.002, 0); this.post.glitch = this.glitch + [0, 0.04, 0.1][this.stage] * (settings.reducedMotion ? 0 : (Math.sin(this.time * 3) > 0.7 ? 1 : 0.2)); this.post.flash = Math.max(0, this.post.flash * 0.9 - 0.01);
    this.post.aberr = 0.0007 + this.stage * 0.0008 + this.glitch * 0.003;
    this.renderer.draw(this.vctx, this.world, this.cam, { debug: this.debug, editing: this.panelOpen, stage: this.stage, arc: this.panelOpen ? this.arc : null, selected: this.selected, time: this.time, paused: !canPlay });
    if (this.shake > 0 && !settings.reducedMotion) { this.shake--; }
    this.post.present(this.view, this.time);
  }
  private handleKeys() {
    if (input.pressed('pause') && this.overlay.hidden) { this.openPause(); return; }
    if (input.pressed('edit') && !this.editorFocused) { if (!this.level.editorAvailable && !story.data.editorRevealed) { this.hud.toast('No editor here. Yet.'); } else if (this.panelOpen) this.closePanel(); else this.openPanel(true); }
    if (input.pressed('debug')) this.toggleDebug();
    if (input.pressed('restart') && !this.editorFocused && this.world.dead === 0) { this.world.integrity = 0; this.world.die(); }
    if (input.pressed('interact') && !this.editorFocused) { const t = this.world.nearestTerminal(); if (t) void this.useTerminal(t); }
  }
  private step(first: boolean) {
    let inp: InputState;
    if (this.scripted && this.scripted.frames > 0) { inp = this.scripted.inp; this.scripted.frames--; } else inp = { left: input.held('left'), right: input.held('right'), jumpHeld: input.held('jump'), jumpPressed: first && input.pressed('jump') };
    this.world.update(inp);
    for (const e of this.world.events) this.onEvent(e);
  }
  private onEvent(e: World['events'][number]) {
    switch (e.type) {
      case 'jump': audio.sfx('jump'); break; case 'land': audio.sfx('land'); break; case 'step': audio.sfx('step'); break;
      case 'hit': audio.sfx('hit'); this.glitch = Math.max(this.glitch, 0.6); this.post.flash = 0.5; break;
      case 'laser': this.consoleP.log('WARNING', 'Laser contact. ADMIN: "Entity terminated."'); break;
      case 'death': audio.sfx('death'); this.glitch = 1; story.data.stats.deaths++; this.shake = 12; break;
      case 'respawn': audio.sfx('glitch'); this.hud.toast('RESTORED FROM CHECKPOINT'); break;
      case 'checkpoint': audio.sfx('checkpoint'); this.hud.toast('CHECKPOINT SAVED'); story.data.checkpoint[this.level.id] = { ...this.world.checkpoint }; story.data.rules[this.level.id] = this.appliedSrc; story.save(); break;
      case 'memory': { audio.sfx('memory'); const m = this.level.memories.find(x => x.id === e.id)!; story.data.memories.push(m.id); story.save(); void this.say('ECHO · ' + m.title, [m.text], 'echo'); break; }
      case 'trigger': if (e.event === 'reveal') void this.revealCutscene(); if (e.event === 'boss') void this.say('ADMIN', ['SECTOR 06. THE WATCHER sees everything within its range.', 'You are not on the list of things that are allowed to be seen. Or to see.'], 'admin'); break;
      case 'camera': audio.sfx('alert'); this.consoleP.log('WARNING', 'Security camera ' + e.id + ' has seen you. Suspicion rising.'); this.hud.toast('SEEN BY CAMERA'); break;
      case 'hunter': this.consoleP.log('ADMIN', 'HUNTER process dispatched to your location.'); this.hud.toast('HUNTER DISPATCHED'); audio.sfx('alert'); break;
      case 'boss':
        if (e.what === 'detected') { audio.sfx('alert'); this.post.flash = 0.6; this.hud.toast('DETECTED BY THE WATCHER'); this.consoleP.log('WARNING', 'THE WATCHER has locked on. Reduce its range or close its eye.'); }
        if (e.what === 'blind') { this.lastBlindTotal = (this.world.boss?.blind ?? 0) || 1; this.consoleP.log('SUCCESS', `Eye closed for ${(this.lastBlindTotal / 60).toFixed(1)} s. Move.`); }
        if (e.what === 'visible') { this.consoleP.log('WARNING', 'THE WATCHER has reopened its eye.'); audio.sfx('eye'); }
        if (e.what === 'defeated') void this.bossDefeated();
        if (e.what === 'fuse') { audio.sfx('checkpoint'); this.consoleP.log('SUCCESS', `FUSE ${e.n} reached.`); }
        break;
      case 'exit': void this.completeLevel(); break;
    }
  }
  private updateCamera() {
    const w = this.world; const tx = w.x + 7 + w.facing * 36 - VIEW_W / 2, ty = w.y + 14 - VIEW_H / 2 + 20; this.cam.x += (tx - this.cam.x) * 0.12; this.cam.y += (ty - this.cam.y) * 0.12; this.clampCam(false);
    if (this.shake > 0 && !settings.reducedMotion) { this.cam.x += (Math.random() - 0.5) * 4; this.cam.y += (Math.random() - 0.5) * 4; }
  }
  private clampCam(snap: boolean) { const maxX = this.world.w * TILE - VIEW_W, maxY = this.world.h * TILE - VIEW_H; this.cam.x = clamp(this.cam.x, 0, Math.max(0, maxX)); this.cam.y = clamp(this.cam.y, 0, Math.max(0, maxY)); void snap; }
  private hudUpdate() {
    const w = this.world; this.hud.setIntegrity(w.integrity); this.hud.setCorruption(w.corruption, STAGE_NAMES[this.stage]);
    const t = w.nearestTerminal(); this.hud.prompt(t && !this.dialogue.open && !this.busy ? `[E] ${t.opensEditor ? 'ACCESS' : 'READ'}  ${t.title}` : null);
    if (w.boss) { this.hud.setBoss(w.boss.integrity / 100); if (w.boss.blind > 0) { this.hud.setTimer(w.boss.blind / Math.max(1, this.lastBlindTotal), (w.boss.blind / 60).toFixed(1) + ' s'); } else this.hud.setTimer(null); } else { this.hud.setBoss(null); this.hud.setTimer(null); }
    this.banner.hidden = !(this.paused || this.editorFocused || (w.boss && w.boss.blind > 0)); this.banner.textContent = this.paused ? 'PAUSED' : this.editorFocused ? 'SIMULATION PAUSED — EDITING' : 'TIMED CHALLENGE';
    if (this.panelOpen) this.panel.refreshVars(this.world.rule);
    this.saveT++;
  }

  // ────────── rules ──────────
  private diffLines(a: string, b: string): number[] { const A = a.split('\n'), B = b.split('\n'); const out: number[] = []; B.forEach((l, i) => { if (l !== A[i] && l.trim() && !l.trim().startsWith('//')) out.push(i + 1); }); return out; }
  compile() {
    const L = this.level; const src = this.panel.editor.source; const res = compileRules({ source: src, schema: L.schema, lockedLines: L.locked });
    if (!res.ok) { this.reportErrors(res); return; }
    this.panel.editor.setErrors([]); const changedLines = this.diffLines(this.appliedSrc, src); const prevState = this.appliedState;
    this.world.applyRules(res.state); this.appliedSrc = src; this.appliedState = res.state; story.data.rules[L.id] = src; story.data.stats.compiles++;
    this.panel.editor.setChanged(changedLines); this.panel.setStatus('APPLIED'); audio.sfx('compile');
    this.consoleP.log('SUCCESS', 'Player properties updated.'); const ch = res.changes; for (const c of ch.slice(0, 8)) this.consoleP.log('INFO', `${c.path}: ${c.from} → ${c.to}`);
    if (!ch.length) this.consoleP.log('INFO', 'No differences from the default rules.');
    const prior = this.priorCorruption(); const before = this.world.corruption; this.world.corruption = prior + contribution(L, res.state); this.updateCorruption(false, before);
    if (!this.warnedAdmin && ch.length) { this.warnedAdmin = true; setTimeout(() => this.consoleP.log('WARNING', 'ADMIN detected an unauthorised modification. Someone is watching you_.'), 600); }
    void prevState; story.save(); this.panel.editor.ta.blur(); this.editorFocused = false; this.arc = null; this.glitch = Math.max(this.glitch, 0.3);
    if (this.world.corruption >= 100) this.consoleP.log('ADMIN', 'Corruption ceiling reached. This is unsustainable.');
  }
  private reportErrors(res: CompileResult) {
    this.panel.editor.setErrors(res.errors); this.panel.setStatus('ERROR', true); audio.sfx('error'); this.glitch = Math.max(this.glitch, 0.25);
    for (const e of res.errors.slice(0, 4)) this.consoleP.log('ERROR', `line ${e.line}:${e.col} — ${e.msg}${e.hint ? ' · ' + e.hint : ''}`);
    this.consoleP.log('INFO', 'Nothing was applied. The game state is unchanged.');
  }
  restoreDefaults() {
    const L = this.level; const src = L.template.join('\n'); this.panel.editor.setSource(src); const res = compileRules({ source: src, schema: L.schema, lockedLines: L.locked });
    this.world.applyRules(res.state); this.appliedSrc = src; this.appliedState = res.state; story.data.rules[L.id] = src; const before = this.world.corruption; this.world.corruption = this.priorCorruption() + contribution(L, res.state); this.updateCorruption(false, before);
    this.consoleP.log('SUCCESS', 'Default rules restored. Guaranteed recovery.'); this.panel.setStatus('RESTORED'); audio.sfx('compile'); story.save(); this.preview();
  }
  private updateCorruption(silent: boolean, before?: number) {
    const s = stageOf(this.world.corruption); const prev = before === undefined ? s : stageOf(before); this.stage = s; this.hud.setCorruption(this.world.corruption, STAGE_NAMES[s]);
    if (!silent && s !== prev) { this.consoleP.log(s > prev ? 'WARNING' : 'INFO', `Corruption ${STAGE_NAMES[s]}: ${STAGE_TEXT[s]}`); if (s > prev) { audio.sfx('alert'); void this.say('ADMIN', [s === 1 ? 'Anomaly detected. Cameras online.' : 'ANOMALY CRITICAL. HUNTER DISPATCHED.'], 'admin'); } }
    audio.setTension(s / 2);
  }
  nextHint() { const h = this.level.hints; if (!settings.hints) { this.consoleP.log('INFO', 'Hints are disabled in settings.'); return; } const t = h[this.hintIdx % h.length]; this.hintIdx++; this.consoleP.log('INFO', 'HINT: ' + t); this.hud.showHint(t); setTimeout(() => this.hud.showHint(null), 9000); }
  private preview() {
    if (!this.panelOpen) return; const L = this.level; const res = compileRules({ source: this.panel.editor.source, schema: L.schema, lockedLines: L.locked });
    if (!res.ok) { this.panel.editor.setErrors(res.errors); this.panel.setStatus('SYNTAX ERROR', true); this.panel.setPreview(`<span class="bad">${res.errors[0].msg}</span>`); this.arc = null; return; }
    this.panel.editor.setErrors([]); this.panel.setStatus(res.source === this.appliedSrc ? 'APPLIED' : 'PENDING');
    const s = res.state; const j = (s.player?.jumpHeight as number) ?? 45, sp = (s.player?.speed as number) ?? 2.8, g = (s.world?.gravity as number) ?? 0.8;
    const air = airTime(j, g), range = sp * air, v = jumpVelocity(j, g); this.panel.setPreview(`PREVIEW  apex <b>${j}</b> px · air <b>${air}</b> frames · range <b>${Math.round(range)}</b> px · launch ${v.toFixed(1)} px/f`);
    const w = this.world; const pts: [number, number][] = []; const x0 = w.x + 7, y0 = w.y + 28; const dir = w.facing || 1; const dyn = w.dynamicSolids();
    for (let n = 0; n <= air + 4; n += 1) { const x = x0 + dir * sp * n, y = y0 - heightAt(n, j, g); if (n > 3 && (w.solidTile(Math.floor(x / TILE), Math.floor(y / TILE)) || dyn.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h))) break; pts.push([x, y]); }
    this.arc = pts;
  }
  private onStageClick(e: MouseEvent) {
    if (!this.debug || !this.world) return; const r = this.out.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * VIEW_W + this.cam.x, y = (e.clientY - r.top) / r.height * VIEW_H + this.cam.y; const L = this.level; const w = this.world;
    type Cand = { id: string; kind: string; rule?: string; d: number; info: string }; const c: Cand[] = [];
    const add = (id: string, kind: string, ex: number, ey: number, rule?: string, info = '') => c.push({ id, kind, rule, d: Math.hypot(ex - x, ey - y), info });
    add('NULL_001', 'player', w.x + 7, w.y + 14, 'player', `integrity ${Math.round(w.integrity)}% · pos ${w.x.toFixed(0)},${w.y.toFixed(0)} · vel ${w.vx.toFixed(2)},${w.vy.toFixed(2)}`);
    for (const p of w.platforms) add(p.def.id, 'platform', p.x + p.w / 2, p.y, p.def.rule, `kind ${p.def.kind}`); for (const d of L.doors) add(d.id, 'door', d.x * TILE + 16, d.y * TILE + d.h * 16, d.rule); for (const l of L.lasers) add(l.id, 'laser', l.x * TILE + 16, l.y * TILE + 16, l.rule);
    for (const en of w.enemies) add(en.def.id, 'DAEMON', en.x + 16, en.y + 16, en.def.rule, `patrol ${en.def.x0}…${en.def.x1} tiles · ${en.hostile ? 'HOSTILE' : 'idle'}`); if (w.boss) add('watcher', 'THE WATCHER', w.boss.x, w.boss.y, 'watcher', `detection ${(w.boss.detection * 100).toFixed(0)}% · eye ${w.boss.blind > 0 ? 'CLOSED' : 'open'}`);
    for (const t of L.terminals) add(t.id, 'terminal', t.x * TILE + 16, t.y * TILE + 16, undefined, t.title);
    c.sort((a, b) => a.d - b.d); const best = c[0]; if (!best || best.d > 70) { this.selected = null; return; } this.selected = best.id;
    const props = best.rule && w.rule[best.rule] ? Object.entries(w.rule[best.rule]).map(([k, v]) => `<div class="var-prop">${best.rule}.${k} = <b>${v}</b></div>`).join('') : '<div class="muted">no editable properties</div>';
    this.panel.setInspector(`<div class="insp"><b>${best.id}</b> <i>${best.kind}</i><div class="muted">${best.info}</div>${props}</div>`); if (!this.panelOpen) this.openPanel(false);
  }

  // ────────── narrative moments ──────────
  async say(who: string, lines: string[], mod: 'sys' | 'admin' | 'echo' | 'null' = 'sys') { if (!settings.subtitles && mod !== 'sys') { this.consoleP.log('INFO', `${who}: ${lines.join(' ')}`); return; } await this.dialogue.show(who, lines, mod); }
  private async useTerminal(t: LevelDef['terminals'][number]) {
    audio.sfx('beep'); story.set('read_' + t.id + '_' + this.level.id, true); await this.say(t.title, t.lines, 'sys');
    if (t.fuse) { this.world.touchFuse(t.fuse); if (t.fuse === 1) await this.say('ADMIN', ['Why can you stand there.', 'No. Do not answer. I am recording the question.'], 'admin'); }
    if (t.opensEditor) this.openPanel(true);
  }
  private async revealCutscene() {
    this.busy = true; const w = this.world; w.frozen = false; audio.sfx('eye'); this.glitch = 1; this.post.flash = 0.3; audio.setTension(0.8);
    await this.dialogue.show('SYSTEM', ['> OBSTACLE HEIGHT: 128 PX', '> ENTITY JUMP HEIGHT: 45 PX', '> THIS JUMP IS NOT POSSIBLE.'], 'sys');
    this.scripted = { frames: 36, inp: { left: false, right: true, jumpHeld: true, jumpPressed: true } }; this.busy = false; await sleep(900); this.busy = true; this.scripted = null;
    audio.sfx('glitch'); this.glitch = 1; await sleep(500);
    await this.dialogue.show('NULL_001', ['...', 'What if it is not a wall.', 'What if it is a number?'], 'null');
    audio.sfx('reveal'); this.glitch = 1; this.post.flash = 0.8; story.data.editorRevealed = true; story.save(); this.busy = false;
    this.level.editorAvailable = true; await sleep(400); this.openPanel(false); this.consoleP.log('WARNING', 'Unauthorised source window opened: ' + this.level.fileName); this.consoleP.log('INFO', 'Change player.jumpHeight, press COMPILE & APPLY (or Ctrl+Enter). Press Tab to hide this window.');
    setTimeout(() => this.panel.editor.focus(), 200);
  }
  private async bossDefeated() {
    audio.sfx('death'); this.glitch = 1; this.post.flash = 0.8; this.consoleP.log('SUCCESS', 'THE WATCHER overwritten. Its eye is closed for good.'); await sleep(1200);
    await this.say('ADMIN', ['That process was mine.', 'Do you know how long I watched through it?', 'Keep going. Everything beyond this door is ROOT. I own ROOT.'], 'admin'); this.hud.toast('EXIT OPEN');
  }
  private async completeLevel() {
    this.busy = true; audio.sfx('checkpoint'); const L = this.level; const w = this.world; story.set('cc_' + L.id, contribution(L, this.appliedState)); if (!story.data.completed.includes(L.id)) story.data.completed.push(L.id);
    story.data.levelIndex = Math.min(this.levelIndex + 1, LEVELS.length - 1); delete story.data.checkpoint[L.id]; story.data.rules[L.id] = this.appliedSrc; story.data.corruption = w.corruption; story.save();
    this.panel.editor.ta.blur(); this.glitch = 1; await sleep(500);
    const mems = L.memories.filter(m => w.collected.has(m.id)).length; const next = this.levelIndex + 1 < LEVELS.length;
    this.overlay.hidden = false; this.overlay.innerHTML = ''; const card = el('div', 'card complete', this.overlay); el('div', 'card-k', card, 'SECTOR COMPLETE'); el('h2', 'glitch-text', card, L.name).dataset.text = L.name;
    el('div', 'card-row', card, `Rule applications: ${story.data.stats.compiles}   ·   Memories: ${mems}/${L.memories.length}   ·   Corruption: ${Math.round(w.corruption)}% ${STAGE_NAMES[this.stage]}`);
    if (!next) el('div', 'card-row', card, 'Beyond this door: ROOT.');
    const b = el('button', 'btn primary', card, next ? 'CONTINUE' : 'ENTER ROOT'); b.focus(); await new Promise<void>(res => b.addEventListener('click', () => res()));
    this.overlay.hidden = true; audio.sfx('click');
    if (next) { await this.loadLevel(this.levelIndex + 1); } else { this.running = false; audio.stopDrone(); this.hooks.onRoot(); }
  }

  // ────────── pause ──────────
  openPause() {
    this.paused = true; this.overlay.hidden = false; this.overlay.innerHTML = ''; const card = el('div', 'card pause', this.overlay); el('div', 'card-k', card, 'SIMULATION PAUSED'); el('h2', '', card, 'PROJECT EDEN');
    const mk = (t: string, fn: () => void, primary = false) => { const b = el('button', 'btn' + (primary ? ' primary' : ''), card, t); b.addEventListener('click', () => { audio.sfx('click'); fn(); }); return b; };
    const first = mk('RESUME', () => this.closePause(), true);
    mk('RESPAWN AT CHECKPOINT', () => { this.closePause(); this.world.integrity = 0; this.world.die(); });
    mk('RESTART SECTOR', () => { this.closePause(); delete story.data.checkpoint[this.level.id]; void this.loadLevel(this.levelIndex, false); });
    mk('SETTINGS', () => { this.overlay.innerHTML = ''; new SettingsPanel(this.overlay, () => this.openPause()); });
    mk('QUIT TO TITLE', () => { this.closePause(); story.save(); this.hide(); this.hooks.onQuit(); });
    first.focus();
    const onKey = (e: KeyboardEvent) => { if (this.overlay.hidden) { removeEventListener('keydown', onKey); return; } if (e.code === 'Escape' && this.paused) { e.preventDefault(); this.closePause(); removeEventListener('keydown', onKey); } }; setTimeout(() => addEventListener('keydown', onKey), 50);
  }
  closePause() { this.paused = false; this.overlay.hidden = true; this.updateBanner(); input.endFrame(); }
  fresh() { return emptySave(); }
  defaults(l: LevelDef): RuleState { return defaultState(l.schema); }
}
