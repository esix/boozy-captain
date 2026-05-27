import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import type { Uri, VfsRegistry } from "@bc/vfs";
import { tcTheme } from "./theme.js";

/** Buffered mode reads the whole file (cap). Windowed mode reads ranges. */
const MAX_BYTES = 1024 * 1024; // 1 MiB buffered cap
const HEX_LIMIT = 64 * 1024; // hex view byte cap
/** Above this, use random-access windowed mode (if the scheme supports it). */
const WINDOW_THRESHOLD = 512 * 1024;
const LINE_H = 16; // fixed line box for byte-offset ↔ pixel mapping
const SCAN_CHUNK = 64 * 1024;

export type ListerMode = "text" | "hex";

export interface ListerProps {
  vfs: VfsRegistry;
  uri: Uri;
  name: string;
  /** File size in bytes (from Stat); enables windowed mode for large files. */
  size?: number;
  onClose?: () => void;
  testID?: string;
}

/**
 * TC-style file viewer (F3). Small files (or schemes that can't seek) are read
 * whole into a buffer; large files on range-capable schemes use windowed mode
 * — only the visible byte window is fetched, so a huge / network file opens
 * instantly and the scrollbar is an approximate byte-offset map.
 */
export function Lister({ vfs, uri, name, size, onClose, testID = "bc-lister" }: ListerProps): JSX.Element {
  const [mode, setMode] = useState<ListerMode>("text");
  const windowed = vfs.canReadRange(uri) && size !== undefined && size > WINDOW_THRESHOLD;

  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.toolbar}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.spacer} />
        {size !== undefined ? (
          <Text style={styles.meta}>
            {formatBytes(size)}
            {windowed ? " · windowed" : ""}
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
        {windowed ? (
          <WindowedView vfs={vfs} uri={uri} size={size!} mode={mode} testID={testID} />
        ) : (
          <BufferedView vfs={vfs} uri={uri} mode={mode} testID={testID} />
        )}
      </View>
    </View>
  );
}

// ─── Buffered (small files / non-seekable schemes) ───────────────────────────

interface BufferState {
  status: "loading" | "ready" | "error";
  bytes: Uint8Array | null;
  truncated: boolean;
  error: string | null;
}

function BufferedView({
  vfs,
  uri,
  mode,
  testID,
}: {
  vfs: VfsRegistry;
  uri: Uri;
  mode: ListerMode;
  testID: string;
}): JSX.Element {
  const [state, setState] = useState<BufferState>({ status: "loading", bytes: null, truncated: false, error: null });

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
        const sz = Math.min(total, MAX_BYTES);
        const buf = new Uint8Array(sz);
        let off = 0;
        for (const c of chunks) {
          if (off >= sz) break;
          const slice = c.length > sz - off ? c.subarray(0, sz - off) : c;
          buf.set(slice, off);
          off += slice.length;
        }
        if (!cancelled) setState({ status: "ready", bytes: buf, truncated, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({ status: "error", bytes: null, truncated: false, error: errMsg(err) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vfs, uri]);

  const text = useMemo(() => (state.bytes ? decodeUtf8(state.bytes) : ""), [state.bytes]);
  const hex = useMemo(() => (state.bytes ? hexDump(state.bytes, 0, HEX_LIMIT) : ""), [state.bytes]);

  if (state.status === "loading") return <Text style={styles.status}>Reading…</Text>;
  if (state.status === "error") return <Text style={styles.error}>Error: {state.error}</Text>;
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} testID={`${testID}-scroll`}>
      <Text style={styles.body} selectable>
        {mode === "text" ? text : hex}
      </Text>
      {state.truncated ? <Text style={styles.status}>… truncated at {formatBytes(MAX_BYTES)}</Text> : null}
    </ScrollView>
  );
}

// ─── Windowed (large files via range reads) ──────────────────────────────────

interface RangeSource {
  size: number;
  readRange(offset: number, length: number): Promise<Uint8Array>;
}

interface LineRec {
  start: number; // absolute byte offset of the line's first byte
  text: string;
}

