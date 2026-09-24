(() => {
  const normalizeRegistration = value => String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const normalizeBrand = value => String(value || '').trim().replace(/\s+/g, ' ');

  function bindResponsibleAdministrationButton() {
    const btn = document.getElementById('adminManagementBtn');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.onclick = showAdministrationManagement;
    }
  }

  async function showAdministrationManagement() {
    cloneTemplate('managementTemplate');
    document.getElementById('managementBackBtn').onclick = showAdmin;
    document.getElementById('managementLogoutBtn').onclick = logout;
    document.getElementById('addManagementTechBtn').onclick = addManagementTechnician;
    document.getElementById('addManagementProjectBtn').onclick = addManagementProject;
    document.getElementById('addManagementVehicleBtn').onclick = addManagementVehicle;

    const techType = document.getElementById('managementTechType');
    techType.onchange = () => {
      const wrap = document.getElementById('managementTechAgencyWrap');
      const input = document.getElementById('managementTechAgency');
      const interim = techType.value === 'interim';
      wrap.classList.toggle('hidden', !interim);
      if (!interim) input.value = '';
    };

    await refreshManagement();
  }

  async function refreshManagement() {
    try {
      await Promise.all([loadReferenceData(true), loadTechnicians(true)]);
      await Promise.all([
        renderManagementTechnicians(),
        renderManagementProjects(),
        renderManagementVehicles()
      ]);
    } catch (error) {
      console.error(error);
      alert('Impossible de charger l’espace Administration : ' + (error.message || error));
    }
  }

  async function renderManagementTechnicians() {
    const box = document.getElementById('managementTechnicians');
    if (!box) return;
    box.innerHTML = '';

    const technicians = [...(state.technicians || [])]
      .filter(t => !t.deleted)
      .sort((a,b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'fr'));

    if (!technicians.length) {
      box.innerHTML = '<p class="hint">Aucun technicien enregistré.</p>';
      return;
    }

    technicians.forEach(t => {
      const isInterim = t.employment_type === 'interim';
      const row = document.createElement('div');
      row.className = 'admin-item tech-admin-item';
      row.innerHTML = `
        <div class="tech-summary">
          <strong>${esc(t.full_name)}</strong><span class="tech-type">${isInterim ? 'Intérim' : 'Salarié'}</span>
          <div class="meta">${t.active === false ? 'Retiré' : 'Actif'}${isInterim && t.interim_agency ? ` · Agence : ${esc(t.interim_agency)}` : ''}</div>
        </div>
        <div class="admin-row-actions">
          <button class="secondary management-edit-tech">Modifier</button>
          <button class="secondary management-toggle-tech">${t.active === false ? 'Réactiver' : 'Retirer'}</button>
        </div>
        <div class="tech-edit-form hidden">
          <div><label>Nom et prénom</label><input class="management-edit-tech-name" value="${esc(t.full_name)}"></div>
          <div><label>Statut</label><select class="management-edit-tech-type"><option value="employee" ${!isInterim ? 'selected' : ''}>Salarié</option><option value="interim" ${isInterim ? 'selected' : ''}>Intérim</option></select></div>
          <div class="management-edit-tech-agency-wrap ${isInterim ? '' : 'hidden'}"><label>Agence d’intérim</label><input class="management-edit-tech-agency" value="${esc(t.interim_agency || '')}" placeholder="Nom de l’agence"></div>
          <div><label>Nouveau PIN</label><input class="management-edit-tech-pin" type="password" inputmode="numeric" maxlength="4" placeholder="Facultatif"></div>
          <div class="tech-edit-actions"><button class="primary management-save-tech">Enregistrer</button><button class="ghost dark-ghost management-cancel-tech">Annuler</button></div>
        </div>`;

      const form = row.querySelector('.tech-edit-form');
      const typeSelect = row.querySelector('.management-edit-tech-type');
      const agencyWrap = row.querySelector('.management-edit-tech-agency-wrap');
      row.querySelector('.management-edit-tech').onclick = () => form.classList.remove('hidden');
      row.querySelector('.management-cancel-tech').onclick = () => form.classList.add('hidden');
      typeSelect.onchange = () => {
        const interim = typeSelect.value === 'interim';
        agencyWrap.classList.toggle('hidden', !interim);
        if (!interim) row.querySelector('.management-edit-tech-agency').value = '';
      };
      row.querySelector('.management-save-tech').onclick = async () => {
        const full_name = row.querySelector('.management-edit-tech-name').value.trim();
        const employment_type = typeSelect.value;
        const interim_agency = employment_type === 'interim' ? row.querySelector('.management-edit-tech-agency').value.trim() : '';
        const pin = row.querySelector('.management-edit-tech-pin').value.trim();
        if (!full_name) return alert('Renseigne le nom du technicien.');
        if (employment_type === 'interim' && !interim_agency) return alert('Renseigne l’agence d’intérim.');
        if (pin && !/^\d{4}$/.test(pin)) return alert('Le PIN doit contenir 4 chiffres.');
        try {
          if (!isCloud) {
            const db = demoDb();
            const found = (db.technicians || []).find(x => x.id === t.id);
            if (found) {
              found.full_name = full_name;
              found.employment_type = employment_type;
              found.interim_agency = interim_agency;
              if (pin) found.pin = pin;
            }
            saveDemoDb(db);
          } else {
            const {data, error} = await sb.functions.invoke('manage-technician', {body:{action:'update', technician_id:t.id, full_name, employment_type, interim_agency, pin:pin || null}});
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
          }
          await refreshManagement();
        } catch (error) {
          alert('Impossible de modifier le technicien : ' + (error.message || error));
        }
      };
      row.querySelector('.management-toggle-tech').onclick = async () => {
        const next = t.active === false;
        if (!next && !confirm(`Retirer ${t.full_name} de la liste des techniciens ? Ses anciennes feuilles seront conservées.`)) return;
        try {
          if (!isCloud) {
            const db = demoDb();
            const found = (db.technicians || []).find(x => x.id === t.id);
            if (found) found.active = next;
            saveDemoDb(db);
          } else {
            const {data, error} = await sb.functions.invoke('manage-technician', {body:{action:'set_active', technician_id:t.id, active:next}});
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
          }
          await refreshManagement();
        } catch (error) {
          alert('Impossible de modifier le technicien : ' + (error.message || error));
        }
      };
      box.appendChild(row);
    });
  }

  async function addManagementTechnician() {
    const name = document.getElementById('managementTechName').value.trim();
    const employment_type = document.getElementById('managementTechType').value;
    const interim_agency = employment_type === 'interim' ? document.getElementById('managementTechAgency').value.trim() : '';
    const pin = document.getElementById('managementTechPin').value.trim();
    if (!name) return alert('Renseigne le nom du technicien.');
    if (employment_type === 'interim' && !interim_agency) return alert('Renseigne l’agence d’intérim.');
    if (!/^\d{4}$/.test(pin)) return alert('Le PIN doit contenir 4 chiffres.');

    try {
      if (!isCloud) {
        const db = demoDb();
        const id = 'tech_' + Date.now();
        db.technicians = db.technicians || [];
        db.technicians.push({id, full_name:name, login_email:`${id}@ljs.local`, employment_type, interim_agency, pin, active:true});
        saveDemoDb(db);
      } else {
        const {data, error} = await sb.functions.invoke('manage-technician', {body:{action:'create', full_name:name, employment_type, interim_agency, pin}});
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
      document.getElementById('managementTechName').value = '';
      document.getElementById('managementTechPin').value = '';
      document.getElementById('managementTechType').value = 'employee';
      document.getElementById('managementTechAgency').value = '';
      document.getElementById('managementTechAgencyWrap').classList.add('hidden');
      await refreshManagement();
    } catch (error) {
      alert('Impossible d’ajouter le technicien : ' + (error.message || error));
    }
  }

  async function getProjects() {
    if (!isCloud) return demoDb().projects || [];
    const {data, error} = await sb.from('ljs_projects').select('*').order('code');
    if (error) throw error;
    return data || [];
  }

  async function renderManagementProjects() {
    const box = document.getElementById('managementProjects');
    if (!box) return;
    box.innerHTML = '';
    const projects = await getProjects();
    if (!projects.length) {
      box.innerHTML = '<p class="hint">Aucun chantier enregistré.</p>';
      return;
    }

    projects.forEach(p => {
      const row = document.createElement('div');
      row.className = 'admin-item project-admin-item';
      row.innerHTML = `
        <div class="project-summary"><strong>${esc(p.code)} — ${esc(p.name)}</strong><div class="meta">${p.active === false ? 'Retiré' : 'Actif'}</div></div>
        <div class="admin-row-actions">
          <button class="secondary management-edit-project">Modifier</button>
          <button class="secondary management-toggle-project">${p.active === false ? 'Réactiver' : 'Retirer'}</button>
        </div>
        <div class="project-edit-form hidden" style="width:100%;margin-top:10px;">
          <div class="project-add">
            <input class="management-edit-project-code" value="${esc(p.code)}" placeholder="N° affaire">
            <input class="management-edit-project-name" value="${esc(p.name)}" placeholder="Nom du chantier">
            <button class="primary management-save-project">Enregistrer</button>
            <button class="ghost dark-ghost management-cancel-project">Annuler</button>
          </div>
        </div>`;
      const form = row.querySelector('.project-edit-form');
      row.querySelector('.management-edit-project').onclick = () => form.classList.remove('hidden');
      row.querySelector('.management-cancel-project').onclick = () => form.classList.add('hidden');
      row.querySelector('.management-save-project').onclick = async () => {
        const code = row.querySelector('.management-edit-project-code').value.trim();
        const name = row.querySelector('.management-edit-project-name').value.trim();
        if (!code || !name) return alert('Renseigne le numéro d’affaire et le nom du chantier.');
        try {
          if (!isCloud) {
            const db = demoDb();
            const found = (db.projects || []).find(x => x.id === p.id);
            if (found) { found.code = code; found.name = name; }
            saveDemoDb(db);
          } else {
            const {error} = await sb.from('ljs_projects').update({code, name}).eq('id', p.id);
            if (error) throw error;
          }
          await refreshManagement();
        } catch (error) {
          alert('Impossible de modifier le chantier : ' + (error.message || error));
        }
      };
      row.querySelector('.management-toggle-project').onclick = async () => {
        const next = p.active === false;
        if (!next && !confirm(`Retirer le chantier ${p.code} — ${p.name} des listes ? Les anciennes feuilles seront conservées.`)) return;
        try {
          if (!isCloud) {
            const db = demoDb();
            const found = (db.projects || []).find(x => x.id === p.id);
            if (found) found.active = next;
            saveDemoDb(db);
          } else {
            const {error} = await sb.from('ljs_projects').update({active:next}).eq('id', p.id);
            if (error) throw error;
          }
          await refreshManagement();
        } catch (error) {
          alert('Impossible de modifier le chantier : ' + (error.message || error));
        }
      };
      box.appendChild(row);
    });
  }

  async function addManagementProject() {
    const code = document.getElementById('managementProjectCode').value.trim();
    const name = document.getElementById('managementProjectName').value.trim();
    if (!code || !name) return alert('Renseigne le numéro d’affaire et le nom du chantier.');
    try {
      if (!isCloud) {
        const db = demoDb();
        db.projects = db.projects || [];
        db.projects.push({id:'p_' + Date.now(), code, name, active:true});
        saveDemoDb(db);
      } else {
        const {error} = await sb.from('ljs_projects').insert({code, name, active:true});
        if (error) throw error;
      }
      document.getElementById('managementProjectCode').value = '';
      document.getElementById('managementProjectName').value = '';
      await refreshManagement();
    } catch (error) {
      alert('Impossible d’ajouter le chantier : ' + (error.message || error));
    }
  }

  async function getVehicles() {
    if (!isCloud) return demoDb().vehicles || [];
    const {data, error} = await sb.from('ljs_vehicles').select('*').order('registration');
    if (error) throw error;
    return data || [];
  }

  async function renderManagementVehicles() {
    const box = document.getElementById('managementVehicles');
    if (!box) return;
    box.innerHTML = '';
    const vehicles = (await getVehicles()).filter(v => !v.deleted);
    if (!vehicles.length) {
      box.innerHTML = '<p class="hint">Aucun véhicule enregistré.</p>';
      return;
    }

    vehicles.forEach(v => {
      const row = document.createElement('div');
      row.className = 'admin-item';
      row.innerHTML = `
        <div><strong>${esc(v.registration)}</strong><div class="meta">${v.brand ? esc(v.brand) + ' · ' : ''}${v.active === false ? 'Retiré' : 'Actif'}</div></div>
        <div class="admin-row-actions">
          <button class="secondary management-edit-vehicle">Modifier</button>
          <button class="secondary management-toggle-vehicle">${v.active === false ? 'Réactiver' : 'Retirer'}</button>
        </div>
        <div class="project-edit-form hidden" style="width:100%;margin-top:10px;">
          <div class="project-add">
            <input class="management-edit-registration" value="${esc(v.registration)}" placeholder="Immatriculation">
            <input class="management-edit-brand" value="${esc(v.brand || '')}" placeholder="Marque">
            <button class="primary management-save-vehicle">Enregistrer</button>
            <button class="ghost dark-ghost management-cancel-vehicle">Annuler</button>
          </div>
        </div>`;
      const form = row.querySelector('.project-edit-form');
      row.querySelector('.management-edit-vehicle').onclick = () => form.classList.remove('hidden');
      row.querySelector('.management-cancel-vehicle').onclick = () => form.classList.add('hidden');
      row.querySelector('.management-save-vehicle').onclick = async () => {
        const registration = normalizeRegistration(row.querySelector('.management-edit-registration').value);
        const brand = normalizeBrand(row.querySelector('.management-edit-brand').value);
        if (!registration || !brand) return alert('Renseigne l’immatriculation et la marque.');
        try {
          if (!isCloud) {
            const db = demoDb();
            const found = (db.vehicles || []).find(x => x.id === v.id);
            if (found) { found.registration = registration; found.brand = brand; }
            saveDemoDb(db);
          } else {
            const {error} = await sb.from('ljs_vehicles').update({registration, brand}).eq('id', v.id);
            if (error) throw error;
          }
          await refreshManagement();
        } catch (error) {
          alert('Impossible de modifier le véhicule : ' + (error.message || error));
        }
      };
      row.querySelector('.management-toggle-vehicle').onclick = async () => {
        const next = v.active === false;
        if (!next && !confirm(`Retirer le véhicule ${v.registration} des listes ? Les anciennes feuilles seront conservées.`)) return;
        try {
          if (!isCloud) {
            const db = demoDb();
            const found = (db.vehicles || []).find(x => x.id === v.id);
            if (found) { found.active = next; found.deleted = false; }
            saveDemoDb(db);
          } else {
            const {error} = await sb.from('ljs_vehicles').update({active:next, deleted:false}).eq('id', v.id);
            if (error) throw error;
          }
          await refreshManagement();
        } catch (error) {
          alert('Impossible de modifier le véhicule : ' + (error.message || error));
        }
      };
      box.appendChild(row);
    });
  }

  async function addManagementVehicle() {
    const registration = normalizeRegistration(document.getElementById('managementVehicleRegistration').value);
    const brand = normalizeBrand(document.getElementById('managementVehicleBrand').value);
    if (!registration || !brand) return alert('Renseigne l’immatriculation et la marque du véhicule.');
    try {
      const vehicles = await getVehicles();
      const duplicate = vehicles.find(v => normalizeRegistration(v.registration) === registration);
      if (duplicate && !duplicate.deleted) return alert('Cette immatriculation existe déjà.');

      if (!isCloud) {
        const db = demoDb();
        db.vehicles = db.vehicles || [];
        if (duplicate) {
          const found = db.vehicles.find(v => v.id === duplicate.id);
          if (found) { found.registration = registration; found.brand = brand; found.active = true; found.deleted = false; }
        } else {
          db.vehicles.push({id:'v_' + Date.now(), registration, brand, active:true, deleted:false});
        }
        saveDemoDb(db);
      } else if (duplicate) {
        const {error} = await sb.from('ljs_vehicles').update({registration, brand, active:true, deleted:false}).eq('id', duplicate.id);
        if (error) throw error;
      } else {
        const {error} = await sb.from('ljs_vehicles').insert({registration, brand, active:true, deleted:false});
        if (error) throw error;
      }
      document.getElementById('managementVehicleRegistration').value = '';
      document.getElementById('managementVehicleBrand').value = '';
      await refreshManagement();
    } catch (error) {
      alert('Impossible d’ajouter le véhicule : ' + (error.message || error));
    }
  }

  const originalShowAdmin = window.showAdmin;
  if (typeof originalShowAdmin === 'function') {
    window.showAdmin = async function(...args) {
      const result = await originalShowAdmin.apply(this, args);
      bindResponsibleAdministrationButton();
      return result;
    };
  }

  const observer = new MutationObserver(bindResponsibleAdministrationButton);
  observer.observe(document.getElementById('app'), {childList:true, subtree:true});

  window.showAdministrationManagement = showAdministrationManagement;
  window.refreshManagement = refreshManagement;
})();
