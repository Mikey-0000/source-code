// Fake "system" interruptions that ADMIN throws at you when corruption is high. Purely cosmetic and always dismissible.
import { el, sleep } from '../core/Util';
import { audio } from '../audio/AudioEngine';

const MESSAGES = [
  'ERROR 0x00A1: ENTITY NULL_001 HAS NO PERMISSION TO BE HERE.', 'WARNING: unauthorised process is rewriting reality.hpp', 'ADMIN: you are being observed. Please remain visible.',
  'checksum mismatch in /entities/echo.memory (expected: ALIVE)', 'FATAL: simulation integrity at risk. Continue anyway? (Y/N)', 'ALERT: 1 anomaly. 1 witness. 0 survivors.',
];
export function fakePopup(parent: HTMLElement) {
  const w = el('div', 'fake-popup', parent); w.setAttribute('role', 'alert'); w.style.left = 8 + Math.random() * 52 + '%'; w.style.top = 14 + Math.random() * 50 + '%';
  el('div', 'fp-title', w, 'EDEN OS — simulated dialog'); el('div', 'fp-body', w, MESSAGES[Math.floor(Math.random() * MESSAGES.length)]); el('div', 'fp-note', w, 'This is a fictional window inside the game.');
  const b = el('button', 'btn small', w, 'IGNORE'); const close = () => w.remove(); b.addEventListener('click', close); setTimeout(close, 6500); audio.sfx('error');
}
export async function fakeCrash(parent: HTMLElement) {
  const o = el('div', 'fake-crash', parent); const pre = el('pre', '', o); audio.sfx('glitch');
  const lines = ['*** KERNEL PANIC — PROJECT EDEN ***', '', 'fault: ENTITY NULL_001 exceeded permitted corruption', 'at reality.step (0x00A1F3C0)', 'at physics.apply (0x00A1B772)', 'at admin.watch (0x00000000)', '', '[simulated crash — your progress is safe]', 'restoring simulation from last stable state...'];
  for (const l of lines) { pre.textContent += l + '\n'; audio.sfx('type'); await sleep(110); }
  await sleep(700); o.classList.add('out'); await sleep(350); o.remove();
}
