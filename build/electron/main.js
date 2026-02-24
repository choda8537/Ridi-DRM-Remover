// src/gui/main.ts
import "dotenv/config";
import electron2 from "electron";
import * as path2 from "path";
import { fileURLToPath } from "url";

// src/gui/services/ipc-handlers.ts
import electron from "electron";
import path from "path";
import fs from "fs";

// src/shared/constants.ts
import "dotenv/config";
import { homedir } from "os";
import { join } from "path";
var RIDI_LOGIN_URL = "https://ridibooks.com/account/login";
var RIDI_USER_DEVICES_API = "https://account.ridibooks.com/api/user-devices/app";
var RIDI_KEYCHAIN_SERVICE = "com.ridi.books";
var RIDI_KEYCHAIN_ACCOUNT = "global";
var RIDI_SETTINGS_PAYLOAD_OFFSET = 256;
var RIDI_OAUTH_CLIENT_ID = process.env.RIDI_OAUTH_CLIENT_ID || "";
var RIDI_OAUTH_CLIENT_SECRET = process.env.RIDI_OAUTH_CLIENT_SECRET || "";
var RIDI_OAUTH_TOKEN_API = "https://account.ridibooks.com/oauth2/token";
var CONFIG_FILE = join(homedir(), ".ridi_auth.json");

// src/core/auth/app-auth-service.ts
import { existsSync, readFileSync } from "fs";
import { homedir as homedir2, platform } from "os";
import { join as join2 } from "path";
import CryptoJS from "crypto-js";
import keytar from "keytar";
import { z } from "zod";
var uuidSchema = z.uuid();
var AppAuthService = class {
  async getAppAuthData() {
    try {
      const key = await this.retrieveKeychainKey();
      if (!key) return null;
      const settingsPath = this.resolveSettingsPath();
      if (!settingsPath || !existsSync(settingsPath)) return null;
      const encryptedData = readFileSync(settingsPath);
      const decryptedJson = this.decryptSettingsFile(encryptedData, key);
      if (!decryptedJson) return null;
      return this.extractAuthData(decryptedJson);
    } catch {
      return null;
    }
  }
  async retrieveKeychainKey() {
    try {
      const password = await keytar.getPassword(
        RIDI_KEYCHAIN_SERVICE,
        RIDI_KEYCHAIN_ACCOUNT
      );
      if (!password) return null;
      return this.decodeBase64IfUuid(password) ?? password;
    } catch {
      return null;
    }
  }
  decodeBase64IfUuid(encoded) {
    try {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      const parseResult = uuidSchema.safeParse(decoded);
      return parseResult.success ? decoded : null;
    } catch {
      return null;
    }
  }
  resolveSettingsPath() {
    const currentPlatform = platform();
    if (currentPlatform === "win32") {
      const appData = process.env.APPDATA || join2(homedir2(), "AppData", "Roaming");
      return join2(appData, "Ridibooks", "datastores", "global", "Settings");
    }
    if (currentPlatform === "darwin") {
      return join2(
        homedir2(),
        "Library",
        "Application Support",
        "Ridibooks",
        "datastores",
        "global",
        "Settings"
      );
    }
    return null;
  }
  decryptSettingsFile(buffer, masterKey) {
    const payload = this.extractPayload(buffer);
    return this.attemptDecryptWithUuidKey(payload, masterKey) ?? this.attemptDecryptWithDerivedKey(payload);
  }
  extractPayload(buffer) {
    const rawPayload = buffer.subarray(RIDI_SETTINGS_PAYLOAD_OFFSET);
    return CryptoJS.lib.WordArray.create(new Uint8Array(rawPayload));
  }
  attemptDecryptWithUuidKey(payload, key) {
    return this.decrypt(payload, key, true);
  }
  attemptDecryptWithDerivedKey(payload) {
    const derivedKey = this.deriveKeyFromSource("Settings-global");
    return this.decrypt(payload, derivedKey, false);
  }
  deriveKeyFromSource(source) {
    const hash = CryptoJS.SHA1(source).toString();
    return hash.substring(2, 18);
  }
  decrypt(payload, keyString, applyPkcs7) {
    try {
      const key = this.prepareKey(keyString, applyPkcs7);
      const decrypted = this.performAesDecryption(payload, key);
      const bytes = this.convertToByteArray(decrypted);
      return this.extractJsonFromBytes(bytes);
    } catch {
      return null;
    }
  }
  prepareKey(keyString, applyPkcs7) {
    const key = CryptoJS.enc.Utf8.parse(keyString);
    if (applyPkcs7 && keyString.length % 16 !== 0) {
      ;
      CryptoJS.pad.Pkcs7.pad(key, 4);
    }
    return key;
  }
  performAesDecryption(payload, key) {
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: payload
    });
    return CryptoJS.AES.decrypt(cipherParams, key, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.NoPadding
    });
  }
  extractJsonFromBytes(bytes) {
    if (bytes.length === 0) return null;
    const unpadded = this.removePkcs7Padding(bytes);
    if (!unpadded) return null;
    const jsonStr = Buffer.from(unpadded).toString("utf8");
    return this.isValidJson(jsonStr) ? jsonStr : null;
  }
  removePkcs7Padding(bytes) {
    const paddingLength = bytes[bytes.length - 1];
    if (paddingLength < 1 || paddingLength > 16) return null;
    return bytes.slice(0, bytes.length - paddingLength);
  }
  convertToByteArray(wordArray) {
    const { words, sigBytes } = wordArray;
    const result = new Uint8Array(sigBytes);
    let offset = 0;
    for (const word of words) {
      if (offset < sigBytes) result[offset++] = word >> 24 & 255;
      if (offset < sigBytes) result[offset++] = word >> 16 & 255;
      if (offset < sigBytes) result[offset++] = word >> 8 & 255;
      if (offset < sigBytes) result[offset++] = word & 255;
    }
    return result;
  }
  extractAuthData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      const refreshToken = data?.data?.autoLogin?.refreshToken;
      const deviceId = data?.data?.device?.deviceId;
      const username = data?.data?.autoLogin?.username;
      if (!deviceId) return null;
      if (!refreshToken || !username) return null;
      return { refreshToken, deviceId, username };
    } catch {
      return null;
    }
  }
  /** refreshToken 없이 deviceId만 추출 (autoLogin 꺼진 경우) */
  async getDeviceIdOnly() {
    try {
      const key = await this.retrieveKeychainKey();
      if (!key) return null;
      const settingsPath = this.resolveSettingsPath();
      if (!settingsPath || !existsSync(settingsPath)) return null;
      const encryptedData = readFileSync(settingsPath);
      const decryptedJson = this.decryptSettingsFile(encryptedData, key);
      if (!decryptedJson) return null;
      const data = JSON.parse(decryptedJson);
      const deviceId = data?.data?.device?.deviceId;
      return deviceId ? { deviceId } : null;
    } catch {
      return null;
    }
  }
  isValidJson(str) {
    return str.startsWith("{") && (str.includes("data") || str.includes("user") || str.includes("schema"));
  }
};

