// Shared helpers: builds a fake Item Market page and runs the userscript inside jsdom.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const SCRIPT_PATH = path.join(__dirname, '..', 'torn-market-shop-price-highlighter.user.js');
const SCRIPT = fs.readFileSync(SCRIPT_PATH, 'utf8');

// Mimics one Item Market listing row: item image (carries the id), name, quantity and price.
function listing(id, name, price, qty) {
  return `
  <div class="rowWrapper___abc" data-test-row="${id}">
    <div class="itemInfo___x">
      <img class="image___amEc7" alt="${name}" src="/images/items/${id}/medium.png">
      <span class="name___y">${name}</span>
      <span class="qty___z">x${qty}</span>
    </div>
    <div class="priceCol___p"><span class="price___q">$${price.toLocaleString('en-US')}</span></div>
    <button>Buy</button>
  </div>`;
}

// Shop prices from the embedded table: 50 -> 750,000 | 49 -> 60,000 | 176 -> 3,100 | 1 -> 50 | 2 -> 130 | 33 -> 7,500
const PAGE = `<!doctype html><html><head></head><body>
  <div class="filtersWrapper___ECZPi">
    <button type="button"><div><span><img alt="Outer Tactical Vest" src="/images/items/50/medium.png"></span>Outer Tactical Vest</div></button>
    <div><span>$</span><input value="0"></div>
    <ul role="listbox">
      <li role="option"><img alt="Flak Jacket" src="/images/items/178/medium.png">Flak Jacket</li>
    </ul>
  </div>
  <div class="listings___L" id="list">
    ${listing(50, 'Outer Tactical Vest', 600000, 3)}
    ${listing(49, 'Full Body Armor', 45000, 1)}
    ${listing(176, 'Chain Mail', 2000, 12)}
    ${listing(1, 'Hammer', 49, 5)}
    ${listing(2, 'Baseball Bat', 500, 1)}
    ${listing(99999, 'Unknown Item', 10, 1)}
  </div>
</body></html>`;

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// Every window we open; closed by closeAll() so the test process can exit cleanly.
const windows = [];
function closeAll() {
  for (const w of windows.splice(0)) w.close();
}

// In-memory stand-in for Torn PDA's PDA_storage (async, per-script key/value store).
function fakePdaStorage() {
  const store = new Map();
  return {
    store,
    async get(key, def) { return store.has(key) ? store.get(key) : def; },
    async set(key, value) { store.set(key, JSON.parse(JSON.stringify(value))); },
    async delete(key) { store.delete(key); },
  };
}

/**
 * Boots the script on the fake page.
 * @param {object} [opts]
 * @param {string} [opts.savedSettings]  JSON to seed localStorage with before the script runs
 * @param {object} [opts.pdaStorage]     object to expose as window.PDA_storage
 */
async function boot(opts = {}) {
  const dom = new JSDOM(PAGE, {
    url: 'https://www.torn.com/page.php?sid=ItemMarket',
    runScripts: 'outside-only',
    beforeParse(window) {
      if (opts.savedSettings) window.localStorage.setItem('tmsh_settings', opts.savedSettings);
      if (opts.pdaStorage) window.PDA_storage = opts.pdaStorage;
    },
  });
  const { window } = dom;
  windows.push(window);
  window.eval(SCRIPT);
  await tick(); // boot() is async (storage load)
  const doc = window.document;
  return {
    dom,
    window,
    doc,
    row: (id) => doc.querySelector(`[data-test-row="${id}"]`),
    priceEl: (id) => doc.querySelector(`[data-test-row="${id}"] .price___q`),
    color: (id) => doc.querySelector(`[data-test-row="${id}"]`).style.getPropertyValue('--tmsh-color'),
    fab: () => doc.getElementById('tmsh-fab'),
    panel: () => doc.getElementById('tmsh-panel'),
    badge: () => doc.querySelector('#tmsh-fab .tmsh-count'),
    listing,
    tick,
  };
}

module.exports = { boot, closeAll, listing, tick, fakePdaStorage, SCRIPT };
