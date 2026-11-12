const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Classic scripts run in a fresh global per test. Only browser presentation
// and timers are stubbed; the model, encoders and scheduler are real.
module.exports = function runtime(scripts = [], globals = {}) {
  const element = { textContent: '', style: {}, children: [], classList: { toggle() {}, add() {}, remove() {} } };
  const context = vm.createContext({
    ...globals, console, Float32Array, Uint8Array, ArrayBuffer, DataView, Blob, navigator: {},
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    document: {
      readyState: 'loading', addEventListener() {}, querySelectorAll() { return []; },
      getElementById() { return element; }
    }
  });
  for (const name of ['core', ...scripts]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../web/js', name + '.js'), 'utf8'), context);
  }
  const mw = context.MW;
  if (mw.app) {
    mw.panels = { refresh() {}, show() {} };
    mw.displays = { refresh() {} };
    mw.grid = { render() {} };
    mw.renderSeqBox = () => {};
    mw.touchPrefs = () => {};
    mw.app.song = mw.createSong();
    mw.player.setSong(mw.app.song);
  }
  return mw;
};
