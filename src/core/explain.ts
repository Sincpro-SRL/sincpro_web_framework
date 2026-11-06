import { TransportError } from "@sincpro/client-framework";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";

/**
 * What a person reads about a failure: a heading, and a sentence with what happened and what
 * to do. The server's own words first; the copy table's when it sent none.
 *
 *     explain(new TransportError("/x", 403, { kind: "permission_denied", guidance: "Pedí acceso.", … }))
 *       -> { heading: "No tenés acceso", sentence: "Pedí acceso.", retryable: false }
 *
 * Context: the transport is @sincpro/client-framework's and speaks no language; how a refusal
 * reads on a screen is the web's, with the words of its copy table.
 */
export function explain(error: unknown): {
  heading: string;
  sentence: string;
  retryable: boolean;
} {
  const copy = frameworkCopy().failure;
  if (error instanceof TransportError && error.problem !== null) {
    const { kind, title, detail, guidance, retryable } = error.problem;
    return {
      heading: title ?? copy.kind[kind] ?? copy.status(error.status ?? 0),
      sentence: [detail, guidance].filter(Boolean).join(" "),
      retryable,
    };
  }
  if (error instanceof TransportError && error.status !== null)
    return { heading: copy.status(error.status), sentence: error.message, retryable: true };
  return {
    heading: copy.unreachable,
    sentence: error instanceof Error ? error.message : String(error),
    retryable: true,
  };
}
