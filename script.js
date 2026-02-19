/* ═══════════════════════════════════════════════════════════════
   INVOIZY — Script
   Phase 4: Interactions (Drag Logo, Toggles)
   ═══════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ── DOM References ───────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const invoiceCanvas = $('#invoiceCanvas');
  const itemsBody = $('#itemsBody');
  const logoContainer = $('#logoContainer');
  const logoArea = $('#logoArea');
  const logoInput = $('#logoInput');
  const logoPreview = $('#logoPreview');
  const logoPlaceholder = $('#logoPlaceholder');
  const logoSizeSlider = $('#logoSizeSlider');
  const logoResizeCtrl = $('#logoResize');
  const logoHint = $('#logoHint');

  const subtotalEl = $('#subtotal');
  const discountRow = $('#discountRow');
  const discountAmountEl = $('#discountAmount');
  const taxRow = $('#taxRow');
  const taxAmountEl = $('#taxAmount');
  const grandTotalEl = $('#grandTotal');
  const taxRateEl = $('#taxRateDisplay');
  const discountRateEl = $('#discountRateDisplay');

  const toastEl = $('#toast');
  const statusSelect = $('#invoiceStatus');
  const currencySelect = $('#currencySelector');
  const toggleDiscount = $('#toggleDiscount');
  const toggleTax = $('#toggleTax');

  const btnAddItem = $('#btnAddItem');
  const btnPrintPDF = $('#btnPrintPDF');
  const btnNewInvoice = $('#btnNewInvoice');
  const templateBtns = $$('.template-btn');

  const STORAGE_KEY = 'invoiceMaker_data_v4';
  let saveTimeout = null;

  // ── Initialize ───────────────────────────────────────────────
  function init() {
    loadData();
    bindEvents();
    recalculate();
    setDefaultDates();
    updateStatusStyle();
  }

  // ── Default Dates ────────────────────────────────────────────
  function setDefaultDates() {
    const dateInput = $('#invoiceDate');
    const dueInput = $('#invoiceDue');
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    if (!dueInput.value) {
      const due = new Date();
      due.setDate(due.getDate() + 30);
      dueInput.value = due.toISOString().split('T')[0];
    }
  }

  // ── Event Bindings ───────────────────────────────────────────
  function bindEvents() {
    // Add item
    btnAddItem.addEventListener('click', () => {
      addItemRow();
      scheduleSave();
    });

    // Logo upload
    logoArea.addEventListener('click', (e) => {
      // Prevent click if dragging
      if (logoContainer.classList.contains('is-dragging')) return;
      logoInput.click();
    });
    logoInput.addEventListener('change', handleLogoFile);

    // Drag & drop logo file
    logoArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      logoArea.style.borderColor = 'var(--c-accent)';
      logoArea.style.background = 'var(--c-accent-light)';
    });
    logoArea.addEventListener('dragleave', () => {
      logoArea.style.borderColor = '';
      logoArea.style.background = '';
    });
    logoArea.addEventListener('drop', (e) => {
      e.preventDefault();
      logoArea.style.borderColor = '';
      logoArea.style.background = '';
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        processLogoFile(file);
      }
    });

    // Logo resize
    logoSizeSlider.addEventListener('input', (e) => {
      const size = parseInt(e.target.value, 10);
      applyLogoSize(size);
      scheduleSave();
    });

    // Logo Dragging Logic
    initLogoDrag();

    // Toolbar actions
    btnPrintPDF.addEventListener('click', handlePrint);
    btnNewInvoice.addEventListener('click', handleNewInvoice);

    // Template switching
    templateBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const template = btn.dataset.template;
        setTemplate(template);
        scheduleSave();
      });
    });

    // Validations & Status
    statusSelect.addEventListener('change', () => {
      updateStatusStyle();
      scheduleSave();
    });

    // Currency Switch
    currencySelect.addEventListener('change', () => {
      recalculate();
      scheduleSave();
    });

    // Visibility Toggles
    toggleDiscount.addEventListener('change', () => {
      updateVisibility();
      recalculate();
      scheduleSave();
    });
    toggleTax.addEventListener('change', () => {
      updateVisibility();
      recalculate();
      scheduleSave();
    });

    // Auto-save
    document.addEventListener('input', (e) => {
      if (e.target.closest('.invoice')) {
        if (
          e.target.classList.contains('item-qty') ||
          e.target.classList.contains('item-price') ||
          e.target.dataset.field === 'taxRate' ||
          e.target.dataset.field === 'discountRate'
        ) {
          recalculate();
        }
        scheduleSave();
      }
    });

    // Date input changes
    $$('input[type="date"]').forEach(input => {
      input.addEventListener('change', scheduleSave);
    });
  }

  // ── Logo Dragging ────────────────────────────────────────────
  function initLogoDrag() {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    let xOffset = 0;
    let yOffset = 0;

    logoArea.addEventListener('mousedown', dragStart);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('mousemove', drag);

    function dragStart(e) {
      if (!logoArea.classList.contains('has-logo')) return;
      // Don't drag if clicking resize slider
      if (e.target === logoSizeSlider) return;

      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;

      if (e.target.closest('#logoArea')) {
        isDragging = true;
        logoArea.style.cursor = 'grabbing';
      }
    }

    function dragEnd(e) {
      initialX = xOffset;
      initialY = yOffset;
      isDragging = false;
      logoArea.style.cursor = 'grab';

      // Save position if we moved
      if (logoArea.classList.contains('has-logo')) {
        scheduleSave();
      }
    }

    function drag(e) {
      if (isDragging) {
        e.preventDefault();

        // Mark as dragging to prevent click event on mouseup
        logoContainer.classList.add('is-dragging');

        const currentX = e.clientX - initialX;
        const currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        setLogoPosition(currentX, currentY);
      } else {
        logoContainer.classList.remove('is-dragging');
      }
    }
  }

  function setLogoPosition(x, y) {
    logoContainer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  // ── Visibility Toggles ───────────────────────────────────────
  function updateVisibility() {
    if (toggleDiscount.checked) {
      discountRow.classList.remove('hidden');
    } else {
      discountRow.classList.add('hidden');
    }

    if (toggleTax.checked) {
      taxRow.classList.remove('hidden');
    } else {
      taxRow.classList.add('hidden');
    }
  }

  // ── Template Switching ───────────────────────────────────────
  function setTemplate(name) {
    invoiceCanvas.className = 'invoice invoice--' + name;
    templateBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.template === name);
    });
    // Sync title
    const bandTitle = invoiceCanvas.querySelector('.band-title');
    const inlineTitle = invoiceCanvas.querySelector('.invoice-title-inline');
    if (name === 'bold') {
      bandTitle.textContent = inlineTitle.textContent;
    }
  }

  function getCurrentTemplate() {
    for (const btn of templateBtns) {
      if (btn.classList.contains('active')) return btn.dataset.template;
    }
    return 'minimal';
  }

  // ── Status Style ─────────────────────────────────────────────
  function updateStatusStyle() {
    statusSelect.dataset.status = statusSelect.value;
  }

  // ── Item Rows ────────────────────────────────────────────────
  function addItemRow(data = {}) {
    const tr = document.createElement('tr');
    tr.classList.add('item-row');
    tr.innerHTML = `
      <td><input type="text" class="item-input item-desc" placeholder="Item description" value="${escapeHTML(data.desc || '')}" /></td>
      <td><input type="number" class="item-input item-qty align-right" placeholder="0" min="0" value="${data.qty || ''}" /></td>
      <td><input type="number" class="item-input item-price align-right" placeholder="0.00" min="0" step="0.01" value="${data.price || ''}" /></td>
      <td class="item-total">0.00</td>
      <td class="col-action no-print">
        <button class="btn-remove" title="Remove item" aria-label="Remove item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </td>
    `;

    tr.querySelector('.btn-remove').addEventListener('click', () => {
      tr.style.opacity = '0';
      tr.style.transform = 'translateX(-10px)';
      tr.style.transition = 'all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)';
      setTimeout(() => {
        tr.remove();
        recalculate();
        scheduleSave();
      }, 250);
    });

    itemsBody.appendChild(tr);

    // Animate
    tr.style.opacity = '0';
    tr.style.transform = 'translateY(6px)';
    requestAnimationFrame(() => {
      tr.style.transition = 'all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)';
      tr.style.opacity = '1';
      tr.style.transform = 'translateY(0)';
    });

    return tr;
  }

  // ── Calculations ─────────────────────────────────────────────
  function recalculate() {
    let subtotal = 0;

    $$('.item-row').forEach(row => {
      const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
      const price = parseFloat(row.querySelector('.item-price').value) || 0;
      const total = qty * price;
      row.querySelector('.item-total').textContent = formatCurrency(total);
      subtotal += total;
    });

    // Discount
    let discountAmount = 0;
    if (toggleDiscount.checked) {
      const discountRate = parseFloat(discountRateEl.textContent) || 0;
      discountAmount = subtotal * (discountRate / 100);
    }

    const afterDiscount = subtotal - discountAmount;

    // Tax
    let taxAmount = 0;
    if (toggleTax.checked) {
      const taxRate = parseFloat(taxRateEl.textContent) || 0;
      taxAmount = afterDiscount * (taxRate / 100);
    }

    const grandTotal = afterDiscount + taxAmount;

    subtotalEl.textContent = formatCurrency(subtotal);
    discountAmountEl.textContent = formatCurrency(discountAmount);
    taxAmountEl.textContent = formatCurrency(taxAmount);
    grandTotalEl.textContent = formatCurrency(grandTotal);
  }

  // ── Currency Formatting ──────────────────────────────────────
  function formatCurrency(n) {
    const currency = currencySelect.value;
    if (currency === 'IDR') {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(n);
    } else {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(n);
    }
  }

  // ── Logo Handling ────────────────────────────────────────────
  function handleLogoFile(e) {
    const file = e.target.files[0];
    if (file) processLogoFile(file);
  }

  function processLogoFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogo(e.target.result);
      scheduleSave();
      showToast('Logo uploaded. Drag to move.');
    };
    reader.readAsDataURL(file);
  }

  function setLogo(dataUrl) {
    logoPreview.src = dataUrl;
    logoPreview.style.display = 'block';
    logoPlaceholder.style.display = 'none';
    logoArea.classList.add('has-logo');
    logoResizeCtrl.style.display = 'flex';
    logoHint.style.display = 'block';
  }

  function applyLogoSize(size) {
    logoArea.style.width = size + 'px';
    logoArea.style.height = Math.round(size * 0.57) + 'px';
    logoSizeSlider.value = size;
  }

  function clearLogo() {
    logoPreview.src = '';
    logoPreview.style.display = 'none';
    logoPlaceholder.style.display = 'flex';
    logoArea.classList.remove('has-logo');
    logoArea.style.width = '';
    logoArea.style.height = '';
    logoInput.value = '';
    logoResizeCtrl.style.display = 'none';
    logoHint.style.display = 'none';
    logoSizeSlider.value = 140;

    // Reset position
    setLogoPosition(0, 0);
  }

  // ── Print / PDF ──────────────────────────────────────────────
  function handlePrint() {
    window.print();
  }

  // ── New Invoice ──────────────────────────────────────────────
  function handleNewInvoice() {
    if (!confirm('Create a new invoice? Current data will be cleared.')) return;
    localStorage.removeItem(STORAGE_KEY);
    clearLogo();

    // Reset inputs
    $$('[data-field]').forEach(el => {
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        el.value = '';
      } else {
        // Defaults
        const defaults = {
          invoiceTitle: 'INVOICE',
          invoiceNumber: 'INV-001',
          fromDetails: 'Your Company Name\n123 Street Address\nCity, State ZIP\nemail@example.com',
          toDetails: 'Client Name\n456 Client Street\nCity, State ZIP\nclient@example.com',
          taxRate: '0',
          discountRate: '0',
          notes: 'Payment is due within 30 days. Thank you for your business.',
          bankName: 'Your Bank Name',
          bankAccountName: 'Your Name / Company',
          bankAccountNumber: '1234567890',
          bankRouting: 'ABCDEF',
          footerThank: 'Thank you for your business.',
        };
        if (defaults[el.dataset.field] !== undefined) {
          el.textContent = defaults[el.dataset.field];
        }
      }
    });

    statusSelect.value = 'draft';
    updateStatusStyle();
    setTemplate('minimal');

    // Reset toggles
    toggleDiscount.checked = true;
    toggleTax.checked = true;
    updateVisibility();

    itemsBody.innerHTML = '';
    addItemRow();
    setDefaultDates();
    recalculate();
    showToast('New invoice created');
  }

  // ── Persistence ──────────────────────────────────────────────
  function scheduleSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveData, 400);
  }

  function saveData() {
    const data = {};

    // Elements
    $$('[data-field]').forEach(el => {
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        data[el.dataset.field] = el.value;
      } else {
        data[el.dataset.field] = el.textContent;
      }
    });

    // Items
    data.items = [];
    $$('.item-row').forEach(row => {
      data.items.push({
        desc: row.querySelector('.item-desc').value,
        qty: row.querySelector('.item-qty').value,
        price: row.querySelector('.item-price').value,
      });
    });

    // Logo
    if (logoPreview.src && logoArea.classList.contains('has-logo')) {
      data.logo = logoPreview.src;
    }
    data.logoSize = parseInt(logoSizeSlider.value, 10);

    // Logo Position
    // We parse the transform style
    const style = window.getComputedStyle(logoContainer);
    const matrix = new WebKitCSSMatrix(style.transform);
    data.logoX = matrix.m41;
    data.logoY = matrix.m42;

    // Settings
    data.template = getCurrentTemplate();
    data.currency = currencySelect.value;
    data.showDiscount = toggleDiscount.checked;
    data.showTax = toggleTax.checked;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save:', e);
    }
  }

  function loadData() {
    let data;
    try {
      data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      data = null;
    }

    if (!data) {
      addItemRow();
      return;
    }

    // Fields
    $$('[data-field]').forEach(el => {
      const val = data[el.dataset.field];
      if (val !== undefined) {
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
          el.value = val;
        } else {
          el.textContent = val;
        }
      }
    });

    // Logo
    if (data.logo) {
      setLogo(data.logo);
      if (data.logoSize) applyLogoSize(data.logoSize);
      if (data.logoX !== undefined && data.logoY !== undefined) {
        setLogoPosition(data.logoX, data.logoY);
      }
    }

    // Settings
    if (data.template) setTemplate(data.template);
    if (data.currency) currencySelect.value = data.currency;

    if (data.showDiscount !== undefined) {
      toggleDiscount.checked = data.showDiscount;
    }
    if (data.showTax !== undefined) {
      toggleTax.checked = data.showTax;
    }
    updateVisibility();

    // Items
    if (data.items && data.items.length > 0) {
      data.items.forEach(item => addItemRow(item));
    } else {
      addItemRow();
    }
  }

  // ── Utils ────────────────────────────────────────────────────
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2500);
  }

  // ── Start ────────────────────────────────────────────────────
  init();

})();
