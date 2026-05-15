import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { Stat, Uri, VfsRegistry } from "@bc/vfs";
import { parentUri } from "@bc/vfs";
import { PathBar } from "./PathBar.js";
import { useDirectoryStream } from "./useDirectoryStream.js";

export interface PanelProps {
  vfs: VfsRegistry;
  uri: Uri;
  onNavigate: (uri: Uri) => void;
  focused?: boolean;
  onFocus?: () => void;
}

export function Panel({ vfs, uri, onNavigate, focused = false, onFocus }: PanelProps): JSX.Element {
  const { entries, loading, error, reload } = useDirectoryStream(vfs, uri);

  const navigate = (next: Uri): void => {
    onFocus?.();
    onNavigate(next);
  };

  return (
    <Pressable onPress={onFocus} style={[styles.container, focused && styles.focused]}>
      <PathBar uri={uri} onUp={() => navigate(parentUri(uri))} />
      <View style={styles.header}>
        <Text style={[styles.cell, styles.headerText, styles.nameCol]}>Name</Text>
        <Text style={[styles.cell, styles.headerText, styles.sizeCol]}>Size</Text>
        <Text style={[styles.cell, styles.headerText, styles.dateCol]}>Modified</Text>
      </View>
      {error ? (
        <Text style={styles.error}>Error: {error.message}</Text>
      ) : (
        <FlatList<Stat>
          data={entries}
          keyExtractor={(item) => item.uri}
          renderItem={({ item }) => <Row item={item} onPress={() => handlePress(item, navigate)} />}
          ListEmptyComponent={
            loading ? <Text style={styles.status}>Loading…</Text> : <Text style={styles.status}>Empty</Text>
          }
          ListFooterComponent={
            loading && entries.length > 0 ? <Text style={styles.status}>Loading more…</Text> : null
          }
        />
      )}
      <View style={styles.footer}>
        <Pressable
          onPress={() => {
            onFocus?.();
            reload();
          }}
          style={styles.refresh}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
        <Text style={styles.status}>{entries.length} item(s)</Text>
      </View>
    </Pressable>
  );
}

function handlePress(item: Stat, navigate: (uri: Uri) => void): void {
  if (item.kind === "dir") navigate(item.uri);
}

function Row({ item, onPress }: { item: Stat; onPress: () => void }): JSX.Element {
  const isDir = item.kind === "dir";
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={[styles.cell, styles.nameCol, isDir && styles.dirText]} numberOfLines={1}>
        {isDir ? `📁 ${item.name}` : `📄 ${item.name}`}
      </Text>
      <Text style={[styles.cell, styles.sizeCol]}>{isDir ? "<DIR>" : formatSize(item.size)}</Text>
      <Text style={[styles.cell, styles.dateCol]}>{formatDate(item.mtime)}</Text>
    </Pressable>
  );
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1117",
    borderWidth: 2,
    borderColor: "transparent",
  },
  focused: {
    borderColor: "#38bdf8",
  },
  header: {
    flexDirection: "row",
    backgroundColor: "#1f2933",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#0b1117",
  },
  headerText: {
    color: "#94a3b8",
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  cell: {
    color: "#e2e8f0",
    fontFamily: "monospace",
    fontSize: 13,
  },
  nameCol: { flex: 3 },
  sizeCol: { flex: 1, textAlign: "right", paddingRight: 8 },
  dateCol: { flex: 2, textAlign: "right" },
  dirText: { color: "#facc15" },
  status: { color: "#64748b", padding: 8, fontFamily: "monospace" },
  error: { color: "#f87171", padding: 8, fontFamily: "monospace" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 6,
    backgroundColor: "#1f2933",
    borderTopWidth: 1,
    borderTopColor: "#0b1117",
  },
  refresh: {
    backgroundColor: "#334155",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 3,
  },
  refreshText: {
    color: "#e2e8f0",
    fontFamily: "monospace",
  },
});
