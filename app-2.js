async function showLogin() {
  cloneTemplate('loginTemplate');
  const tech = document.getElementById('techSelect');
  try { await loadTechnicians(false); }
  catch(e) { document.getElementById('loginError').textContent='Impossible de charger la liste des techniciens : '+(e.message||e); }
  state.technicians.forEach(t => tech.add(new Option(`${t.full_name}${t.employment_type==='interim'?' (Intérim)':''}`, t.id)));
  if (!isCloud) document.querySelector('.demo-hint').classList.remove('hidden');
  document.getElementById('loginBtn').onclick = techLogin;
  document.getElementById('adminLoginOpen').onclick = showAdminLogin;
  document.getElementById('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') techLogin(); });
}
async function techLogin() {
  const technicianId = document.getElementById('techSelect').value;
  const pin = document.getElementById('pinInput').value.trim();
  const err = document.getElementById('loginError'); err.textContent = '';
  if (!/^\d{4}$/.test(pin)) { err.textContent = 'Le PIN doit contenir 4 chiffres.'; return; }
  const info=state.technicians.find(t=>t.id===technicianId);
  if(!info){err.textContent='Technicien introuvable.';return;}
  if (!isCloud) {
    const db=demoDb(); const t=(db.technicians||[]).find(x=>x.id===technicianId && x.active!==false);
    if (!t || pin !== t.pin) { err.textContent = 'PIN incorrect.'; return; }
    currentUser = { id: t.id, email:t.login_email };
    currentProfile = { id:t.id, full_name:t.full_name, employment_type:t.employment_type||'employee', role:'technician', active:true };
    return showWeek();
  }
  const { data, error } = await sb.auth.signInWithPassword({ email: info.login_email, password: CFG.AUTH_PASSWORD_PREFIX + pin });
  if (error) { err.textContent = 'PIN incorrect ou compte non configuré.'; return; }
  currentUser = data.user;
  const { data: profile, error: pe } = await sb.from('ljs_profiles').select('*').eq('id', currentUser.id).single();
  if (pe || !profile || profile.role !== 'technician' || profile.active===false) { err.textContent = 'Profil technicien inactif ou introuvable.'; await sb.auth.signOut(); return; }
  currentProfile = profile;
  showWeek();
}
function showAdminLogin() {
  cloneTemplate('adminLoginTemplate');
  if (!isCloud) document.getElementById('adminLoginError').textContent = 'Mode démo : PIN responsable 3002.';
  document.getElementById('adminLoginBtn').onclick = adminLogin;
  document.getElementById('backToTech').onclick = showLogin;
  document.getElementById('adminPinInput').addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
}
async function adminLogin() {
  const pin = document.getElementById('adminPinInput').value.trim();
  const err = document.getElementById('adminLoginError');
  if (!/^\d{4}$/.test(pin)) { err.textContent = 'Le PIN doit contenir 4 chiffres.'; return; }
  if (!isCloud) {
    if (pin !== '3002') { err.textContent = 'PIN incorrect.'; return; }
    currentUser = { id:'admin', email:CFG.ADMIN_ACCOUNT.email };
    currentProfile = { id:'admin', full_name:CFG.ADMIN_ACCOUNT.name || 'Responsable', role:'admin' };
    return showAdmin();
  }
  const { data, error } = await sb.auth.signInWithPassword({ email: CFG.ADMIN_ACCOUNT.email, password: CFG.AUTH_PASSWORD_PREFIX + pin });
  if (error) { err.textContent = 'PIN responsable incorrect.'; return; }
  currentUser = data.user;
  const { data: profile } = await sb.from('ljs_profiles').select('*').eq('id', currentUser.id).single();
  if (!profile || profile.role !== 'admin') { err.textContent = 'Ce compte n’est pas responsable.'; await sb.auth.signOut(); return; }
  currentProfile = profile;
  showAdmin();
}
async function logout() {
  if (isCloud) await sb.auth.signOut();
  currentUser = currentProfile = null;
  state = {projects:[],vehicles:[],technicians:[],sheet:null,adminSheet:null};
  showLogin();
}

