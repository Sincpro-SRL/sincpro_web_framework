"use client";

import {
  dayTextOf,
  instantTextOf,
  moneyTextOf,
  numberTextOf,
} from "@sincpro/web-framework/core/present";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useMemo } from "react";

/** What a value a screen holds reads as — each `null` when there is nothing to read. */
export type ValueTexts = {
  number: (value: unknown) => string | null;
  day: (value: unknown) => string | null;
  instant: (value: unknown) => string | null;
  money: (value: unknown) => string | null;
};

/**
 * The texts of `numberTextOf`, `dayTextOf`, `instantTextOf` and `moneyTextOf`, in the
 * provider's locale and on the zone it installed — for what a screen of its own holds outside a
 * model: a total it added up, a balance a use case answered.
 *
 *     const text = useTextOf();
 *     <Stat label="Saldo" value={text.money(balance) ?? "—"} />
 */
export function useTextOf(): ValueTexts {
  const { locale } = useFramework();
  return useMemo(
    () => ({
      number: (value) => numberTextOf(value, locale),
      day: (value) => dayTextOf(value, locale),
      instant: (value) => instantTextOf(value, locale),
      money: (value) => moneyTextOf(value, locale),
    }),
    [locale],
  );
}
