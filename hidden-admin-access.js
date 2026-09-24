(() => {
  function openResponsibleAccess(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (typeof window.showAdminLogin === 'function') {
      window.showAdminLogin();
    }
  }

  function bindHiddenResponsibleAccess() {
    const visibleButton = document.getElementById('adminLoginOpen');
    if (visibleButton) {
      visibleButton.classList.add('hidden');
      visibleButton.setAttribute('aria-hidden', 'true');
      visibleButton.tabIndex = -1;
    }

    const logo = document.querySelector('.login-logo');
    const drop = logo?.querySelector('.admin-secret-drop');
    if (!logo || !drop) return;

    drop.style.pointerEvents = 'all';

    let hit = logo.querySelector('.admin-secret-hit');
    if (!hit) {
      const ns = 'http://www.w3.org/2000/svg';
      hit = document.createElementNS(ns, 'rect');
      hit.setAttribute('x', '66');
      hit.setAttribute('y', '68');
      hit.setAttribute('width', '78');
      hit.setAttribute('height', '98');
      hit.setAttribute('fill', 'transparent');
      hit.setAttribute('pointer-events', 'all');
      hit.setAttribute('class', 'admin-secret-hit');
      logo.appendChild(hit);
    }

    if (!hit.dataset.bound) {
      hit.dataset.bound = '1';
      hit.addEventListener('click', openResponsibleAccess);
    }
  }

  const app = document.getElementById('app');
  if (app) {
    new MutationObserver(bindHiddenResponsibleAccess)
      .observe(app, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', bindHiddenResponsibleAccess);
  bindHiddenResponsibleAccess();
})();