import { TransportError } from "@sincpro/client-framework";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";

/**
 * What a person reads about a failure: a heading, and a sentence with what happened and what
 * to do. The heading is the client's word for the kind of failure; the sentence is what the
 * server said happened (`detail`) and what to do next — the copy table's for a kind whose next
 * step is always the same, the server's `guidance` for one only the use case knows (`invalid`,
 * `domain`).
 *
 *     explain(new TransportError("/x", 403, { kind: "permission_denied", detail: "No es tu pago.", … }))
 *       -> { heading: "No tenés acceso", sentence: "No es tu pago. Pedí acceso a quien lo administra.",
 *            retryable: false }
 *
 * Context: the transport is @sincpro/client-framework's and speaks no language; how a refusal
 * reads on a screen is the web's, with the words of its copy table. The server's `title` is one
 * per kind and English until the language travels at the edge (sincpro_framework #190), and its
 * default `guidance` too — so the heading and the generic next step are the copy's, and the
 * server's words are kept where only it knows them: what happened, and how to fix a refusal of
 * its own. quipu drew its own box because the server's English headed every refusal.
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
      heading: copy.kind[kind] ?? title ?? copy.status(error.status ?? 0),
      sentence: [detail, copy.next[kind] ?? guidance].filter(Boolean).join(" "),
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
