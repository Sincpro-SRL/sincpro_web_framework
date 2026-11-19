import { waitFor, within } from "storybook/test";

/** «Abrir en…» of the row that names this record: among the row's ways in in a table (web-ui
 *  2.10), beside the name in the rows face. The name may also be a heading or a crumb: the row
 *  is the one of its places that offers «Abrir en…». */
export async function abrirEn(
  canvasElement: HTMLElement,
  name: string,
): Promise<HTMLElement> {
  const canvas = within(canvasElement);
  return waitFor(() => {
    for (const found of canvas.getAllByText(name)) {
      const row = found.closest<HTMLElement>("tr, [data-slot='row']");
      const button =
        row === null ? null : within(row).queryByRole("button", { name: /^Abrir en…/ });
      if (button !== null) return button;
    }
    throw new Error(`no row of «${name}» offers «Abrir en…»`);
  });
}
