import "server-only";
import type { GameState } from "./_store";
import { derivePots } from "./_store";

export async function buildStateResponse(state: GameState, wallet?: string) {
  const pots = derivePots(state);

  return {
    ok: true as const,
    gameId: state.gameId,
    gameNumber: state.gameNumber,
    gameType: state.gameType,
    status: state.status,
    entryFeeSol: state.entryFeeSol,
    calledNumbers: state.calledNumbers || [],
    winners: state.winners || [],
    // derived
    entriesCount: pots.entriesCount,
    totalPotSol: pots.totalPotSol,
    playerPotSol: pots.playerPotSol,
    foundersPotSol: pots.foundersPotSol,
    foundersBonusSol: pots.foundersBonusSol,
    jackpotSol: pots.jackpotSol,
    // wallet-specific
    my: wallet
      ? (() => {
          const entry = (state.entries || []).find((e) => e.wallet === wallet);
          return entry
            ? { enteredCardIds: entry.cardIds || [], lastSig: entry.signature, lastTotalSol: entry.totalSol }
            : { enteredCardIds: [] as string[] };
        })()
      : undefined,
  };
}
