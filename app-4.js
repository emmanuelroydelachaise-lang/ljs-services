async function showAdmin() {
  cloneTemplate('adminTemplate');
  document.getElementById('adminLogoutBtn').onclick = logout;
  document.getElementById('adminWeekInput').value = currentWeekValue();
  document.getElementById('refreshAdmin').onclick = refreshAdmin;
  document.getElementById('adminWeekInput').onchange = refreshAdmin;
  document.getElementById('addProjectBtn').onclick = addProject;
  document.getElementById('addTechBtn').onclick = addTechnician;
  await refreshAdmin();
}
async function refreshAdmin() {
  await loadReferenceData(true);
  await loadTechnicians(true);
  await renderAdminTechnicians();
  await renderAdminProjects();
  await renderAdminSheets();
}
async function renderAdminTechnicians() {
  const box=document.getElementById('adminTechnicians'); if(!box) return; box.innerHTML='';
  state.technicians.forEach(t=>{
    const el=document.createElement('div'); el.className='admin-item tech-admin-item';
    const type=t.employment_type==='interim'?'Intérim':'Salarié';
    el.innerHTML=`
      <div class="tech-summary">
        <strong>${esc(t.full_name)}</strong><span class="tech-type">${type}</span>
        <div class="meta">${t.active===false?'Retiré':'Actif'}</div>
      </div>
      <div class="admin-row-actions">
        <button class="secondary edit-tech">Modifier</button>
        <button class="secondary toggle-tech">${t.active===false?'Réactiver':'Retirer'}</button>
      </div>
      <div class="tech-edit-form hidden">
        <div><label>Nom et prénom</label><input class="edit-tech-name" value="${esc(t.full_name)}"></div>
        <div><label>Statut</label><select class="edit-tech-type"><option value="employee" ${t.employment_type!=='interim'?'selected':''}>Salarié</option><option value="interim" ${t.employment_type==='interim'?'selected':''}>Intérim</option></select></div>
        <div><label>Nouveau PIN (facultatif)</label><input class="edit-tech-pin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]*" placeholder="Laisser vide pour conserver"></div>
        <div class="tech-edit-actions"><button class="primary save-tech-edit">Enregistrer</button><button class="ghost dark-ghost cancel-tech-edit">Annuler</button></div>
      </div>`;
    const form=el.querySelector('.tech-edit-form');
    el.querySelector('.edit-tech').onclick=()=>form.classList.remove('hidden');
    el.querySelector('.cancel-tech-edit').onclick=()=>form.classList.add('hidden');
    el.querySelector('.save-tech-edit').onclick=async()=>{
      const full_name=el.querySelector('.edit-tech-name').value.trim();
      const employment_type=el.querySelector('.edit-tech-type').value;
      const pin=el.querySelector('.edit-tech-pin').value.trim();
      if(!full_name){alert('Renseigne le nom du technicien.');return;}
      if(pin && !/^\d{4}$/.test(pin)){alert('Le nouveau PIN doit contenir 4 chiffres.');return;}
      try{
        if(!isCloud){
          const db=demoDb();const x=db.technicians.find(x=>x.id===t.id);
          if(x){x.full_name=full_name;x.employment_type=employment_type;if(pin)x.pin=pin;}
          saveDemoDb(db);
        } else {
          const {data,error}=await sb.functions.invoke('manage-technician',{body:{action:'update',technician_id:t.id,full_name,employment_type,pin:pin||null}});
          if(error) throw error;if(data?.error) throw new Error(data.error);
        }
        refreshAdmin();
      }catch(e){alert('Impossible de modifier le technicien : '+(e.message||e));}
    };
    el.querySelector('.toggle-tech').onclick=async()=>{
      const next=t.active===false;
      if(!next && !confirm(`Retirer ${t.full_name} de la liste des techniciens ? Ses anciennes feuilles seront conservées.`)) return;
      try{
        if(!isCloud){const db=demoDb();const x=db.technicians.find(x=>x.id===t.id);if(x)x.active=next;saveDemoDb(db);}
        else {const {data,error}=await sb.functions.invoke('manage-technician',{body:{action:'set_active',technician_id:t.id,active:next}});if(error)throw error;if(data?.error)throw new Error(data.error);}
        refreshAdmin();
      }catch(e){alert('Impossible de modifier le technicien : '+(e.message||e));}
    };
    box.append(el);
  });
}
async function addTechnician() {
  const name=document.getElementById('newTechName').value.trim();
  const employment_type=document.getElementById('newTechType').value;
  const pin=document.getElementById('newTechPin').value.trim();
  if(!name){alert('Renseigne le nom du technicien.');return;}
  if(!/^\d{4}$/.test(pin)){alert('Le PIN doit contenir 4 chiffres.');return;}
  try{
    if(!isCloud){
      const db=demoDb(); const id='tech_'+Date.now();
      db.technicians.push({id,full_name:name,login_email:`${id}@ljs.local`,employment_type,pin,active:true}); saveDemoDb(db);
    } else {
      const {data,error}=await sb.functions.invoke('manage-technician',{body:{action:'create',full_name:name,employment_type,pin}});
      if(error) throw error;
      if(data?.error) throw new Error(data.error);
    }
    document.getElementById('newTechName').value='';document.getElementById('newTechPin').value='';document.getElementById('newTechType').value='employee';
    refreshAdmin();
  }catch(e){alert('Impossible d’ajouter le technicien : '+(e.message||e));}
}

