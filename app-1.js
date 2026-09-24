const CFG = window.LJS_CONFIG;
const app = document.getElementById('app');
const printArea = document.getElementById('printArea');
const isCloud = Boolean(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
const sb = isCloud ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
let installPrompt = null;
let currentUser = null;
let currentProfile = null;
let state = { projects: [], vehicles: [], technicians: [], sheet: null, adminSheet: null };
const OTHER_PROJECT_ID = '__other__';

const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const DAY_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const DAY_FULL = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  document.getElementById('installBtn').classList.remove('hidden');
});
document.getElementById('installBtn').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

function cloneTemplate(id) {
  app.innerHTML = '';
  app.append(document.getElementById(id).content.cloneNode(true));
}
function deepClone(v) { return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)); }
function fmtHours(n) { return `${Number(n || 0).toFixed(2).replace('.', ',')} h`; }
function fmtCellHours(n) {
  const x = Number(n || 0);
  if (!x) return '';
  return Number.isInteger(x) ? String(x) : String(x).replace('.', ',');
}
function mondayOfWeekValue(weekValue) {
  if (!weekValue) return null;
  const [year, week] = weekValue.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(year,0,4));
  const day = jan4.getUTCDay() || 7;
  const mon = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  return mon.toISOString().slice(0,10);
}
function currentWeekValue() {
  const d = new Date();
  d.setHours(0,0,0,0);
  const th = new Date(d);
  th.setDate(d.getDate() + 3 - ((d.getDay()+6)%7));
  const week1 = new Date(th.getFullYear(),0,4);
  const week = 1 + Math.round(((th - week1)/86400000 - 3 + ((week1.getDay()+6)%7))/7);
  return `${th.getFullYear()}-W${String(week).padStart(2,'0')}`;
}
function weekValueFromMonday(mondayISO) {
  const d = new Date(mondayISO + 'T12:00:00');
  const th = new Date(d);
  th.setDate(d.getDate() + 3 - ((d.getDay()+6)%7));
  const week1 = new Date(th.getFullYear(),0,4);
  const week = 1 + Math.round(((th - week1)/86400000 - 3 + ((week1.getDay()+6)%7))/7);
  return `${th.getFullYear()}-W${String(week).padStart(2,'0')}`;
}
function weekNumber(mondayISO) { return Number(weekValueFromMonday(mondayISO).split('-W')[1]); }
function dateForDay(mondayISO, i) {
  const d = new Date(mondayISO + 'T12:00:00');
  d.setDate(d.getDate()+i);
  return d.toISOString().slice(0,10);
}
function formatDayTitle(iso) { const d=new Date(iso+'T12:00:00'); return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}); }
function technicianById(id) { return state.technicians.find(t=>t.id===id) || null; }
function esc(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function projectById(id) { return state.projects.find(p => p.id === id) || null; }
function vehicleById(id) { return state.vehicles.find(v => v.id === id) || null; }
function totalDay(day) { return day?.absent ? 0 : (day.entries || []).reduce((a,e)=>a+Number(e.hours||0),0); }
function totalWeek(sheet) { return (sheet.days || []).reduce((a,d)=>a+totalDay(d),0); }
function normalizeSheet(s, weekStart=null) {
  if (!s) return s;
  s.status = s.status || 'draft';
  s.general_comment = s.general_comment || '';
  s.technician_signature = s.technician_signature || '';
  s.responsible_signature = s.responsible_signature || '';
  s.responsible_name = s.responsible_name || '';
  s.admin_changes = Array.isArray(s.admin_changes) ? s.admin_changes : [];
  s.week_start = s.week_start || weekStart;
  s.days = Array.isArray(s.days) ? s.days : [];
  s.days = DAYS.map((name,i) => {
    const date = dateForDay(s.week_start, i);
    const found = s.days.find(d => d.date === date) || s.days[i] || {};
    return {
      date,
      name,
      zone: Number(found.zone ?? found.travel_zone ?? 0),
      absent: Boolean(found.absent),
      comment: found.comment || '',
      entries: Array.isArray(found.entries) && found.entries.length ? found.entries.map(e=>({ ...e, project_id:e.project_id || (e.manual_project_name ? OTHER_PROJECT_ID : ''), manual_project_code:e.manual_project_code||'', manual_project_name:e.manual_project_name||'', hours:Number(e.hours||0) })) : [{project_id:state.projects.find(p=>p.active !== false)?.id || state.projects[0]?.id || '',manual_project_code:'',manual_project_name:'',hours:0}]
    };
  });
  return s;
}

function initDemo() {
  if (!localStorage.getItem('ljs_demo_db')) {
    localStorage.setItem('ljs_demo_db', JSON.stringify({
      technicians: [
        {id:'emmanuel@ljs.local', full_name:'Roy de Lachaise Emmanuel', login_email:'emmanuel@ljs.local', employment_type:'employee', pin:'1234', active:true},
        {id:'adrien@ljs.local', full_name:'Paterne Adrien', login_email:'adrien@ljs.local', employment_type:'employee', pin:'1234', active:true},
        {id:'nabil@ljs.local', full_name:'Moro Nabil', login_email:'nabil@ljs.local', employment_type:'employee', pin:'1234', active:true}
      ],
      projects: [
        {id:'p1', code:'05362', name:'OPTEO', active:true},
        {id:'p2', code:'05152', name:'APAJH', active:true},
        {id:'p3', code:'06449', name:'LUZECH', active:true}
      ],
      vehicles: [
        {id:'v1', registration:'EN-816-WQ', active:true},
        {id:'v2', registration:'FR-480-VQ', active:true},
        {id:'v3', registration:'HF-769-GT', active:true}
      ],
      sheets: []
    }));
  }
  const db = JSON.parse(localStorage.getItem('ljs_demo_db'));
  let changed = false;
  if (!Array.isArray(db.technicians)) {
    db.technicians = (CFG.TECH_ACCOUNTS||[]).map(t=>({id:t.email,full_name:t.name,login_email:t.email,employment_type:'employee',pin:'1234',active:true}));
    changed=true;
  }
  db.technicians.forEach(t=>{
    if(!t.full_name && t.name){t.full_name=t.name;changed=true;}
    if(!t.login_email){t.login_email=t.id;changed=true;}
    if(!t.employment_type){t.employment_type='employee';changed=true;}
    if(!t.pin){t.pin='1234';changed=true;}
    if(typeof t.active!=='boolean'){t.active=true;changed=true;}
  });
  db.sheets = (db.sheets || []).map(s => {
    if (!('technician_signature' in s)) { s.technician_signature=''; changed=true; }
    if (!('responsible_signature' in s)) { s.responsible_signature=''; changed=true; }
    if (!('responsible_name' in s)) { s.responsible_name=''; changed=true; }
    if (!Array.isArray(s.admin_changes)) { s.admin_changes=[]; changed=true; }
    (s.days||[]).forEach(d=>{if(!('absent' in d)){d.absent=false;changed=true;}});
    return s;
  });
  if (changed) localStorage.setItem('ljs_demo_db', JSON.stringify(db));
}
function demoDb() { initDemo(); return JSON.parse(localStorage.getItem('ljs_demo_db')); }
function saveDemoDb(db) { localStorage.setItem('ljs_demo_db', JSON.stringify(db)); }

async function loadTechnicians(includeInactive=false) {
  if (!isCloud) {
    const db=demoDb();
    state.technicians=(db.technicians||[]).filter(t=>includeInactive || t.active!==false).sort((a,b)=>a.full_name.localeCompare(b.full_name,'fr'));
    return state.technicians;
  }
  if (currentProfile?.role==='admin') {
    let q=sb.from('ljs_profiles').select('id,full_name,login_email,employment_type,active,role').eq('role','technician').order('full_name');
    if(!includeInactive) q=q.eq('active',true);
    const {data,error}=await q; if(error) throw error;
    state.technicians=(data||[]).map(t=>({...t}));
  } else {
    const {data,error}=await sb.from('ljs_technician_directory').select('*').order('full_name');
    if(error) throw error;
    state.technicians=(data||[]).map(t=>({...t,active:true,role:'technician'}));
  }
  return state.technicians;
}

