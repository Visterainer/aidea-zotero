import { fnv1aHex } from "../../utils/hash";
import type { EvidenceRef } from "./document/evidence";
export function fileEvidence(attachment: {
  id?: string;
  name: string;
  textContent?: string;
}): EvidenceRef | undefined {
  if (!attachment.textContent) return undefined;
  const text = attachment.textContent.slice(0, 12000);
  return {
    id: `f${fnv1aHex(`${attachment.name}:${text}`)}`,
    itemId: 0,
    attachmentId: attachment.id,
    title: attachment.name,
    text,
  };
}
