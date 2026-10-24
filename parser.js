/* RFQ sheet parser: header-name based, mirrors the Excel dashboard rules */
const RFQP = (() => {
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const txt = v => (v == null ? '' : String(v)).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  const num = v => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v == null || typeof v === 'boolean') return 0;
    const s = String(v).replace(/ /g, '').replace(/₹/g, '').replace(/,/g, '').trim();
    return s !== '' && !isNaN(+s) ? +s : 0;
  };
  const ser = v => {
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      const d = new Date(Math.round((v - 25569) * 864e5));
      return d.toISOString().slice(0, 10);
    }
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    if (typeof v === 'string') {
      const m = v.trim().match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
      if (m) { const y = +m[3], mo = +m[2], d = +m[1]; const dt = new Date(Date.UTC(y, mo - 1, d));
        if (dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) return dt.toISOString().slice(0, 10); }
    }
    return null;
  };
  const isNum = v => { if (typeof v === 'number') return isFinite(v); const s = txt(v).replace(/₹/g, '').replace(/,/g, '').trim(); return s !== '' && !isNaN(+s); };
  const prosp = v => { const s = txt(v).toLowerCase(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Not set'; };
  const PROC = [['investment', 'Investment Casting'], ['steel casting', 'Steel Casting'], ['alumin', 'Aluminium Casting'], ['allumin', 'Aluminium Casting'],
    ['raw material', 'Raw Material'], ['casting', 'Casting'], ['forging', 'Forging'], ['assembly', 'Assembly'], ['fabrication', 'Fabrication'],
    ['welding', 'Welding'], ['brought', 'Bought Out'], ['b.o', 'Bought Out']];
  const OWN = [['sanjeev', 'Sanjeev'], ['sanjay', 'Sanjay'], ['hiren', 'Hiren'], ['jaydeep', 'Jaydeep'], ['keval', 'Keval'], ['ketan', 'Ketan'],
    ['bhautik', 'Bhautik'], ['bhauitk', 'Bhautik'], ['saurabh', 'Saurabh'], ['rgk', 'RGK Sir'], ['gongane', 'Gongane Sir'], ['piyush', 'Piyush V'],
    ['kamlesh', 'Kamlesh'], ['manish', 'Manish'], ['manoj', 'Manoj']];
  const proc = v => { const s = txt(v).toLowerCase(); for (const [k, n] of PROC) if (s.includes(k)) return n; return 'Others'; };
  const owners = v => { const s = txt(v).toLowerCase(); const o = []; for (const [k, n] of OWN) if (s.includes(k) && !o.includes(n)) o.push(n); return o.length ? o : ['Unassigned']; };
  const status = v => { const s = txt(v).toLowerCase(); if (s === 'd' || s.includes('regret')) return 'Regret'; if (s.includes('hold')) return 'Hold'; if (s.includes('close') || s.includes('won')) return 'Won'; return 'Open'; };
  const grade = v => { const s = txt(v).toUpperCase(); return s.includes('ADI') ? 'ADI' : s.includes('SG') ? 'SG' : s.includes('CI') ? 'CI' : ''; };

  // header keys -> list of accepted normalized header names (first match wins)
  const COLS = {
    st: ['status'], cat: ['catagory', 'category'], rt: ['rfq10rfq20'], ed: ['exportdomestic'], c: ['customername'], no: ['rfqno'],
    ton: ['ton'], d: ['rfqreceiptdate'], t: ['quotationtargatedate', 'quotationtargetdate'], s: ['quotationsentdate'], ow: ['owner'],
    m: ['matrial', 'material'], pc: ['process'], pt: ['noofparts'], pri: ['priority'], rm: ['remarks'], to: ['expectedyearturnover'],
    g: ['castinggrade'], al: ['checklist9targetdatealert'], loc: ['countrystate', 'country'], cv: ['convertedturnover'], pro: ['prospectiveinquiry', 'prospective']
  };
  function mapHeaders(h) {
    const n = h.map(norm), idx = {};
    for (const k in COLS) { idx[k] = -1; for (const want of COLS[k]) { const i = n.indexOf(want); if (i >= 0) { idx[k] = i; break; } } }
    if (idx.rt < 0) idx.rt = n.findIndex(x => x.startsWith('rfq10'));
    if (idx.g < 0 && idx.al >= 0) idx.g = idx.al + 1; // grade sits right after the Checklist #9 column
    return idx;
  }
    // ---- country / state ----
  const CTRY = { USA: 'USA', US: 'USA', 'UNITED STATES': 'USA', AMERICA: 'USA', UK: 'UK', ENGLAND: 'UK', 'UNITED KINGDOM': 'UK', IRLAND: 'Ireland', IRELAND: 'Ireland',
    IZMIR: 'Turkey', TURKEY: 'Turkey', INDIA: 'India' };
  const STATE = { FARIDABAD: 'Haryana', GURGAON: 'Haryana', GURUGRAM: 'Haryana', COIMBATORE: 'Tamil Nadu', CHENNAI: 'Tamil Nadu', TAMILNADU: 'Tamil Nadu', 'TAMIL NADU': 'Tamil Nadu',
    PUNE: 'Maharashtra', MUMBAI: 'Maharashtra', NASIK: 'Maharashtra', NASHIK: 'Maharashtra', MAHARASHTRA: 'Maharashtra', AURANGABAD: 'Maharashtra', NAGPUR: 'Maharashtra',
    AHMEDABAD: 'Gujarat', SURAT: 'Gujarat', GANDHINAGAR: 'Gujarat', RAJKOT: 'Gujarat', VADODARA: 'Gujarat', BARODA: 'Gujarat', GUJARAT: 'Gujarat',
    BANGLORE: 'Karnataka', BANGALORE: 'Karnataka', BENGALURU: 'Karnataka', KARNATAKA: 'Karnataka', KOLKATA: 'West Bengal', 'WEST BENGAL': 'West Bengal',
    DELHI: 'Delhi', 'NEW DELHI': 'Delhi', NOIDA: 'Uttar Pradesh', 'UTTAR PRADESH': 'Uttar Pradesh', RAJASTHAN: 'Rajasthan', ALWAR: 'Rajasthan', JAIPUR: 'Rajasthan',
    'MADHYA PRADESH': 'Madhya Pradesh', INDORE: 'Madhya Pradesh', HYDERABAD: 'Telangana', TELANGANA: 'Telangana', PUNJAB: 'Punjab', LUDHIANA: 'Punjab' };
  const tc = s => s.toLowerCase().replace(/\b[a-z]/g, m => m.toUpperCase());
  function place(raw, ed) {
    const s = txt(raw), u = s.toUpperCase();
    if (!s || u === 'NA' || u === '-' ) return ed === 'Domestic' ? { co: 'India', sta: 'Not specified' } : { co: 'Not specified', sta: '' };
    if (CTRY[u] && CTRY[u] !== 'India') return { co: CTRY[u], sta: '' };
    if (u === 'INDIA') return { co: 'India', sta: 'Not specified' };
    const parts = u.split(',').map(x => x.trim());
    for (const x of parts.slice().reverse()) if (STATE[x]) return { co: 'India', sta: STATE[x] };
    if (ed === 'Domestic') return { co: 'India', sta: tc(s) };
    return { co: u.length <= 3 ? u : tc(s), sta: '' };
  }
  const REQUIRED = ['c', 'no', 'd', 's', 'pc'];
  function parse(header, rows) {
    const I = mapHeaders(header);
    const missing = REQUIRED.filter(k => I[k] < 0);
    if (missing.length) return { error: 'Missing columns: ' + missing.join(', '), recs: [] };
    const g = (r, k) => (I[k] >= 0 ? r[I[k]] : '');
    const recs = [];
    for (const r of rows) {
      const d = ser(g(r, 'd'));
      if (!d || txt(g(r, 'no')) === '') continue;
      const sr = g(r, 's');
      const rt0 = txt(g(r, 'rt')).toUpperCase();
      const ed = txt(g(r, 'ed')), edT = ed.charAt(0).toUpperCase() + ed.slice(1).toLowerCase();
      const pr = txt(g(r, 'pri')), prT = pr.charAt(0).toUpperCase() + pr.slice(1).toLowerCase();
      const cat = txt(g(r, 'cat')).toUpperCase();
      recs.push({
        no: txt(g(r, 'no')).slice(0, 40), d, t: ser(g(r, 't')), s: ser(sr), p: typeof sr === 'string' && sr.toLowerCase().includes('pending'),
        st: status(g(r, 'st')), cat: ['A', 'B', 'C', 'D', 'ND'].includes(cat) ? cat : 'NA',
        rt: rt0.includes('2.0') ? 'RFQ 2.0' : (rt0.startsWith('RFQ 1') ? 'RFQ 1.0' : 'NA'),
        ed: ['Export', 'Domestic'].includes(edT) ? edT : 'NA', c: txt(g(r, 'c')) || 'Unknown', ow: owners(g(r, 'ow')), pc: proc(g(r, 'pc')),
        pt: Math.trunc(num(g(r, 'pt'))), ton: Math.round(num(g(r, 'ton')) * 1e4) / 1e4, to: Math.round(num(g(r, 'to')) * 100) / 100,
        pri: ['High', 'Medium', 'Low'].includes(prT) ? prT : 'NA', g: grade(g(r, 'g')), m: txt(g(r, 'm')).slice(0, 60), rm: txt(g(r, 'rm')).slice(0, 120)
      });
      const rec = recs[recs.length - 1], pl = place(g(r, 'loc'), rec.ed);
      rec.co = pl.co; rec.sta = pl.sta; rec.loc = txt(g(r, 'loc'));
      // turnover rule: Won rows use Converted Turnover, every other row uses Expected Year Turnover
      rec.exp = rec.to; rec.pro = I.pro >= 0 ? prosp(g(r, 'pro')) : 'Not set';
      const cvRaw = I.cv >= 0 ? g(r, 'cv') : '';
      rec.cvErr = I.cv >= 0 && txt(cvRaw) !== '' && !isNum(cvRaw);
      rec.cv = I.cv >= 0 ? (rec.cvErr ? 0 : Math.round(num(cvRaw) * 100) / 100) : (rec.st === 'Won' ? rec.exp : 0);
      if (rec.st === 'Won') rec.to = rec.cv;
    }
    return { recs, cols: I };
  }
  const yearOf = name => { const m = String(name).match(/^\s*(sub|submitted)\b.*?(\d{4})\s*$/i); return m ? m[2] : null; };
  return { parse, mapHeaders, yearOf, norm };
})();
if (typeof module !== 'undefined') module.exports = RFQP;
