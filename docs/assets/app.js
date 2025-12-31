function $(sel, root = document){ return root.querySelector(sel); }
function $all(sel, root = document){ return Array.from(root.querySelectorAll(sel)); }

function bindCopyButtons(){
  $all('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy') || '';
      if (!text) return;
      try{
        await navigator.clipboard.writeText(text);
        const old = btn.textContent;
        btn.textContent = '已複製';
        setTimeout(() => { btn.textContent = old; }, 900);
      }catch{
        alert('複製失敗，請手動複製：\\n' + text);
      }
    });
  });
}

function markActiveNav(){
  const segments = location.pathname.split('/').filter(Boolean);
  const current = segments.slice(-2).join('/') || 'index.html';
  $all('.navlinks a').forEach(a => {
    const href = (a.getAttribute('href') || '').split('/').filter(Boolean).slice(-2).join('/');
    if (!href) return;
    if (href === current) a.setAttribute('aria-current', 'page');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindCopyButtons();
  markActiveNav();
});
