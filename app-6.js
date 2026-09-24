function pathChanged(sheet,path){return (sheet.admin_changes||[]).includes(path);}
function dayHoursChanged(sheet,di){return (sheet.admin_changes||[]).some(p=>p===`days.${di}.entries`||p.startsWith(`days.${di}.entries.`)||p===`days.${di}.absent`);}
function entryProjectKey(e){return e.project_id===OTHER_PROJECT_ID||!e.project_id?`other:${String(e.manual_project_code||'').trim().toLowerCase()}|${String(e.manual_project_name||'').trim().toLowerCase()}`:`project:${e.project_id}`;}
function descriptorForEntry(e){
  if(e.project_id===OTHER_PROJECT_ID||!e.project_id) return {id:entryProjectKey(e),key:entryProjectKey(e),code:(e.manual_project_code||'AUTRE').trim()||'AUTRE',name:(e.manual_project_name||'Chantier autre').trim()||'Chantier autre',manual:true};
  const p=projectById(e.project_id)||{id:e.project_id,code:'?',name:'Chantier'}; return {...p,key:`project:${e.project_id}`,manual:false};
}
function projectHeaderChanged(sheet,projectKey){
  for(let di=0;di<sheet.days.length;di++) for(let ei=0;ei<sheet.days[di].entries.length;ei++){
    const e=sheet.days[di].entries[ei]; if(entryProjectKey(e)!==projectKey) continue;
    if(pathChanged(sheet,`days.${di}.entries`)||pathChanged(sheet,`days.${di}.entries.${ei}.project_id`)||pathChanged(sheet,`days.${di}.entries.${ei}.manual_project_code`)||pathChanged(sheet,`days.${di}.entries.${ei}.manual_project_name`)) return true;
  }
  return false;
}
function cellHoursForProject(day, projectKey){return day.absent?0:day.entries.filter(e=>entryProjectKey(e)===projectKey).reduce((a,e)=>a+Number(e.hours||0),0);}
function cellChangedForProject(sheet,di,projectKey){
  const d=sheet.days[di]; if(pathChanged(sheet,`days.${di}.entries`)) return true;
  return d.entries.some((e,ei)=>entryProjectKey(e)===projectKey && (pathChanged(sheet,`days.${di}.entries.${ei}.hours`)||pathChanged(sheet,`days.${di}.entries.${ei}.project_id`)||pathChanged(sheet,`days.${di}.entries.${ei}.manual_project_code`)||pathChanged(sheet,`days.${di}.entries.${ei}.manual_project_name`)));
}
function printCommentHtml(sheet){
  const parts=[];
  if(sheet.general_comment) parts.push(`<span class="${pathChanged(sheet,'general_comment')?'red-edit':''}">${esc(sheet.general_comment)}</span>`);
  return parts.join(' &nbsp; | &nbsp; ');
}
function getPrintProjects(sheet){
  const map=new Map();
  sheet.days.forEach(d=>{if(d.absent)return;(d.entries||[]).forEach(e=>{if(Number(e.hours)>0 && e.project_id && (e.project_id!==OTHER_PROJECT_ID || String(e.manual_project_name||'').trim())){const desc=descriptorForEntry(e);if(!map.has(desc.key))map.set(desc.key,desc);}})});
  return [...map.values()].slice(0,18);
}
function formatPrintTime(totalMinutes){
  const minutes=Math.max(0,Math.round(Number(totalMinutes)||0));
  const h=Math.floor(minutes/60);
  const m=minutes%60;
  return `${h}h${String(m).padStart(2,'0')}`;
}
function effectiveHoursForDay(day){
  if(day?.absent) return [];
  const totalMinutes=Math.max(0,Math.round(Number(totalDay(day)||0)*60));
  if(totalMinutes<=0) return [];
  const lines=[];
  const morningMinutes=Math.min(totalMinutes,4*60);
  if(morningMinutes>0) lines.push(`8h00 à ${formatPrintTime(8*60+morningMinutes)}`);
  const afternoonMinutes=Math.max(0,totalMinutes-4*60);
  if(afternoonMinutes>0) lines.push(`13h30 à ${formatPrintTime(13*60+30+afternoonMinutes)}`);
  return lines;
}
function printTimesheet(sheet, technicianName) {
  const s=normalizeSheet(deepClone(sheet),sheet.week_start);
  const projects=getPrintProjects(s);
  while(projects.length<18) projects.push(null);
  const monday=new Date(s.week_start+'T12:00:00');
  const vehicle=vehicleById(s.vehicle_id)?.registration || '';
  const employmentType=s.technician_employment_type || technicianById(s.technician_id)?.employment_type || 'employee';
  const month=monday.toLocaleDateString('fr-FR',{month:'long'});
  const year=monday.getFullYear();
  const week=weekNumber(s.week_start);
  const PW=2339, PH=1653;
  const pc=(v,max)=>((v/max)*100).toFixed(5)+'%';
  const box=(x1,y1,x2,y2,cls,html)=>`<div class="p-overlay ${cls||''}" style="left:${pc(x1,PW)};top:${pc(y1,PH)};width:${pc(x2-x1,PW)};height:${pc(y2-y1,PH)}">${html||''}</div>`;
  const red=(changed)=>changed?' red-edit':'';

  const overlay=[];
  if(employmentType==='interim') overlay.push(box(102,188,392,224,'p-field',`<span>${esc(technicianName)}</span>`));
  else overlay.push(box(102,151,392,187,'p-field',`<span>${esc(technicianName)}</span>`));
  overlay.push(box(102,226,392,267,'p-field'+red(pathChanged(s,'vehicle_id')),`<span>${esc(vehicle)}</span>`));
  const commentParts=[];
  if(s.general_comment) commentParts.push(`<span class="${pathChanged(s,'general_comment')?'red-edit':''}">${esc(s.general_comment)}</span>`);
  overlay.push(box(790,151,2235,270,'p-comments',commentParts.join('')));
  overlay.push(box(95,750,165,786,'p-year-mask',`<span>${year}</span>`));
  overlay.push(box(67,805,190,849,'p-month',`<span>${esc(month)}</span>`));
  overlay.push(box(150,1480,275,1537,'p-week-number',`<span>${week}</span>`));

  const projectX0=433, projectW=89;
  projects.forEach((p,i)=>{
    if(!p) return;
    const x1=projectX0+i*projectW, x2=x1+projectW;
    const ch=projectHeaderChanged(s,p.key);
    overlay.push(box(x1+2,312,x2-2,482,'p-project-code p-project-vertical'+red(ch),`<span>${esc(p.code)}</span>`));
    overlay.push(box(x1+2,489,x2-2,742,'p-project-name p-project-vertical'+red(ch),`<span>${esc(p.name)}</span>`));
  });

  const rowLines=[946,1021,1095,1169,1243,1317,1391,1464];
  s.days.forEach((d,di)=>{
    const y1=rowLines[di]+3, y2=rowLines[di+1]-2;
    const dayNum=new Date(d.date+'T12:00:00').getDate();
    overlay.push(box(7,y1+2,140,y2-2,'p-day-mask',''));
    overlay.push(box(7,y1,140,y2,'p-day-name',DAY_FULL[di]));
    overlay.push(box(144,y1,219,y2,'p-day-number',String(dayNum)));

    const dt=totalDay(d);
    const dayHasHours=!d.absent && dt>0;
    const effectiveLines=effectiveHoursForDay(d);
    const effectiveHoursHtml=effectiveLines.length
      ? `<div style="width:100%;height:100%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.2mm;font-size:6.2pt;font-weight:700;line-height:1.05;white-space:nowrap">${effectiveLines.map(line=>`<span>${line}</span>`).join('')}</div>`
      : '<div style="width:100%;height:100%;background:#fff"></div>';
    overlay.push(box(2125,y1+1,2334,y2-1,'p-effective-hours',effectiveHoursHtml));

    if(d.absent){overlay.push(box(433,y1,2035,y2,'p-absent'+red(pathChanged(s,`days.${di}.absent`)),'ABSENT'));return;}
    if(dayHasHours) overlay.push(box(220,y1,321,y2,'p-zone'+red(pathChanged(s,`days.${di}.zone`)),String(d.zone)));
    projects.forEach((p,i)=>{
      if(!p) return;
      const h=cellHoursForProject(d,p.key);
      if(!h) return;
      const x1=projectX0+i*projectW, x2=x1+projectW;
      overlay.push(box(x1+2,y1,x2-2,y2,'p-hours'+red(cellChangedForProject(s,di,p.key)),fmtCellHours(h)));
    });
    if(dt) overlay.push(box(2039,y1,2123,y2,'p-day-total'+red(dayHoursChanged(s,di)),fmtCellHours(dt)));
  });

  projects.forEach((p,i)=>{
    if(!p) return;
    const t=s.days.reduce((a,d)=>a+cellHoursForProject(d,p.key),0);
    if(!t) return;
    const changed=s.days.some((d,di)=>cellChangedForProject(s,di,p.key));
    const x1=projectX0+i*projectW, x2=x1+projectW;
    overlay.push(box(x1+2,1468,x2-2,1520,'p-project-total'+red(changed),fmtCellHours(t)));
  });
  const anyHoursChanged=(s.admin_changes||[]).some(p=>p.includes('.entries'));
  overlay.push(box(2039,1468,2123,1538,'p-week-total'+red(anyHoursChanged),fmtCellHours(totalWeek(s))));
  if(s.technician_signature) overlay.push(box(170,1572,1190,1642,'p-signature',`<img src="${s.technician_signature}" alt="Signature technicien">`));
  if(s.responsible_signature) overlay.push(box(1515,1572,2285,1642,'p-signature responsible-signature-print red-edit',`<img src="${s.responsible_signature}" alt="Signature responsable">`));
  printArea.innerHTML=`<div class="exact-print-sheet"><img class="exact-print-bg" src="./print-template.svg?v=20260916-print-2" alt="Modèle original LJS">${overlay.join('')}</div>`;
  const images=[...printArea.querySelectorAll('img')];
  const waits=images.map(im=>new Promise(resolve=>{
    const finish=async()=>{try{if(im.decode)await im.decode();}catch(_){}resolve();};
    if(im.complete){finish();return;}
    im.addEventListener('load',finish,{once:true});
    im.addEventListener('error',finish,{once:true});
  }));
  Promise.all(waits).then(()=>setTimeout(()=>window.print(),120));
}

document.addEventListener('DOMContentLoaded', showLogin);
