(function () {
  const route = () => (location.hash.startsWith('#/panel') ? 'panel' : 'tienda');

  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });

  function navigate(view) {
    location.hash = view === 'panel' ? '#/panel' : '#/tienda';
  }

  function setActiveLink(view) {
    document.querySelectorAll('.nav-link').forEach(l =>
      l.classList.toggle('active', l.dataset.nav === view));
  }

  async function renderRoute() {
    const view = route();
    setActiveLink(view);
    Store.closeModal && Store.closeModal();
    document.getElementById('cartDrawer').hidden = true;
    document.getElementById('cartOverlay').hidden = true;

    if (view === 'tienda') {
      await Store.load();
      Store.render();
    } else {
      document.getElementById('cartBtn').style.display = 'none';
      await Admin.load();
      Admin.render();
      document.getElementById('cartBtn').style.display = '';
    }
  }

  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('DOMContentLoaded', renderRoute);

  document.getElementById('cartBtn').addEventListener('click', () => Store.openCart());
  document.getElementById('cartOverlay').addEventListener('click', () => Store.closeCart());
  document.querySelectorAll('[data-close-cart]').forEach(b => b.addEventListener('click', () => Store.closeCart()));

  window.escapeHtml = esc;
  window.money = money;
})();