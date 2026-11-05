import { type Contract, type Meta, metaFromContract } from "@sincpro/criteria";

/**
 * A bounded context's client contract, as the application keeps it: the snapshot
 * `sincpro-web generate` writes (`contract.json`), or the document a service serves
 * (`GET /client-contract/<context>.json`). Only its models are read here.
 *
 * Context: the generated entities are keyed `<domain>:<kind>` (`project:issue`) — the key the
 * workspace refers to them by and the meta store keeps their definitions under —, so the rule
 * that turns a model's name into its kind lives once, here, and both the generator and the
 * preload read it.
 */
export type ClientContract = {
  models: Readonly<Record<string, Contract>>;
  $defs?: Readonly<Record<string, Contract>>;
};

/** `ProjectEvent` → `project_event`. */
function kindOf(model: string): string {
  return model
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/** The key of a model's entity: `entityKeyOf("project", "ProjectEvent")` → `"project:project_event"`. */
export function entityKeyOf(domain: string, model: string): string {
  return `${domain}:${kindOf(model)}`;
}

/**
 * The definition of every model of `contract`, by its entity's key — what `FrameworkProvider
 * metas` preloads, so the first screen draws its labels with no request at all. The transport
 * still reads the live definition and asks again when an answer says another version.
 *
 *     <FrameworkProvider transport={transport} metas={metasOf(contract, "project")}>
 */
export function metasOf(contract: ClientContract, domain: string): Record<string, Meta> {
  // A related model, or a value a record holds, is pointed at by its name (`#/models/Run`).
  const related = { ...(contract.$defs ?? {}), ...contract.models };
  return Object.fromEntries(
    Object.entries(contract.models)
      // Only an entity has a key of its own; a value it holds is described inside it.
      .filter(([, model]) => model["x-sincpro"]?.identity != null)
      .map(([name, model]) => [entityKeyOf(domain, name), metaFromContract(model, related)]),
  );
}
