import assert from "node:assert/strict";

import { defineMeta, field } from "@sincpro/client-framework";
import {
  attachmentOf,
  defaultFields,
  holdsFile,
  installFrameworkCopy,
  renditionUrl,
  SPANISH_FRAMEWORK_COPY,
  storedFileOf,
  textOf,
} from "@sincpro/web-framework";
import { test } from "vitest";

installFrameworkCopy(SPANISH_FRAMEWORK_COPY);

/**
 * Context: a file a record holds, as sincpro_framework answers its `StoredFile` — drawn by its
 * widget (`file`, `image`) as ONE value: its name, never its storage key nor its JSON; its
 * `thumb` rendition as the thumbnail a list loads.
 */

const archivoMeta = defineMeta({
  aggregate: "StoredFile",
  identity: "key",
  fields: { key: field.text(), name: field.text(), content_type: field.text() },
});

const organoMeta = defineMeta({
  aggregate: "Organo",
  identity: "id",
  fields: {
    id: field.text(),
    nombre: field.text(),
    foto: { ...field.embedded(archivoMeta, { nullable: true }), widget: "image" },
    recibo: field.embedded(archivoMeta, { nullable: true }),
  },
});

const FOTO = {
  key: "publico/contenido/01a1ece4998f.jpg",
  name: "Directorio 2026.jpg",
  content_type: "image/jpeg",
  size: 412_000,
  url: "/files/cHVibGljbw.1763600400.Zk3",
  renditions: [
    {
      name: "thumb",
      key: "publico/contenido/01a1ece4998f@thumb.webp",
      content_type: "image/webp",
      size: 9_800,
      width: 320,
      height: 240,
      url: "/files/dGh1bWI.1763600400.Ab1",
    },
  ],
};

test("a field holds a file by its widget, file or image — not by being embedded", () => {
  assert.equal(holdsFile(organoMeta.fields["foto"]), true);
  assert.equal(holdsFile({ widget: "file" }), true);
  assert.equal(holdsFile(organoMeta.fields["recibo"]), false);
  assert.equal(holdsFile(undefined), false);
});

test("a stored file reads as the name it was sent with, never its key nor its JSON", () => {
  assert.equal(textOf(organoMeta, "foto", FOTO, "es"), "Directorio 2026.jpg");
  assert.equal(textOf(organoMeta, "foto", null, "es"), null);
  assert.equal(storedFileOf("publico/contenido/01a1ece4998f.jpg"), null);
});

test("a list shows its files among its columns; other value objects stay a section", () => {
  assert.deepEqual(defaultFields(organoMeta), ["id", "nombre", "foto"]);
});

test("its thumbnail is the thumb rendition, else the original", () => {
  assert.equal(renditionUrl(FOTO, "thumb"), "/files/dGh1bWI.1763600400.Ab1");
  assert.equal(renditionUrl(FOTO, "view"), FOTO.url);
  assert.deepEqual(attachmentOf(FOTO), {
    id: FOTO.key,
    name: "Directorio 2026.jpg",
    type: "image/jpeg",
    size: 412_000,
    url: FOTO.url,
    thumbnail: "/files/dGh1bWI.1763600400.Ab1",
  });
  assert.equal(attachmentOf(undefined), null);
});
