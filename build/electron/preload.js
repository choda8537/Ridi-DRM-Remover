// src/gui/preload.ts
import { contextBridge, ipcRenderer } from "electron";
console.log("[Preload] Electron IPC \uBE0C\uB9BF\uC9C0 \uC2DC\uC791");
try {
  contextBridge.exposeInMainWorld("electronAPI", {
    auth: {
      getLoginUrl: () => ipcRenderer.invoke("auth:getLoginUrl"),
      parseDeviceList: (jsonInput) => ipcRenderer.invoke("auth:parseDeviceList", jsonInput),
      addDevice: (device) => ipcRenderer.invoke("auth:addDevice", device),
      listUsers: () => ipcRenderer.invoke("auth:listUsers"),
      switchUser: (userId) => ipcRenderer.invoke("auth:switchUser", userId),
      removeUser: (userId) => ipcRenderer.invoke("auth:removeUser", userId),
      getActiveUser: () => ipcRenderer.invoke("auth:getActiveUser"),
      autoLogin: () => ipcRenderer.invoke("auth:autoLogin"),
      getToken: (userId) => ipcRenderer.invoke("auth:getToken", userId),
      saveToken: (userId, token) => ipcRenderer.invoke("auth:saveToken", userId, token),
      removeToken: (userId) => ipcRenderer.invoke("auth:removeToken", userId)
    },
    user: {
      getActiveUser: () => ipcRenderer.invoke("user:getActiveUser"),
      switchUser: (userId) => ipcRenderer.invoke("user:switchUser", userId),
      removeUser: (userId) => ipcRenderer.invoke("user:removeUser", userId),
      listUsers: () => ipcRenderer.invoke("user:listUsers")
    },
    books: {
      getAvailableBooks: () => ipcRenderer.invoke("books:getAvailableBooks"),
      getAvailableBooksForUser: (userId) => ipcRenderer.invoke("books:getAvailableBooksForUser", userId)
    },
    export: {
      exportBook: (book, deviceId, outputDir) => ipcRenderer.invoke("export:exportBook", book, deviceId, outputDir),
      exportBooks: (books, deviceId, outputDir) => ipcRenderer.invoke("export:exportBooks", books, deviceId, outputDir),
      onProgress: (callback) => ipcRenderer.on("export:progress", (_event, progress) => callback(progress))
    },
    util: {
      selectFolder: () => ipcRenderer.invoke("util:selectFolder"),
      openExternal: (url) => ipcRenderer.invoke("util:openExternal", url)
    },
    getLibrary: () => ipcRenderer.invoke("books:getAvailableBooks")
  });
  console.log("[Preload] Electron IPC \uBE0C\uB9BF\uC9C0 \uB85C\uB4DC \uC644\uB8CC \u2705");
} catch (error) {
  console.error("[Preload] \uBE0C\uB9BF\uC9C0 \uB85C\uB4DC \uC2E4\uD328:", error);
}
