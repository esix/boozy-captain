import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DriveGroup, DriveInfo, Uri } from "@bc/vfs";
import { parseUri } from "@bc/vfs";
import { tcTheme } from "./theme.js";

export interface DriveBarProps {
  uri: Uri;
  /** Per-plugin drive groups. UI draws a horizontal separator between groups. */
  driveGroups?: readonly DriveGroup[];
  /** Optional free-space label, e.g. "[Local Disk] 92 568 828 k of 498 242 556 k free". */
  info?: string;
  onNavigate: (uri: Uri) => void;
  /** Plugin-aware parent URI for the ".." button. Required for drive-root suppression. */
  parentOf: (uri: Uri) => Uri;
  /** Controlled open state. Omit to let DriveBar manage it internally. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  testID?: string;
}

const nonFocusable = {
  tabIndex: -1,
  onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
} as unknown as object;

interface FlatDrive {
  groupIndex: number;
  driveIndexInGroup: number;
  drive: DriveInfo;
  key: string;
}

/**
 * TC-style per-panel drive bar. Combo on the left opens a 2-column dropdown
 * (letter | label). Multiple FS plugins each contribute a group; separators
 * sit between groups so identical letters from different plugins coexist
 * without ambiguity.
 *
 * Keyboard model when open: Arrow Up/Down move the cursor across all entries
 * (groups merge into one logical list), Enter activates, Esc closes. Mouse
 * hover and keyboard share a single `cursorIndex` so they don't fight.
 */
export function DriveBar({
  uri,
  driveGroups,
  info,
  onNavigate,
  parentOf,
  open: openProp,
  onOpenChange,
  testID = "bc-drivebar",
}: DriveBarProps): JSX.Element {
  const { scheme } = parseUri(uri);
  const [openInternal, setOpenInternal] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openInternal;
  const setOpen = (next: boolean | ((cur: boolean) => boolean)): void => {
    const value = typeof next === "function" ? next(open) : next;
    if (!isControlled) setOpenInternal(value);
    onOpenChange?.(value);
  };

  const [cursorIndex, setCursorIndex] = useState<number>(-1);
  const rootRef = useRef<View | null>(null);

  // Flatten groups → one indexed list. Group boundaries are preserved as a
  // per-row `isGroupHead` derived later from `driveIndexInGroup === 0`.
  const flatDrives = useMemo<FlatDrive[]>(() => {
    const out: FlatDrive[] = [];
    (driveGroups ?? []).forEach((g, gi) => {
      g.drives.forEach((d, di) => {
        out.push({
          groupIndex: gi,
          driveIndexInGroup: di,
          drive: d,
          key: `${g.scheme}.${d.letter}`,
        });
      });
    });
    return out;
  }, [driveGroups]);

  const activeIndex = useMemo(
    () => findActiveDriveIndex(uri, flatDrives),
    [uri, flatDrives],
  );

  const activeLetter = activeIndex >= 0 && flatDrives[activeIndex]
    ? flatDrives[activeIndex]!.drive.letter
    : scheme;

  // Seed cursor when the dropdown opens: prefer the currently-active drive,
  // fall back to the first row.
  useEffect(() => {
    if (!open) return;
    setCursorIndex(activeIndex >= 0 ? activeIndex : 0);
  }, [open, activeIndex]);

  // onPick must be reachable from the keyboard handler; keep a stable ref so
  // the handler doesn't need to re-bind on every cursor change.
  const cursorRef = useRef(cursorIndex);
  cursorRef.current = cursorIndex;
  const flatRef = useRef(flatDrives);
  flatRef.current = flatDrives;

  const pickDrive = (d: DriveInfo): void => {
    setOpen(false);
    setCursorIndex(-1);
    onNavigate(d.uri);
  };

  // Click-outside, Esc, Arrow Up/Down/Home/End, Enter. Registered as a
  // capture-phase listener + stopImmediatePropagation so the keys we consume
  // never reach the Panel's own ArrowUp/Down handlers underneath.
  useEffect(() => {
    if (!open) return;
    const handled = new Set([
      "Escape",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "Enter",
    ]);
    const onKey = (e: KeyboardEvent): void => {
      if (!handled.has(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      switch (e.key) {
        case "Escape":
          setOpen(false);
          return;
        case "ArrowDown":
          setCursorIndex((c) => {
            const n = flatRef.current.length;
            return n === 0 ? -1 : (c + 1 + n) % n;
          });
          return;
        case "ArrowUp":
          setCursorIndex((c) => {
            const n = flatRef.current.length;
            return n === 0 ? -1 : (c - 1 + n) % n;
          });
          return;
        case "Home":
          setCursorIndex(flatRef.current.length > 0 ? 0 : -1);
          return;
        case "End":
          setCursorIndex(flatRef.current.length > 0 ? flatRef.current.length - 1 : -1);
          return;
        case "Enter": {
          const f = flatRef.current[cursorRef.current];
          if (f) pickDrive(f.drive);
          return;
        }
      }
    };
    const onMouseDown = (e: MouseEvent): void => {
      const el = rootRef.current as unknown as HTMLElement | null;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onMouseDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [open]);

  return (
    <View style={styles.row} testID={testID} ref={rootRef}>
      <View>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          style={[styles.combo, open && styles.comboOpen]}
          testID={`${testID}-combo`}
          {...nonFocusable}
        >
          <View style={styles.lockIcon} />
          <Text style={styles.comboText}>{activeLetter}</Text>
          <Text style={styles.comboCaret}>▼</Text>
        </Pressable>
        {open ? (
          <View style={styles.dropdown} testID={`${testID}-dropdown`}>
            <DriveTable
              flatDrives={flatDrives}
              cursorIndex={cursorIndex}
              setCursorIndex={setCursorIndex}
              onPick={pickDrive}
              testID={testID}
            />
          </View>
        ) : null}
      </View>
      <Text style={styles.info} numberOfLines={1}>
        {info ?? `[${scheme}://]`}
      </Text>
      <View style={styles.spacer} />
      <Pressable onPress={() => onNavigate(`${scheme}:///`)} style={styles.button} testID={`${testID}-root`} {...nonFocusable}>
        <Text style={styles.buttonText}>\</Text>
      </Pressable>
      <Pressable onPress={() => onNavigate(parentOf(uri))} style={styles.button} testID={`${testID}-up`} {...nonFocusable}>
        <Text style={styles.buttonText}>..</Text>
      </Pressable>
    </View>
  );
}

function DriveTable({
  flatDrives,
  cursorIndex,
  setCursorIndex,
  onPick,
  testID,
}: {
  flatDrives: readonly FlatDrive[];
  cursorIndex: number;
  setCursorIndex: React.Dispatch<React.SetStateAction<number>>;
  onPick: (d: DriveInfo) => void;
  testID: string;
}): JSX.Element {
  if (flatDrives.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No drives</Text>
      </View>
    );
  }
  return (
    <View>
      {flatDrives.map((f, i) => {
        const isCursor = i === cursorIndex;
        // First row of every non-first group renders the group separator as
        // its own borderTop + extra paddingTop — keeps the hover/click hit
        // area continuous across what used to be a margin gap.
        const isGroupHead = f.groupIndex > 0 && f.driveIndexInGroup === 0;
        return (
          <Pressable
            key={f.key}
            onPress={() => onPick(f.drive)}
            onHoverIn={() => setCursorIndex(i)}
            // Functional updater so a stale render's value can't overwrite
            // the new row that was just set by the adjacent onHoverIn.
            onHoverOut={() =>
              setCursorIndex((cur) => (cur === i ? -1 : cur))
            }
            style={[styles.dropRow, isGroupHead && styles.dropRowGroupHead, isCursor && styles.dropRowHover]}
            testID={`${testID}-item-${f.key}`}
            {...nonFocusable}
          >
            <Text style={[styles.dropLetter, isCursor && styles.dropTextHover]} numberOfLines={1}>
              {f.drive.letter}
            </Text>
            <Text style={[styles.dropLabel, isCursor && styles.dropTextHover]} numberOfLines={1}>
              {f.drive.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Index of the drive whose URI is the longest prefix of `uri`. -1 if none. */
function findActiveDriveIndex(uri: Uri, flat: readonly FlatDrive[]): number {
  let bestIdx = -1;
  let bestLen = -1;
  for (let i = 0; i < flat.length; i++) {
    const d = flat[i]!.drive;
    if (uri === d.uri || uri.startsWith(d.uri)) {
      if (d.uri.length > bestLen) {
        bestIdx = i;
        bestLen = d.uri.length;
      }
    }
  }
  return bestIdx;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tcTheme.color.chromeBg,
    borderBottomWidth: 1,
    borderBottomColor: tcTheme.color.chromeBorder,
    paddingHorizontal: 2,
    paddingVertical: 1,
    minHeight: 22,
    // Combo dropdown must be allowed to draw above siblings.
    zIndex: 150,
  },
  combo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: tcTheme.color.chromeBorder,
    backgroundColor: tcTheme.color.panelBg,
    marginRight: 6,
  },
  comboOpen: {
    backgroundColor: tcTheme.color.cursorBgInactive,
  },
  lockIcon: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: "#7A7A7A",
    backgroundColor: "#D4AF37",
    marginRight: 4,
  },
  comboText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
    minWidth: 16,
    paddingHorizontal: 2,
  },
  comboCaret: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: 9,
    marginLeft: 4,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    minWidth: 220,
    zIndex: 200,
    backgroundColor: tcTheme.color.panelBg,
    borderWidth: 1,
    borderColor: tcTheme.color.chromeBorder,
    paddingVertical: 2,
    shadowColor: "#000",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
  },
  dropRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dropRowGroupHead: {
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: tcTheme.color.chromeBorder,
  },
  dropRowHover: {
    backgroundColor: tcTheme.color.panelBorderFocused,
  },
  dropLetter: {
    width: 28,
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.mono,
    fontSize: tcTheme.font.sizeSmall,
  },
  dropLabel: {
    flex: 1,
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
    marginLeft: 4,
  },
  dropTextHover: {
    color: "#FFFFFF",
  },
  empty: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  emptyText: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
  },
  info: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
    flexShrink: 1,
  },
  spacer: {
    flex: 1,
  },
  button: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    marginLeft: 2,
    borderWidth: 1,
    borderColor: tcTheme.color.chromeBorder,
    backgroundColor: tcTheme.color.fbarButtonBg,
  },
  buttonText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
  },
});
