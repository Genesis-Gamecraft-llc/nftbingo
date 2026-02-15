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

    entriesCount: pots.entriesCount,
    totalPotSol: pots.totalPotSol,
    playerPotSol: pots.playerPotSol,
    foundersPotSol: pots.foundersPotSol,
    foundersBonusSol: pots.foundersBonusSol,
    jackpotSol: pots.jackpotSol,

    progressiveJackpotSol: state.progressiveJackpotSol || 0,
    currentGameJackpotSol: pots.currentGameJackpotSol,

    claimWindowEndsAt: state.claimWindowEndsAt ?? null,
    lastClaim: state.lastClaim ?? null,

    my: wallet
      ? (() => {
          const entry = (state.entries || []).find((e) => e.wallet === wallet);
          return entry
            ? {
                enteredCardIds: entry.cardIds || [],
                lastSig: entry.signature || "",
                lastTotalSol: typeof entry.totalSol === "number" ? entry.totalSol : 0,
              }
            : { enteredCardIds: [] as string[] };
        })()
      : undefined,
  };
}
