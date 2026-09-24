(() => {
  const baseLoadTechnicians = window.loadTechnicians;
  const baseRenderAdminTechnicians = window.renderAdminTechnicians;

  if (typeof baseLoadTechnicians !== 'function' || typeof baseRenderAdminTechnicians !== 'function') return;

  window.loadTechnicians = async function(includeInactive = false) {
    if (!isCloud) {
      const db = demoDb();
      state.technicians = (db.technicians || [])
        .map(t => ({ ...t, interim_agency: t.interim_agency || '', deleted: Boolean(t.deleted) }))
        .filter(t => includeInactive || (t.active !== false && !t.deleted))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr'));
      return state.technicians;
    }

    if (currentProfile?.role === 'admin') {
      let q = sb.from('ljs_profiles')
        .select('id,full_name,login_email,employment_type,interim_agency,active,deleted,role')
        .eq('role', 'technician')
        .order('full_name');
      if (!includeInactive) q = q.eq('active', true).eq('deleted', false);
      const { data, error } = await q;
      if (error) throw error;
      state.technicians = (data || []).map(t => ({ ...t, interim_agency: t.interim_agency || '', deleted: Boolean(t.deleted) }));
      return state.technicians;
    }

    const result = await baseLoadTechnicians(includeInactive);
    state.technicians = (result || []).map(t => ({ ...t, deleted: false }));
    return state.technicians;
  };

  async function setTechnicianState(t, action) {
    try {
      if (!isCloud) {
        const db = demoDb();
        const row = (db.technicians || []).find(x => x.id === t.id);
        if (!row) throw new Error('Technicien introuvable');
        if (action === 'retire') {
          row.active = false;
          row.deleted = false;
        } else if (action === 'reactivate') {
          row.active = true;
          row.deleted = false;
        } else if (action === 'delete') {
          row.active = false;
          row.deleted = true;
        }
        saveDemoDb(db);
      } else {
        const { error } = await sb.rpc('ljs_set_technician_state', {
          p_technician_id: t.id,
          p_action: action
        });
        if (error) throw error;
      }
      await refreshAdmin();
    } catch (e) {
      alert('Impossible de modifier le technicien : ' + (e.message || e));
    }
  }

  function decorateTechnicianRows() {
    const box = document.getElementById('adminTechnicians');
    if (!box) return;

    const techCard = box.closest('.card');
    const hint = techCard?.querySelector('p.hint');
    if (hint) hint.textContent = 'Retirer désactive temporairement un technicien et permet de le réactiver. Supprimer le fait disparaître des listes, mais conserve ses anciennes feuilles dans les archives.';

    const rows = [...box.querySelectorAll('.tech-admin-item')];
    rows.forEach((row, index) => {
      const t = state.technicians[index];
      if (!t) return;

      if (t.deleted) {
        row.remove();
        return;
      }

      const toggle = row.querySelector('.toggle-tech');
      if (toggle) {
        toggle.textContent = t.active === false ? 'Réactiver' : 'Retirer';
        toggle.onclick = async () => {
          if (t.active === false) {
            await setTechnicianState(t, 'reactivate');
            return;
          }
          if (!confirm(`Retirer ${t.full_name} temporairement ?\n\nLe technicien pourra être réactivé plus tard et ses anciennes feuilles seront conservées.`)) return;
          await setTechnicianState(t, 'retire');
        };
      }

      const actions = row.querySelector('.admin-row-actions');
      if (actions && !actions.querySelector('.delete-tech-permanent')) {
        const del = document.createElement('button');
        del.className = 'secondary delete-tech-permanent';
        del.textContent = 'Supprimer';
        del.style.borderColor = '#d92d20';
        del.style.color = '#b42318';
        del.style.background = '#fff4f2';
        del.onclick = async () => {
          if (!confirm(`Supprimer ${t.full_name} de la liste des techniciens ?\n\nLe technicien ne sera plus visible. Ses anciennes feuilles resteront dans les archives.`)) return;
          await setTechnicianState(t, 'delete');
        };
        actions.appendChild(del);
      }
    });
  }

  function fixArchiveBadges() {
    document.querySelectorAll('.archive-tech-group').forEach(group => {
      const name = group.querySelector('.archive-tech-toggle strong')?.textContent?.trim();
      if (!name) return;
      const t = (state.technicians || []).find(x => x.full_name === name);
      if (!t) return;
      let badge = group.querySelector('.archive-deleted-badge');
      if (t.deleted) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'archive-deleted-badge';
          group.querySelector('.archive-tech-toggle span')?.appendChild(badge);
        }
        badge.textContent = 'Supprimé';
      } else if (t.active === false) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'archive-deleted-badge';
          group.querySelector('.archive-tech-toggle span')?.appendChild(badge);
        }
        badge.textContent = 'Retiré';
      } else if (badge) {
        badge.remove();
      }
    });
  }

  function patchRefreshWhenArchivesReady() {
    if (typeof window.renderAdminArchives !== 'function') {
      setTimeout(patchRefreshWhenArchivesReady, 50);
      return;
    }
    if (window.__ljsTechnicianStatePatched) return;
    window.__ljsTechnicianStatePatched = true;

    const archiveRefresh = window.refreshAdmin;
    window.refreshAdmin = async function() {
      await archiveRefresh();
      await baseRenderAdminTechnicians();
      decorateTechnicianRows();
      fixArchiveBadges();
    };

    if (document.getElementById('adminTechnicians')) {
      baseRenderAdminTechnicians().then(() => {
        decorateTechnicianRows();
        fixArchiveBadges();
      });
    }
  }

  function loadAdminVehicles() {
    if (document.querySelector('script[data-admin-vehicles]')) return;
    const script = document.createElement('script');
    script.src = './admin-vehicles.js?v=20260915-pwa-15';
    script.dataset.adminVehicles = '1';
    script.async = false;
    document.head.appendChild(script);
  }

  patchRefreshWhenArchivesReady();
  loadAdminVehicles();
})();
