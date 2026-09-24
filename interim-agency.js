// Gestion de l'agence d'intérim des techniciens.
function ensureInterimAgencyAddField(){
  const type=document.getElementById('newTechType');
  if(!type) return;
  let wrap=document.getElementById('newTechAgencyWrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='newTechAgencyWrap';
    wrap.className='hidden';
    wrap.innerHTML='<input id="newTechAgency" placeholder="Agence d’intérim" />';
    type.insertAdjacentElement('afterend',wrap);
  }
  if(!type.dataset.agencyBound){
    type.dataset.agencyBound='1';
    type.addEventListener('change',()=>{
      const interim=type.value==='interim';
      wrap.classList.toggle('hidden',!interim);
      if(!interim){const i=document.getElementById('newTechAgency');if(i)i.value='';}
    });
  }
  wrap.classList.toggle('hidden',type.value!=='interim');
}

const agencyObserver=new MutationObserver(()=>ensureInterimAgencyAddField());
agencyObserver.observe(document.getElementById('app'),{childList:true,subtree:true});

loadTechnicians = async function(includeInactive=false) {
  if (!isCloud) {
    const db=demoDb();
    state.technicians=(db.technicians||[]).filter(t=>includeInactive || t.active!==false).map(t=>({...t,interim_agency:t.interim_agency||''})).sort((a,b)=>a.full_name.localeCompare(b.full_name,'fr'));
    return state.technicians;
  }
  if (currentProfile?.role==='admin') {
    let q=sb.from('ljs_profiles').select('id,full_name,login_email,employment_type,interim_agency,active,role').eq('role','technician').order('full_name');
    if(!includeInactive) q=q.eq('active',true);
    const {data,error}=await q; if(error) throw error;
    state.technicians=(data||[]).map(t=>({...t,interim_agency:t.interim_agency||''}));
  } else {
    const {data,error}=await sb.from('ljs_technician_directory').select('*').order('full_name');
    if(error) throw error;
    state.technicians=(data||[]).map(t=>({...t,interim_agency:t.interim_agency||'',active:true,role:'technician'}));
  }
  return state.technicians;
};

