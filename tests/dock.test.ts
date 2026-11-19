import assert from "node:assert/strict";

import { actionsOf } from "@sincpro/web-framework";
import { dockedOf } from "@sincpro/web-framework/web/record/dock";
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

test("an action's gesture as a dock's action: its look as given, off while it runs", () => {
  const gesture = { start: () => {}, busy: false, dialog: null };
  // What the screen left out is not written; its id is its label unless it says one.
  const { action } = dockedOf(gesture, "Aprobar", { primary: true, icon: undefined });
  assert.deepEqual(Object.keys(action).sort(), [
    "disabled",
    "id",
    "label",
    "onSelect",
    "primary",
  ]);
  assert.equal(action.id, "Aprobar");
  assert.equal(action.onSelect, gesture.start);
  assert.equal(dockedOf(gesture, "Eliminar", { id: "delete" }).action.id, "delete");
  // Running, it is not offered again; the screen may turn it off too.
  assert.equal(dockedOf({ ...gesture, busy: true }, "Aprobar", {}).action.disabled, true);
  assert.equal(dockedOf(gesture, "Aprobar", {}, true).action.disabled, true);
});
