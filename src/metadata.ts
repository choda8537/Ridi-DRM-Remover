import AdmZip from "adm-zip";
import { PDFDocument } from "pdf-lib";
import { BookFormat } from "./book.js";

export async function extractTitle(fmt: BookFormat, data: Buffer): Promise<string | null> {
  if (fmt === BookFormat.EPUB) {
    return extractTitleEpub(data);
  } else if (fmt === BookFormat.PDF) {
    return await extractTitlePdf(data);
  }
  return null;
}

function extractTitleEpub(data: Buffer): string | null {
  try {
    const zip = new AdmZip(data);
    const containerEntry = zip.getEntry("META-INF/container.xml");
    if (!containerEntry) return null;

    const containerXml = containerEntry.getData().toString("utf-8");
    const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!rootfileMatch) return null;

    const opfPath = rootfileMatch[1];
    const opfEntry = zip.getEntry(opfPath);
    if (!opfEntry) return null;

    const opfXml = opfEntry.getData().toString("utf-8");
    const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
    if (titleMatch) {
      return titleMatch[1].trim();
    }

    const fallbackMatch = opfXml.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (fallbackMatch) {
      return fallbackMatch[1].trim();
    }
  } catch {
    return null;
  }
  return null;
}

async function extractTitlePdf(data: Buffer): Promise<string | null> {
  try {
    const pdfDoc = await PDFDocument.load(data);
    const title = pdfDoc.getTitle();
    if (title) {
      return title.trim();
    }
  } catch {
    return null;
  }
  return null;
}

const UNSAFE_CHARS = /[\\/:*?"<>|]/g;
const WHITESPACE_RUN = /\s+/g;
const WINDOWS_RESERVED = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

export function sanitizeFilename(name: string, maxLen: number = 120): string {
  let sanitized = name.trim().replace(UNSAFE_CHARS, " ");
  sanitized = sanitized.replace(WHITESPACE_RUN, " ").trim();
  if (sanitized.length > maxLen) {
    sanitized = sanitized.substring(0, maxLen).trimEnd();
  }
  if (WINDOWS_RESERVED.has(sanitized.toUpperCase())) {
    sanitized = `_${sanitized}`;
  }
  return sanitized || "untitled";
}
