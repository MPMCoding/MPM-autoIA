// Adiciona a interface IpcRenderer ao preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expõe APIs específicas do Electron para o renderer process
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  platform: process.platform,
  
  // Métodos para obter dados
  getAutomationPort: () => {
    return 3000; // Porta padrão para a automação
  },
  
  getActivities: async () => {
    try {
      const result = await ipcRenderer.invoke('db-get-activities');
      return result;
    } catch (error) {
      console.error('Erro ao obter atividades:', error);
      return [];
    }
  },
  
  // Expõe o ipcRenderer para comunicação com o processo principal
  ipcRenderer: {
    on: (channel, listener) => {
      ipcRenderer.on(channel, listener);
    },
    once: (channel, listener) => {
      ipcRenderer.once(channel, listener);
    },
    send: (channel, ...args) => {
      ipcRenderer.send(channel, ...args);
    },
    invoke: (channel, ...args) => {
      return ipcRenderer.invoke(channel, ...args);
    },
    removeListener: (channel, listener) => {
      ipcRenderer.removeListener(channel, listener);
    },
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  }
});
