/* SM Stats — shared DOM / formatting helpers */

window.SM = window.SM || {};

SM.ui = (function () {
  const SILHOUETTE_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8.3" r="4"/>' +
    '<path d="M4 20.3c0-4.6 3.8-7.3 8-7.3s8 2.7 8 7.3a.9.9 0 0 1-.9.9H4.9a.9.9 0 0 1-.9-.9Z"/></svg>';

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      if (key === 'class') node.className = attrs[key];
      else if (key === 'html') node.innerHTML = attrs[key];
      else if (key === 'text') node.textContent = attrs[key];
      else if (key.indexOf('on') === 0 && typeof attrs[key] === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
      } else {
        node.setAttribute(key, attrs[key]);
      }
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  // "2026-09-14" -> "Sáb 14 Sep" (short, no year — matches design)
  function formatDateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
  }

  // "2026-09-14" -> "14 sep 2026"
  function formatDateLong(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function ageFromBirthdate(iso, today) {
    if (!iso) return null;
    const birth = new Date(iso + 'T00:00:00');
    if (isNaN(birth)) return null;
    const now = today || new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }

  // Escapes free-text values (player/staff/rival names...) before they're
  // dropped into an innerHTML string, so a stray "<" or "&" someone typed
  // in a form can't break the layout or be interpreted as markup.
  function escapeHtml(v) {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Up to 3-letter badge initials for a club/team name, e.g. "CD Ribera" -> "CDR".
  function clubInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 3).toUpperCase();
  }

  function initials(name) {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    const first = parts[0] ? parts[0][0] : '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  // Returns an HTML string for a circular avatar: real photo if fotoUrl is set,
  // otherwise the silhouette placeholder — same pattern used across the design.
  function avatarHtml(fotoUrl, size) {
    size = size || 64;
    if (fotoUrl) {
      return '<div class="avatar-photo" style="width:' + size + 'px;height:' + size + 'px;">' +
        '<img src="' + fotoUrl + '" alt="" loading="lazy"></div>';
    }
    const iconSize = Math.round(size * 0.46);
    return '<div class="avatar-photo" style="width:' + size + 'px;height:' + size + 'px;">' +
      '<span style="width:' + iconSize + 'px;height:' + iconSize + 'px;display:block;">' + SILHOUETTE_SVG + '</span></div>';
  }

  const POSITION_META = {
    POR: { label: 'Portero', color: 'var(--cyan)', bright: 'var(--cyan-bright)' },
    DEF: { label: 'Defensa', color: 'var(--green)', bright: 'var(--green)' },
    CEN: { label: 'Centrocampista', color: 'var(--magenta)', bright: 'var(--magenta-bright)' },
    DEL: { label: 'Delantero', color: 'var(--amber)', bright: 'var(--amber-bright)' }
  };

  function positionMeta(code) {
    return POSITION_META[code] || { label: code || '—', color: 'var(--text-dim)', bright: 'var(--text-dim)' };
  }

  // Translucent variant of a token (CSS variable or oklch(...) string) via
  // relative color syntax, e.g. alpha('var(--cyan)', 0.12) -> a 12%-opacity tint.
  function alpha(colorToken, a) {
    return 'oklch(from ' + colorToken + ' l c h / ' + a + ')';
  }

  let toastTimer = null;
  function toast(message, kind) {
    let node = document.querySelector('.toast');
    if (!node) {
      node = el('div', { class: 'toast' });
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.className = 'toast';
    }, 3200);
  }

  function openModal(titleText, bodyNode, onClose) {
    const overlay = el('div', { class: 'modal-overlay' });
    const modal = el('div', { class: 'modal' });
    const head = el('div', { class: 'modal-head' }, [
      el('div', { class: 'modal-title', text: titleText }),
      el('button', {
        class: 'modal-close', type: 'button', html: '&times;',
        onClick: function () { close(); }
      })
    ]);
    modal.appendChild(head);
    modal.appendChild(bodyNode);
    overlay.appendChild(modal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', escHandler);
    function escHandler(e) { if (e.key === 'Escape') close(); }
    function close() {
      document.removeEventListener('keydown', escHandler);
      overlay.remove();
      if (onClose) onClose();
    }
    document.body.appendChild(overlay);
    return { close: close, modal: modal };
  }

  function field(labelText, inputHtml, span2) {
    const wrap = el('div', { class: 'form-field' + (span2 ? ' span-2' : '') });
    wrap.appendChild(el('label', { text: labelText }));
    const holder = el('div', { html: inputHtml });
    while (holder.firstChild) wrap.appendChild(holder.firstChild);
    return wrap;
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  return {
    SILHOUETTE_SVG: SILHOUETTE_SVG,
    el: el,
    formatDateShort: formatDateShort,
    formatDateLong: formatDateLong,
    ageFromBirthdate: ageFromBirthdate,
    initials: initials,
    clubInitials: clubInitials,
    escapeHtml: escapeHtml,
    avatarHtml: avatarHtml,
    positionMeta: positionMeta,
    alpha: alpha,
    toast: toast,
    openModal: openModal,
    field: field,
    qs: qs
  };
})();
