import { derivePots, GameState } from "./_store";

export async function buildStateResponse(state: GameState, wallet?: string) {
  const pots = derivePots(state);

  let my:
    | {
        enteredCardIds: string[];
        lastSig?: string;
        lastTotalSol?: number;
      }
    | undefined = undefined;

  if (wallet) {
    const normalized = String(wallet);
    const myEntry = state.entries.find((e) => e.wallet === normalized);
    my = {
      enteredCardIds: myEntry?.cardIds || [],
      lastSig: myEntry?.signature,
      lastTotalSol: myEntry?.totalSol,
    };
  }

  return {
    ok: true,
    gameId: state.gameId,
    gameNumber: state.gameNumber,
    gameType: state.gameType,
    status: state.status,
    entryFeeSol: state.entryFeeSol,
    calledNumbers: state.calledNumbers,
    winners: state.winners,
    ...pots,
    ...(my ? { my } : {}),
  };
}
