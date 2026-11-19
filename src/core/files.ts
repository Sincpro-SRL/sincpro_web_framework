/**
 * A file a record holds — sincpro_framework's `StoredFile`, as a read answers it: its name as it
 * was sent, its type, its size, a link to see it (`url`), and for a picture its renditions,
 * `thumb` for a list's line and `view` for a record.
 *
 *     holdsFile(meta.fields.foto)                          -> true     (widget "image" or "file")
 *     storedFileOf({ key: "fotos/01a1e.jpg", name: "Directorio.jpg", … })   -> StoredFileValue
 *     storedFileOf("fotos/01a1e.jpg")                      -> null     (a bare key names nothing)
 *     renditionUrl(foto, "thumb")                          -> "/files/cGhv…"   (else the original's)
 *
 * Context: the model publishes such a field as `embedded` with the widget `file` — or `image`,
 * by its presentation —; read as any embedded value it was a section of its parts (key, name,
 * type…) and a list's cell its JSON. Drawn by its widget it is ONE value: the picture and the
 * name it was sent with, the name downloading it (web-ui's `FileValue`).
 */

/** A rendition of a stored picture, as answered. */
export type RenditionValue = {
  name: string;
  key: string;
  content_type: string;
  size: number;
  width: number;
  height: number;
  url?: string;
};

/** A stored file, as answered. */
export type StoredFileValue = {
  key: string;
  name: string;
  content_type: string;
  size: number;
  width?: number | null;
  height?: number | null;
  url?: string;
  renditions?: readonly RenditionValue[];
};

/** The widgets that draw a field as one file: sincpro_framework's `Widget.FILE` / `IMAGE`. */
export const FILE_WIDGETS: ReadonlySet<string> = new Set(["file", "image"]);

/** Whether a field holds a file — drawn as one value, by its widget. */
export function holdsFile(
  field: { widget?: string | undefined } | null | undefined,
): boolean {
  return field?.widget !== undefined && FILE_WIDGETS.has(field.widget);
}

/** The stored file a value is — `null` for nothing, or for anything that is not one. */
export function storedFileOf(value: unknown): StoredFileValue | null {
  if (typeof value !== "object" || value === null) return null;
  const held = value as Partial<StoredFileValue>;
  return typeof held.key === "string" && typeof held.name === "string"
    ? (held as StoredFileValue)
    : null;
}

/** Where to see the rendition `name` of a stored picture — the original's link when it has
 *  none (a file put whole, a picture smaller than the rendition). */
export function renditionUrl(file: StoredFileValue, name: string): string | undefined {
  return file.renditions?.find((one) => one.name === name)?.url ?? file.url;
}
