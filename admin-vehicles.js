(() => {
  const normalizeRegistration = value => String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const normalizeText = value => String(value || '').trim().replace(/\s+/g, ' ');

  function decorateResponsibleScreen() {
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (!logoutBtn) return;

    const techCard = document.getElementById('adminTechnicians')?.closest('.card');
    const projectCard = document.getElementById('adminProjects')?.closest('.card');
    if (techCard) techCard.classList.add('hidden');
    if (projectCard) projectCard.classList.add('hidden');
    document.getElementById('adminVehiclesCard')?.remove();

    if (document.getElementById('adminManagementBtn')) return;

    let actions = logoutBtn.closest('.admin-management-nav');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'admin-row-actions admin-management-nav';
      logoutBtn.parentNode.insertBefore(actions, logoutBtn);
      actions.appendChild(logoutBtn);
    }

    const btn = document.createElement('button');
    btn.id = 'adminManagementBtn';
    btn.className = 'primary';
    btn.type = 'button';
    btn.textContent = 'Administratif';
    btn.onclick = showAdministrationManagement;
    actions.insertBefore(btn, logoutBtn);
  }

  function renderManagementShell() {
    app.innerHTML = `
      <section class="toolbar card">
        <div><div class="small muted">Mode</div><strong>Administratif</strong></div>
        <div class="admin-row-actions">
          <button id="managementBackBtn" class="secondary" type="button">Retour Responsable</button>
          <button id="managementLogoutBtn" class="ghost" type="button">Quitter</button>
        </div>
      </section>

      <section class="card">
        <h2>Personnel / techniciens</h2>
        <p class="hint">Ajoute, modifie, retire ou supprime un technicien. Les anciennes feuilles restent conservées dans les archives.</p>
        <div class="technician-add">
          <input id="managementTechName" placeholder="Nom et prénom" />
          <select id="managementTechType"><option value="employee">Salarié</option><option value="interim">Intérim</option></select>
          <input id="managementTechPin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]*" placeholder="PIN 4 chiffres" />
          <button id="addManagementTechBtn" class="primary" type="button">Ajouter</button>
        </div>
        <div id="managementTechAgencyWrap" class="hidden" style="margin-bottom:12px">
          <input id="managementTechAgency" placeholder="Agence d’intérim" />
        </div>
        <div id="managementTechnicians" class="stack"></div>
      </section>

      <section class="card">
        <h2>Véhicules</h2>
        <p class="hint">Ajoute, modifie, retire ou supprime un véhicule. Les anciennes feuilles restent conservées.</p>
        <div class="project-add">
          <input id="managementVehicleRegistration" placeholder="Immatriculation" />
          <input id="managementVehicleBrand" placeholder="Marque" />
          <button id="addManagementVehicleBtn" class="primary" type="button">Ajouter</button>
        </div>
        <div id="managementVehicles" class="stack" style="margin-top:12px"></div>
      </section>

      <section class="card">
        <h2>Chantiers</h2>
        <p class="hint">Ajoute, modifie, retire ou supprime un chantier. Les anciennes feuilles restent conservées dans l’historique.</p>
        <div class="project-add">
          <input id="managementProjectCode" placeholder="N° affaire" />
          <input id="managementProjectName" placeholder="Nom du chantier" />
          <button id="addManagementProjectBtn" class="primary" type="button">Ajouter</button>
        </div>
        <div id="managementProjects" class="stack" style="margin-top:12px"></div>
      </section>`;

    document.getElementById('managementBackBtn').onclick = showAdmin;
    document.getElementById('managementLogoutBtn').onclick = logout;
    document.getElementById('addManagementTechBtn').onclick = addTechnicianFromManagement;
    document.getElementById('addManagementVehicleBtn').onclick = addVehicleFromManagement;
    document.getElementById('addManagementProjectBtn').onclick = addProjectFromManagement;

    document.getElementById('managementTechType').onchange = event => {
      const interim = event.target.value === 'interim';
      document.getElementById('managementTechAgencyWrap').classList.toggle('hidden', !interim);
      if (!interim) document.getElementById('managementTechAgency').value = '';
    };
  }

  async function showAdministrationManagement() {
    renderManagementShell();
    await refreshManagement();
  }

  async function refreshManagement() {
    try {
      await Promise.all([loadReferenceData(true), loadTechnicians(true)]);
      await renderManagementTechnicians();
      await renderManagementVehicles();
      await renderManagementProjects();
    } catch (error) {
      console.error(error);
      alert('Impossible de charger l’espace Administratif : ' + (error.message || error));
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
      const interim = t.employment_type === 'interim';
      const row = document.createElement('div');
      row.className = 'admin-item tech-admin-item';
      row.innerHTML = `
        <div class="tech-summary">
          <strong>${esc(t.full_name)}</strong><span class="tech-type">${interim ? 'Intérim' : 'Salarié'}</span>
          <div class="meta">${t.active === false ? 'Retiré' : 'Actif'}${interim && t.interim_agency ? ` · Agence : ${esc(t.interim_agency)}` : ''}</div>
        </div>
        <div class="admin-row-actions">
          <button class="secondary edit-item" type="button">Modifier</button>
          <button class="secondary toggle-item" type="button">${t.active === false ? 'Réactiver' : 'Retirer'}</button>
          <button class="secondary delete-item" type="button" style="border-color:#d92d20;color:#b42318;background:#fff4f2">Supprimer</button>
        </div>
        <div class="tech-edit-form hidden">
          <div><label>Nom et prénom</label><input class="edit-name" value="${esc(t.full_name)}" /></div>
          <div><label>Statut</label><select class="edit-type"><option value="employee" ${interim ? '' : 'selected'}>Salarié</option><option value="interim" ${interim ? 'selected' : ''}>Intérim</option></select></div>
          <div class="edit-agency-wrap ${interim ? '' : 'hidden'}"><label>Agence d’intérim</label><input class="edit-agency" value="${esc(t.interim_agency || '')}" /></div>
          <div><label>Nouveau PIN</label><input class="edit-pin" type="password" inputmode="numeric" maxlength="4" placeholder="Facultatif" /></div>
          <div class="tech-edit-actions"><button class="primary save-item" type="button">Enregistrer</button><button class="ghost dark-ghost cancel-item" type="button">Annuler</button></div>
        </div>`;

      const form = row.querySelector('.tech-edit-form');
      const type = row.querySelector('.edit-type');
      const agencyWrap = row.querySelector('.edit-agency-wrap');
      row.querySelector('.edit-item').onclick = () => form.classList.remove('hidden');
      row.querySelector('.cancel-item').onclick = () => form.classList.add('hidden');
      type.onchange = () => {
        const isInterim = type.value === 'interim';
        agencyWrap.classList.toggle('hidden', !isInterim);
        if (!isInterim) row.querySelector('.edit-agency').value = '';
      };

      row.querySelector('.save-item').onclick = async () => {
        const full_name = normalizeText(row.querySelector('.edit-name').value);
        const employment_type = type.value;
        const interim_agency = employment_type === 'interim' ? normalizeText(row.querySelector('.edit-agency').value) : '';
        const pin = row.querySelector('.edit-pin').value.trim();
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

      row.querySelector('.toggle-item').onclick = async () => {
        const active = t.active === false;
        if (!active && !confirm(`Retirer ${t.full_name} de la liste des techniciens ? Ses anciennes feuilles seront conservées.`)) return;
        try {
          if (!isCloud) {
            const db = demoDb();
            const found = (db.technicians || []).find(x => x.id === t.id);
            if (found) found.active = active;
            saveDemoDb(db);
          } else {
            const {data, error} = await sb.functions.invoke('manage-technician', {body:{action:'set_active', technician_id:t.id, active}});
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
          }
          await refreshManagement();
        } catch (error) {
          alert('Impossible de modifier le technicien : ' + (error.message || error));
        }
      };

      row.querySelector('.delete-item').onclick = async () => {
        if (!confirm(`Supprimer ${t.full_name} de la liste des techniciens ?\n\nSes anciennes feuilles resteront conservées dans les archives.`)) return;
        try {
          if (!isCloud) {
            const db = demoDb();
            const found = (db.technicians || []).find(x => x.id === t.id);
            if (found) { found.active = false; found.deleted = true; }
            saveDemoDb(db);
          } else {
            const {error} = await sb.rpc('ljs_set_technician_state', {
              p_technician_id: t.id,
              p_action: 'delete'
            });
            if (error) throw error;
          }
          await refreshManagement();
        } catch (error) {
          alert('Impossible de supprimer le technicien : ' + (error.message || error));
        }
      };

      box.appendChild(row);
    });
  }

  async function addTechnicianFromManagement() {
    const full_name = normalizeText(document.getElementById('managementTechName').value);
    const employment_type = document.getElementById('managementTechType').value;
    const interim_agency = employment_type === 'interim' ? normalizeText(document.getElementById('managementTechAgency').value) : '';
    const pin = document.getElementById('managementTechPin').value.trim();

    if (!full_name) return alert('Renseigne le nom du technicien.');
    if (employment_type === 'interim' && !interim_agency) return alert('Renseigne l’agence d’intérim.');
    if (!/^\d{4}$/.test(pin)) return alert('Le PIN doit contenir 4 chiffres.');

    try {
      if (!isCloud) {
        const db = demoDb();
        const id = 'tech_' + Date.now();
        db.technicians = db.technicians || [];
        db.technicians.push({id, full_name, login_email:`${id}@ljs.local`, employment_type, interim_agency, pin, active:true});
        saveDemoDb(db);
      } else {
        const {data, error} = await sb.functions.invoke('manage-technician', {body:{action:'create', full_name, employment_type, interim_agency, pin}});
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

  async function fetchVehicles() {
    if (!isCloud) return demoDb().vehicles || [];
    const {data, error} = await sb.from('ljs_vehicles').select('*').order('registration');
    if (error) throw error;
    return data || [];
  }

  async function renderManagementVehicles() {
    const box = document.getElementById('managementVehicles');
    if (!box) return;
    box.innerHTML = '';
    const vehicles = (await fetchVehicles()).filter(v => !v.deleted);

    if (!vehicles.length) {
      box.innerHTML = '<p class="hint">Aucun véhicule enregistré.</p>';
      return;
    }

    vehicles.forEach(v => {
      const row = document.createElement('div');
      row.className = 'admin-item project-admin-item';
      row.innerHTML = `
        <div class="project-summary"><strong>${esc(v.registration)}</strong><div class="meta">${v.brand ? esc(v.brand) + ' · ' : ''}${v.active === false ? 'Retiré' : 'Actif'}</div></div>
        <div class="admin-row-actions"><button class="secondary edit-item" type="button">Modifier</button><button class="secondary toggle-item" type="button">${v.active === false ? 'Réactiver' : 'Retirer'}</button><button class="secondary delete-item" type="button" style="border-color:#d92d20;color:#b42318;background:#fff4f2">Supprimer</button></div>
        <div class="project-edit-form hidden" style="width:100%;margin-top:10px">
          <div class="project-add">
            <input class="edit-registration" value="${esc(v.registration)}" placeholder="Immatriculation" />
            <input class="edit-brand" value="${esc(v.brand || '')}" placeholder="Marque" />
            <button class="primary save-item" type="button">Enregistrer</button>
            <button class="ghost dark-ghost cancel-item" type="button">Annuler</button>
          </div>
        </div>`;

      const form = row.querySelector('.project-edit-form');
      row.querySelector('.edit-item').onclick = () => form.classList.remove('hidden');
      row.querySelector('.cancel-item').onclick = () => form.classList.add('hidden');
      row.querySelector('.save-item').onclick = async () => {
        const registration = normalizeRegistration(row.querySelector('.edit-registration').value);
        const brand = normalizeText(row.querySelector('.edit-brand').value);
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
      row.querySelector('.toggle-item').onclick = async () => {
        const active = v.active === false;
        if (!active && !confirm(`Retirer le véhicule ${v.registration} des listes ? Les anciennes feuilles seront conservées.`)) return;
        try {
          if (!isCloud) {
            const db = demoDb();
            const found = (db.vehicles || []).find(x => x.id === v.id);
            if (found) { found.active = active; found.deleted = false; }
            saveDemoDb(db);
          } else {
            const {error} = await sb.from('ljs_vehicles').update({active, deleted:false}).eq('id', v.id);
            if (error) throw error;
          }
          await refreshManagement();
        } catch (error) {
          alert('Impossible de modifier le véhicule : ' + (error.message || error));
        }
      };
      row.querySelector('.delete-item').onclick = async () => {
        if (!confirm(`Supprimer le véhicule ${v.registration} ?\n\nIl disparaîtra des listes mais restera identifiable dans les anciennes feuilles.`)) return;
        try {
          if (!isCloud) {
            const db = demoDb();
            const found = (db.vehicles || []).find(x => x.id === v.id);
            if (found) { found.active = false; found.deleted = true; }
            saveDemoDb(db);
          } else {
            const {error} = await sb.from('ljs_vehicles').update({active:false, deleted:true}).eq('id', v.id);
            if (error) throw error;
          }
          await refreshManagement();
        } catch (error) {
          alert('Impossible de supprimer le véhicule : ' + (error.message || error));
        }
      };
      box.appendChild(row);
    });
  }

  async function addVehicleFromManagement() {
    const registration = normalizeRegistration(document.getElementById('managementVehicleRegistration').value);
    const brand = normalizeText(document.getElementById('managementVehicleBrand').value);
    if (!registration || !brand) return alert('Renseigne l’immatriculation et la marque du véhicule.');

    try {
      const vehicles = await fetchVehicles();
      const duplicate = vehicles.find(v => normalizeRegistration(v.registration) === registration);
      if (duplicate && !duplicate.deleted) return alert('Cette immatriculation existe déjà.');

      if (!isCloud) {
        const db = demoDb();
        db.vehicles = db.vehicles || [];
        if (duplicate) {
          const found = db.vehicles.find(x => x.id === duplicate.id);
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

  async function fetchProjects() {
    if (!isCloud) return demoDb().projects || [];
    const {data, error} = await sb.from('ljs_projects').select('*').order('code');
    if (error) throw error;
    return data || [];
  }

  async function renderManagementProjects() {
    const box = document.getElementById('managementProjects');
    if (!box) return;
    box.innerHTML = '';
    const projects = (await fetchProjects()).filter(p => !p.deleted);

    if (!projects.length) {
      box.innerHTML = '<p class="hint">Aucun chantier enregistré.</p>';
      return;
    }

    projects.forEach(p => {
      const row = document.createElement('div');
      row.className = 'admin-item project-admin-item';
      row.innerHTML = `
        <div class="project-summary"><strong>${esc(p.code)} — ${esc(p.name)}</strong><div class="meta">${p.active === false ? 'Retiré' : 'Actif'}</div></div>
        <div class="admin-row-actions"><button class="secondary edit-item" type="button">Modifier</button><button class="secondary toggle-item" type="button">${p.active === false ? 'Réactiver' : 'Retirer'}</button><button class="secondary delete-item" type="button" style="border-color:#d92d20;color:#b42318;background:#fff4f2">Supprimer</button></div>
        <div class="project-edit-form hidden" style="width:100%;margin-top:10px">
          <div class="project-add">
            <input class="edit-code" value="${esc(p.code)}" placeholder="N° affaire" />
            <input class="edit-name" value="${esc(p.name)}" placeholder="Nom du chantier" />
            <button class="primary save-item" type="button">Enregistrer</button>
            <button class="ghost dark-ghost cancel-item" type="button">Annuler</button>
          </div>
        </div>`;

      const form = row.querySelector('.project-edit-form');
      row.querySelector('.edit-item').onclick = () => form.classList.remove('hidden');
      row.querySelector('.cancel-item').onclick = () => form.classList.add('hidden');
      row.querySelector('.save-item').onclick = async () => {
        const code = normalizeText(row.querySelector('.edit-code').value);
        const name = normalizeText(row.querySelector('.edit-name').value);
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
      row.querySelector('.toggle-item').onclick = async () => {
        const active = p.active === false;
        if (!active && !confirm(`Retirer le chantier ${p.code} — ${p.name} des listes ? Les anciennes feuilles seront conservées.`)) return;
        try {
          if (!isCloud) {
            const db = demoDb();
            const found = (db.projects || []).find(x => x.id === p.id);
            if (found) found.active = active;
            saveDemoDb(db);
          } else {
            const {error} = await sb.from('ljs_projects').update({active}).eq('id', p.id);
            if (error) throw error;
          }
          await refreshManagement();
        } catch (error) {
          alert('Impossible de modifier le chantier : ' + (error.message || error));
        }
      };
      row.querySelector('.delete-item').onclick = async () => {
        if (!confirm(`Supprimer le chantier ${p.code} — ${p.name} ?\n\nIl disparaîtra des listes mais restera conservé dans les anciennes feuilles.`)) return;
        try {
          if (!isCloud) {
            const db = demoDb();
            const found = (db.projects || []).find(x => x.id === p.id);
            if (found) { found.active = false; found.deleted = true; }
            saveDemoDb(db);
          } else {
            const {error} = await sb.from('ljs_projects').update({active:false, deleted:true}).eq('id', p.id);
            if (error) throw error;
          }
          await refreshManagement();
        } catch (error) {
          alert('Impossible de supprimer le chantier : ' + (error.message || error));
        }
      };
      box.appendChild(row);
    });
  }

  async function addProjectFromManagement() {
    const code = normalizeText(document.getElementById('managementProjectCode').value);
    const name = normalizeText(document.getElementById('managementProjectName').value);
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

  const observer = new MutationObserver(decorateResponsibleScreen);
  observer.observe(document.getElementById('app'), {childList:true, subtree:true});
  decorateResponsibleScreen();

  window.showAdministrationManagement = showAdministrationManagement;
  window.refreshManagement = refreshManagement;
})();