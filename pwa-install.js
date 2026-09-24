document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('installBtn');
  if (!btn) return;

  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) {
    btn.classList.add('hidden');
    return;
  }

  btn.classList.remove('hidden');
  btn.textContent = 'Installer';

  btn.addEventListener('click', () => {
    setTimeout(() => {
      if (!installPrompt) {
        alert("Si la fenêtre d’installation ne s’ouvre pas, utilise le menu ⋮ de Chrome puis choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».");
      }
    }, 50);
  });
});
