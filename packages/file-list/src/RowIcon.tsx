import { createElement, type ComponentProps } from "react";
import { View } from "react-native";
import {
  Archive,
  File,
  FileAudio,
  FileBox,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideo,
  Folder,
  FolderUp,
  type LucideIcon,
} from "lucide-react";
import type { Stat } from "@bc/vfs";
import type { Row } from "./types.js";

type IconC = LucideIcon;

const TEXT = new Set(["txt", "md", "log", "conf", "ini", "cfg", "yml", "yaml", "rtf"]);
const CODE = new Set(["ts", "tsx", "js", "jsx", "py", "cs", "cpp", "c", "h", "hpp", "rs", "go", "java", "rb", "php", "html", "css", "scss", "json", "xml"]);
const IMAGE = new Set(["png", "jpg", "jpeg", "bmp", "gif", "webp", "svg", "ico", "tif", "tiff"]);
const ARCHIVE = new Set(["zip", "rar", "tar", "gz", "tgz", "7z", "bz2", "xz"]);
const AUDIO = new Set(["mp3", "wav", "flac", "ogg", "aac", "m4a"]);
const VIDEO = new Set(["mp4", "mkv", "mov", "avi", "webm", "wmv", "mpg", "mpeg"]);
const DOC = new Set(["doc", "docx", "pdf", "odt"]);
const SHEET = new Set(["xls", "xlsx", "csv", "tsv", "ods"]);
const EXE = new Set(["exe", "bat", "cmd", "dll", "ps1", "sh"]);

export function pickIconForStat(stat: Stat): IconC {
  if (stat.kind === "dir") return Folder;
  const dot = stat.name.lastIndexOf(".");
  if (dot < 0) return File;
  const ext = stat.name.slice(dot + 1).toLowerCase();
  if (TEXT.has(ext)) return FileText;
  if (CODE.has(ext)) return FileCode;
  if (IMAGE.has(ext)) return FileImage;
  if (ARCHIVE.has(ext)) return Archive;
  if (AUDIO.has(ext)) return FileAudio;
  if (VIDEO.has(ext)) return FileVideo;
  if (DOC.has(ext)) return FileType;
  if (SHEET.has(ext)) return FileSpreadsheet;
  if (EXE.has(ext)) return FileBox;
  return File;
}

export interface RowIconProps {
  row: Row;
  size?: number;
  color?: string;
}

export function RowIcon({ row, size = 13, color = "#444" }: RowIconProps): JSX.Element {
  let icon: IconC;
  if (row.kind === "parent") icon = FolderUp;
  else icon = pickIconForStat(row.stat);
  const props: ComponentProps<IconC> = { size, color, strokeWidth: 1.75 };
  return (
    <View style={{ width: size + 4, alignItems: "center", justifyContent: "center" }}>
      {createElement(icon as React.ComponentType<ComponentProps<IconC>>, props)}
    </View>
  );
}
