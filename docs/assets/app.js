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
  const path = location.pathname.split('/').pop() || 'index.html';
  $all('.navlinks a').forEach(a => {
    const href = (a.getAttribute('href') || '').split('/').pop();
    if (!href) return;
    if (href === path) a.setAttribute('aria-current', 'page');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindCopyButtons();
  markActiveNav();
});