function WindowedView({
  vfs,
  uri,
  size,
  mode,
  testID,
}: {
  vfs: VfsRegistry;
  uri: Uri;
  size: number;
  mode: ListerMode;
  testID: string;
}): JSX.Element {
  const src = useMemo<RangeSource>(
    () => ({ size, readRange: (o, l) => vfs.readRange(uri, o, Math.min(l, size - o)) }),
    [vfs, uri, size],
  );

  const [topOffset, setTopOffset] = useState(0);
  const [viewportLines, setViewportLines] = useState(20);
  const [lines, setLines] = useState<string[]>([]);
  const [winBytes, setWinBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Full line records of the loaded window (with a margin past the viewport),
  // so forward scrolling can reposition synchronously without another read.
  const recsRef = useRef<LineRec[]>([]);
  const busyRef = useRef(false);
  const containerRef = useRef<View | null>(null);

  // Load the window at topOffset whenever it (or the viewport) changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const recs = await readLines(src, topOffset, viewportLines * 2 + 1);
        if (cancelled) return;
        recsRef.current = recs;
        setLines(recs.slice(0, viewportLines).map((r) => r.text));
        setWinBytes(await src.readRange(topOffset, Math.min(HEX_LIMIT, size - topOffset)));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(errMsg(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, topOffset, viewportLines, size]);

  const scrollBy = async (delta: number): Promise<void> => {
    if (delta === 0 || busyRef.current) return;
    if (delta > 0) {
      // Forward: reposition from the cached window when possible.
      const recs = recsRef.current;
      let next = recs[delta]?.start;
      if (next === undefined) {
        busyRef.current = true;
        try {
          const more = await readLines(src, topOffset, delta + 1);
          next = more[delta]?.start ?? more[more.length - 1]?.start;
        } finally {
          busyRef.current = false;
        }
      }
      if (next !== undefined && next > topOffset && next < size) setTopOffset(next);
    } else {
      busyRef.current = true;
      try {
        const prev = await prevLineStart(src, topOffset, -delta);
        if (prev !== topOffset) setTopOffset(prev);
      } finally {
        busyRef.current = false;
      }
    }
  };

  const seekFraction = async (frac: number): Promise<void> => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const target = Math.max(0, Math.min(size - 1, Math.floor(frac * size)));
      setTopOffset(await lineStartAtOrBefore(src, target));
    } finally {
      busyRef.current = false;
    }
  };

  const toEnd = async (): Promise<void> => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const lastStart = await lineStartAtOrBefore(src, size - 1);
      setTopOffset(await prevLineStart(src, lastStart, viewportLines - 1));
    } finally {
      busyRef.current = false;
    }
  };

  // Wheel → line scroll. Keys (when the lister area is hovered/active) →
  // arrows/page/home/end. Both attach to the DOM container.
  useEffect(() => {
    const el = containerRef.current as unknown as HTMLElement | null;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const k = Math.max(1, Math.round(Math.abs(e.deltaY) / LINE_H));
      void scrollBy(Math.sign(e.deltaY) * k);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  useEffect(() => {
    const handled = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"]);
    const onKey = (e: KeyboardEvent): void => {
      if (!handled.has(e.key)) return;
      // Capture-phase + stop so the panel's hotkeys underneath the modal don't
      // also move while the lister is open.
      e.preventDefault();
      e.stopImmediatePropagation();
      switch (e.key) {
        case "ArrowDown":
          void scrollBy(1);
          break;
        case "ArrowUp":
          void scrollBy(-1);
          break;
        case "PageDown":
          void scrollBy(viewportLines - 1);
          break;
        case "PageUp":
          void scrollBy(-(viewportLines - 1));
          break;
        case "Home":
          setTopOffset(0);
          break;
        case "End":
          void toEnd();
          break;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const onLayout = (e: LayoutChangeEvent): void => {
    const n = Math.max(1, Math.floor(e.nativeEvent.layout.height / LINE_H));
    setViewportLines(n);
  };

  const hex = useMemo(() => (winBytes ? hexDump(winBytes, topOffset, HEX_LIMIT) : ""), [winBytes, topOffset]);

  if (error) return <Text style={styles.error}>Error: {error}</Text>;

  return (
    <View style={styles.windowRoot}>
      <View style={styles.windowBody} onLayout={onLayout} ref={containerRef}>
        {mode === "text" ? (
          lines.map((line, i) => (
            <Text key={topOffset + ":" + i} style={styles.line} numberOfLines={1} selectable>
              {line.length === 0 ? " " : line}
            </Text>
          ))
        ) : (
          <Text style={styles.body} selectable>
            {hex}
          </Text>
        )}
      </View>
      <ApproxScrollbar
        fraction={size > 0 ? topOffset / size : 0}
        onSeek={(f) => void seekFraction(f)}
        testID={`${testID}-scrollbar`}
      />
    </View>
  );
}

/** Byte-offset approximate scrollbar: position = topOffset/size; drag to seek. */
function ApproxScrollbar({
  fraction,
  onSeek,
  testID,
}: {
  fraction: number;
  onSeek: (fraction: number) => void;
  testID: string;
}): JSX.Element {
  const trackRef = useRef<View | null>(null);
  const draggingRef = useRef(false);

  const seekFromY = (clientY: number): void => {
    const el = trackRef.current as unknown as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const f = (clientY - rect.top) / Math.max(1, rect.height);
    onSeek(Math.max(0, Math.min(1, f)));
  };

  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      if (!draggingRef.current) return;
      e.preventDefault();
      seekFromY(e.clientY);
    };
    const onUp = (): void => {
      draggingRef.current = false;
    };
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseup", onUp, true);
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseup", onUp, true);
    };
  }, []);

  const down = {
    onMouseDown: (e: { clientY: number; preventDefault(): void }) => {
      e.preventDefault();
      draggingRef.current = true;
      seekFromY(e.clientY);
    },
    tabIndex: -1,
  } as unknown as object;

  const thumbTop = `${Math.max(0, Math.min(0.96, fraction)) * 100}%`;
  return (
    <View style={styles.scrollbarTrack} ref={trackRef} testID={testID} {...down}>
      <View style={[styles.scrollbarThumb, { top: thumbTop } as object]} />
    </View>
  );
}

// ─── byte/line helpers ───────────────────────────────────────────────────────

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/** Split a byte window into line records (absolute offsets); strips trailing \r. */
function splitLines(bytes: Uint8Array, base: number): LineRec[] {
  const recs: LineRec[] = [];
  let lineStart = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x0a) {
      let end = i;
      if (end > lineStart && bytes[end - 1] === 0x0d) end -= 1; // strip \r
      recs.push({ start: base + lineStart, text: decodeUtf8(bytes.subarray(lineStart, end)) });
      lineStart = i + 1;
    }
  }
  // trailing (unterminated) segment
  let end = bytes.length;
  if (end > lineStart && bytes[end - 1] === 0x0d) end -= 1;
  recs.push({ start: base + lineStart, text: decodeUtf8(bytes.subarray(lineStart, end)) });
  return recs;
}

