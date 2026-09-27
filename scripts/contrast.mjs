// Acceptance check 5: text contrast at least 4.5 to 1 and marks at least 3 to 1 against the page,
// in normal vision and under deuteranopia, protanopia and tritanopia simulation (Machado et al. 2009, severity 1).
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const unlin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const lum = (rgb) => {
  const [r, g, b] = rgb.map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const M = {
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};
const sim = (rgb, m) => {
  const l = rgb.map(lin);
  return m.map((row) => unlin(Math.min(1, Math.max(0, row[0] * l[0] + row[1] * l[1] + row[2] * l[2]))));
};

const bg = hex('#0B1719');
const panel = hex('#142225');
const text = { ink: '#EFEBE1', mute: '#96A3A5', micro: '#7E8B8E', focus: '#F8C534' };
const marks = {
  un_organs: '#F8C534',
  un_system: '#009EDB',
  member_states: '#F29BD0',
  civil_society: '#1DC79B',
  business: '#DB503F',
  not_shown_ring: '#7E8B8E',
  lit_seat: '#EFEBE1',
  seat_outline_pending: '#7E8B8E',
};

let fail = false;
const rows = [];
for (const [vision, m] of [['normal', null], ...Object.entries(M)]) {
  const t = (c) => (m ? sim(hex(c), m) : hex(c));
  const b = m ? sim(bg, m) : bg;
  const p = m ? sim(panel, m) : panel;
  for (const [k, c] of Object.entries(text)) {
    for (const [surface, s] of [['page', b], ['panel', p]]) {
      const r = ratio(t(c), s);
      if (r < 4.5) fail = true;
      rows.push(`${r < 4.5 ? 'FAIL' : 'ok  '} text ${k.padEnd(22)} on ${surface.padEnd(5)} ${vision.padEnd(12)} ${r.toFixed(2)}`);
    }
  }
  for (const [k, c] of Object.entries(marks)) {
    const r = ratio(t(c), b);
    if (r < 3) fail = true;
    rows.push(`${r < 3 ? 'FAIL' : 'ok  '} mark ${k.padEnd(22)} on page  ${vision.padEnd(12)} ${r.toFixed(2)}`);
  }
}
if (process.argv.includes('--verbose') || fail) console.log(rows.join('\n'));
if (fail) process.exit(1);
console.log(`contrast: ok. ${rows.length} checks across normal vision, deuteranopia, protanopia and tritanopia.`);