async function loadReferenceData(includeInactive=false) {
  if (!isCloud) {
    const db = demoDb();
    state.projects = db.projects.filter(p => includeInactive || p.active);
    state.vehicles = db.vehicles.filter(v => includeInactive || v.active);
    return;
  }
  let pq = sb.from('ljs_projects').select('*').order('code');
  let vq = sb.from('ljs_vehicles').select('*').order('registration');
  if (!includeInactive) { pq = pq.eq('active',true); vq = vq.eq('active',true); }
  const [{data:projects},{data:vehicles}] = await Promise.all([pq,vq]);
  state.projects = projects || [];
  state.vehicles = vehicles || [];
}
function newBlankSheet(weekStart) {
  return normalizeSheet({
    id:null,
    technician_id: currentProfile.id,
    technician_employment_type: currentProfile.employment_type || 'employee',
    week_start: weekStart,
    vehicle_id: null,
    general_comment:'',
    status:'draft',
    technician_signature:'',
    responsible_signature:'',
    responsible_name:'',
    admin_changes:[],
    days: []
  }, weekStart);
}
async function loadSheet(weekStart) {
  if (!isCloud) {
    const db = demoDb();
    const found = db.sheets.find(s => s.technician_id === currentProfile.id && s.week_start === weekStart);
    state.sheet = normalizeSheet(found ? deepClone(found) : newBlankSheet(weekStart), weekStart);
    state.sheet.technician_employment_type=currentProfile.employment_type||'employee';
    return;
  }
  const { data:ts } = await sb.from('ljs_timesheets').select('*').eq('technician_id',currentProfile.id).eq('week_start',weekStart).maybeSingle();
  if (!ts) { state.sheet = newBlankSheet(weekStart); return; }
  const [{data:days},{data:entries}] = await Promise.all([
    sb.from('ljs_day_entries').select('*').eq('timesheet_id',ts.id),
    sb.from('ljs_work_entries').select('*').eq('timesheet_id',ts.id).order('created_at')
  ]);
  state.sheet = normalizeSheet({
    ...ts,
    technician_employment_type: currentProfile.employment_type || 'employee',
    days: DAYS.map((name,i)=>{
      const date = dateForDay(weekStart,i);
      const d = (days||[]).find(x=>x.work_date===date);
      const es = (entries||[]).filter(x=>x.work_date===date).map(x=>({id:x.id, project_id:x.project_id||OTHER_PROJECT_ID, manual_project_code:x.manual_project_code||'', manual_project_name:x.manual_project_name||'', hours:Number(x.hours)}));
      return { date, name, zone:d?.travel_zone ?? 0, absent:Boolean(d?.absent), comment:d?.comment ?? '', entries:es.length?es:[{project_id:state.projects[0]?.id||'',manual_project_code:'',manual_project_name:'',hours:0}] };
    })
  }, weekStart);
}

// Passage automatique à la semaine suivante après validation par le responsable.
(() => {
  const CHECK_INTERVAL_MS = 5000;
  let timer = null;
  let checking = false;
  let moving = false;
  let observedSheetId = null;
  let observedStatus = null;

  function nextWeekStart(weekStart) {
    const date = new Date(`${weekStart}T12:00:00`);
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 10);
  }

  function rememberCurrentSheet() {
    observedSheetId = state?.sheet?.id || null;
    observedStatus = state?.sheet?.status || 'draft';
  }

  function archivesAreOpen() {
    const panel = document.getElementById('technicianArchivesPanel');
    return Boolean(panel && !panel.classList.contains('hidden'));
  }

  async function advanceToNextWeek(previousWeekStart) {
    if (moving || !previousWeekStart) return;
    moving = true;
    try {
      const nextStart = nextWeekStart(previousWeekStart);
      const weekInput = document.getElementById('weekInput');
      await loadSheet(nextStart);
      if (weekInput) weekInput.value = weekValueFromMonday(nextStart);
      if (typeof showTechnicianSheetView === 'function') showTechnicianSheetView();
      renderWeek();
      rememberCurrentSheet();
      const msg = document.getElementById('saveMsg');
      if (msg) {
        msg.textContent = 'La semaine précédente a été validée par le responsable. Passage automatique à la semaine suivante.';
        msg.style.fontWeight = '700';
      }
      window.scrollTo({ top:0, behavior:'smooth' });
    } catch (error) {
      console.error('Passage automatique à la semaine suivante impossible :', error);
    } finally {
      moving = false;
    }
  }

  async function checkApproval() {
    if (checking || moving || !isCloud || currentProfile?.role !== 'technician' || archivesAreOpen()) return;
    const sheet = state?.sheet;
    if (!sheet?.id || !sheet?.week_start) {
      rememberCurrentSheet();
      return;
    }
    if (observedSheetId !== sheet.id) {
      rememberCurrentSheet();
      return;
    }

    checking = true;
    try {
      const sheetId = sheet.id;
      const weekStart = sheet.week_start;
      const previousStatus = observedStatus || sheet.status || 'draft';
      const { data, error } = await sb.from('ljs_timesheets').select('status').eq('id', sheetId).maybeSingle();
      if (error || !data) return;
      observedStatus = data.status || previousStatus;
      if (previousStatus !== 'approved' && data.status === 'approved' && state?.sheet?.id === sheetId) {
        state.sheet.status = 'approved';
        await advanceToNextWeek(weekStart);
      }
    } catch (error) {
      console.warn('Vérification de validation responsable impossible :', error);
    } finally {
      checking = false;
    }
  }

  function startWatcher() {
    if (timer) clearInterval(timer);
    timer = setInterval(checkApproval, CHECK_INTERVAL_MS);
  }

  document.addEventListener('change', event => {
    if (event.target?.id === 'weekInput') setTimeout(rememberCurrentSheet, 0);
  });

  document.addEventListener('DOMContentLoaded', () => {
    const baseShowWeek = window.showWeek;
    if (typeof baseShowWeek !== 'function' || baseShowWeek.__ljsAutoAdvanceWeek) return;
    const wrapped = async function() {
      const result = await baseShowWeek.apply(this, arguments);
      rememberCurrentSheet();
      if (state?.sheet?.status === 'approved' && state?.sheet?.week_start) {
        await advanceToNextWeek(state.sheet.week_start);
      }
      startWatcher();
      return result;
    };
    wrapped.__ljsAutoAdvanceWeek = true;
    window.showWeek = wrapped;
  });
})();