// src/core/auth/auth-service.ts
var USER_AGENT = "Ridibooks/0.11.7 (Windows NT 10.0; Win64; x64)";
var AuthService = class {
  constructor(configService) {
    this.configService = configService;
    this.appAuthService = new AppAuthService();
  }
  appAuthService;
  getLoginUrl() {
    const statePayload = JSON.stringify({ return_url: RIDI_USER_DEVICES_API });
    const stateEncoded = encodeURIComponent(statePayload);
    return `${RIDI_LOGIN_URL}?state=${stateEncoded}`;
  }
  async autoLogin() {
    const appAuth = await this.appAuthService.getAppAuthData();
    if (!appAuth) return null;
    const credentials = this.getOAuthCredentials();
    if (!credentials) return null;
    try {
      const tokenResponse = await this.refreshAccessToken(
        appAuth.refreshToken,
        appAuth.deviceId,
        credentials
      );
      if (!tokenResponse) return null;
      const devices = await this.fetchUserDevices(tokenResponse.access_token);
      const device = this.findMatchingDevice(devices, appAuth.deviceId);
      if (!device) return null;
      return {
        device,
        username: appAuth.username
      };
    } catch {
      return null;
    }
  }
  parseDeviceList(jsonInput) {
    const cleaned = this.cleanJsonInput(jsonInput);
    const data = JSON.parse(cleaned);
    return data.user_devices || [];
  }
  addDevice(device) {
    this.configService.addUser(
      String(device.user_idx),
      device.device_id,
      device.device_nick
    );
  }
  listUsers() {
    return this.configService.listUsers();
  }
  switchUser(userId) {
    return this.configService.switchUser(userId);
  }
  removeUser(userId) {
    return this.configService.removeUser(userId);
  }
  getActiveUser() {
    return this.configService.getActiveUser();
  }
  getOAuthCredentials() {
    if (!RIDI_OAUTH_CLIENT_ID || !RIDI_OAUTH_CLIENT_SECRET) return null;
    return {
      clientId: RIDI_OAUTH_CLIENT_ID,
      clientSecret: RIDI_OAUTH_CLIENT_SECRET
    };
  }
  async refreshAccessToken(refreshToken, deviceId, credentials) {
    const response = await fetch(RIDI_OAUTH_TOKEN_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        device_id: deviceId
      })
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json;
  }
  async fetchUserDevices(accessToken) {
    const response = await fetch(RIDI_USER_DEVICES_API, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": USER_AGENT
      }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.user_devices || [];
  }
  findMatchingDevice(devices, deviceId) {
    return devices.find((device) => device.device_id === deviceId) || null;
  }
  cleanJsonInput(jsonInput) {
    if (jsonInput.startsWith("{")) return jsonInput;
    const startIndex = jsonInput.indexOf("{");
    return startIndex !== -1 ? jsonInput.substring(startIndex) : jsonInput;
  }
};

