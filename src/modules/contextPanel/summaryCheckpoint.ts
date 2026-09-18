import type { SummaryCheckpoint } from "./document/evidence";

/** Prefix identity, not message count, makes edited/sibling histories distinct. */
export function checkpointMatches(
  checkpoint: SummaryCheckpoint | undefined,
  ids: number[],
): checkpoint is SummaryCheckpoint {
  return Boolean(
    checkpoint?.coveredMessageIds.length &&
    checkpoint.coveredMessageIds.length <= ids.length &&
    checkpoint.coveredMessageIds.every((id, index) => id === ids[index]),
  );
}
