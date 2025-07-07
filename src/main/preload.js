const { contextBridge, ipcRenderer } = require('electron');

// Secure bridge between renderer and main processes
// Only exposes whitelisted IPC channels and methods
contextBridge.exposeInMainWorld(
    'api', {
        send: (channel, data) => {
            let validChannels = ['toMain'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, func) => {
            let validChannels = ['fromMain', 'project-error', 'project-opened', 'toggle-feather', 'save-project'];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        },
        invoke: (channel, data) => {
            let validChannels = ['read-script-content', 'update-object-property', 'read-sprite-image', 'read-functions-xml', 'save-file'];
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, data);
            }
            return Promise.reject(new Error(`Invalid channel: ${channel}`));
        }
    }
); 