// src/core/book/book-info.ts
import { readdirSync, statSync } from "fs";
import { basename, join as join3 } from "path";
function bookFormatFromPath(path3) {
  const ext = path3.substring(path3.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "epub") return "epub" /* EPUB */;
  if (ext === "pdf") return "pdf" /* PDF */;
  throw new Error(`not a book file: ${path3}`);
}
function bookFormatExtension(format) {
  return format.toString();
}
var BookInfo = class {
  path;
  id;
  format;
  constructor(path3) {
    this.path = path3;
    this.id = basename(path3);
    this.format = this.detectFormat(path3);
  }
  detectFormat(path3) {
    const entries = readdirSync(path3);
    for (const entry of entries) {
      const fullPath = join3(path3, entry);
      if (statSync(fullPath).isFile()) {
        try {
          return bookFormatFromPath(fullPath);
        } catch {
          continue;
        }
      }
    }
    throw new Error(`Valid book file not found in: ${path3}`);
  }
  getFile(kind) {
    const ext = kind === "book" /* BOOK */ ? bookFormatExtension(this.format) : "dat";
    const entries = readdirSync(this.path);
    for (const entry of entries) {
      const fullPath = join3(this.path, entry);
      if (statSync(fullPath).isFile() && entry.startsWith(this.id) && entry.toLowerCase().endsWith(`.${ext}`)) {
        return fullPath;
      }
    }
    return join3(this.path, `${this.id}.${ext}`);
  }
  fileName(kind) {
    if (kind === "book" /* BOOK */) {
      return `${this.id}.${bookFormatExtension(this.format)}`;
    }
    const filePath = this.getFile(kind);
    return basename(filePath);
  }
};

// src/core/book/book-service.ts
import { existsSync as existsSync4 } from "fs";

// src/core/crypto/decrypt.ts
import { createDecipheriv } from "crypto";
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "fs";