renderAdminTechnicians = async function() {
  const box=document.getElementById('adminTechnicians'); if(!box) return; box.innerHTML='';
  state.technicians.forEach(t=>{
    const el=document.createElement('div'); el.className='admin-item tech-admin-item';
    const isInterim=t.employment_type==='interim';
    const type=isInterim?'Intérim':'Salarié';
    const agency=isInterim && t.interim_agency ? ` · Agence : ${esc(t.interim_agency)}` : '';
    el.innerHTML=`
      <div class="tech-summary">
        <strong>${esc(t.full_name)}</strong><span class="tech-type">${type}</span>
        <div class="meta">${t.active===false?'Retiré':'Actif'}${agency}</div>
      </div>
      <div class="admin-row-actions">
        <button class="secondary edit-tech">Modifier</button>
        <button class="secondary toggle-tech">${t.active===false?'Réactiver':'Retirer'}</button>
      </div>
      <div class="tech-edit-form hidden">
        <div><label>Nom et prénom</label><input class="edit-tech-name" value="${esc(t.full_name)}"></div>
        <div><label>Statut</label><select class="edit-tech-type"><option value="employee" ${!isInterim?'selected':''}>Salarié</option><option value="interim" ${isInterim?'selected':''}>Intérim</option></select></div>
        <div class="edit-tech-agency-wrap ${isInterim?'':'hidden'}"><label>Agence d’intérim</label><input class="edit-tech-agency" value="${esc(t.interim_agency||'')}" placeholder="Nom de l’agence"></div>
        <div><label>Nouveau PIN (facultatif)</label><input class="edit-tech-pin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]*" placeholder="Laisser vide pour conserver"></div>
        <div class="tech-edit-actions"><button class="primary save-tech-edit">Enregistrer</button><button class="ghost dark-ghost cancel-tech-edit">Annuler</button></div>
      </div>`;
    const form=el.querySelector('.tech-edit-form');
    const typeSel=el.querySelector('.edit-tech-type');
    const agencyWrap=el.querySelector('.edit-tech-agency-wrap');
    el.querySelector('.edit-tech').onclick=()=>form.classList.remove('hidden');
    el.querySelector('.cancel-tech-edit').onclick=()=>form.classList.add('hidden');
    typeSel.onchange=()=>{
      const interim=typeSel.value==='interim';
      agencyWrap.classList.toggle('hidden',!interim);
      if(!interim) el.querySelector('.edit-tech-agency').value='';
    };
    el.querySelector('.save-tech-edit').onclick=async()=>{
      const full_name=el.querySelector('.edit-tech-name').value.trim();
      const employment_type=typeSel.value;
      const interim_agency=employment_type==='interim'?el.querySelector('.edit-tech-agency').value.trim():'';
      const pin=el.querySelector('.edit-tech-pin').value.trim();
      if(!full_name){alert('Renseigne le nom du technicien.');return;}
      if(employment_type==='interim' && !interim_agency){alert('Renseigne l’agence d’intérim.');return;}
      if(pin && !/^\d{4}$/.test(pin)){alert('Le nouveau PIN doit contenir 4 chiffres.');return;}
      try{
        if(!isCloud){
          const db=demoDb();const x=db.technicians.find(x=>x.id===t.id);
          if(x){x.full_name=full_name;x.employment_type=employment_type;x.interim_agency=interim_agency;if(pin)x.pin=pin;}
          saveDemoDb(db);
        } else {
          const {data,error}=await sb.functions.invoke('manage-technician',{body:{action:'update',technician_id:t.id,full_name,employment_type,interim_agency,pin:pin||null}});
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
};

addTechnician = async function() {
  const name=document.getElementById('newTechName').value.trim();
  const employment_type=document.getElementById('newTechType').value;
  const interim_agency=employment_type==='interim'?(document.getElementById('newTechAgency')?.value||'').trim():'';
  const pin=document.getElementById('newTechPin').value.trim();
  if(!name){alert('Renseigne le nom du technicien.');return;}
  if(employment_type==='interim' && !interim_agency){alert('Renseigne l’agence d’intérim.');return;}
  if(!/^\d{4}$/.test(pin)){alert('Le PIN doit contenir 4 chiffres.');return;}
  try{
    if(!isCloud){
      const db=demoDb(); const id='tech_'+Date.now();
      db.technicians.push({id,full_name:name,login_email:`${id}@ljs.local`,employment_type,interim_agency,pin,active:true}); saveDemoDb(db);
    } else {
      const {data,error}=await sb.functions.invoke('manage-technician',{body:{action:'create',full_name:name,employment_type,interim_agency,pin}});
      if(error) throw error;
      if(data?.error) throw new Error(data.error);
    }
    document.getElementById('newTechName').value='';
    document.getElementById('newTechPin').value='';
    document.getElementById('newTechType').value='employee';
    const agencyInput=document.getElementById('newTechAgency'); if(agencyInput) agencyInput.value='';
    ensureInterimAgencyAddField();
    refreshAdmin();
  }catch(e){alert('Impossible d’ajouter le technicien : '+(e.message||e));}
};

loadAdminSheet = async function(id, technicianName='') {
  if(!isCloud){
    const db=demoDb();
    const raw=db.sheets.find(x=>x.id===id);
    if(!raw) throw new Error('Feuille introuvable');
    const s=normalizeSheet(deepClone(raw), raw.week_start);
    const tech=technicianById(s.technician_id);
    s.technician_name=technicianName || tech?.full_name || s.technician_id;
    s.technician_employment_type=tech?.employment_type||'employee';
    s.technician_interim_agency=tech?.interim_agency||'';
    return s;
  }
  const {data:ts,error}=await sb.from('ljs_timesheets').select('*').eq('id',id).single();
  if(error) throw error;
  const [{data:profile},{data:days},{data:entries}] = await Promise.all([
    sb.from('ljs_profiles').select('full_name,employment_type,interim_agency').eq('id',ts.technician_id).single(),
    sb.from('ljs_day_entries').select('*').eq('timesheet_id',id),
    sb.from('ljs_work_entries').select('*').eq('timesheet_id',id).order('created_at')
  ]);
  return normalizeSheet({
    ...ts,
    technician_name:profile?.full_name || technicianName,
    technician_employment_type:profile?.employment_type || 'employee',
    technician_interim_agency:profile?.interim_agency || '',
    days:DAYS.map((name,i)=>{
      const date=dateForDay(ts.week_start,i);
      const d=(days||[]).find(x=>x.work_date===date);
      const es=(entries||[]).filter(x=>x.work_date===date).map(x=>({id:x.id,project_id:x.project_id||OTHER_PROJECT_ID,manual_project_code:x.manual_project_code||'',manual_project_name:x.manual_project_name||'',hours:Number(x.hours)}));
      return {date,name,zone:d?.travel_zone??0,absent:Boolean(d?.absent),comment:d?.comment??'',entries:es.length?es:[{project_id:state.projects[0]?.id||'',manual_project_code:'',manual_project_name:'',hours:0}]};
    })
  },ts.week_start);
};

const basePrintTimesheet=printTimesheet;
printTimesheet=function(sheet,technicianName){
  const employmentType=sheet?.technician_employment_type || technicianById(sheet?.technician_id)?.employment_type || 'employee';
  const agency=sheet?.technician_interim_agency || technicianById(sheet?.technician_id)?.interim_agency || '';
  const displayName=employmentType==='interim' && agency ? `${technicianName} (${agency})` : technicianName;
  return basePrintTimesheet(sheet,displayName);
};
