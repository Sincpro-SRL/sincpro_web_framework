import "./storybook.css";

import { installComposerCopy, SPANISH_COMPOSER_COPY } from "@sincpro/web-composer";
import { installFrameworkCopy, SPANISH_FRAMEWORK_COPY } from "@sincpro/web-framework";
import { installCopy, isTheme, SPANISH_COPY, ThemeProvider } from "@sincpro/web-ui";
import type { Preview } from "@storybook/react-vite";
import { createElement } from "react";

/* Stories read in Spanish, with the tables an application installs. */
installCopy(SPANISH_COPY);
installComposerCopy(SPANISH_COMPOSER_COPY);
installFrameworkCopy(SPANISH_FRAMEWORK_COPY);

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    /* Reported in the a11y panel, not a failure: what the stories draw is web-ui's, and its
       a11y bugs (the search bar's input loses its name once a chip is put) are fixed there,
       not here — see docs/ROADMAP.md. */
    a11y: { test: "todo" },
    controls: { expanded: true },
  },
  globalTypes: {
    theme: {
      description: "Tema de color",
      toolbar: {
        title: "Tema",
        icon: "circlehollow",
        dynamicTitle: true,
        items: [
          { value: "light", title: "Claro" },
          { value: "dark", title: "Oscuro" },
          { value: "system", title: "Sistema" },
        ],
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (Story, context) => {
      const chosen: unknown = context.globals["theme"];
      return createElement(
        ThemeProvider,
        { value: isTheme(chosen) ? chosen : "light" },
        createElement(Story),
      );
    },
  ],
};

export default preview;
