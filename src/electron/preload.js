const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
  /**======================
   *    Expose API here
   *========================**/
});