// src/core/crypto/validation.ts
function isValidOutput(fmt, data) {
  if (fmt === "epub" /* EPUB */) {
    return data.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])) || data.subarray(0, 4).equals(Buffer.from([80, 75, 5, 6])) || data.subarray(0, 4).equals(Buffer.from([80, 75, 7, 8]));
  } else if (fmt === "pdf" /* PDF */) {
    return data.subarray(0, 4).equals(Buffer.from("%PDF"));
  }
  return false;
}
function removePKCS7Padding(data) {
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

// src/core/crypto/decrypt.ts
function decryptKey(bookInfo, deviceId) {
  const dataPath = bookInfo.getFile("data" /* DATA */);
  if (!existsSync2(dataPath)) {
    throw new Error(`Missing data file: ${dataPath}`);
  }
  const data = readFileSync2(dataPath);
  const key = Buffer.from(deviceId.substring(0, 16), "utf-8");
  const iv = data.subarray(0, 16);
  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([
    decipher.update(data.subarray(16)),
    decipher.final()
  ]);
  const plaintext = removePKCS7Padding(decrypted);
  if (plaintext.length < 84) {
    throw new Error(`.dat plaintext too short: ${plaintext.length} bytes`);
  }
  const sessionKey = Buffer.from(
    plaintext.subarray(68, 84).toString("utf-8", 0, 16),
    "utf-8"
  );
  if (sessionKey.length !== 16) {
    throw new Error("Invalid session key length");
  }
  return sessionKey;
}
function decryptBook(bookInfo, key) {
  const bookFilePath = bookInfo.getFile("book" /* BOOK */);
  if (!existsSync2(bookFilePath)) {
    throw new Error(`Book file not found: ${bookFilePath}`);
  }
  const raw = readFileSync2(bookFilePath);
  if (isValidOutput(bookInfo.format, raw)) {
    return raw;
  }
  if (raw.length < 16) {
    throw new Error("Book file too small to contain IV");
  }
  const iv = raw.subarray(0, 16);
  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([
    decipher.update(raw.subarray(16)),
    decipher.final()
  ]);
  return removePKCS7Padding(decrypted);
}

// src/core/metadata/extract.ts
import AdmZip from "adm-zip";
import { PDFDocument } from "pdf-lib";
function extractCover(fmt, data) {
  if (fmt === "epub" /* EPUB */) return extractCoverEpub(data);
  return null;
}
function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}=["']([^"']+)["']`));
  return m?.[1] ?? null;
}
function findEntry(zip, rawPath) {
  const path3 = rawPath.replace(/^\//, "");
  const exact = zip.getEntry(path3);
  if (exact) return exact;
  const lower = path3.toLowerCase();
  for (const e of zip.getEntries()) {
    if (e.entryName.toLowerCase() === lower) return e;
  }
  return null;
}
function resolvePath(base, href) {
  if (href.startsWith("/")) return href.slice(1);
  if (!base) return href;
  const clean = href.split("?")[0].split("#")[0];
  const segments = (base + clean).split("/");
  const resolved = [];
  for (const seg of segments) {
    if (seg === "..") resolved.pop();
    else if (seg !== ".") resolved.push(seg);
  }
  return resolved.join("/");
}
function extractCoverEpub(data) {
  try {
    const zip = new AdmZip(data);
    const containerEntry = findEntry(zip, "META-INF/container.xml");
    if (!containerEntry) return null;
    const containerXml = containerEntry.getData().toString("utf-8");
    const rootfileMatch = containerXml.match(/full-path=["']([^"']+)["']/);
    if (!rootfileMatch) return null;
    const opfPath = rootfileMatch[1];
    const opfDir = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";
    const opfEntry = findEntry(zip, opfPath);
    if (!opfEntry) return null;
    const opfXml = opfEntry.getData().toString("utf-8");
    const manifest = /* @__PURE__ */ new Map();
    for (const m of opfXml.matchAll(/<item\s[^>]+>/gi)) {
      const tag = m[0];
      const id = attr(tag, "id");
      const href = attr(tag, "href");
      const mediaType = attr(tag, "media-type") ?? "";
      if (id && href) manifest.set(id, { href, mediaType });
    }
    let coverHref = null;
    const metaCoverMatch = opfXml.match(/<meta[^>]*name=["']cover["'][^>]*>/i) ?? opfXml.match(/<meta[^>]*content=["'][^"']+["'][^>]*name=["']cover["'][^>]*>/i);
    if (metaCoverMatch) {
      const contentId = attr(metaCoverMatch[0], "content");
      if (contentId) coverHref = manifest.get(contentId)?.href ?? null;
    }
    if (!coverHref) {
      for (const m of opfXml.matchAll(/<item[^>]+>/gi)) {
        const tag = m[0];
        if (tag.includes("cover-image")) {
          const href = attr(tag, "href");
          if (href) {
            coverHref = href;
            break;
          }
        }
      }
    }
    if (!coverHref) {
      for (const [id, entry] of manifest) {
        if (id.toLowerCase().includes("cover") && entry.mediaType.startsWith("image/")) {
          coverHref = entry.href;
          break;
        }
      }
    }
    if (!coverHref) {
      const guideMatch = opfXml.match(/<reference[^>]+type=["']cover["'][^>]*>/i);
      if (guideMatch) coverHref = attr(guideMatch[0], "href");
    }
    if (!coverHref) {
      for (const [, entry] of manifest) {
        const name = entry.href.toLowerCase();
        if (name.includes("cover") && entry.mediaType.startsWith("image/")) {
          coverHref = entry.href;
          break;
        }
      }
    }
    if (!coverHref) {
      const firstSpineMatch = opfXml.match(/<itemref[^>]+idref=["']([^"']+)["'][^>]*>/i);
      if (firstSpineMatch) {
        const firstId = firstSpineMatch[1];
        const spineEntry = manifest.get(firstId);
        if (spineEntry?.mediaType.startsWith("image/")) {
          coverHref = spineEntry.href;
        }
      }
    }
    if (!coverHref) {
      const imageEntries = zip.getEntries().filter((e) => /\.(jpe?g|png|gif|webp)$/i.test(e.entryName) && !e.entryName.toLowerCase().includes("meta-inf")).sort((a, b) => a.entryName.localeCompare(b.entryName));
      if (imageEntries.length > 0) {
        const imgData2 = imageEntries[0].getData();
        let mime2 = "jpeg";
        if (imgData2[0] === 137 && imgData2[1] === 80) mime2 = "png";
        else if (imgData2[0] === 71 && imgData2[1] === 73) mime2 = "gif";
        else if (imgData2[0] === 82 && imgData2[1] === 73) mime2 = "webp";
        return `data:image/${mime2};base64,${imgData2.toString("base64")}`;
      }
    }
    if (!coverHref) return null;
    if (/\.x?html?($|\?)/i.test(coverHref)) {
      const htmlFullPath = resolvePath(opfDir, coverHref);
      const htmlEntry = findEntry(zip, htmlFullPath);
      if (htmlEntry) {
        const html = htmlEntry.getData().toString("utf-8");
        const imgMatch = html.match(/<img\s[^>]+>/i);
        if (imgMatch) {
          const src = attr(imgMatch[0], "src");
          if (src) {
            const htmlDir = htmlFullPath.includes("/") ? htmlFullPath.substring(0, htmlFullPath.lastIndexOf("/") + 1) : "";
            coverHref = resolvePath(htmlDir, src);
          }
        }
      }
    } else {
      coverHref = resolvePath(opfDir, coverHref);
    }
    const imgEntry = findEntry(zip, coverHref);
    if (!imgEntry) return null;
    const imgData = imgEntry.getData();
    let mime = "jpeg";
    if (imgData[0] === 137 && imgData[1] === 80) mime = "png";
    else if (imgData[0] === 71 && imgData[1] === 73) mime = "gif";
    else if (imgData[0] === 82 && imgData[1] === 73) mime = "webp";
    return `data:image/${mime};base64,${imgData.toString("base64")}`;
  } catch {
    return null;
  }
}
async function extractTitle(fmt, data) {
  if (fmt === "epub" /* EPUB */) {
    return extractTitleEpub(data);
  } else if (fmt === "pdf" /* PDF */) {
    return await extractTitlePdf(data);
  }
  return null;
}
function extractTitleEpub(data) {
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
async function extractTitlePdf(data) {
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

// src/core/book/library.ts
import { existsSync as existsSync3, readdirSync as readdirSync2, statSync as statSync2 } from "fs";
import { homedir as homedir3, platform as platform2 } from "os";
import { join as join4 } from "path";
function libraryPath(userIdx) {
  const plat = platform2();
  if (plat === "darwin") {
    const home = homedir3();
    return join4(
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
    if (!appdata || !existsSync3(appdata)) {
      throw new Error("APPDATA environment variable not found");
    }
    return join4(appdata, "Ridibooks", "library", `_${userIdx}`);
  }
  throw new Error("library_path() not implemented for this OS");
}
function discoverBooks(path3) {
  if (!existsSync3(path3)) {
    return [];
  }
  const infos = [];
  const entries = readdirSync2(path3);
  for (const entry of entries) {
    const fullPath = join4(path3, entry);
    if (statSync2(fullPath).isDirectory()) {
      try {
        infos.push(new BookInfo(fullPath));
      } catch {
        continue;
      }
    }
  }
  return infos;
}

// src/core/book/book-service.ts
var BookService = class {
  getAvailableBooks(userIdx) {
    const libPath = libraryPath(userIdx);
    if (!existsSync4(libPath)) {
      throw new Error(`Library path not found for user ${userIdx}: ${libPath}`);
    }
    const infos = discoverBooks(libPath).filter(
      (b) => existsSync4(b.getFile("data" /* DATA */))
    );
    if (infos.length === 0) {
      throw new Error("No books found in library.");
    }
    return infos;
  }
  filterById(books, id) {
    if (!id) return books;
    const filtered = books.filter((b) => b.id === id);
    if (filtered.length === 0) {
      throw new Error(`No books found with ID: ${id}`);
    }
    return filtered;
  }
  async filterByName(books, deviceId, name) {
    if (!name) return books;
    const matched = [];
    for (const book of books) {
      try {
        const key = decryptKey(book, deviceId);
        const content = decryptBook(book, key);
        const title = await extractTitle(book.format, content);
        if (title && title.includes(name)) {
          matched.push(book);
        }
      } catch {
        continue;
      }
    }
    return matched;
  }
  async getBooksWithMetadata(books, deviceId, onProgress) {
    const results = [];
    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      onProgress?.(i + 1, books.length, book.id);
      try {
        const key = decryptKey(book, deviceId);
        const content = decryptBook(book, key);
        const title = await extractTitle(book.format, content) || "Unknown Title";
        const cover = extractCover(book.format, content);
        results.push({ book, title, cover });
      } catch (e) {
        results.push({ book, title: `[Error: ${e}]`, cover: null });
      }
    }
    return results;
  }
};

// src/core/crypto/export-service.ts
import { existsSync as existsSync5, mkdirSync, writeFileSync } from "fs";
import { join as join5 } from "path";

// src/core/metadata/sanitize.ts
var UNSAFE_CHARS = /[\\/:*?"<>|]/g;
var WHITESPACE_RUN = /\s+/g;
var WINDOWS_RESERVED = /* @__PURE__ */ new Set([
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
  "LPT9"
]);
function sanitizeFilename(name, maxLen = 120) {
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

// src/core/crypto/export-service.ts
var ExportService = class {
  async exportBook(bookInfo, deviceId, outputDir, onProgress) {
    const fileName = bookInfo.fileName("book" /* BOOK */);
    onProgress?.({
      bookId: bookInfo.id,
      fileName,
      status: "processing"
    });
    try {
      const key = decryptKey(bookInfo, deviceId);
      const content = decryptBook(bookInfo, key);
      const title = await extractTitle(bookInfo.format, content);
      let outName;
      if (title) {
        outName = `${sanitizeFilename(title)}.${bookFormatExtension(bookInfo.format)}`;
      } else {
        outName = fileName;
      }
      if (!existsSync5(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
      let target = join5(outputDir, outName);
      if (existsSync5(target)) {
        const lastDot = outName.lastIndexOf(".");
        const stem = lastDot > 0 ? outName.substring(0, lastDot) : outName;
        const suffix = lastDot > 0 ? outName.substring(lastDot) : "";
        let i = 1;
        while (existsSync5(target) && i < 1e3) {
          target = join5(outputDir, `${stem} (${i})${suffix}`);
          i++;
        }
      }
      writeFileSync(target, content);
      onProgress?.({
        bookId: bookInfo.id,
        fileName,
        status: "success"
      });
      return target;
    } catch (error) {
      onProgress?.({
        bookId: bookInfo.id,
        fileName,
        status: "error",
        error
      });
      throw error;
    }
  }
  async exportBooks(books, deviceId, outputDir, onProgress) {
    let successCount = 0;
    for (const book of books) {
      try {
        await this.exportBook(book, deviceId, outputDir, onProgress);
        successCount++;
      } catch {
        continue;
      }
    }
    return { success: successCount, total: books.length };
  }
};

// src/core/config/config-service.ts
import { existsSync as existsSync6, mkdirSync as mkdirSync2, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "fs";
import { dirname } from "path";
var ConfigService = class {
  configPath;
  config;
  constructor(configPath) {
    this.configPath = configPath;
    this.config = this.load();
  }
  load() {
    if (!existsSync6(this.configPath)) {
      return { users: [], active_user: null };
    }
    try {
      const content = readFileSync3(this.configPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return { users: [], active_user: null };
    }
  }
  save() {
    try {
      const dir = dirname(this.configPath);
      if (!existsSync6(dir)) {
        mkdirSync2(dir, { recursive: true });
      }
      writeFileSync2(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        "utf-8"
      );
    } catch (e) {
      throw new Error(`Failed to save config: ${e}`);
    }
  }
  addUser(userIdx, deviceId, deviceName) {
    for (const user of this.config.users) {
      if (user.user_idx === userIdx && user.device_id === deviceId) {
        user.device_name = deviceName || "Unknown Device";
        this.config.active_user = this.makeId(userIdx, deviceId);
        this.save();
        return;
      }
    }
    const newUser = {
      id: this.makeId(userIdx, deviceId),
      user_idx: userIdx,
      device_id: deviceId,
      device_name: deviceName || "Unknown Device"
    };
    this.config.users.push(newUser);
    this.config.active_user = newUser.id;
    this.save();
  }
  makeId(userIdx, deviceId) {
    return `${userIdx}_${deviceId.substring(0, 8)}`;
  }
  getActiveUser() {
    if (!this.config.active_user) return null;
    for (const user of this.config.users) {
      if (user.id === this.config.active_user) {
        return user;
      }
    }
    return null;
  }
  switchUser(userId) {
    for (const user of this.config.users) {
      if (user.id === userId) {
        this.config.active_user = userId;
        this.save();
        return true;
      }
    }
    return false;
  }
  removeUser(userId) {
    const initialLen = this.config.users.length;
    this.config.users = this.config.users.filter((u) => u.id !== userId);
    if (this.config.users.length < initialLen) {
      if (this.config.active_user === userId) {
        this.config.active_user = this.config.users.length > 0 ? this.config.users[0].id : null;
      }
      this.save();
      return true;
    }
    return false;
  }
  listUsers() {
    return this.config.users;
  }
};

// src/gui/services/ipc-handlers.ts
var { ipcMain, dialog, shell } = electron;
function setupIpcHandlers(configPath) {
  const configService = new ConfigService(configPath);
  const authService = new AuthService(configService);
  const bookService = new BookService();
  const exportService = new ExportService();
  ipcMain.handle("auth:getLoginUrl", () => {
    return authService.getLoginUrl();
  });
  ipcMain.handle("auth:parseDeviceList", (_, jsonInput) => {
    return authService.parseDeviceList(jsonInput);
  });
  ipcMain.handle("auth:addDevice", (_, device) => {
    authService.addDevice(device);
  });
  ipcMain.handle("auth:autoLogin", async () => {
    const diagnostics = [];
    try {
      diagnostics.push("[1/4] \uC571 \uC778\uC99D \uB370\uC774\uD130 \uD655\uC778 \uC911...");
      const appAuthService = new AppAuthService();
      const appAuth = await appAuthService.getAppAuthData();
      if (!appAuth) {
        const deviceOnlyAuth = await appAuthService.getDeviceIdOnly();
        if (deviceOnlyAuth) {
          diagnostics.push(`[1/4] \u26A0\uFE0F refreshToken \uC5C6\uC74C \u2014 deviceId\uB9CC \uD655\uC778\uB428: ${deviceOnlyAuth.deviceId.substring(0, 8)}...`);
          diagnostics.push("[1/4] \u2139\uFE0F \uC774\uBBF8 \uB4F1\uB85D\uB41C \uC0AC\uC6A9\uC790\uAC00 \uC5C6\uC5B4 \uC218\uB3D9 \uB4F1\uB85D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4");
          console.warn("[autoLogin]", diagnostics.join("\n"));
          return { success: false, diagnostics };
        }
        diagnostics.push("[1/4] \u274C \uC571 \uC778\uC99D \uB370\uC774\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC74C (Ridi \uC571\uC774 \uC124\uCE58/\uB85C\uADF8\uC778 \uB418\uC5B4\uC788\uB294\uC9C0 \uD655\uC778)");
        console.error("[autoLogin]", diagnostics.join("\n"));
        return { success: false, diagnostics };
      }
      diagnostics.push(`[1/4] \u2705 \uC778\uC99D \uB370\uC774\uD130 \uD655\uC778\uB428 \u2014 \uC0AC\uC6A9\uC790: ${appAuth.username}, \uB514\uBC14\uC774\uC2A4: ${appAuth.deviceId.substring(0, 8)}...`);
      diagnostics.push("[2/4] OAuth \uC790\uACA9\uC99D\uBA85 \uD655\uC778 \uC911...");
      if (!RIDI_OAUTH_CLIENT_ID || !RIDI_OAUTH_CLIENT_SECRET) {
        diagnostics.push("[2/4] \u274C OAuth \uC790\uACA9\uC99D\uBA85 \uB204\uB77D (RIDI_OAUTH_CLIENT_ID / RIDI_OAUTH_CLIENT_SECRET \uD658\uACBD\uBCC0\uC218 \uD544\uC694)");
        console.error("[autoLogin]", diagnostics.join("\n"));
        return { success: false, diagnostics };
      }
      diagnostics.push("[2/4] \u2705 OAuth \uC790\uACA9\uC99D\uBA85 \uD655\uC778\uB428");
      diagnostics.push("[3/4] \uD1A0\uD070 \uAC31\uC2E0 \uBC0F \uB514\uBC14\uC774\uC2A4 \uC870\uD68C \uC911...");
      const result = await authService.autoLogin();
      if (!result) {
        diagnostics.push("[3/4] \u274C \uD1A0\uD070 \uAC31\uC2E0 \uB610\uB294 \uB514\uBC14\uC774\uC2A4 \uB9E4\uCE6D \uC2E4\uD328");
        console.error("[autoLogin]", diagnostics.join("\n"));
        return { success: false, diagnostics };
      }
      diagnostics.push(`[3/4] \u2705 \uB85C\uADF8\uC778 \uC131\uACF5 \u2014 ${result.username}`);
      diagnostics.push("[4/4] \uB514\uBC14\uC774\uC2A4 \uC815\uBCF4 \uC800\uC7A5 \uC911...");
      authService.addDevice(result.device);
      diagnostics.push("[4/4] \u2705 \uC800\uC7A5 \uC644\uB8CC");
      console.log("[autoLogin] \uC131\uACF5:", diagnostics.join("\n"));
      return {
        success: true,
        device: result.device,
        username: result.username,
        diagnostics
      };
    } catch (err) {
      diagnostics.push(`\u274C \uC608\uC678 \uBC1C\uC0DD: ${err.message}`);
      console.error("[autoLogin] \uC608\uC678:", err);
      return { success: false, diagnostics };
    }
  });
  ipcMain.handle("auth:listUsers", () => {
    return authService.listUsers();
  });
  ipcMain.handle("auth:switchUser", (_, userId) => {
    return authService.switchUser(userId);
  });
  ipcMain.handle("auth:removeUser", (_, userId) => {
    return authService.removeUser(userId);
  });
  ipcMain.handle("auth:getActiveUser", () => {
    return authService.getActiveUser();
  });
  ipcMain.handle("books:getAvailableBooks", async (_event) => {
    const user = configService.getActiveUser();
    console.log("[books] activeUser:", JSON.stringify(user));
    if (!user) {
      console.log("[books] \u274C \uD65C\uC131 \uC0AC\uC6A9\uC790 \uC5C6\uC74C");
      return [];
    }
    const appdata = process.env.APPDATA;
    const libPath = path.join(appdata || "", "Ridibooks", "library", `_${user.user_idx}`);
    console.log("[books] \uD0D0\uC0C9 \uACBD\uB85C:", libPath);
    console.log("[books] \uACBD\uB85C \uC874\uC7AC:", fs.existsSync(libPath));
    const libraryRoot = path.join(appdata || "", "Ridibooks", "library");
    if (fs.existsSync(libraryRoot)) {
      const dirs = fs.readdirSync(libraryRoot);
      console.log("[books] library/ \uD558\uC704 \uD3F4\uB354:", dirs);
    } else {
      console.log("[books] \u274C library \uD3F4\uB354 \uC790\uCCB4\uAC00 \uC5C6\uC74C:", libraryRoot);
      const ridiRoot = path.join(appdata || "", "Ridibooks");
      if (fs.existsSync(ridiRoot)) {
        const ridiDirs = fs.readdirSync(ridiRoot);
        console.log("[books] Ridibooks/ \uD558\uC704:", ridiDirs);
      } else {
        console.log("[books] \u274C Ridibooks \uD3F4\uB354 \uC5C6\uC74C:", ridiRoot);
      }
    }
    try {
      const books = bookService.getAvailableBooks(user.user_idx);
      console.log("[books] \uBC1C\uACAC\uB41C \uCC45:", books.length);
      const booksWithMeta = await bookService.getBooksWithMetadata(books, user.device_id);
      return booksWithMeta;
    } catch (err) {
      console.error("[books] \uC5D0\uB7EC:", err.message);
      return [];
    }
  });
  ipcMain.handle("export:exportBook", async (event, book, deviceId, outputDir) => {
    const bookInfo = new BookInfo(book.path);
    return exportService.exportBook(bookInfo, deviceId, outputDir, (progress) => {
      event.sender.send("export:progress", progress);
    });
  });
  ipcMain.handle("export:exportBooks", async (event, books, deviceId, outputDir) => {
    const bookInfos = books.map((b) => new BookInfo(b.path));
    return exportService.exportBooks(bookInfos, deviceId, outputDir, (progress) => {
      event.sender.send("export:progress", progress);
    });
  });
  ipcMain.handle("util:selectFolder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"]
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("util:openExternal", (_, url) => {
    return shell.openExternal(url);
  });
  ipcMain.handle("books:getAvailableBooksForUser", async (_, userId) => {
    try {
      const books = bookService.getAvailableBooks(userId);
      const activeUser = configService.getActiveUser();
      const deviceId = activeUser?.device_id || "";
      return bookService.getBooksWithMetadata(books, deviceId);
    } catch (err) {
      console.error("[books:getAvailableBooksForUser] \uC5D0\uB7EC:", err.message);
      return [];
    }
  });
  ipcMain.handle("user:getActiveUser", () => authService.getActiveUser());
  ipcMain.handle("user:switchUser", (_, userId) => authService.switchUser(userId));
  ipcMain.handle("user:removeUser", (_, userId) => authService.removeUser(userId));
  ipcMain.handle("user:listUsers", () => authService.listUsers());
  const tokenStore = /* @__PURE__ */ new Map();
  ipcMain.handle("auth:getToken", (_, userId) => tokenStore.get(userId) ?? null);
  ipcMain.handle("auth:saveToken", (_, userId, token) => {
    tokenStore.set(userId, token);
  });
  ipcMain.handle("auth:removeToken", (_, userId) => {
    tokenStore.delete(userId);
  });
}

// src/gui/main.ts
var { app, BrowserWindow } = electron2;
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
function createWindow() {
  const isDev = process.env.NODE_ENV !== "production";
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#1C1C1C",
    show: false,
    webPreferences: {
      preload: isDev ? path2.join(__dirname, "dist", "preload.js") : path2.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path2.join(__dirname, "../../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
  });
}
app.whenReady().then(() => {
  setupIpcHandlers(CONFIG_FILE);
  createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