/** Read forward from `offset` until we have ≥ `count` complete lines (or EOF). */
async function readLines(src: RangeSource, offset: number, count: number): Promise<LineRec[]> {
  let windowSize = Math.max(SCAN_CHUNK, count * 256);
  for (;;) {
    const len = Math.min(windowSize, src.size - offset);
    const bytes = await src.readRange(offset, len);
    const recs = splitLines(bytes, offset);
    const atEof = offset + bytes.length >= src.size;
    const complete = atEof ? recs.length : recs.length - 1; // last is partial unless EOF
    if (complete >= count || atEof || len >= MAX_BYTES) {
      return atEof ? recs : recs.slice(0, recs.length - 1);
    }
    windowSize *= 2;
  }
}

/** Line start ≤ pos (scan back for the previous newline). */
async function lineStartAtOrBefore(src: RangeSource, pos: number): Promise<number> {
  if (pos <= 0) return 0;
  let end = Math.min(pos, src.size);
  while (end > 0) {
    const start = Math.max(0, end - SCAN_CHUNK);
    const bytes = await src.readRange(start, end - start);
    for (let i = bytes.length - 1; i >= 0; i--) {
      if (bytes[i] === 0x0a) return start + i + 1;
    }
    if (start === 0) return 0;
    end = start;
  }
  return 0;
}

/** Start of the line `count` lines above `topOffset` (a line start). */
async function prevLineStart(src: RangeSource, topOffset: number, count: number): Promise<number> {
  if (topOffset <= 0 || count <= 0) return 0;
  const newlines: number[] = []; // descending absolute positions, < topOffset
  let end = topOffset;
  while (end > 0 && newlines.length < count + 1) {
    const start = Math.max(0, end - SCAN_CHUNK);
    const bytes = await src.readRange(start, end - start);
    for (let i = bytes.length - 1; i >= 0; i--) {
      if (bytes[i] === 0x0a) {
        const abs = start + i;
        if (abs < topOffset) newlines.push(abs);
        if (newlines.length >= count + 1) break;
      }
    }
    if (start === 0) break;
    end = start;
  }
  return newlines.length >= count + 1 ? newlines[count]! + 1 : 0;
}

function hexDump(bytes: Uint8Array, baseOffset: number, limit: number): string {
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
    lines.push(`${(baseOffset + i).toString(16).padStart(8, "0")}  ${hexPart} ${ascii}`);
  }
  return lines.join("\n");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(1)} MiB`;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
  name: { color: tcTheme.color.text, fontFamily: tcTheme.font.ui, fontSize: tcTheme.font.size, fontWeight: "600", flexShrink: 1 },
  spacer: { flex: 1 },
  meta: { color: tcTheme.color.textDim, fontFamily: tcTheme.font.ui, fontSize: tcTheme.font.sizeSmall, marginRight: 10 },
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
  body: { color: tcTheme.color.text, fontFamily: tcTheme.font.mono, fontSize: tcTheme.font.sizeSmall, userSelect: "text" } as object,
  windowRoot: { flex: 1, flexDirection: "row", minHeight: 0 },
  windowBody: { flex: 1, overflow: "hidden", paddingLeft: 4 },
  line: {
    height: LINE_H,
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.mono,
    fontSize: tcTheme.font.sizeSmall,
    lineHeight: LINE_H,
    userSelect: "text",
  } as object,
  scrollbarTrack: {
    width: 12,
    backgroundColor: tcTheme.color.chromeBg,
    borderLeftWidth: 1,
    borderLeftColor: tcTheme.color.chromeBorder,
    cursor: "default",
  } as object,
  scrollbarThumb: {
    position: "absolute",
    left: 1,
    right: 1,
    height: 28,
    backgroundColor: tcTheme.color.panelBorder,
    borderWidth: 1,
    borderColor: "#9AA0A6",
  } as object,
  status: { color: tcTheme.color.textDim, fontFamily: tcTheme.font.ui, fontSize: tcTheme.font.sizeSmall, padding: 6 },
  error: { color: tcTheme.color.textMarked, fontFamily: tcTheme.font.ui, fontSize: tcTheme.font.sizeSmall, padding: 6 },
});
