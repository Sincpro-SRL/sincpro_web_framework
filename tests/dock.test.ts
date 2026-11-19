import assert from "node:assert/strict";

import { actionsOf } from "@sincpro/web-framework";
import { createElement } from "react";
import { test } from "vitest";

test("a screen's actions as data go to the dock; drawn by hand, where they are put", () => {
  const exportar = { id: "export", label: "Exportar", onSelect: () => {} };
  assert.deepEqual(actionsOf([exportar]), { dock: [exportar], drawn: null });
  // Nothing given is no actions, not a node.
  assert.deepEqual(actionsOf(undefined), { dock: [], drawn: null });
  assert.deepEqual(actionsOf(false), { dock: [], drawn: null });
  assert.deepEqual(actionsOf([]), { dock: [], drawn: null });
  // A node — one, or a list of them — is drawn by hand.
  const boton = createElement("button", null, "Importar");
  assert.deepEqual(actionsOf(boton), { dock: [], drawn: boton });
  assert.deepEqual(actionsOf([boton]), { dock: [], drawn: [boton] });
  assert.deepEqual(actionsOf("Importar"), { dock: [], drawn: "Importar" });
});
