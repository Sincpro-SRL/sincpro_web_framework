import { renditionUrl, storedFileOf } from "@sincpro/web-framework/core/files";
import type { AttachmentFile } from "@sincpro/web-ui";

/**
 * A stored file as web-ui draws one (`AttachmentFile`): its name, type and size, its link, and
 * the `thumb` rendition as its thumbnail — so a list of fifty photos loads fifty thumbnails.
 * `null` when the value is no file.
 *
 *     attachmentOf(organo.foto)   -> { id: "fotos/01a1e.jpg", name: "Directorio.jpg", url, thumbnail }
 */
export function attachmentOf(value: unknown): AttachmentFile | null {
  const file = storedFileOf(value);
  if (file === null) return null;
  const thumbnail = renditionUrl(file, "thumb");
  return {
    id: file.key,
    name: file.name,
    type: file.content_type,
    size: file.size,
    ...(file.url === undefined ? {} : { url: file.url }),
    ...(thumbnail === undefined ? {} : { thumbnail }),
  };
}
