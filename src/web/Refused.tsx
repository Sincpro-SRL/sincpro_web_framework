"use client";

import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { explain } from "@sincpro/web-framework/core/transport";
import { Button, Failed } from "@sincpro/web-ui";

/**
 * A failure, said the way the server said it: its title, what happened and what to do —
 * `guidance` included, which is the part a person acts on. Retry only when retrying can help:
 * a «you have no access» with a retry button is a button that lies.
 */
export function Refused({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { heading, sentence, retryable } = explain(error);
  return (
    <Failed
      heading={heading}
      sentence={sentence}
      action={
        onRetry !== undefined && retryable ? (
          <Button size="sm" role="secondary" onClick={onRetry}>
            {frameworkCopy().failure.retry}
          </Button>
        ) : undefined
      }
    />
  );
}
