import { createDecipheriv } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { BookInfo, FileKind, bookFormatExtension, BookFormat } from "./book.js";
import { extractTitle, sanitizeFilename } from "./metadata.js";

function isValidOutput(fmt: BookFormat, data: Buffer): boolean {
  if (fmt === BookFormat.EPUB) {
    return (
      data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
      data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) ||
      data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]))
    );
  } else if (fmt === BookFormat.PDF) {
    return data.subarray(0, 4).equals(Buffer.from("%PDF"));
  }
  return false;
}

function removePKCS7Padding(data: Buffer): Buffer {
  const paddingLength = data[data.length - 1];
  if (paddingLength > 16 || paddingLength === 0) {
    throw new Error("Invalid PKCS7 padding");
  }
  for (let i = 1; i <= paddingLength; i++) {
    if (data[data.length - i] !== paddingLength) {
      throw new Error("Invalid PKCS7 padding");
    }
  }
  return data.subarray(0, data.length - paddingLength);
}

export function decryptKey(bookInfo: BookInfo, deviceId: string, debug: boolean = false): Buffer {
  const dataPath = bookInfo.getFile(FileKind.DATA);
  if (!existsSync(dataPath)) {
    throw new Error(`Missing data file: ${dataPath}`);
  }

  const data = readFileSync(dataPath);

  if (debug) {
    console.log(`Data file: ${dataPath} (${data.length} bytes)`);
  }

  const key = Buffer.from(deviceId.substring(0, 16), "utf-8");
  const iv = data.subarray(0, 16);

  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([decipher.update(data.subarray(16)), decipher.final()]);

  const plaintext = removePKCS7Padding(decrypted);

  if (plaintext.length < 84) {
    throw new Error(`.dat plaintext too short: ${plaintext.length} bytes`);
  }

  const sessionKey = Buffer.from(plaintext.subarray(68, 84).toString("utf-8", 0, 16), "utf-8");
  if (sessionKey.length !== 16) {
    throw new Error("Invalid session key length");
  }

  if (debug) {
    console.log(`Session key: ${sessionKey.toString("hex")}`);
  }

  return sessionKey;
}

export function decryptBook(bookInfo: BookInfo, key: Buffer, debug: boolean = false): Buffer {
  const bookFilePath = bookInfo.getFile(FileKind.BOOK);

  if (!existsSync(bookFilePath)) {
    throw new Error(`Book file not found: ${bookFilePath}`);
  }

  const raw = readFileSync(bookFilePath);

  if (debug) {
    console.log(`Book file: ${bookFilePath} (${raw.length} bytes)`);
  }

  if (isValidOutput(bookInfo.format, raw)) {
    if (debug) {
      console.log("File already valid; returning as-is");
    }
    return raw;
  }

  if (raw.length < 16) {
    throw new Error("Book file too small to contain IV");
  }

  const iv = raw.subarray(0, 16);
  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([decipher.update(raw.subarray(16)), decipher.final()]);

  return removePKCS7Padding(decrypted);
}

export async function decryptAndSave(
  bookInfo: BookInfo,
  deviceId: string,
  debug: boolean = false,
  outputDir?: string
): Promise<string> {
  const key = decryptKey(bookInfo, deviceId, debug);
  const content = decryptBook(bookInfo, key, debug);

  const title = await extractTitle(bookInfo.format, content);
  let outName: string;
  if (title) {
    outName = `${sanitizeFilename(title)}.${bookFormatExtension(bookInfo.format)}`;
  } else {
    outName = bookInfo.fileName(FileKind.BOOK);
  }

  const outDir = outputDir || process.cwd();
  let target = join(outDir, outName);

  if (existsSync(target)) {
    const lastDot = outName.lastIndexOf(".");
    const stem = lastDot > 0 ? outName.substring(0, lastDot) : outName;
    const suffix = lastDot > 0 ? outName.substring(lastDot) : "";
    let i = 1;
    while (existsSync(target) && i < 1000) {
      target = join(outDir, `${stem} (${i})${suffix}`);
      i++;
    }
  }

  writeFileSync(target, content);
  if (debug) {
    console.log(`Wrote output: ${target}`);
  }
  return target;
}

export async function decryptWithProgress(
  bookInfo: BookInfo,
  deviceId: string,
  debug: boolean = false,
  outputDir?: string
): Promise<boolean> {
  const fileName = bookInfo.fileName(FileKind.BOOK);

  process.stdout.write(`\r⣿ Decrypting "${fileName}"`);

  try {
    await decryptAndSave(bookInfo, deviceId, debug, outputDir);
    console.log(`\r⣿ Decrypting "${fileName}" ✔︎`);
    return true;
  } catch (e) {
    console.log(`\r⣿ Decrypting "${fileName}" ✘`);
    if (debug) {
      console.error(`Error decrypting ${bookInfo.id}: ${e}`);
    }
    return false;
  }
}
