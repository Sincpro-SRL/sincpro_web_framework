"use client";

import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { explain } from "@sincpro/web-framework/core/explain";
import { Button, Failed } from "@sincpro/web-ui";

/**
 * A failure in the application's words: the copy table's heading for its kind, what the server
 * said happened, and what to do (`explain`). Retry only when retrying can help: a «you have no
 * access» with a retry button is a button that lies.
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
