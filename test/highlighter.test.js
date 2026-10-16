'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { boot, closeAll, fakePdaStorage } = require('./helpers');

after(closeAll);

const GREEN = '#2ecc71', YELLOW = '#f1c40f', RED = '#e74c3c', BLUE = '#3b1ee0';

describe('initial scan', () => {
  test('highlights profitable rows with the right tier colour', async () => {
    const t = await boot();
    assert.ok(t.row(50).classList.contains('tmsh-good'));
    assert.equal(t.color(50), GREEN);   // 750k - 600k = 150k
    assert.equal(t.color(49), YELLOW);  // 60k - 45k = 15k
    assert.equal(t.color(176), RED);    // 3,100 - 2,000 = 1,100
    assert.equal(t.color(1), BLUE);     // 50 - 49 = 1
    assert.equal(t.doc.querySelectorAll('.tmsh-good').length, 4);
  });

  test('ignores losses, unknown items and the filter bar', async () => {
    const t = await boot();
    assert.ok(!t.row(2).classList.contains('tmsh-good'));
    assert.ok(!t.row(99999).classList.contains('tmsh-good'));
    assert.ok(!t.doc.querySelector('.filtersWrapper___ECZPi').classList.contains('tmsh-good'));
  });

  test('writes inline labels and tooltips, inserts no nodes into rows', async () => {
    const t = await boot();
    assert.equal(t.priceEl(50).getAttribute('data-tmsh-label'), '+150k (450k)');
    assert.equal(t.priceEl(49).getAttribute('data-tmsh-label'), '+15k');          // qty 1 -> no total
    assert.equal(t.priceEl(176).getAttribute('data-tmsh-label'), '+1.1k (13.2k)');
    assert.equal(t.priceEl(1).getAttribute('data-tmsh-label'), '+1 (5)');
    assert.ok(t.priceEl(50).hasAttribute('data-tmsh-dot'));
    assert.match(t.priceEl(50).title, /Shop pays \$750,000/);
    assert.match(t.priceEl(176).title, /12 x = \$13,200 total/);
    assert.equal(t.row(50).children.length, 3, 'row child count unchanged');
    assert.equal(t.row(50).querySelector('[class^="tmsh"]'), null);
  });

  test('badge shows the count and the panel starts hidden', async () => {
    const t = await boot();
    assert.equal(t.badge().textContent, '4');
    assert.equal(t.badge().hidden, false);
    assert.equal(t.panel().hidden, true);
  });
});

describe('settings panel', () => {
  test('opens, lists tiers and shows the price table date', async () => {
    const t = await boot();
    t.fab().click();
    assert.equal(t.panel().hidden, false);
    assert.equal(t.panel().querySelectorAll('input.tmsh-min').length, 4);
    assert.match(t.panel().textContent, /generated \d{4}-\d{2}-\d{2} \(\d+ items\)/);
    assert.match(t.panel().textContent, /localStorage/);
  });

  test('edits survive re-render, save applies and persists', async () => {
    const t = await boot();
    t.fab().click();
    const panel = t.panel();
    panel.querySelector('#tmsh-hide').checked = true;
    panel.querySelector('input.tmsh-min').value = '200000';          // green: 50k -> 200k
    panel.querySelectorAll('button[data-act="del"]')[3].click();     // remove blue
    assert.equal(panel.querySelectorAll('input.tmsh-min').length, 3);
    assert.equal(panel.querySelector('#tmsh-hide').checked, true, 'checkbox survived re-render');
    assert.equal(panel.querySelector('input.tmsh-min').value, '200000', 'threshold survived re-render');

    panel.querySelector('button[data-act="save"]').click();
    await t.tick();
    assert.equal(panel.hidden, true);
    assert.equal(t.color(50), YELLOW, 'OTV dropped to yellow');
    assert.ok(t.row(1).classList.contains('tmsh-hide'), 'Hammer hidden: blue tier gone + hide on');
    assert.ok(t.row(2).classList.contains('tmsh-hide'), 'loss row hidden');
    assert.ok(t.row(99999).classList.contains('tmsh-hide'), 'unknown item hidden');
    assert.equal(t.badge().textContent, '3');

    const stored = JSON.parse(t.window.localStorage.getItem('tmsh_settings'));
    assert.equal(stored.hideUnprofitable, true);
    assert.equal(stored.tiersAbs.length, 3);
    assert.equal(stored.tiersAbs[0].min, 200000);
  });

  test('saved settings are applied on the next load', async () => {
    const first = await boot();
    first.fab().click();
    first.panel().querySelector('#tmsh-hide').checked = true;
    first.panel().querySelector('button[data-act="save"]').click();
    await first.tick();
    const saved = first.window.localStorage.getItem('tmsh_settings');

    const second = await boot({ savedSettings: saved });
    assert.ok(second.row(2).classList.contains('tmsh-hide'));
  });

  test('percent mode switches tiers and labels', async () => {
    const t = await boot();
    t.fab().click();
    const panel = t.panel();
    const sel = panel.querySelector('#tmsh-mode');
    sel.value = 'pct';
    sel.dispatchEvent(new t.window.Event('change', { bubbles: true }));
    assert.equal(panel.querySelector('th').textContent, 'Min %');
    assert.equal(panel.querySelector('input.tmsh-min').value, '100');
    panel.querySelector('button[data-act="save"]').click();
    await t.tick();
    assert.equal(t.priceEl(176).getAttribute('data-tmsh-label'), '+55% (13.2k)');
    assert.equal(t.color(176), YELLOW, '55% margin is yellow in pct mode');
  });

  test('reset clears storage and returns to defaults', async () => {
    const t = await boot({ savedSettings: JSON.stringify({ mode: 'pct', hideUnprofitable: true }) });
    assert.ok(t.row(2).classList.contains('tmsh-hide'));
    t.fab().click();
    t.panel().querySelector('button[data-act="reset"]').click();
    await t.tick();
    assert.equal(t.window.localStorage.getItem('tmsh_settings'), null);
    assert.equal(t.panel().querySelector('#tmsh-mode').value, 'abs');
    assert.ok(!t.row(2).classList.contains('tmsh-hide'));
  });
});

