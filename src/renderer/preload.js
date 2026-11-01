'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('attendance', {
  info: () => ipcRenderer.invoke('info'),
  save: (patch) => ipcRenderer.invoke('save', patch),
  newPin: () => ipcRenderer.invoke('new-pin'),
  browseM3: () => ipcRenderer.invoke('browse-m3'),
  copy: (text) => ipcRenderer.invoke('copy', text),
  open: (url) => ipcRenderer.invoke('open', url),
  openFolder: (which) => ipcRenderer.invoke('open-folder', which),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdate: (fn) => ipcRenderer.on('update', (_e, status) => fn(status)),
});