async function renderAdminProjects() {
  const box=document.getElementById('adminProjects'); box.innerHTML='';
  let projects;
  if(!isCloud) projects=demoDb().projects;
  else { const {data}=await sb.from('ljs_projects').select('*').order('code'); projects=data||[]; }
  projects.forEach(p=>{
    const el=document.createElement('div'); el.className='admin-item';
    el.innerHTML=`<div><strong>${esc(p.code)} — ${esc(p.name)}</strong><div class="meta">${p.active?'Actif':'Retiré'}</div></div><button class="secondary">${p.active?'Retirer':'Réactiver'}</button>`;
    el.querySelector('button').onclick=async()=>{
      if(!isCloud){ const db=demoDb(); const x=db.projects.find(x=>x.id===p.id); x.active=!x.active; saveDemoDb(db); }
      else await sb.from('ljs_projects').update({active:!p.active}).eq('id',p.id);
      refreshAdmin();
    };
    box.append(el);
  });
}
async function addProject() {
  const code=document.getElementById('newProjectCode').value.trim();
  const name=document.getElementById('newProjectName').value.trim();
  if(!code||!name){ alert('Renseigne le numéro d’affaire et le nom du chantier.'); return; }
  if(!isCloud){ const db=demoDb(); db.projects.push({id:'p_'+Date.now(),code,name,active:true}); saveDemoDb(db); }
  else { const {error}=await sb.from('ljs_projects').insert({code,name,active:true}); if(error){alert(error.message);return;} }
  document.getElementById('newProjectCode').value='';
  document.getElementById('newProjectName').value='';
  refreshAdmin();
}
async function renderAdminSheets() {
  const weekStart=mondayOfWeekValue(document.getElementById('adminWeekInput').value);
  const box=document.getElementById('adminTimesheets'); box.innerHTML='';
  document.getElementById('adminEditor').classList.add('hidden');
  let sheets=[];
  if(!isCloud){
    const db=demoDb();
    sheets=db.sheets.filter(s=>s.week_start===weekStart).map(s=>({
      ...s,
      technician_name:technicianById(s.technician_id)?.full_name||s.technician_id,
      total:totalWeek(s)
    }));
  } else {
    const {data,error}=await sb.from('ljs_timesheets_admin').select('*').eq('week_start',weekStart).order('technician_name');
    if(error){ box.innerHTML=`<p class="error">${esc(error.message)}</p>`; return; }
    sheets=data||[];
  }
  const byTech=new Map(sheets.map(s=>[s.technician_id||state.technicians.find(t=>t.full_name===s.technician_name)?.id,s]));
  state.technicians.forEach(account=>{
    const s=byTech.get(account.id);
    const el=document.createElement('div'); el.className='admin-item admin-sheet-row';
    const status = !s ? 'Aucune feuille' : s.status==='approved' ? 'Validée responsable' : s.status==='submitted' ? 'À valider' : 'En cours';
    el.innerHTML=`
      <div><strong>${esc(account.full_name)}</strong><span class="tech-type">${account.employment_type==='interim'?'Intérim':'Salarié'}</span><div class="meta">${account.active===false?'Retiré · ':''}${s ? `${fmtHours(s.total||0)} · ${status}` : status}</div></div>
      <div class="admin-row-actions">
        ${s?'<button class="primary open-sheet">Ouvrir / modifier</button><button class="secondary print-sheet">Imprimer</button>':''}
        ${s && (s.status==='submitted' || s.status==='approved')?'<button class="secondary unlock-sheet">Déverrouiller technicien</button>':''}
      </div>`;
    if(s){
      el.querySelector('.open-sheet').onclick=()=>openAdminSheet(s.id, account.full_name);
      el.querySelector('.print-sheet').onclick=async()=>{ const full=await loadAdminSheet(s.id, account.full_name); printTimesheet(full, account.full_name); };
      const ub=el.querySelector('.unlock-sheet'); if(ub) ub.onclick=()=>unlockSheet(s,account.full_name);
    }
    box.append(el);
  });
}
async function unlockSheet(s, name) {
  if(!confirm(`Déverrouiller la feuille de ${name} ? Le technicien pourra alors la modifier de nouveau.`)) return;
  if(!isCloud){
    const db=demoDb(); const x=db.sheets.find(x=>x.id===s.id);
    if(x){x.status='draft';x.submitted_at=null;x.approved_at=null;x.responsible_signature='';x.responsible_name='';}
    saveDemoDb(db);
  } else {
    await sb.from('ljs_timesheets').update({status:'draft',submitted_at:null,approved_at:null,responsible_signature:null,responsible_name:null}).eq('id',s.id);
  }
  renderAdminSheets();
}
async function loadAdminSheet(id, technicianName='') {
  if(!isCloud){
    const db=demoDb();
    const raw=db.sheets.find(x=>x.id===id);
    if(!raw) throw new Error('Feuille introuvable');
    const s=normalizeSheet(deepClone(raw), raw.week_start);
    const tech=technicianById(s.technician_id); s.technician_name = technicianName || tech?.full_name || s.technician_id; s.technician_employment_type=tech?.employment_type||'employee';
    return s;
  }
  const {data:ts,error}=await sb.from('ljs_timesheets').select('*').eq('id',id).single();
  if(error) throw error;
  const [{data:profile},{data:days},{data:entries}] = await Promise.all([
    sb.from('ljs_profiles').select('full_name,employment_type').eq('id',ts.technician_id).single(),
    sb.from('ljs_day_entries').select('*').eq('timesheet_id',id),
    sb.from('ljs_work_entries').select('*').eq('timesheet_id',id).order('created_at')
  ]);
  const s=normalizeSheet({
    ...ts,
    technician_name:profile?.full_name || technicianName,
    technician_employment_type:profile?.employment_type || 'employee',
    days:DAYS.map((name,i)=>{
      const date=dateForDay(ts.week_start,i);
      const d=(days||[]).find(x=>x.work_date===date);
      const es=(entries||[]).filter(x=>x.work_date===date).map(x=>({id:x.id,project_id:x.project_id||OTHER_PROJECT_ID,manual_project_code:x.manual_project_code||'',manual_project_name:x.manual_project_name||'',hours:Number(x.hours)}));
      return {date,name,zone:d?.travel_zone??0,absent:Boolean(d?.absent),comment:d?.comment??'',entries:es.length?es:[{project_id:state.projects[0]?.id||'',manual_project_code:'',manual_project_name:'',hours:0}]};
    })
  },ts.week_start);
  return s;
}
