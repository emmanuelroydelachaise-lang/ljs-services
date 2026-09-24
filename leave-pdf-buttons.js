(() => {
  let decoratingTechnician = false;
  let decoratingAdmin = false;

  async function fetchTechnicianRequests() {
    if (!isCloud || !currentProfile?.id || currentProfile.role !== 'technician') return [];
    const {data,error} = await sb.from('ljs_leave_requests')
      .select('*')
      .eq('technician_id', currentProfile.id)
      .order('created_at', {ascending:false});
    if (error) throw error;
    return data || [];
  }

  async function decorateTechnicianRequests() {
    if (decoratingTechnician || currentProfile?.role !== 'technician') return;
    const box = document.getElementById('leaveRequestList');
    if (!box) return;
    const items = [...box.querySelectorAll('.leave-request-item')];
    if (!items.length) return;
    decoratingTechnician = true;
    try {
      const requests = await fetchTechnicianRequests();
      items.forEach((item,index) => {
        const request = requests[index];
        if (!request || request.status === 'pending' || item.querySelector('.leave-pdf-tech-btn')) return;
        const actions = document.createElement('div');
        actions.className = 'admin-row-actions leave-pdf-tech-actions';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'secondary leave-pdf-tech-btn';
        btn.textContent = 'Télécharger le PDF';
        btn.onclick = async () => {
          const old = btn.textContent;
          btn.disabled = true;
          btn.textContent = 'Création du PDF…';
          try {
            if (typeof window.downloadLeaveRequestPdf !== 'function') throw new Error('Le générateur PDF n’est pas chargé.');
            await window.downloadLeaveRequestPdf(request);
          } catch (error) {
            console.error(error);
            alert('Impossible de créer le PDF : ' + (error.message || error));
          } finally {
            btn.disabled = false;
            btn.textContent = old;
          }
        };
        actions.appendChild(btn);
        item.appendChild(actions);
      });
    } catch (error) {
      console.error('leave technician pdf buttons', error);
    } finally {
      decoratingTechnician = false;
    }
  }

  const displayName = r => [r.last_name,r.first_name].filter(Boolean).join(' ').trim() || 'Technicien';

  async function fetchAdminArchivedRequests() {
    if (!isCloud || currentProfile?.role !== 'admin') return [];
    const {data,error} = await sb.from('ljs_leave_requests')
      .select('*')
      .in('status',['approved','refused']);
    if (error) throw error;
    const requests = data || [];
    requests.sort((a,b) => {
      const byName = displayName(a).localeCompare(displayName(b),'fr');
      if (byName !== 0) return byName;
      return String(b.decision_date || '').localeCompare(String(a.decision_date || ''));
    });
    return requests;
  }

  async function decorateAdminArchives() {
    if (decoratingAdmin || currentProfile?.role !== 'admin') return;
    const box = document.getElementById('adminLeaveArchiveList');
    if (!box) return;
    const groups = [...box.querySelectorAll('.archive-tech-group')];
    if (!groups.length) return;
    decoratingAdmin = true;
    try {
      const requests = await fetchAdminArchivedRequests();
      const grouped = new Map();
      requests.forEach(r => {
        const key = r.technician_id || displayName(r);
        if (!grouped.has(key)) grouped.set(key,{name:displayName(r),requests:[]});
        grouped.get(key).requests.push(r);
      });
      const orderedGroups = [...grouped.values()];

      groups.forEach((groupEl,groupIndex) => {
        const group = orderedGroups[groupIndex];
        if (!group) return;
        const rows = [...groupEl.querySelectorAll('.admin-leave-archive-row')];
        rows.forEach((row,rowIndex) => {
          const request = group.requests[rowIndex];
          if (!request || row.querySelector('.admin-leave-archive-pdf')) return;
          const actions = row.querySelector('.admin-row-actions');
          if (!actions) return;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'secondary admin-leave-archive-pdf';
          btn.textContent = 'PDF';
          btn.onclick = async () => {
            const old = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'PDF…';
            try {
              if (typeof window.downloadLeaveRequestPdf !== 'function') throw new Error('Le générateur PDF n’est pas chargé.');
              await window.downloadLeaveRequestPdf(request);
            } catch (error) {
              console.error(error);
              alert('Impossible de créer le PDF : ' + (error.message || error));
            } finally {
              btn.disabled = false;
              btn.textContent = old;
            }
          };
          const deleteBtn = actions.querySelector('.admin-leave-archive-delete');
          if (deleteBtn) actions.insertBefore(btn,deleteBtn);
          else actions.appendChild(btn);
        });
      });
    } catch (error) {
      console.error('leave admin pdf buttons', error);
    } finally {
      decoratingAdmin = false;
    }
  }

  function decorate() {
    decorateTechnicianRequests();
    decorateAdminArchives();
  }

  const observer = new MutationObserver(() => setTimeout(decorate,40));
  const app = document.getElementById('app');
  if (app) observer.observe(app,{childList:true,subtree:true});
  document.addEventListener('click', event => {
    if (['techLeaveTab','adminArchiveLeaveTab','refreshArchivesBtn','refreshAdminLeaveBtn'].includes(event.target?.id)) {
      setTimeout(decorate,300);
    }
  });
  setInterval(decorate,1500);
})();