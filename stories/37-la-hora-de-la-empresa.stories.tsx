import { dirtyOf, RecordField, useRecord } from "@sincpro/web-framework";
import { Record, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { A_LAS, CITA, citas, servidorAgenda } from "./support/agenda";
import { Escenario } from "./support/escenario";

const meta: Meta = {
  title: "Casos de uso/37 · La hora de la empresa",
  parameters: {
    docs: {
      description: {
        component:
          'El servidor guarda un **instante** (`2026-03-12T14:30:00Z`); una persona lee y escribe la hora del **lugar del negocio**. Qué lugar es lo dice quien está arriba de las pantallas —la aplicación, la empresa con la que se trabaja—: `SincproApp timeZone` o `FrameworkProvider timeZone` (`"America/La_Paz"`), y sin eso la del navegador. Cada fecha con hora se lee en esa zona y se escribe en ella (`DateTimePicker` de web-ui); lo que viaja vuelve a ser el instante. Un día del calendario (`date`) no tiene zona y nunca se mueve.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function Cita() {
  const cita = useRecord(citas, CITA);
  const dirty = dirtyOf(cita);
  if (cita.status !== "ready") return <Skeleton rows={2} label="Cargando la cita" />;
  return (
    <Record
      identity={{ title: cita.record.title }}
      {...(dirty === undefined ? {} : { dirty })}
    >
      <Record.Paper>
        <div className="grid max-w-md gap-3 p-4">
          <RecordField record={cita} name="at" />
        </div>
      </Record.Paper>
    </Record>
  );
}

function Escena({ zona }: { zona: string }) {
  const [guardado, setGuardado] = useState("—");
  const servidor = useMemo(
    () => servidorAgenda((at) => queueMicrotask(() => setGuardado(at))),
    [],
  );
  return (
    <Escenario tables={servidor.tables} handle={servidor.handle} latency={40} timeZone={zona}>
      <Cita />
      <p aria-label="Lo que se guardó" className="px-4 pb-4 font-mono text-micro text-muted">
        {guardado}
      </p>
    </Escenario>
  );
}

// Intl writes «a. m.» with no-break spaces: compared with them folded to plain ones.
const segmento = (canvas: ReturnType<typeof within>, nombre: RegExp) =>
  (canvas.getByRole("spinbutton", { name: nombre }).textContent ?? "").replace(/\s/g, " ");
const PERIODO = /^a\.\sm\./;

export const EnLaPaz: Story = {
  render: () => <Escena zona="America/La_Paz" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Revisión del contrato" });
    // 14:30 UTC is read as 10:30 a. m. on the wall clock of La Paz.
    await waitFor(() => expect(segmento(canvas, /^hora/)).toBe("10"));
    await expect(segmento(canvas, /^minuto/)).toBe("30");
    await expect(segmento(canvas, PERIODO)).toBe("a. m.");
    // Typed there an hour later, what travels is the instant again: 15:30 UTC.
    await userEvent.click(canvas.getByRole("spinbutton", { name: /^hora/ }));
    await userEvent.keyboard("{ArrowUp}");
    await expect(segmento(canvas, /^hora/)).toBe("11");
    await userEvent.click(await canvas.findByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(canvas.getByLabelText("Lo que se guardó")).toHaveTextContent(
        "2026-03-12T15:30:00.000Z",
      ),
    );
    await expect(A_LAS).toBe("2026-03-12T14:30:00.000Z");
  },
};

export const EnMadrid: Story = {
  render: () => <Escena zona="Europe/Madrid" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Revisión del contrato" });
    // The same instant, from a company in Madrid: 3:30 p. m.
    await waitFor(() => expect(segmento(canvas, /^hora/)).toBe("3"));
    await expect(segmento(canvas, /^minuto/)).toBe("30");
    await expect(segmento(canvas, PERIODO)).toBe("p. m.");
  },
};
