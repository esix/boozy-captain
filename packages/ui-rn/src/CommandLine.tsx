import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { tcTheme } from "./theme.js";

export interface CommandLineProps {
  /** Prompt prefix, e.g. the active panel's current path. */
  prompt: string;
  /** Called when Enter is pressed. */
  onSubmit?: (cmd: string) => void;
}

/**
 * TC-style command line. Visual only for now — submit pushes the entry into
 * history and clears the input. A real shell runner lands later.
 */
export function CommandLine({ prompt, onSubmit }: CommandLineProps): JSX.Element {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number | null>(null);

  const submit = (): void => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    setHistory((h) => [trimmed, ...h]);
    setHistoryIdx(null);
    setValue("");
    onSubmit?.(trimmed);
  };

  return (
    <View style={styles.row} testID="bc-cmdline">
      <Text style={styles.prompt} numberOfLines={1} testID="bc-cmdline-prompt">
        {prompt}{">"}
      </Text>
      <TextInput
        testID="bc-cmdline-input"
        style={styles.input}
        value={value}
        onChangeText={(t: string) => {
          setValue(t);
          setHistoryIdx(null);
        }}
        onSubmitEditing={submit}
        onKeyPress={(e: { nativeEvent: { key: string } }) => {
          const k = e.nativeEvent.key;
          if (k === "ArrowUp") {
            setHistoryIdx((i) => {
              const next = i === null ? 0 : Math.min(i + 1, history.length - 1);
              const item = history[next];
              if (item !== undefined) setValue(item);
              return next;
            });
          } else if (k === "ArrowDown") {
            setHistoryIdx((i) => {
              if (i === null) return null;
              const next = i - 1;
              if (next < 0) {
                setValue("");
                return null;
              }
              const item = history[next];
              if (item !== undefined) setValue(item);
              return next;
            });
          }
        }}
        autoCorrect={false}
        spellCheck={false}
        blurOnSubmit={false}
        placeholder=""
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tcTheme.color.cmdLineBg,
    borderTopWidth: 1,
    borderTopColor: tcTheme.color.chromeBorder,
    paddingHorizontal: 4,
    paddingVertical: 2,
    minHeight: 24,
  },
  prompt: {
    color: tcTheme.color.cmdLinePrompt,
    fontFamily: tcTheme.font.mono,
    fontSize: tcTheme.font.sizeSmall,
    marginRight: 4,
    flexShrink: 1,
  },
  input: {
    flex: 1,
    color: tcTheme.color.cmdLineText,
    fontFamily: tcTheme.font.mono,
    fontSize: tcTheme.font.sizeSmall,
    paddingVertical: 0,
    paddingHorizontal: 0,
    outlineWidth: 0,
  } as object,
});
