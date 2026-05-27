import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Uri, VfsRegistry } from "@bc/vfs";
import { tcTheme } from "./theme.js";

/** Cap how much we pull into memory — the lister is a viewer, not a loader. */
const MAX_BYTES = 1024 * 1024; // 1 MiB
/** Hex view is line-structured; cap it tighter so layout stays snappy. */
const HEX_LIMIT = 64 * 1024; // 64 KiB

export type ListerMode = "text" | "hex";

export interface ListerProps {
  vfs: VfsRegistry;
  uri: Uri;
  name: string;
  onClose?: () => void;
  testID?: string;
}

interface LoadState {
  status: "loading" | "ready" | "error";
  bytes: Uint8Array | null;
  truncated: boolean;
  error: string | null;
}

/**
 * TC-style file viewer (F3). Streams up to MAX_BYTES via vfs.read(), then shows
 * UTF-8 text or a hex dump. Rendered as surface content, so the host decides
 * whether it's a modal, a floating window, etc. — the viewer is unaware.
 */
export function Lister({ vfs, uri, name, onClose, testID = "bc-lister" }: ListerProps): JSX.Element {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    bytes: null,
    truncated: false,
    error: null,
  });
  const [mode, setMode] = useState<ListerMode>("text");

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", bytes: null, truncated: false, error: null });
    (async () => {
      try {
        const reader = vfs.read(uri).getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        let truncated = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (cancelled) {
            await reader.cancel();
            return;
          }
          chunks.push(value);
          total += value.length;
          if (total >= MAX_BYTES) {
            truncated = true;
            await reader.cancel();
            break;
          }
        }
        const size = Math.min(total, MAX_BYTES);
        const buf = new Uint8Array(size);
        let off = 0;
        for (const c of chunks) {
          if (off >= size) break;
          const slice = c.length > size - off ? c.subarray(0, size - off) : c;
          buf.set(slice, off);
          off += slice.length;
        }
        if (!cancelled) setState({ status: "ready", bytes: buf, truncated, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            bytes: null,
            truncated: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vfs, uri]);

  const text = useMemo(
    () => (state.bytes ? new TextDecoder("utf-8", { fatal: false }).decode(state.bytes) : ""),
    [state.bytes],
  );
  const hex = useMemo(() => (state.bytes ? hexDump(state.bytes, HEX_LIMIT) : ""), [state.bytes]);
  const hexClipped = mode === "hex" && state.bytes !== null && state.bytes.length > HEX_LIMIT;

  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.toolbar}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.spacer} />
        {state.bytes ? (
          <Text style={styles.meta}>
            {formatBytes(state.bytes.length)}
            {state.truncated ? " (truncated)" : ""}
          </Text>
        ) : null}
        <ModeButton label="Text" active={mode === "text"} onPress={() => setMode("text")} testID={`${testID}-mode-text`} />
        <ModeButton label="Hex" active={mode === "hex"} onPress={() => setMode("hex")} testID={`${testID}-mode-hex`} />
        {onClose ? (
          <Pressable onPress={onClose} style={styles.closeBtn} testID={`${testID}-close`} {...nonFocusable}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.contentArea}>
        {state.status === "loading" ? (
          <Text style={styles.status}>Reading…</Text>
        ) : state.status === "error" ? (
          <Text style={styles.error}>Error: {state.error}</Text>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} testID={`${testID}-scroll`}>
            <Text style={styles.body} selectable>
              {mode === "text" ? text : hex}
            </Text>
            {hexClipped ? <Text style={styles.status}>… hex view limited to first {formatBytes(HEX_LIMIT)}</Text> : null}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function ModeButton({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}): JSX.Element {
  return (
    <Pressable onPress={onPress} style={[styles.modeBtn, active && styles.modeBtnActive]} testID={testID} {...nonFocusable}>
      <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
    </Pressable>
  );
}

function hexDump(bytes: Uint8Array, limit: number): string {
  const n = Math.min(bytes.length, limit);
  const lines: string[] = [];
  for (let i = 0; i < n; i += 16) {
    const end = Math.min(i + 16, n);
    let hexPart = "";
    let ascii = "";
    for (let j = i; j < i + 16; j++) {
      if (j < end) {
        const b = bytes[j]!;
        hexPart += b.toString(16).padStart(2, "0") + " ";
        ascii += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".";
      } else {
        hexPart += "   ";
      }
      if (j === i + 7) hexPart += " ";
    }
    lines.push(`${i.toString(16).padStart(8, "0")}  ${hexPart} ${ascii}`);
  }
  return lines.join("\n");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(1)} MiB`;
}

const nonFocusable = {
  tabIndex: -1,
  onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
} as unknown as object;

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "column", minHeight: 0 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: tcTheme.color.chromeBorder,
    marginBottom: 6,
  },
  name: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
    fontWeight: "600",
    flexShrink: 1,
  },
  spacer: { flex: 1 },
  meta: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
    marginRight: 10,
  },
  modeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: tcTheme.color.chromeBorder,
    backgroundColor: tcTheme.color.fbarButtonBg,
    marginLeft: 4,
  },
  modeBtnActive: { backgroundColor: tcTheme.color.cursorBg, borderColor: tcTheme.color.cursorBorder },
  modeText: { color: tcTheme.color.text, fontFamily: tcTheme.font.ui, fontSize: tcTheme.font.sizeSmall },
  modeTextActive: { fontWeight: "600" },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: tcTheme.color.chromeBorder,
    backgroundColor: tcTheme.color.fbarButtonBg,
    marginLeft: 10,
  },
  closeText: { color: tcTheme.color.text, fontFamily: tcTheme.font.ui, fontSize: tcTheme.font.sizeSmall },
  contentArea: { flex: 1, minHeight: 0 },
  scroll: { flex: 1 },
  scrollContent: { padding: 4 },
  body: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.mono,
    fontSize: tcTheme.font.sizeSmall,
    // RN-Web: allow selection/copy in the viewer.
    userSelect: "text",
  } as object,
  status: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
    padding: 6,
  },
  error: {
    color: tcTheme.color.textMarked,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
    padding: 6,
  },
});
