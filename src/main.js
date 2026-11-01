'use strict';

// Kingdom Attendance desktop app: runs the server in the tray, makes the video on Finalize
// and hands it to M³. Closing the window keeps it running; Quit from the tray stops it.

const path = require('node:path');
const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, shell, clipboard, nativeImage } = require('electron');
const QRCode = require('qrcode');
const { createService } = require('./core/service');
const { createServer } = require('./core/server');
const { loadSettings, saveSettings, newPin } = require('./core/settings');
const { deliverVideo } = require('./core/m3');
const { renderAttendance } = require('./render/recorder');

// Developer switches: ATT_DATA_DIR uses a scratch data folder; ATT_SHOT saves a screenshot of the window.
if (process.env.ATT_DATA_DIR) app.setPath('userData', path.resolve(process.env.ATT_DATA_DIR));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win = null;
  let tray = null;
  let server = null;
  let service = null;
  let quitting = false;
  const ICON = path.join(__dirname, '..', 'assets', 'icon.png');
  const dataDir = () => app.getPath('userData');
  const getSettings = () => loadSettings(dataDir());

  const applyLoginItem = (s) => {
    if (!app.isPackaged) return; // only the installed app starts with Windows
    app.setLoginItemSettings({ openAtLogin: !!s.openAtLogin, args: ['--hidden'] });
  };

  function slideUrl({ meeting, totals, congregation, theme }) {
    const q = new URLSearchParams({
      hall: totals.hall, zoom: totals.zoom, total: totals.total, type: meeting.type, date: meeting.date, cong: congregation, theme,
    });
    return `http://127.0.0.1:${server.port}/slide?${q}`;
  }

  const renderer = (args) => renderAttendance({
    slideUrl: slideUrl(args),
    outDir: path.join(dataDir(), 'slides'),
    fileBase: `Attendance ${args.meeting.date} ${args.meeting.type === 'weekend' ? 'Weekend' : 'Midweek'}`,
  });

  const deliver = ({ mp4, dateKey }) => deliverVideo({
    mp4, dateKey, sharedFolder: getSettings().m3Folder, desktopDir: app.getPath('desktop'),
  });

  function showWindow() {
    if (!win) {
      win = new BrowserWindow({
        width: 820, height: 760, minWidth: 420, minHeight: 520, show: false, icon: ICON, title: 'Kingdom Attendance',
        autoHideMenuBar: true,
        webPreferences: { preload: path.join(__dirname, 'renderer', 'preload.js'), contextIsolation: true, nodeIntegration: false },
      });
      win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
      win.once('ready-to-show', () => {
        win.show();
        if (process.env.ATT_SHOT) {
          setTimeout(async () => require('node:fs').writeFileSync(process.env.ATT_SHOT, (await win.webContents.capturePage()).toPNG()), 1500);
        }
      });
      win.on('close', (e) => { if (!quitting) { e.preventDefault(); win.hide(); } });
      win.on('closed', () => { win = null; });
    } else {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  }

  async function confirmQuit() {
    const rendering = service && service.getState().render.status === 'rendering';
    const { response } = await dialog.showMessageBox(win && win.isVisible() ? win : null, {
      type: 'question', buttons: ['Quit', 'Cancel'], defaultId: 1, cancelId: 1, title: 'Quit Kingdom Attendance',
      message: rendering ? 'The video is still being made. Quit anyway?' : 'Quit Kingdom Attendance?',
      detail: 'Phones and the OBS dock stop working until it is opened again. The count is saved.',
    });
    if (response !== 0) return;
    quitting = true;
    app.quit();
  }

  function buildTray() {
    const img = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 });
    tray = new Tray(img);
    tray.setToolTip('Kingdom Attendance');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Kingdom Attendance', click: showWindow },
      { label: 'Open the dock in the browser', click: () => shell.openExternal(server.urls().dock) },
      { type: 'separator' },
      { label: 'Quit', click: confirmQuit },
    ]));
    tray.on('click', showWindow);
  }

  async function info() {
    const u = server.urls();
    return { ...u, port: server.port, pin: getSettings().pin, qr: await QRCode.toDataURL(u.count, { margin: 1, width: 360 }), settings: getSettings() };
  }

  ipcMain.handle('info', info);
  ipcMain.handle('save', (_e, patch) => {
    const allowed = ['congregation', 'm3Folder', 'theme', 'openAtLogin'];
    const clean = Object.fromEntries(Object.entries(patch || {}).filter(([k]) => allowed.includes(k)));
    if (clean.theme && !['light', 'dark'].includes(clean.theme)) delete clean.theme;
    const s = saveSettings(dataDir(), clean);
    if ('openAtLogin' in clean) applyLoginItem(s);
    return info();
  });
  ipcMain.handle('new-pin', () => { saveSettings(dataDir(), { pin: newPin() }); return info(); });
  ipcMain.handle('browse-m3', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Choose the M³ shared folder', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return info();
    saveSettings(dataDir(), { m3Folder: r.filePaths[0] });
    return info();
  });
  ipcMain.handle('copy', (_e, text) => { clipboard.writeText(String(text)); return true; });
  ipcMain.handle('open', (_e, url) => {
    if (/^http:\/\/(localhost|127\.0\.0\.1|attendance\.local|\d+\.\d+\.\d+\.\d+)(:\d+)?\//.test(url)) shell.openExternal(url);
    return true;
  });
  ipcMain.handle('open-folder', (_e, which) => {
    const s = getSettings();
    const dir = which === 'm3' && s.m3Folder ? s.m3Folder : path.join(dataDir(), 'slides');
    return shell.openPath(dir);
  });

  app.on('second-instance', showWindow);
  app.on('window-all-closed', () => { /* stay in the tray */ });
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', (e) => {
    if (!server) return;
    e.preventDefault();
    const s = server;
    server = null;
    s.close().finally(() => app.exit(0));
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.symbobingo12.attendance');
    service = createService({ dataDir: dataDir(), getSettings, renderer, deliver });
    server = createServer(service, { settings: getSettings, webDir: path.join(__dirname, '..', 'web') });
    try {
      await server.listen();
    } catch (err) {
      dialog.showErrorBox('Kingdom Attendance could not start', `Ports ${getSettings().port} and ${getSettings().port + 1} are both in use.\n\n${err.message}`);
      quitting = true;
      app.quit();
      return;
    }
    applyLoginItem(getSettings());
    buildTray();
    if (!process.argv.includes('--hidden')) showWindow();
  });
}
