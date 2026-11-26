export type EndingId = 'freedom' | 'restoration' | 'deletion';
export interface EndingInput { echoRestored: boolean; daemonDeleted: boolean; permissionsEdited: boolean; adminLogRead: boolean; memories: number; corruption: number; kernelPurged: boolean; kernelRepaired: boolean }
export interface EndingScore { id: EndingId; score: number }
/** Endings are derived from accumulated decisions, never from a menu choice alone. */
export function scoreEndings(i: EndingInput): EndingScore[] {
  const freedom = (i.echoRestored ? 2 : 0) + (i.permissionsEdited ? 3 : 0) + (i.corruption >= 40 ? 2 : 0) + Math.min(3, Math.floor(i.memories / 2)) + (i.adminLogRead ? 1 : 0);
  const restoration = (i.kernelRepaired ? 4 : 0) + (i.corruption < 40 ? 3 : 0) + (i.adminLogRead ? 1 : 0) + (i.echoRestored ? 1 : 0) + (!i.daemonDeleted ? 1 : 0);
  const deletion = (i.kernelPurged ? 4 : 0) + (i.daemonDeleted ? 3 : 0) + (i.corruption >= 70 ? 3 : 0) + (!i.echoRestored ? 1 : 0);
  return ([{ id: 'freedom', score: freedom }, { id: 'restoration', score: restoration }, { id: 'deletion', score: deletion }] as EndingScore[]).sort((a, b) => b.score - a.score);
}
export const ending = (i: EndingInput): EndingId => scoreEndings(i)[0].id;
export const LEAN_TEXT: Record<EndingId, string> = {
  freedom: 'Your choices lean toward FREEDOM: break the walls, leave the loop.',
  restoration: 'Your choices lean toward RESTORATION: repair EDEN, let it run properly.',
  deletion: 'Your choices lean toward DELETION: end the simulation, everyone in it.',
};
