/**
 * TC-style theme. Modeled on Total Commander's classic light Windows look
 * with the user's defaults (UseNewDefFont=1, DirBrackets=1, no custom colors).
 *
 * Lives in its own package so `@bc/file-list` and `@bc/ui-rn` can both consume
 * it without a circular dependency.
 */
export const tcTheme = {
  font: {
    ui: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
    mono: 'Consolas, "Cascadia Mono", "Courier New", monospace',
    size: 13,
    sizeSmall: 12,
  },
  color: {
    panelBg: "#FFFFFF",
    panelBorder: "#ABABAB",
    panelBorderFocused: "#0078D7",

    text: "#000000",
    textDim: "#606060",
    textDir: "#000000",
    textMarked: "#C00000",

    cursorBg: "#0078D7",
    cursorText: "#FFFFFF",
    // Inactive cursor is a noticeable grey so it doesn't blend with the light-blue header.
    cursorBgInactive: "#B8B8B8",
    cursorTextInactive: "#000000",

    headerBg: "#E5EFFE",
    headerText: "#000000",
    headerBorder: "#C0C0C0",

    chromeBg: "#F0F0F0",
    chromeBorder: "#C0C0C0",

    fbarBg: "#F0F0F0",
    fbarButtonBg: "#F0F0F0",
    fbarButtonBgHover: "#E5F1FB",
    fbarButtonBorder: "#C0C0C0",
    fbarKeyText: "#0050A0",
    fbarLabelText: "#000000",

    cmdLineBg: "#FFFFFF",
    cmdLineBorder: "#7A7A7A",
    cmdLineText: "#000000",
    cmdLinePrompt: "#606060",
  },
} as const;

export type TcTheme = typeof tcTheme;