describe('storage hardening', () => {
  test('garbage in storage falls back to defaults field by field', async () => {
    const bad = JSON.stringify({
      mode: 'evil',
      tiersAbs: [
        { min: 'x', color: '#2ecc71', label: 'nan' },                       // dropped
        { min: 5000, color: 'url(https://evil/x)', label: 'a'.repeat(40) }, // colour + label sanitised
        { min: -1, color: '#000000' },                                      // dropped
      ],
      tiersPct: 'nope',
      inlineLabel: 'yes',
      __proto__: { polluted: true },
    });
    const t = await boot({ savedSettings: bad });
    assert.equal(({}).polluted, undefined, 'no prototype pollution');
    t.fab().click();
    const rows = t.panel().querySelectorAll('tr');
    assert.equal(rows.length, 2, 'header + one surviving tier');
    assert.equal(rows[1].querySelector('.tmsh-color').value, '#ffffff');
    assert.equal(rows[1].querySelector('.tmsh-label').value.length, 12);
    assert.equal(t.panel().querySelector('#tmsh-mode').value, 'abs');
    assert.equal(t.panel().querySelector('#tmsh-inline').checked, true, 'non-boolean -> default');
  });

  test('tier labels are rendered as text, never as markup', async () => {
    const saved = JSON.stringify({ tiersAbs: [{ min: 1, color: '#2ecc71', label: '<img src=x>' }] });
    const t = await boot({ savedSettings: saved });
    t.fab().click();
    assert.equal(t.panel().querySelector('img'), null);
    assert.equal(t.panel().querySelector('.tmsh-label').value, '<img src=x>');
    assert.match(t.priceEl(50).title, /\(<img src=x>\)/);
  });

  test('uses PDA_storage when Torn PDA injects it', async () => {
    const pda = fakePdaStorage();
    const t = await boot({ pdaStorage: pda });
    t.fab().click();
    assert.match(t.panel().textContent, /PDA_storage/);
    t.panel().querySelector('#tmsh-hide').checked = true;
    t.panel().querySelector('button[data-act="save"]').click();
    await t.tick();
    assert.equal(pda.store.get('tmsh_settings').hideUnprofitable, true);
    assert.equal(t.window.localStorage.getItem('tmsh_settings'), null, 'localStorage untouched');
    assert.ok(t.row(2).classList.contains('tmsh-hide'));

    t.fab().click();
    t.panel().querySelector('button[data-act="reset"]').click();
    await t.tick();
    assert.equal(pda.store.has('tmsh_settings'), false);
  });

  test('loads settings previously saved in PDA_storage', async () => {
    const pda = fakePdaStorage();
    pda.store.set('tmsh_settings', { hideUnprofitable: true });
    const t = await boot({ pdaStorage: pda });
    assert.ok(t.row(2).classList.contains('tmsh-hide'));
  });

  test('save failure keeps the panel open with a message', async () => {
    const pda = fakePdaStorage();
    pda.set = async () => { const e = new Error('quota'); e.code = 'QuotaExceeded'; throw e; };
    const t = await boot({ pdaStorage: pda });
    t.fab().click();
    t.panel().querySelector('button[data-act="save"]').click();
    await t.tick();
    assert.equal(t.panel().hidden, false);
    assert.match(t.panel().querySelector('.tmsh-status').textContent, /Could not save/);
  });
});

describe('live page changes', () => {
  test('a newly added row is highlighted and the badge updates', async () => {
    const t = await boot();
    t.doc.getElementById('list').insertAdjacentHTML('beforeend', t.listing(33, 'Police Vest', 1000, 2)); // 7,500 - 1,000
    await t.tick(300);
    assert.equal(t.color(33), RED);
    assert.equal(t.badge().textContent, '5');
  });

  test('a row whose price rises above the shop price is cleared', async () => {
    const t = await boot();
    const p = t.priceEl(50);
    p.textContent = '$800,000';
    await t.tick(300);
    assert.ok(!t.row(50).classList.contains('tmsh-good'));
    assert.ok(!p.hasAttribute('data-tmsh-label'));
    assert.ok(!p.hasAttribute('title'));
  });
});
