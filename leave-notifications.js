(() => {
  let refreshing = false;
  let markingRead = false;
  let refreshTimer = null;

  function isTechnician() {
    return currentProfile?.role === 'technician' && Boolean(currentProfile?.id) && Boolean(isCloud);
  }

  function installStyle() {
    if (document.getElementById('leaveNotificationStyle')) return;
    const style = document.createElement('style');
    style.id = 'leaveNotificationStyle';
    style.textContent = `
      #techLeaveTab{position:relative}
      .tech-leave-notification-badge{
        position:absolute;top:-8px;right:-8px;
        min-width:21px;height:21px;padding:0 6px;
        display:inline-flex;align-items:center;justify-content:center;
        border-radius:999px;background:#d40000;color:#fff;
        border:2px solid #fff;box-sizing:border-box;
        font:800 11px/1 Arial,Helvetica,sans-serif;
        box-shadow:0 1px 4px rgba(0,0,0,.22);
        z-index:4
      }
      .tech-leave-notification-badge.hidden{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function ensureBadge() {
    const button = document.getElementById('techLeaveTab');
    if (!button) return null;
    installStyle();
    let badge = button.querySelector('.tech-leave-notification-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'tech-leave-notification-badge hidden';
      badge.setAttribute('aria-label', 'Nouvelles décisions');
      badge.textContent = '0';
      button.appendChild(badge);
    }
    return badge;
  }

  async function unreadNotifications() {
    if (!isTechnician()) return [];
    const { data, error } = await sb
      .from('ljs_leave_notifications')
      .select('id,leave_request_id,decision_status,created_at')
      .eq('technician_id', currentProfile.id)
      .is('read_at', null)
      .order('created_at', { ascending:false });
    if (error) throw error;
    return data || [];
  }

  async function refreshLeaveNotificationBadge() {
    if (refreshing || !isTechnician()) return;
    const badge = ensureBadge();
    if (!badge) return;
    refreshing = true;
    try {
      const unread = await unreadNotifications();
      badge.textContent = unread.length > 99 ? '99+' : String(unread.length);
      badge.classList.toggle('hidden', unread.length === 0);
      const button = document.getElementById('techLeaveTab');
      if (button) {
        button.title = unread.length
          ? `${unread.length} demande${unread.length > 1 ? 's' : ''} traitée${unread.length > 1 ? 's' : ''} à consulter`
          : 'Demande de congés';
      }
    } catch (error) {
      console.error('leave notification badge', error);
    } finally {
      refreshing = false;
    }
  }

  async function markLeaveNotificationsRead() {
    if (markingRead || !isTechnician()) return;
    markingRead = true;
    try {
      const { error } = await sb
        .from('ljs_leave_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('technician_id', currentProfile.id)
        .is('read_at', null);
      if (error) throw error;
      const badge = ensureBadge();
      if (badge) {
        badge.textContent = '0';
        badge.classList.add('hidden');
      }
    } catch (error) {
      console.error('leave notification read', error);
    } finally {
      markingRead = false;
    }
  }

  function scheduleRefresh(delay = 120) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      ensureBadge();
      refreshLeaveNotificationBadge();
    }, delay);
  }

  document.addEventListener('click', event => {
    const leaveButton = event.target?.closest?.('#techLeaveTab');
    if (!leaveButton) return;
    setTimeout(markLeaveNotificationsRead, 250);
  }, true);

  window.addEventListener('focus', () => scheduleRefresh(80));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleRefresh(80);
  });

  const app = document.getElementById('app');
  if (app) {
    const observer = new MutationObserver(() => scheduleRefresh(80));
    observer.observe(app, { childList:true, subtree:true });
  }

  setInterval(() => {
    if (!document.hidden) refreshLeaveNotificationBadge();
  }, 30000);

  scheduleRefresh(150);
  window.refreshLeaveNotificationBadge = refreshLeaveNotificationBadge;
})();
