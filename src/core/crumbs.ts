/**
 * A crumb says only what is its OWN.
 *
 * Context: a view names itself whole so its tab stands alone in the workspace — «Pagos · María
 * Fernanda Apaza Quispe» —, and the trail takes that name: `Pagos › María Fernanda Apaza Quispe ›
 * Pagos · María Fernanda Apaza Quispe`. The crumb before already says whose; the last one wrapped
 * onto a second line to say it again. Under its parent, a crumb drops the parent's name and the
 * joint that held it («·», «:», «—», «de», «of»…) — «Pagos» —, and is left whole when the parent's
 * name is not in it or is all of it.
 */
const JOINT =
  /^(?:[\s·:—–|/-]|de\b|del\b|of\b|for\b|para\b)+|(?:[\s·:—–|/-]|\bde|\bdel|\bof|\bfor|\bpara)+$/giu;

export function ownLabel(label: string, parent: string | undefined): string {
  const before = parent?.trim();
  if (before === undefined || before === "" || !label.includes(before)) return label;
  const own = label.replace(before, "").replace(JOINT, "").trim();
  return own === "" ? label : own;
}

export function ownCrumbs<C extends { label: string }>(crumbs: readonly C[]): C[] {
  return crumbs.map((crumb, at) => {
    const own = ownLabel(crumb.label, crumbs[at - 1]?.label);
    return own === crumb.label ? crumb : { ...crumb, label: own };
  });
}
