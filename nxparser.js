/* NX Parts Status parser: Earth Truss + Anchor sheets, header-name based */
const NXP = (() => {
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const txt = v => (v == null ? '' : String(v)).replace(/ /g, ' ').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const pad = n => String(n).padStart(2, '0');
  const isoYMD = (y, m, d) => { if (y < 100) y += 2000; const dt = new Date(Date.UTC(y, m - 1, d)); return (dt.getUTCMonth() === m - 1 && y > 2000 && y < 2100) ? `${y}-${pad(m)}-${pad(d)}` : null; };
  const toDate = v => {
    if (typeof v === 'number' && v > 30000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    const s = txt(v); let m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
    if (m) return isoYMD(+m[3], +m[2], +m[1]);
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return isoYMD(+m[1], +m[2], +m[3]);
    return null;
  };
  const dateIn = s => { const m = txt(s).match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/); return m ? isoYMD(+m[3], +m[2], +m[1]) : null; };
  const num = v => { if (typeof v === 'number') return v; const s = txt(v).replace(/,/g, ''); return s !== '' && !isNaN(+s) ? +s : null; };

  // Part Status drop-down list (order as in the sheet)
  const PS = ['Sample Under Development', 'Sample Submitted', 'Sample Rejected', 'Sample Approved', 'Project PO Pending', 'PPAP Run Pending',
    'PPAP Submission Pending', 'PPAP Pending', 'PPAP Approval Pending', 'PPAP Approved', 'Drawing Revised', 'Design Discontinued'];
  const PS_ALIAS = { 'ppapsubmittedapprovalpending': 'PPAP Approval Pending' };
  const STAGE = { 'Sample Under Development': 'Development', 'Sample Submitted': 'Sample', 'Sample Rejected': 'Sample', 'Sample Approved': 'Sample',
    'Project PO Pending': 'Sample', 'PPAP Run Pending': 'PPAP', 'PPAP Submission Pending': 'PPAP', 'PPAP Pending': 'PPAP', 'PPAP Approval Pending': 'PPAP',
    'PPAP Approved': 'Approved for production', 'Drawing Revised': 'Revised / Discontinued', 'Design Discontinued': 'Revised / Discontinued' };
  const STAGES = ['Development', 'Sample', 'PPAP', 'Approved for production', 'Revised / Discontinued', 'Not set'];
  function partStatus(v) {
    const s = txt(v); if (!s) return 'Not set';
    const n = norm(s); if (PS_ALIAS[n]) return PS_ALIAS[n];
    const hit = PS.find(p => norm(p) === n); return hit || s;
  }
  function delivery(dispStatus, recent, dispDate) {
    const d = txt(dispStatus).toUpperCase(), r = txt(recent).toUpperCase();
    let st;
    if (d.includes('DISPATCH')) st = 'Dispatched';
    else if (d.includes('HOLD')) st = 'Hold';
    else if (d.includes('REGULAR')) st = 'Regular production';
    else if (r.includes('READY')) st = 'Ready for dispatch';
    else if (/DISPATCH|DISPTACH/.test(r) && !r.includes('PENDING') && !r.includes('WAITING')) st = 'Dispatched';
    else if (r.includes('HOLD')) st = 'Hold';
    else st = 'Not dispatched';
    const date = toDate(dispDate) || (st === 'Dispatched' ? dateIn(recent) : null);
    return { st, date };
  }
  function po(v) {
    const s = txt(v); const u = s.toUpperCase();
    if (!s || u === 'NA' || u === '-' || u.startsWith('NO PO') || u === 'NO') return { has: false, no: s };
    return /\d{4,}/.test(s) ? { has: true, no: s } : { has: false, no: s };
  }

  const COLS = { sr: ['srno'], sup: ['supplier', 'suppliername'], img: ['partimage', 'image'], pn: ['partnumber'], rev: ['latestrev', 'latestrevision'],
    revAtul: ['revwatul', 'revisionwithatulbhai'], revOld: ['revision'], revChk: ['revcheck'], pd: ['partdescription'], ps: ['partstatus'],
    after: ['aftersamplesubmittedpartstatus'], qty: ['qty', 'quantity'], po: ['ponumber'], ready: ['samplereadiness'], dd: ['dispatchdate'],
    agent: ['shippingagent'], track: ['trackingno', 'trackingnumber'], recent: ['recentstatus'], ds: ['dispatchstatus'], dq: ['dispatch'],
    sa: ['sampleapproval'], arena: ['arenappapnumber'], test: ['testingyn'], ppapYN: ['ppapstatusyn'], ppapCode: ['ppapcode'],
    prodDate: ['productiionapproval', 'productionapprovaldate'], prod: ['productionapproval'], prodSt: ['productiionapprovalstatus'], note: ['note'] };
  function mapHeaders(h) {
    const n = h.map(norm), idx = {};
    for (const k in COLS) { idx[k] = -1; for (const w of COLS[k]) { const i = n.indexOf(w); if (i >= 0) { idx[k] = i; break; } } }
    return idx;
  }
  const findHeaderRow = rows => { for (let i = 0; i < Math.min(rows.length, 15); i++) { const n = (rows[i] || []).map(norm); if (n.includes('partnumber') && n.includes('partstatus')) return i; } return -1; };
  const projectOf = name => /earth|truss|ojjo/i.test(name) ? 'Earth Truss' : /anchor/i.test(name) ? 'Anchor' : null;

  // rows: array of arrays (whole sheet from row 1); hidden: array of booleans per row; comments: {rowIndex0: [text]}
  function parse(sheetName, rows, hidden, comments) {
    const project = projectOf(sheetName);
    const hi = findHeaderRow(rows);
    if (hi < 0) return { error: `${sheetName}: header row with "Part Number" and "Part Status" not found`, recs: [] };
    const I = mapHeaders(rows[hi]);
    const g = (r, k) => (I[k] >= 0 ? r[I[k]] : '');
    const recs = [];
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const a = txt(r[0]).toUpperCase(), b = txt(r[1]).toUpperCase();
      if (a === 'SUMMARY' || b.startsWith('TOTAL NO') || a.startsWith('SUMMARY')) break;
      const pn = txt(g(r, 'pn')), pd = txt(g(r, 'pd'));
      if (!pn && !pd) continue;
      const ps = partStatus(g(r, 'ps')), dl = delivery(g(r, 'ds'), g(r, 'recent'), g(r, 'dd')), p = po(g(r, 'po'));
      const cm = (comments && comments[i]) || [];
      const ctext = [...new Set(cm.map(x => txt(x)))].join(' | ');
      recs.push({
        row: i + 1, project, sheet: sheetName, hidden: !!(hidden && hidden[i]),
        sr: txt(g(r, 'sr')), pn, pd, rev: txt(g(r, 'rev')), revAtul: txt(g(r, 'revAtul')), revOld: txt(g(r, 'revOld')), revChk: txt(g(r, 'revChk')),
        sup: txt(g(r, 'sup')), ps, stage: STAGE[ps] || (ps === 'Not set' ? 'Not set' : 'Other'), after: txt(g(r, 'after')),
        qty: num(g(r, 'qty')), qtyTxt: txt(g(r, 'qty')), po: p.no, hasPO: p.has,
        ready: toDate(g(r, 'ready')), readyTxt: txt(g(r, 'ready')), del: dl.st, dDate: dl.date, agent: txt(g(r, 'agent')), track: txt(g(r, 'track')),
        recent: txt(g(r, 'recent')), sa: txt(g(r, 'sa')), arena: txt(g(r, 'arena')) || (/^PPAP-/i.test(txt(g(r, 'after'))) ? txt(g(r, 'after')) : ''),
        test: txt(g(r, 'test')), ppapYN: txt(g(r, 'ppapYN')), prod: txt(g(r, 'prod')), prodSt: txt(g(r, 'prodSt')) || (toDate(g(r, 'prodDate')) || ''),
        note: txt(g(r, 'note')), comments: ctext, critical: /critical/i.test(ctext), high: /high priority/i.test(ctext),
        inactive: ps === 'Design Discontinued' || ps === 'Drawing Revised' || /requirement cancelled|design discontinued/i.test(txt(g(r, 'sa')))
      });
    }
    return { recs, cols: I, headerRow: hi };
  }
  return { parse, mapHeaders, findHeaderRow, projectOf, PS, STAGES, toDate, norm };
})();
if (typeof module !== 'undefined') module.exports = NXP;
