import "server-only";
import type { GameState } from "./_store";

export async function buildStateResponse(state: GameState, wallet?: string) {
  return { ok: true, state, wallet: wallet || null };
}
