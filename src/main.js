'use strict';

// Kingdom Attendance desktop app: runs the server in the tray, makes the video on Finalize
// and hands it to M³. Closing the window keeps it running; Quit from the tray stops it.

const path = require('node:path');
const { app, BrowserWindow, Tray, Menu, dialog, shell, nativeImage, nativeTheme, screen } = require('electron');
const { createService } = require('./core/service');
const { createServer } = require('./core/server');
const { loadSettings, saveSettings, newPin, appearanceOf } = require('./core/settings');
const { deliverVideo } = require('./core/m3');
const { renderAttendance } = require('./render/recorder');
const { createUpdates } = require('./core/updates');

// Developer switches: ATT_DATA_DIR uses a scratch data folder; ATT_SHOT saves a screenshot of the window.
if (process.env.ATT_DATA_DIR) app.setPath('userData', path.resolve(process.env.ATT_DATA_DIR));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win = null;
  let tray = null;
  let server = null;
  let service = null;
  let updates = null;
  let quitting = false;
  const ICON = path.join(__dirname, '..', 'assets', 'icon.png');
  const dataDir = () => app.getPath('userData');
  const getSettings = () => loadSettings(dataDir());

  const applyLoginItem = (s) => {
    if (!app.isPackaged) return; // only the installed app starts with Windows
    app.setLoginItemSettings({ openAtLogin: !!s.openAtLogin, args: ['--hidden'] });
  };

  // The window's colours; "system" makes it follow Windows' own light or dark setting.
  const applyAppearance = (s) => {
    nativeTheme.themeSource = appearanceOf(s) === 'auto' ? 'system' : appearanceOf(s);
    if (win) win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#121a2b' : '#ffffff');
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
      // Wide enough for the desktop layout (sidebar from 900 px), but never bigger than the screen.
      const area = screen.getPrimaryDisplay().workAreaSize;
      win = new BrowserWindow({
        width: Math.min(1280, area.width), height: Math.min(820, area.height), minWidth: 420, minHeight: 520, show: false, icon: ICON, title: 'Kingdom Attendance',
        backgroundColor: nativeTheme.shouldUseDarkColors ? '#121a2b' : '#ffffff', // the page colour, so opening doesn't flash
        autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      // The window is the same web app phones use, on this computer (so it counts as the AV computer).
      const appUrl = `http://127.0.0.1:${server.port}/`;
      const external = (url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); };
      win.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
      win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(appUrl)) { e.preventDefault(); external(url); } });
      win.loadURL(appUrl);
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

  // New versions come from the installer's GitHub releases; a developer run has nothing to update.
  function setupUpdates() {
    const supported = app.isPackaged && process.platform === 'win32';
    updates = createUpdates({
      updater: supported ? require('electron-updater').autoUpdater : null,
      reason: 'Updates only work in the installed app.',
      isEnabled: () => getSettings().autoUpdate,
      isBusy: () => service.getState().render.status === 'rendering',
    });
    updates.start();
  }

  // What the web app's Settings asks the desktop app to do; only the AV computer itself can call these.
  const host = {
    version: app.getVersion(),
    saveSettings(patch) {
      const s = saveSettings(dataDir(), patch);
      if ('openAtLogin' in patch) applyLoginItem(s);
      if ('appearance' in patch) applyAppearance(s);
      return s;
    },
    newPin: () => saveSettings(dataDir(), { pin: newPin() }),
    async chooseFolder() {
      const r = await dialog.showOpenDialog(win, { title: 'Choose the M³ shared folder', properties: ['openDirectory'] });
      if (r.canceled || !r.filePaths[0]) return null;
      saveSettings(dataDir(), { m3Folder: r.filePaths[0] });
      return r.filePaths[0];
    },
    openFolder(which) {
      const s = getSettings();
      shell.openPath(which === 'm3' && s.m3Folder ? s.m3Folder : path.join(dataDir(), 'slides'));
    },
    updateStatus: () => (updates ? updates.status() : { state: 'idle', message: '', version: null, percent: 0 }),
    checkUpdate: () => updates.check(),
    installUpdate: () => updates.install(), // false while the video is being made
  };

  app.on('second-instance', showWindow);
  app.on('window-all-closed', () => { /* stay in the tray */ });
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', (e) => {
    if (!server) return;
    e.preventDefault();
    const s = server;
    server = null;
    // quit again rather than app.exit(), so a downloaded update is installed on the way out
    s.close().finally(() => app.quit());
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.symbobingo12.attendance');
    service = createService({ dataDir: dataDir(), getSettings, renderer, deliver });
    server = createServer(service, { settings: getSettings, webDir: path.join(__dirname, '..', 'web'), host });
    try {
      await server.listen();
    } catch (err) {
      dialog.showErrorBox('Kingdom Attendance could not start', `Ports ${getSettings().port} and ${getSettings().port + 1} are both in use.\n\n${err.message}`);
      quitting = true;
      app.quit();
      return;
    }
    applyLoginItem(getSettings());
    applyAppearance(getSettings());
    setupUpdates();
    buildTray();
    if (!process.argv.includes('--hidden')) showWindow();
  });
}
