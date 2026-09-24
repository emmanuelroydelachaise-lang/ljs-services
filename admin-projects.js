// Gestion des chantiers côté responsable : seuls les chantiers actifs sont visibles.
// "Supprimer" désactive le chantier afin de préserver les anciennes feuilles d'heures.
// "Modifier" permet de changer le numéro d'affaire et le nom du chantier.
renderAdminProjects = async function() {
  const box=document.getElementById('adminProjects');
  if(!box) return;
  box.innerHTML='';

  // L'espace « Techniciens » correspond à la gestion du personnel autorisé à saisir
  // des feuilles d'heures. L'administration peut déjà ajouter, modifier, retirer
  // ou réactiver ces personnes depuis cet écran.
  const personnelCard=document.getElementById('adminTechnicians')?.closest('.card');
  const personnelTitle=personnelCard?.querySelector('h2');
  if(personnelTitle) personnelTitle.textContent='Personnel / techniciens';

  let projects=[];
  if(!isCloud){
    projects=(demoDb().projects||[]).filter(p=>p.active!==false);
  } else {
    const {data,error}=await sb.from('ljs_projects').select('*').eq('active',true).order('code');
    if(error){
      box.innerHTML=`<p class="error">${esc(error.message)}</p>`;
      return;
    }
    projects=data||[];
  }

  if(!projects.length){
    box.innerHTML='<p class="hint">Aucun chantier actif.</p>';
    return;
  }

  projects.forEach(p=>{
    const el=document.createElement('div');
    el.className='admin-item project-admin-item';
    el.innerHTML=`
      <div class="project-summary"><strong>${esc(p.code)} — ${esc(p.name)}</strong></div>
      <div class="admin-row-actions">
        <button class="secondary edit-project">Modifier</button>
        <button class="secondary delete-project">Supprimer</button>
      </div>
      <div class="project-edit-form hidden" style="width:100%;margin-top:10px;">
        <div class="project-add">
          <input class="edit-project-code" value="${esc(p.code)}" placeholder="N° affaire">
          <input class="edit-project-name" value="${esc(p.name)}" placeholder="Nom du chantier">
          <button class="primary save-project-edit">Enregistrer</button>
          <button class="ghost dark-ghost cancel-project-edit">Annuler</button>
        </div>
      </div>`;

    const form=el.querySelector('.project-edit-form');
    el.querySelector('.edit-project').onclick=()=>form.classList.remove('hidden');
    el.querySelector('.cancel-project-edit').onclick=()=>form.classList.add('hidden');

    el.querySelector('.save-project-edit').onclick=async()=>{
      const code=el.querySelector('.edit-project-code').value.trim();
      const name=el.querySelector('.edit-project-name').value.trim();
      if(!code || !name){
        alert('Renseigne le numéro d’affaire et le nom du chantier.');
        return;
      }
      try{
        if(!isCloud){
          const db=demoDb();
          const x=db.projects.find(x=>x.id===p.id);
          if(x){x.code=code;x.name=name;}
          saveDemoDb(db);
        } else {
          const {error}=await sb.from('ljs_projects').update({code,name}).eq('id',p.id);
          if(error) throw error;
        }
        await refreshAdmin();
      }catch(e){
        alert('Impossible de modifier le chantier : '+(e.message||e));
      }
    };

    el.querySelector('.delete-project').onclick=async()=>{
      if(!confirm(`Supprimer le chantier ${p.code} — ${p.name} de la liste ?\n\nIl disparaîtra de l'onglet responsable mais restera conservé dans les anciennes feuilles d'heures.`)) return;
      try{
        if(!isCloud){
          const db=demoDb();
          const x=db.projects.find(x=>x.id===p.id);
          if(x) x.active=false;
          saveDemoDb(db);
        } else {
          const {error}=await sb.from('ljs_projects').update({active:false}).eq('id',p.id);
          if(error) throw error;
        }
        await refreshAdmin();
      }catch(e){
        alert('Impossible de supprimer le chantier : '+(e.message||e));
      }
    };
    box.append(el);
  });
};

// Le module véhicules existait déjà dans le dépôt mais n'était pas chargé par
// l'application. On le charge ici pour l'intégrer à l'espace responsable sans
// modifier la structure générale de l'application.
(function loadAdminVehiclesModule(){
  if(window.__ljsAdminVehiclesLoaded) return;
  window.__ljsAdminVehiclesLoaded=true;
  if(document.querySelector('script[data-ljs-admin-vehicles]')) return;
  const script=document.createElement('script');
  script.src='./admin-vehicles.js?v=20260916-admin-management-1';
  script.async=false;
  script.dataset.ljsAdminVehicles='1';
  document.head.appendChild(script);
})();
