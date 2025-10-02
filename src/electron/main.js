import { app, BrowserWindow } from 'electron';
import path from 'path';

const ROOT = '/dist-react/index.html';
const inDevelopment = process.env.NODE_ENV === 'development';

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(app.getAppPath(), '/src/electron/preload.js'),
    },
  });

  if (inDevelopment) {
    win.loadURL('http://localhost:5123');
  } else win.loadFile(path.join(app.getAppPath() + ROOT));
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
