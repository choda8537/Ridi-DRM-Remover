import { existsSync, readdirSync, statSync } from "fs";
import { basename, join } from "path";
import { homedir, platform } from "os";

export enum BookFormat {
  EPUB = "epub",
  PDF = "pdf",
}

export function bookFormatFromPath(path: string): BookFormat {
  const ext = path.substring(path.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "epub") return BookFormat.EPUB;
  if (ext === "pdf") return BookFormat.PDF;
  throw new Error(`not a book file: ${path}`);
}

export function bookFormatExtension(format: BookFormat): string {
  return format.toString();
}

export enum FileKind {
  BOOK = "book",
  DATA = "data",
}

export class BookInfo {
  public readonly path: string;
  public readonly id: string;
  public readonly format: BookFormat;

  constructor(path: string) {
    this.path = path;
    this.id = basename(path);
    this.format = this.detectFormat(path);
  }

  private detectFormat(path: string): BookFormat {
    const entries = readdirSync(path);
    for (const entry of entries) {
      const fullPath = join(path, entry);
      if (statSync(fullPath).isFile()) {
        try {
          return bookFormatFromPath(fullPath);
        } catch {
          continue;
        }
      }
    }
    throw new Error(`Valid book file not found in: ${path}`);
  }

  getFile(kind: FileKind): string {
    const ext = kind === FileKind.BOOK ? bookFormatExtension(this.format) : "dat";
    const entries = readdirSync(this.path);
    for (const entry of entries) {
      const fullPath = join(this.path, entry);
      if (
        statSync(fullPath).isFile() &&
        entry.startsWith(this.id) &&
        entry.toLowerCase().endsWith(`.${ext}`)
      ) {
        return fullPath;
      }
    }
    return join(this.path, `${this.id}.${ext}`);
  }

  fileName(kind: FileKind): string {
    if (kind === FileKind.BOOK) {
      return `${this.id}.${bookFormatExtension(this.format)}`;
    }
    const filePath = this.getFile(kind);
    return basename(filePath);
  }
}

export function libraryPath(userIdx: string): string {
  const plat = platform();
  if (plat === "darwin") {
    const home = homedir();
    return join(
      home,
      "Library",
      "Application Support",
      "Ridibooks",
      "library",
      `_${userIdx}`
    );
  }
  if (plat === "win32") {
    const appdata = process.env.APPDATA;
    if (!appdata || !existsSync(appdata)) {
      throw new Error("APPDATA environment variable not found");
    }
    return join(appdata, "Ridibooks", "library", `_${userIdx}`);
  }
  throw new Error("library_path() not implemented for this OS");
}

export function discoverBooks(path: string): BookInfo[] {
  if (!existsSync(path)) {
    return [];
  }
  const infos: BookInfo[] = [];
  const entries = readdirSync(path);
  for (const entry of entries) {
    const fullPath = join(path, entry);
    if (statSync(fullPath).isDirectory()) {
      try {
        infos.push(new BookInfo(fullPath));
      } catch {
        continue;
      }
    }
  }
  return infos;
}
