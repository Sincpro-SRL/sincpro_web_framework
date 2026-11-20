import { configureProcess } from "@sincpro/client-framework";
import { memoryReporter } from "@sincpro/client-framework/testing";
import { RouteError } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Component, type ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

const meta: Meta = {
  title: "Casos de uso/69 · Una página que se rompió",
  parameters: {
    docs: {
      description: {
        component:
          "Una página que se rompe al dibujarse —en el servidor o en el navegador— no muestra la página genérica del framework de la aplicación (Next, TanStack Start, React Router): muestra `RouteError`, con palabras simples, **el código con que el servidor lo anotó** (el `digest` de Next: lo que la persona dicta es lo que soporte busca en los logs), «Intentar de nuevo» y «Volver al inicio». Se reporta **una vez**, por el proceso (`reportError`), con el nombre de la zona donde pasó. El mensaje técnico nunca se dibuja. La frontera de error es del framework de la aplicación; `RouteError` sólo recibe lo que ella le da (`error`, `reset`).",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** Where the application's process reports: kept, so the play reads what was reported. */
const reported = memoryReporter();

/** What a route's error boundary does — Next's `error.tsx`, TanStack's `errorComponent`: on a
 *  failure it draws the screen it is given, and `reset` draws the page again. */
class Boundary extends Component<
  { children: ReactNode; screen: (error: unknown, reset: () => void) => ReactNode },
  { failed: boolean; error: unknown }
> {
  state = { failed: false, error: undefined as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { failed: true, error };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return this.props.screen(this.state.error, () =>
      this.setState({ failed: false, error: undefined }),
    );
  }
}

/** The failure, as Next hands a server render's to the browser: its message and its digest. */
let broke: Error = new Error();
/** Whether the page still fails: a server down, a read that answered what the page did not expect. */
let broken = true;

function Cursos() {
  if (broken) throw broke;
  return <h1>Próximos cursos</h1>;
}

export const SeRompioAlDibujar: Story = {
  beforeEach: () => {
    broke = Object.assign(new Error("Cannot read properties of undefined (reading 'next')"), {
      digest: "2817364509",
    });
    broken = true;
    reported.reports.splice(0);
    configureProcess({ reporter: reported });
    return () => configureProcess();
  },
  render: () => (
    <Boundary
      screen={(error, reset) => (
        <RouteError error={error} reset={reset} where="sitio" home="/" />
      )}
    >
      <Cursos />
    </Boundary>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("Algo salió mal al mostrar esta página"),
    ).toBeVisible();
    // The code the server logged it with — never the message, which is the system's.
    await expect(canvas.getByText("Código: 2817364509")).toBeVisible();
    await expect(canvas.queryByText(/Cannot read properties/)).toBeNull();
    await expect(canvas.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute(
      "href",
      "/",
    );
    // Reported once, under the zone it broke in.
    await waitFor(() => expect(reported.reports).toHaveLength(1));
    await expect(reported.reports[0]?.error).toBe(broke);
    await expect(reported.reports[0]?.about.useCase).toBe("sitio");

    // What failed passed (the server is back): «Intentar de nuevo» draws the page again.
    broken = false;
    await userEvent.click(canvas.getByRole("button", { name: "Intentar de nuevo" }));
    await expect(
      await canvas.findByRole("heading", { name: "Próximos cursos" }),
    ).toBeVisible();
    await expect(reported.reports).toHaveLength(1);
  },
};

/** A failure in the browser, outside any server render: no digest. */
let suelto: Error = new Error();

export const SinCodigoNiSalida: Story = {
  beforeEach: () => {
    suelto = new Error("Failed to fetch dynamically imported module");
    reported.reports.splice(0);
    configureProcess({ reporter: reported });
    return () => configureProcess();
  },
  render: () => <RouteError error={suelto} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("Algo salió mal al mostrar esta página"),
    ).toBeVisible();
    // Without a digest there is no code to quote; without `reset` or `home`, nothing to press
    // but web-ui's «Copiar el error».
    await expect(canvas.queryByText(/Código/)).toBeNull();
    await expect(canvas.queryByRole("button", { name: "Intentar de nuevo" })).toBeNull();
    await expect(canvas.queryByRole("link", { name: "Volver al inicio" })).toBeNull();
    await waitFor(() => expect(reported.reports).toHaveLength(1));
    await expect(reported.reports[0]?.about.useCase).toBe("route");
  },
};
