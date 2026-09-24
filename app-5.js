async function openAdminSheet(id, technicianName) {
  try {
    await loadReferenceData(true);
    state.adminSheet=await loadAdminSheet(id, technicianName);
    renderAdminEditor();
    document.getElementById('adminEditor').scrollIntoView({behavior:'smooth',block:'start'});
  } catch(e) { alert(e.message||e); }
}
function isAdminChanged(path) { return (state.adminSheet?.admin_changes||[]).includes(path); }
function markAdminChange(path, element=null) {
  const s=state.adminSheet;
  if(!s.admin_changes.includes(path)) s.admin_changes.push(path);
  if(element) (element.closest('.admin-field') || element).classList.add('admin-changed');
}
function changedClass(path) { return isAdminChanged(path) ? ' admin-changed' : ''; }
function renderAdminEditor() {
  const s=state.adminSheet;
  const ed=document.getElementById('adminEditor');
  ed.classList.remove('hidden');
  ed.innerHTML=`
    <section class="card admin-edit-card">
      <div class="admin-editor-head">
        <div><h2>${esc(s.technician_name)} <span class="tech-type">${s.technician_employment_type==='interim'?'Intérim':'Salarié'}</span></h2><div class="meta">Semaine ${weekNumber(s.week_start)} · ${fmtHours(totalWeek(s))} · ${s.status==='approved'?'Validée responsable':s.status==='submitted'?'Validée technicien':'En cours'}</div></div>
        <button id="closeAdminEditor" class="ghost dark-ghost">Fermer</button>
      </div>
      <p class="admin-red-note">Toute correction faite par le responsable est conservée et imprimée <b>en rouge</b>.</p>
      <div class="field-row">
        <div class="admin-field${changedClass('vehicle_id')}"><label>Véhicule</label><select id="adminVehicle"></select></div>
        <div><label>Signature technicien</label><div id="adminTechSig"></div></div>
      </div>
      <div id="adminDays"></div>
      <div class="admin-field${changedClass('general_comment')}"><label>Commentaire général</label><textarea id="adminWeekComment" rows="3">${esc(s.general_comment)}</textarea></div>
    </section>
    <section class="card signature-card">
      <div class="signature-head"><div><h2>Validation responsable</h2><p class="hint">Signe ici puis clique sur « Valider la feuille ».</p></div><button id="clearResponsibleSignature" class="secondary">Effacer</button></div>
      <div class="admin-field${changedClass('responsible_signature')}"><canvas id="responsibleSignatureCanvas" class="signature-pad responsible-signature-pad" width="900" height="220"></canvas></div>
    </section>
    <section class="card admin-edit-actions">
      <button id="saveAdminChanges" class="secondary">Enregistrer les corrections</button>
      <button id="printAdminSheet" class="secondary">Aperçu / Imprimer</button>
      <button id="approveAdminSheet" class="primary">Valider la feuille</button>
      <p id="adminSaveMsg" class="hint"></p>
    </section>`;
  document.getElementById('closeAdminEditor').onclick=()=>{ ed.classList.add('hidden'); state.adminSheet=null; };
  const veh=document.getElementById('adminVehicle');
  veh.add(new Option('— Aucun véhicule —',''));
  state.vehicles.forEach(v=>veh.add(new Option(v.registration,v.id)));
  veh.value=s.vehicle_id||'';
  veh.onchange=e=>{s.vehicle_id=e.target.value;markAdminChange('vehicle_id',e.target);};
  document.getElementById('adminWeekComment').oninput=e=>{s.general_comment=e.target.value;markAdminChange('general_comment',e.target);};
  const techSig=document.getElementById('adminTechSig');
  techSig.innerHTML=s.technician_signature?`<img class="signature-preview small-signature" src="${s.technician_signature}" alt="Signature technicien">`:'<span class="error">Pas de signature technicien</span>';
  const days=document.getElementById('adminDays');
  s.days.forEach((d,di)=>days.append(renderAdminDay(d,di)));
  const rc=document.getElementById('responsibleSignatureCanvas');
  initSignaturePad(rc,s.responsible_signature,data=>{s.responsible_signature=data;markAdminChange('responsible_signature',rc);}, '#d40000');
  document.getElementById('clearResponsibleSignature').onclick=()=>{clearSignatureCanvas(rc);s.responsible_signature='';markAdminChange('responsible_signature',rc);};
  document.getElementById('saveAdminChanges').onclick=()=>saveAdminSheet(false);
  document.getElementById('approveAdminSheet').onclick=()=>saveAdminSheet(true);
  document.getElementById('printAdminSheet').onclick=()=>printTimesheet(s,s.technician_name);
}
function renderAdminDay(day,di) {
  const sec=document.createElement('section');
  sec.className='admin-day-block'+(day.absent?' absent':'');
  sec.innerHTML=`
    <div class="day-title"><h3>${esc(formatDayTitle(day.date))}</h3><strong data-admin-day-total="${di}">${fmtHours(totalDay(day))}</strong></div>
    <div class="absence-line admin-field${changedClass(`days.${di}.absent`)}"><input class="admin-absent" type="checkbox" ${day.absent?'checked':''}><label>Technicien absent ce jour</label></div>
    <div class="admin-work-list"></div>
    <button class="secondary admin-add-row" ${day.absent?'disabled':''}>+ Ajouter un chantier</button>
    <div class="zone-only">
      <div class="admin-field${changedClass(`days.${di}.zone`)}"><label>Zone trajet</label><select class="admin-zone" ${day.absent?'disabled':''}>${[0,1,2,3,4,5].map(z=>`<option value="${z}" ${Number(day.zone)===z?'selected':''}>Zone ${z}</option>`).join('')}</select></div>
    </div>`;
  const list=sec.querySelector('.admin-work-list');
  function redraw(){
    list.innerHTML='';
    day.entries.forEach((e,ei)=>{
      e.manual_project_code=e.manual_project_code||'';e.manual_project_name=e.manual_project_name||'';
      const wholeChanged=isAdminChanged(`days.${di}.entries`); const disabled=day.absent;
      const row=document.createElement('div'); row.className='work-row';
      row.innerHTML=`
        <div class="admin-field${wholeChanged||isAdminChanged(`days.${di}.entries.${ei}.project_id`)?' admin-changed':''}"><label>Chantier</label><select class="project" ${disabled?'disabled':''}>${projectOptions(e.project_id,true)}</select></div>
        <div class="admin-field${wholeChanged||isAdminChanged(`days.${di}.entries.${ei}.hours`)?' admin-changed':''}"><label>Heures</label><input class="hours" type="number" min="0" max="24" step="0.25" value="${e.hours||''}" inputmode="decimal" ${disabled?'disabled':''}></div>
        <button class="remove" title="Supprimer" ${disabled?'disabled':''}>×</button>
        <div class="manual-project-fields ${e.project_id===OTHER_PROJECT_ID?'':'hidden'}">
          <div class="admin-field${changedClass(`days.${di}.entries.${ei}.manual_project_code`)}"><label>N° affaire / réf.</label><input class="manual-code" value="${esc(e.manual_project_code)}" ${disabled?'disabled':''}></div>
          <div class="admin-field${changedClass(`days.${di}.entries.${ei}.manual_project_name`)}"><label>Nom du chantier / intervention</label><input class="manual-name" value="${esc(e.manual_project_name)}" ${disabled?'disabled':''}></div>
        </div>`;
      row.querySelector('.project').onchange=ev=>{e.project_id=ev.target.value;if(e.project_id!==OTHER_PROJECT_ID){e.manual_project_code='';e.manual_project_name='';}markAdminChange(`days.${di}.entries.${ei}.project_id`,ev.target);redraw();};
      row.querySelector('.hours').oninput=ev=>{e.hours=Math.max(0,Number(ev.target.value||0));markAdminChange(`days.${di}.entries.${ei}.hours`,ev.target);updateAdminEditorTotal(di);};
      row.querySelector('.manual-code').oninput=ev=>{e.manual_project_code=ev.target.value;markAdminChange(`days.${di}.entries.${ei}.manual_project_code`,ev.target);};
      row.querySelector('.manual-name').oninput=ev=>{e.manual_project_name=ev.target.value;markAdminChange(`days.${di}.entries.${ei}.manual_project_name`,ev.target);};
      row.querySelector('.remove').onclick=()=>{ if(day.entries.length===1){day.entries[0]={project_id:state.projects[0]?.id||'',manual_project_code:'',manual_project_name:'',hours:0};} else day.entries.splice(ei,1); markAdminChange(`days.${di}.entries`); redraw(); updateAdminEditorTotal(di); };
      list.append(row);
    });
  }
  redraw();
  sec.querySelector('.admin-add-row').onclick=()=>{day.entries.push({project_id:state.projects.find(p=>p.active)?.id||state.projects[0]?.id||'',manual_project_code:'',manual_project_name:'',hours:0});markAdminChange(`days.${di}.entries`);redraw();};
  sec.querySelector('.admin-zone').onchange=e=>{day.zone=Number(e.target.value);markAdminChange(`days.${di}.zone`,e.target);};
  sec.querySelector('.admin-absent').onchange=e=>{day.absent=e.target.checked;markAdminChange(`days.${di}.absent`,e.target);if(day.absent){day.zone=0;day.entries.forEach(x=>x.hours=0);}renderAdminEditor();};
  return sec;
}
function updateAdminEditorTotal(di){
  const el=document.querySelector(`[data-admin-day-total="${di}"]`);
  if(el) el.textContent=fmtHours(totalDay(state.adminSheet.days[di]));
}
async function saveAdminSheet(approve) {
  const s=state.adminSheet;
  if(!s) return;
  const invalidOther=s.days.some(d=>!d.absent && d.entries.some(e=>Number(e.hours)>0 && e.project_id===OTHER_PROJECT_ID && !String(e.manual_project_name||'').trim()));
  if(invalidOther){alert('Pour « Chantier autre », renseigne le nom du chantier ou de l’intervention.');return;}
  if(approve){
    if(!s.technician_signature){alert('Cette feuille ne comporte pas la signature du technicien.');return;}
    if(!s.responsible_signature){alert('Signe la feuille dans la zone « Validation responsable » avant de la valider.');return;}
    if(!confirm('Valider définitivement cette feuille en tant que responsable ?')) return;
    s.status='approved';
    s.approved_at=new Date().toISOString();
    s.responsible_name=currentProfile.full_name || CFG.ADMIN_ACCOUNT.name || 'Responsable';
    markAdminChange('responsible_signature');
  }
  const msg=document.getElementById('adminSaveMsg');
  msg.textContent='Enregistrement…';
  try{
    if(!isCloud){
      const db=demoDb();
      const idx=db.sheets.findIndex(x=>x.id===s.id);
      if(idx<0) throw new Error('Feuille introuvable');
      db.sheets[idx]=deepClone(s);
      saveDemoDb(db);
    } else {
      const {error}=await sb.from('ljs_timesheets').update({
        vehicle_id:s.vehicle_id||null,
        general_comment:s.general_comment||'',
        status:s.status,
        approved_at:s.approved_at||null,
        responsible_signature:s.responsible_signature||null,
        responsible_name:s.responsible_name||null,
        admin_changes:s.admin_changes||[]
      }).eq('id',s.id);
      if(error) throw error;
      await sb.from('ljs_day_entries').delete().eq('timesheet_id',s.id);
      await sb.from('ljs_work_entries').delete().eq('timesheet_id',s.id);
      const dayRows=s.days.map(d=>({timesheet_id:s.id,work_date:d.date,travel_zone:d.absent?0:d.zone,absent:Boolean(d.absent),comment:d.comment||''}));
      const workRows=s.days.flatMap(d=>d.absent?[]:d.entries.filter(e=>Number(e.hours)>0&&e.project_id&&(e.project_id!==OTHER_PROJECT_ID||String(e.manual_project_name||'').trim())).map(e=>({timesheet_id:s.id,work_date:d.date,project_id:e.project_id===OTHER_PROJECT_ID?null:e.project_id,manual_project_code:e.project_id===OTHER_PROJECT_ID?(e.manual_project_code||null):null,manual_project_name:e.project_id===OTHER_PROJECT_ID?(e.manual_project_name||null):null,hours:Number(e.hours)})));
      const de=await sb.from('ljs_day_entries').insert(dayRows); if(de.error) throw de.error;
      if(workRows.length){const we=await sb.from('ljs_work_entries').insert(workRows);if(we.error)throw we.error;}
    }
    msg.textContent=approve?'Feuille validée par le responsable.':'Corrections enregistrées.';
    if(approve) setTimeout(()=>refreshAdmin(),500);
  }catch(e){console.error(e);msg.textContent='Erreur : '+(e.message||e);}
}
