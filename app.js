// app.js — tab navigation + CSV-driven filters + Modals
(() => {
  'use strict';

  const GLOVES = Array.isArray(window.GLOVES) ? window.GLOVES : [];
  const FILTERS = window.FILTERS || { categories: {}, productMap: {} };

  // ---------- helpers ----------
  const __GU = window.GloveUtils || {};
  const normalizeCode = __GU.normalizeCode || ((code) => String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''));
  const slug = __GU.slug || ((s) => String(s || '').trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
  const uniqSorted = __GU.uniqSorted || ((arr) => Array.from(new Set((arr || []).filter(Boolean).map(String))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })));

  const gloveByNormCode = new Map(
    GLOVES.map((g) => [normalizeCode(g.code), g])
  );

  // Build quick lookup for CSV productMap using normalized keys
  const productMap = FILTERS.productMap || {};
  const productMapNorm = new Map();
  for (const [code, obj] of Object.entries(productMap)) {
    productMapNorm.set(normalizeCode(code), obj || {});
  }

  function getProductCategoryValues(gloveCode, categoryName) {
    const norm = normalizeCode(gloveCode);
    if (categoryName === 'Brand') {
      const g = gloveByNormCode.get(norm);
      const b = (g && g.brand != null) ? String(g.brand).trim() : '';
      return b ? [b] : [];
    }
    const fromMap = productMapNorm.get(norm);
    if (fromMap && Array.isArray(fromMap[categoryName])) return fromMap[categoryName];
    return [];
  }


  // ---------- tabs ----------
  const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
  const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));

  function showTab(tabName) {
    const targetId = `tab-${tabName}`;
    tabPanels.forEach((p) => {
      p.classList.toggle('tab-panel--active', p.id === targetId);
    });
    tabButtons.forEach((b) => {
      b.classList.toggle('tab-button--active', b.dataset.tab === tabName);
    });
    
    // keep URL clean + allow refresh to stay on tab
    try {
      const url = new URL(window.location.href);
      url.hash = tabName ? `#${tabName}` : '';
      history.replaceState(null, '', url.toString());
    } catch (_) {}
  }

  const brandHome = document.getElementById('brand-home-link');
  if (brandHome) {
    brandHome.addEventListener('click', (e) => {
      e.preventDefault();
      showTab('home');
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, 0); }
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      showTab(btn.dataset.tab);
    });
  });

  document.querySelectorAll('.home-card').forEach((card) => {
    const go = () => {
      const tab = card.dataset.goTab;
      if (tab) showTab(tab);
    };
    card.addEventListener('click', (e) => {
      if (e.target && (e.target.closest('a') || e.target.closest('button'))) return;
      go();
    });
    const btn = card.querySelector('.home-card-btn');
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); go(); });
  });

  if (window.location.hash) {
    const h = window.location.hash.replace('#', '').trim();
    if (h) showTab(h);
  }

  // ---------- filter rendering ----------
  const INDUSTRY_CATEGORY = 'Industry';
  const BRAND_CATEGORY = 'Brand';

  function getFeatureCategoryOrder(FILTERS) {
    const catsFromFeatureCategories =
      Array.isArray(FILTERS?.featureCategories) && FILTERS.featureCategories.length
        ? FILTERS.featureCategories.slice()
        : [];
    const catsFromCategoriesObject = Object.keys(FILTERS?.categories || {})
      .filter((c) => c && c !== INDUSTRY_CATEGORY);
    const merged = [];
    const add = (c) => {
      if (!c) return;
      if (!merged.includes(c)) merged.push(c);
    };
    add(BRAND_CATEGORY);
    catsFromFeatureCategories.forEach(add);
    catsFromCategoriesObject.forEach(add);
    return merged
      .filter((c) => c !== INDUSTRY_CATEGORY)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }

  const FEATURE_CATEGORIES = getFeatureCategoryOrder(FILTERS);

  const featureState = {};
  FEATURE_CATEGORIES.forEach((c) => (featureState[c] = new Set()));
  const industryState = new Set();

  function renderFilterList(container, options, selectedSet, onChange, mode) {
    if (!container) return;
    container.innerHTML = '';
    const useChips = mode === 'chip';
    options.forEach((opt) => {
      const id = `${container.id}-${slug(opt)}`;
      const label = document.createElement('label');
      label.className = useChips ? 'chip' : 'checkbox-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = id;
      input.checked = selectedSet.has(opt);
      input.addEventListener('change', () => {
        if (input.checked) selectedSet.add(opt);
        else selectedSet.delete(opt);
        onChange();
      });
      const span = document.createElement('span');
      span.textContent = opt;
      label.appendChild(input);
      label.appendChild(span);
      container.appendChild(label);
    });
  }

  function getCategoryOptions(categoryName) {
    const opts = (FILTERS.categories && FILTERS.categories[categoryName]) || [];
    return uniqSorted(opts);
  }

  // ---------- results rendering ----------
  const els = {
    resultsCount: document.getElementById('results-count'),
    resultsGrid: document.getElementById('results-grid'),
    resultsCountIndustry: document.getElementById('results-count-industry'),
    resultsGridIndustry: document.getElementById('results-grid-industry'),
    clearFeatures: document.getElementById('clear-filters'),
    clearIndustry: document.getElementById('clear-industry-filters'),
    featureFiltersRoot: document.getElementById('feature-filters-root'),
    industry: document.querySelector('#tab-industry #filter-industry') || document.getElementById('filter-industry'),
    lightbox: document.getElementById('lightbox'),
    lightboxImg: document.getElementById('lightbox-img'),
    
    // Poster
    posterCount: document.getElementById('poster-count'),
    posterGrid: document.getElementById('poster-grid'),
    posterA4: document.getElementById('poster-a4'),
    customerLogoInput: document.getElementById('customer-logo-input'),
    customerLogo: document.getElementById('customer-logo'),
    customerLogoWrapper: document.getElementById('poster-customer-logo-wrapper'),
    downloadPoster: document.getElementById('download-poster'),
    clearPoster: document.getElementById('clear-poster'),
    
    // Poster Notes Box
    posterNotesBox: document.getElementById('poster-notes-box'),
  };

  function matchesFeatureFilters(glove) {
    for (const cat of FEATURE_CATEGORIES) {
      const selected = featureState[cat];
      if (!selected || selected.size === 0) continue;
      const values = getProductCategoryValues(glove.code, cat);
      if (!values || values.length === 0) return false;
      const hit = values.some((v) => selected.has(v));
      if (!hit) return false;
    }
    return true;
  }

  function matchesIndustryFilters(glove) {
    if (industryState.size === 0) return true;
    const values = getProductCategoryValues(glove.code, INDUSTRY_CATEGORY);
    if (!values || values.length === 0) return false;
    return values.some((v) => industryState.has(v));
  }

  const POSTER_MAX = 10;

  function createStandardsBadge(glove) {
    const stdIcon = (glove.standardsIcon || '').trim();
    const stdCode = (glove.standardsCode || '').trim();
    if (!stdIcon || !stdCode) return null;
    const badge = document.createElement('div');
    badge.className = 'standards-badge';
    const badgeImg = document.createElement('img');
    badgeImg.src = stdIcon;
    badgeImg.alt = stdCode;
    const badgeTxt = document.createElement('span');
    badgeTxt.className = 'standards-badge-code';
    badgeTxt.textContent = stdCode;
    badge.appendChild(badgeImg);
    badge.appendChild(badgeTxt);
    return badge;
  }

  function createGloveCard(glove) {
    const card = document.createElement('article');
    card.className = 'glove-card';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'glove-image-wrapper';
    const img = document.createElement('img');
    img.alt = glove.name ? `${glove.name}` : glove.code;
    img.loading = 'lazy';
    img.src = glove.image || '';
    imgWrap.appendChild(img);
    const magnify = document.createElement('button');
    magnify.type = 'button';
    magnify.className = 'magnify-btn';
    magnify.title = 'View image';
    magnify.addEventListener('click', () => openLightbox(glove.image || ''));
    imgWrap.appendChild(magnify);

    const head = document.createElement('div');
    head.className = 'glove-header';
    const code = document.createElement('div');
    code.className = 'glove-code';
    code.textContent = glove.code || '';
    const name = document.createElement('div');
    name.className = 'glove-name';
    name.textContent = glove.name || '';
    head.appendChild(code);
    head.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'glove-meta';
    const brand = glove.brand ? `Brand: ${glove.brand}` : '';
    const sizes = glove.sizes ? `Sizes: ${glove.sizes}` : '';
    meta.textContent = [brand, sizes].filter(Boolean).join(' • ');

    const actions = document.createElement('div');
    actions.className = 'glove-actions';
    const datasheet = document.createElement('a');
    datasheet.className = 'datasheet-btn';
    datasheet.href = glove.datasheet || '#';
    datasheet.target = '_blank';
    datasheet.rel = 'noopener';
    datasheet.textContent = 'Datasheet';
    
    const addPoster = document.createElement('button');
    addPoster.type = 'button';
    addPoster.className = 'poster-add-btn';
    addPoster.setAttribute('data-code', glove.code || '');
    const initiallySelected = posterSelected.has(glove.code || '');
    addPoster.textContent = initiallySelected ? 'Remove from poster' : 'Add to poster';
    addPoster.setAttribute('aria-pressed', initiallySelected ? 'true' : 'false');

    addPoster.addEventListener('click', () => {
      const codeVal = glove.code || '';
      if (!codeVal) return;
      if (posterSelected.has(codeVal)) {
        posterSelected.delete(codeVal);
        updatePosterCount();
        renderPosterGrid();
        updatePosterButtons();
        return;
      }
      if (posterSelected.size >= POSTER_MAX) {
        updatePosterButtons();
        return;
      }
      addToPoster(codeVal);
      updatePosterButtons();
    });

    actions.appendChild(datasheet);
    actions.appendChild(addPoster);

    card.appendChild(imgWrap);
    card.appendChild(head);
    if (meta.textContent) card.appendChild(meta);
    card.appendChild(actions);

    return card;
  }

  function renderResults(list, countEl, gridEl) {
    if (!countEl || !gridEl) return;
    countEl.textContent = `${list.length} product${list.length === 1 ? '' : 's'} found`;
    gridEl.innerHTML = '';
    list.forEach((g) => gridEl.appendChild(createGloveCard(g)));
    updatePosterButtons();
  }

  function updateFeatureResults() {
    const filtered = GLOVES.filter(matchesFeatureFilters);
    renderResults(filtered, els.resultsCount, els.resultsGrid);
  }

  function updateIndustryResults() {
    const filtered = GLOVES.filter(matchesIndustryFilters);
    renderResults(filtered, els.resultsCountIndustry, els.resultsGridIndustry);
  }

  function clearFeatureFilters() {
    FEATURE_CATEGORIES.forEach((c) => featureState[c].clear());
    renderFeatureFilters();
    updateFeatureResults();
  }

  function clearIndustryFilters() {
    industryState.clear();
    renderIndustryFilters();
    updateIndustryResults();
  }

  function renderFeatureFilters() {
    const root = els.featureFiltersRoot;
    if (!root) return;
    root.innerHTML = '';
    FEATURE_CATEGORIES.forEach((cat) => {
      const section = document.createElement('div');
      section.className = 'filter-section';
      const header = document.createElement('button');
      header.className = 'filter-section-header';
      header.type = 'button';
      const left = document.createElement('span');
      left.textContent = cat;
      const toggle = document.createElement('span');
      toggle.className = 'filter-section-toggle';
      toggle.textContent = '–';
      header.appendChild(left);
      header.appendChild(toggle);
      const body = document.createElement('div');
      body.className = 'filter-section-body';
      const optionsWrap = document.createElement('div');
      optionsWrap.className = 'filter-options filter-options--chips';
      body.appendChild(optionsWrap);
      section.appendChild(header);
      section.appendChild(body);
      root.appendChild(section);
      if (!featureState[cat]) featureState[cat] = new Set();
      renderFilterList(optionsWrap, getCategoryOptions(cat), featureState[cat], updateFeatureResults, 'chip');
    });
    initCollapsibleFilters();
  }

  function renderIndustryFilters() {
    renderFilterList(els.industry, getCategoryOptions(INDUSTRY_CATEGORY), industryState, updateIndustryResults, 'row');
  }

  function openLightbox(src) {
    if (!els.lightbox || !els.lightboxImg) return;
    if (!src) return;
    els.lightboxImg.src = src;
    els.lightbox.classList.add('active');
  }
  function closeLightbox() {
    if (!els.lightbox || !els.lightboxImg) return;
    els.lightbox.classList.remove('active');
    els.lightboxImg.src = '';
  }
  if (els.lightbox) {
    els.lightbox.addEventListener('click', (e) => {
      if (e.target === els.lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  // ---------- POSTER CREATOR ----------
  const posterSelected = new Set();
  const posterPrices = new Map(); 
  let posterNotesText = '';
  // New config state for formatting
  let posterNotesConfig = { 
    bold: false, 
    italic: false, 
    fontSize: 11  // Default size increased to 11
  };
  const companyDetails = { name:'', a1:'', a2:'', city:'', postcode:'', website:'', telephone:'' };

  function updatePosterButtons() {
    const isFull = posterSelected.size >= POSTER_MAX;
    document.querySelectorAll('.poster-add-btn').forEach((btn) => {
      const code = btn.getAttribute('data-code') || '';
      const selected = posterSelected.has(code);
      btn.textContent = selected ? 'Remove from poster' : 'Add to poster';
      btn.classList.toggle('is-selected', selected);
      btn.disabled = isFull && !selected;
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function renderPriceInputs() {
    const wrap = document.getElementById('poster-price-inputs');
    if (!wrap) return;
    wrap.innerHTML = '';
    const selected = Array.from(posterSelected).map((codeRaw) => {
      const glove = gloveByNormCode.get(normalizeCode(codeRaw));
      return { code: glove?.code || codeRaw, name: glove?.name || '' };
    });
    if (selected.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'poster-price-empty';
      empty.textContent = 'Select products to add optional prices.';
      wrap.appendChild(empty);
      return;
    }
    selected.forEach(({ code, name }) => {
      const row = document.createElement('div');
      row.className = 'poster-price-row';
      const label = document.createElement('div');
      label.className = 'poster-price-label';
      label.textContent = name ? `${code} — ${name}` : code;
      const input = document.createElement('input');
      input.className = 'poster-price-input';
      input.placeholder = 'Price';
      input.value = posterPrices.get(code) || '';
      input.addEventListener('input', () => {
        const val = String(input.value || '').trim();
        if (val) posterPrices.set(code, val);
        else posterPrices.delete(code);
        renderPosterGrid();
      });
      row.appendChild(label);
      row.appendChild(input);
      wrap.appendChild(row);
    });
  }

  function updatePosterNotes() {
    const box = els.posterNotesBox;
    if (!box) return;
    
    // Content
    const t = String(posterNotesText || '').trim();
    box.textContent = t || '—';

    // Style Application
    box.style.fontWeight = posterNotesConfig.bold ? 'bold' : 'normal';
    box.style.fontStyle = posterNotesConfig.italic ? 'italic' : 'normal';
    box.style.fontSize = `${posterNotesConfig.fontSize}pt`;
  }

  // Formatting Controls Logic
  function updateNotesToolbarUI() {
    const btnBold = document.getElementById('notes-btn-bold');
    const btnItalic = document.getElementById('notes-btn-italic');
    const displaySize = document.getElementById('notes-size-display');
    
    if (btnBold) btnBold.classList.toggle('active', posterNotesConfig.bold);
    if (btnItalic) btnItalic.classList.toggle('active', posterNotesConfig.italic);
    if (displaySize) displaySize.textContent = `${posterNotesConfig.fontSize}pt`;
  }

  function bindNotesToolbar() {
    const btnBold = document.getElementById('notes-btn-bold');
    const btnItalic = document.getElementById('notes-btn-italic');
    const btnUp = document.getElementById('notes-btn-size-up');
    const btnDown = document.getElementById('notes-btn-size-down');

    if (btnBold) btnBold.addEventListener('click', () => {
      posterNotesConfig.bold = !posterNotesConfig.bold;
      updatePosterNotes();
      updateNotesToolbarUI();
    });

    if (btnItalic) btnItalic.addEventListener('click', () => {
      posterNotesConfig.italic = !posterNotesConfig.italic;
      updatePosterNotes();
      updateNotesToolbarUI();
    });

    if (btnUp) btnUp.addEventListener('click', () => {
      if (posterNotesConfig.fontSize < 36) {
        posterNotesConfig.fontSize++;
        updatePosterNotes();
        updateNotesToolbarUI();
      }
    });

    if (btnDown) btnDown.addEventListener('click', () => {
      if (posterNotesConfig.fontSize > 8) {
        posterNotesConfig.fontSize--;
        updatePosterNotes();
        updateNotesToolbarUI();
      }
    });
    
    // Init state
    updateNotesToolbarUI();
  }


  function updatePosterCompanyBoxes() {
    const setLine = (id, text) => {
      const el = document.getElementById(id);
      if (!el) return;
      const t = String(text || '').trim();
      el.textContent = t;
      el.style.display = t ? 'block' : 'none';
    };
    setLine('poster-company-box-line-1', companyDetails.name);
    const addressSingle = [companyDetails.a1, companyDetails.a2, companyDetails.city, companyDetails.postcode]
      .map(v => String(v || '').trim())
      .filter(Boolean)
      .join(', ');
    setLine('poster-company-box-line-2', addressSingle);
    setLine('poster-company-box-line-3', '');
    setLine('poster-company-box-line-4', '');
    const line5 = document.getElementById('poster-company-box-line-5');
    if (line5) { line5.textContent = ''; line5.style.display = 'none'; }
    setLine('poster-company-box-website', companyDetails.website ? `Web: ${companyDetails.website}` : '');
    setLine('poster-company-box-telephone', companyDetails.telephone ? `Tel: ${companyDetails.telephone}` : '');
  }

  function updatePosterCount() {
    if (els.posterCount) els.posterCount.textContent = String(posterSelected.size);
    renderPriceInputs();
    updatePosterNotes();
    updatePosterCompanyBoxes();
  }

  function renderPosterGrid() {
    if (!els.posterGrid) return;
    els.posterGrid.innerHTML = '';
    const count = posterSelected.size;
    els.posterGrid.className = 'poster-grid';
    if (count > 0) els.posterGrid.classList.add(`layout-${count}`);
    else els.posterGrid.classList.add('layout-0');

    const addMetaRow = (root, label, value) => {
      const isArr = Array.isArray(value);
      const raw = (value === undefined || value === null)
        ? ''
        : (isArr ? value.filter(Boolean).join(', ') : String(value).trim());
      const str = raw || '—';
      const row = document.createElement('div');
      row.className = 'poster-meta-row';
      const k = document.createElement('span');
      k.className = 'poster-meta-key';
      k.textContent = `${label}:`;
      const v = document.createElement('span');
      v.className = 'poster-meta-val';
      v.textContent = str;
      row.appendChild(k);
      row.appendChild(v);
      root.appendChild(row);
    };

    Array.from(posterSelected).forEach((code) => {
      const glove = gloveByNormCode.get(normalizeCode(code));
      if (!glove) return;
      const item = document.createElement('div');
      item.className = 'poster-item';

      const cap = document.createElement('div');
      cap.className = 'poster-item-caption';
      const codeEl = document.createElement('span');
      codeEl.className = 'poster-item-code';
      codeEl.textContent = glove.code || '';
      const nameEl = document.createElement('span');
      nameEl.className = 'poster-item-name';
      nameEl.textContent = glove.name || '';
      cap.appendChild(codeEl);
      cap.appendChild(nameEl);

      const imgWrap = document.createElement('div');
      imgWrap.className = 'poster-item-image';
      const img = document.createElement('img');
      img.src = glove.image || '';
      img.alt = glove.code || '';
      imgWrap.appendChild(img);

      const posterBadge = createStandardsBadge(glove);
      if (posterBadge) imgWrap.appendChild(posterBadge);

      const meta = document.createElement('div');
      meta.className = 'poster-item-meta';
      const sizesStr = Array.isArray(glove.sizes) ? glove.sizes.join(', ') : (glove.sizes || '');
      addMetaRow(meta, 'Sizes', sizesStr);
      addMetaRow(meta, 'Brand', glove.brand);
      addMetaRow(meta, glove.coating ? 'Coating' : (glove.leather ? 'Leather' : 'Coating'), glove.coating || glove.leather);
      
      const cutVal = (glove.cutLevel ?? '').toString().trim();
      const rawPrice = posterPrices.get(code) || '';
      const priceVal = String(rawPrice || '').trim();
      {
        const row = document.createElement('div');
        row.className = 'poster-meta-row poster-meta-row--cut';
        const k = document.createElement('span');
        k.className = 'poster-meta-key';
        k.textContent = 'Cut:';
        const v = document.createElement('span');
        v.className = 'poster-meta-val poster-meta-cut-val';
        v.textContent = cutVal || '—';
        row.appendChild(k);
        row.appendChild(v);
        if (priceVal) {
          const p = document.createElement('span');
          p.className = 'poster-price-inline';
          p.textContent = priceVal.startsWith('£') ? priceVal : `£${priceVal}`;
          row.appendChild(p);
        }
        meta.appendChild(row);
      }
      if (!meta.children.length) meta.style.display = 'none';

      item.appendChild(cap);
      item.appendChild(imgWrap);
      item.appendChild(meta);
      els.posterGrid.appendChild(item);
    });
    updatePosterNotes();
    updatePosterCompanyBoxes();
  }

  function addToPoster(code) {
    if (!code) return;
    if (posterSelected.has(code)) return;
    if (posterSelected.size >= POSTER_MAX) {
      updatePosterButtons();
      return;
    }
    posterSelected.add(code);
    updatePosterCount();
    renderPosterGrid();
    updatePosterButtons();
  }

  if (els.clearPoster) {
    els.clearPoster.addEventListener('click', () => {
      posterSelected.clear();
      posterPrices.clear();
      updatePosterCount();
      renderPosterGrid();
      updatePosterButtons();
    });
  }

  // --- Modals logic ---
  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
  }

  // Bind toolbar buttons
  document.getElementById('btn-open-distributor')?.addEventListener('click', () => openModal('modal-distributor'));
  document.getElementById('btn-open-prices')?.addEventListener('click', () => openModal('modal-prices'));
  document.getElementById('btn-open-notes')?.addEventListener('click', () => openModal('modal-notes'));
  
  // Upload logo button triggers hidden file input
  document.getElementById('btn-upload-logo')?.addEventListener('click', () => {
    els.customerLogoInput && els.customerLogoInput.click();
  });

  // Modal close handlers (overlay + x btn + done btn)
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-close')) {
        modal.classList.remove('active');
      }
    });
  });

  // Poster inputs binding
  const bindVal = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      companyDetails[key] = String(el.value || '').trim();
      updatePosterCompanyBoxes();
    });
  };
  bindVal('company-name', 'name');
  bindVal('company-address-1', 'a1');
  bindVal('company-address-2', 'a2');
  bindVal('company-city', 'city');
  bindVal('company-postcode', 'postcode');
  bindVal('company-website', 'website');
  bindVal('company-telephone', 'telephone');

  const notesIn = document.getElementById('poster-notes-input');
  if (notesIn) {
    notesIn.addEventListener('input', () => {
      posterNotesText = String(notesIn.value || '');
      updatePosterNotes();
    });
  }

  updatePosterCompanyBoxes();
  updatePosterNotes();
  bindNotesToolbar(); // Bind the new toolbar controls
  renderPriceInputs();

  if (els.customerLogoInput && els.customerLogo && els.customerLogoWrapper) {
    els.customerLogoInput.addEventListener('change', () => {
      const file = els.customerLogoInput.files && els.customerLogoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        els.customerLogo.src = String(reader.result || '');
        els.customerLogoWrapper.style.display = 'block';
      };
      reader.readAsDataURL(file);
    });
  }

  // Poster download (PDF)
  function extractPrintCssForCapture() {
    let css = '';
    const sheets = Array.from(document.styleSheets || []);
    for (const ss of sheets) {
      let rules;
      try { rules = ss.cssRules; } catch (_) { continue; }
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        try {
          if (rule.type === 4 && rule.media && String(rule.media.mediaText || '').includes('print')) {
            css += '\n' + String(rule.cssText || '').replace(/@media\s+print/i, '@media all');
          }
        } catch (_) {}
      }
    }
    document.querySelectorAll('style[media="print"]').forEach((st) => {
      const t = String(st.textContent || '');
      if (t.trim()) css += '\n' + t;
    });
    return css.trim();
  }

  async function waitForPosterAssets(root) {
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll('img'));
    await Promise.all(imgs.map(img => {
      try {
        const srcAttr = img.getAttribute('src');
        const hasSrc =
          (typeof img.currentSrc === 'string' && img.currentSrc.trim() !== '') ||
          (typeof img.src === 'string' && img.src.trim() !== '' && !img.src.startsWith('about:')) ||
          (typeof srcAttr === 'string' && srcAttr.trim() !== '');
        if (!hasSrc) return Promise.resolve();
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      } catch (e) {}
      return new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  // Enforced PDF compression settings – adaptive to keep poster PDFs under 10 MB.
  // scale   : html2canvas render resolution multiplier
  // quality : initial JPEG compression 0.0–1.0
  const PDF_QUALITY = { scale: 1.5, quality: 0.72 };

  // --- Adaptive PDF size helpers ---

  // Wraps canvas.toBlob in a Promise so we can await it.
  function canvasToJpegBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
        'image/jpeg',
        quality
      );
    });
  }

  // Returns a new canvas drawn at (canvas.width * factor) x (canvas.height * factor).
  function downscaleCanvas(canvas, factor) {
    const w = Math.max(1, Math.round(canvas.width * factor));
    const h = Math.max(1, Math.round(canvas.height * factor));
    const scaled = document.createElement('canvas');
    scaled.width = w;
    scaled.height = h;
    const ctx = scaled.getContext('2d');
    ctx.drawImage(canvas, 0, 0, w, h);
    return scaled;
  }

  // Converts a Blob to a data URL.
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Adaptive encode: tries quality sweep first, then downscaling, until under maxBytes.
  // Returns { dataUrl, qualityUsed, scaleFactorUsed, bytes }.
  async function encodePosterImageUnderLimit(canvas, {
    maxBytes = 9.5 * 1024 * 1024,
    initialQuality = 0.72,
    minQuality = 0.40,
    qualityStep = 0.04,
    initialScaleFactor = 1.0,
    minScaleFactor = 0.30,
    scaleStep = 0.10,
    maxAttempts = 40
  } = {}) {
    let scaleFactor = initialScaleFactor;
    let attempts = 0;

    while (scaleFactor >= minScaleFactor && attempts < maxAttempts) {
      const workCanvas = scaleFactor < 1.0
        ? downscaleCanvas(canvas, scaleFactor)
        : canvas;

      let quality = initialQuality;
      while (quality >= minQuality - 1e-9 && attempts < maxAttempts) {
        attempts++;
        // Yield to keep the UI from freezing between attempts.
        await new Promise((r) => setTimeout(r, 0));
        const blob = await canvasToJpegBlob(workCanvas, quality);
        console.debug(`PDF encode attempt ${attempts}: scale=${scaleFactor.toFixed(2)}, quality=${quality.toFixed(2)}, bytes=${blob.size}`);
        if (blob.size <= maxBytes) {
          const dataUrl = await blobToDataUrl(blob);
          console.log(`PDF export: using scale=${scaleFactor.toFixed(2)}, quality=${quality.toFixed(2)}, bytes=${blob.size}`);
          return { dataUrl, qualityUsed: quality, scaleFactorUsed: scaleFactor, bytes: blob.size };
        }
        quality = Math.round((quality - qualityStep) * 100) / 100;
      }
      scaleFactor = Math.round((scaleFactor - scaleStep) * 100) / 100;
    }

    // Fallback: best-effort at minimum settings.
    const finalScale = Math.max(minScaleFactor, scaleFactor);
    const workCanvas = finalScale < 1.0 ? downscaleCanvas(canvas, finalScale) : canvas;
    const blob = await canvasToJpegBlob(workCanvas, minQuality);
    const dataUrl = await blobToDataUrl(blob);
    console.warn(`PDF export fallback: scale=${finalScale.toFixed(2)}, quality=${minQuality}, bytes=${blob.size}`);
    return { dataUrl, qualityUsed: minQuality, scaleFactorUsed: finalScale, bytes: blob.size };
  }

  if (els.downloadPoster && els.posterA4 && window.html2canvas) {
    els.downloadPoster.addEventListener('click', async () => {
      const EXPORT_CLASS = 'poster-export-mode';
      const preset = PDF_QUALITY;
      const overlay = document.getElementById('export-overlay');
      const btn = els.downloadPoster;
      const btnLabel = btn ? btn.textContent : '';
      const showOverlay = () => {
        if (overlay) {
          overlay.classList.add('export-overlay--active');
          overlay.setAttribute('aria-hidden', 'false');
        }
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Generating…';
        }
      };
      const hideOverlay = () => {
        if (overlay) {
          overlay.classList.remove('export-overlay--active');
          overlay.setAttribute('aria-hidden', 'true');
        }
        if (btn) {
          btn.disabled = false;
          btn.textContent = btnLabel;
        }
      };

      try {
        showOverlay();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await waitForPosterAssets(els.posterA4);
        const printCss = extractPrintCssForCapture();
        const canvas = await window.html2canvas(els.posterA4, {
          scale: preset.scale,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            clonedDoc.body.classList.add(EXPORT_CLASS);
            const posterTab = clonedDoc.getElementById('tab-poster');
            if (posterTab) {
              posterTab.style.display = 'block';
              posterTab.classList.add('tab-panel--active');
            }
            // Force all images to load eagerly in the off-screen clone so
            // html2canvas can capture them (lazy images may not load in a
            // headless/offscreen context and would render blank).
            clonedDoc.querySelectorAll('img').forEach((img) => {
              img.loading = 'eager';
            });
            if (printCss) {
              const style = clonedDoc.createElement('style');
              style.textContent = printCss.replace(/@media\s+print/gi, '@media all');
              clonedDoc.head.appendChild(style);
            }
          }
        });

        if (window.jspdf && window.jspdf.jsPDF) {
          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
          });
          const pageW = pdf.internal.pageSize.getWidth();
          const pageH = pdf.internal.pageSize.getHeight();
          const { dataUrl } = await encodePosterImageUnderLimit(canvas, {
            initialQuality: preset.quality
          });
          pdf.addImage(dataUrl, 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST');
          pdf.save('poster.pdf');
        } else {
          window.print();
        }
      } catch (err) {
        console.error('Poster export failed:', err);
        window.print();
      } finally {
        hideOverlay();
      }
    });
  }

  if (els.clearFeatures) els.clearFeatures.addEventListener('click', clearFeatureFilters);
  if (els.clearIndustry) els.clearIndustry.addEventListener('click', clearIndustryFilters);

  function init() {
    renderFeatureFilters();
    renderIndustryFilters();
    updateFeatureResults();
    updateIndustryResults();
    updatePosterCount();
    renderPosterGrid();
    updatePosterButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function initCollapsibleFilters() {
    const featuresRoot = document.getElementById('filters-features');
    if (!featuresRoot) return;
    const toggleAllBtn =
      featuresRoot.querySelector('#collapse-all-features') ||
      featuresRoot.querySelector('#collapse-all') ||
      featuresRoot.querySelector('#collapseAll') ||
      featuresRoot.querySelector('[data-action="toggle-collapse-all"]') ||
      featuresRoot.querySelector('.collapse-all-btn') ||
      Array.from(featuresRoot.querySelectorAll('button')).find(b => /\b(collapse|expand)\s+all\b/i.test(b.textContent || ''));
    const sections = Array.from(featuresRoot.querySelectorAll('.filter-section'));
    if (sections.length === 0) return;
    function setPuck(section) {
      const header = section.querySelector('.filter-section-header');
      if (!header) return;
      const puck = header.querySelector('.filter-section-toggle');
      if (!puck) return;
      const collapsed = section.classList.contains('collapsed');
      puck.textContent = collapsed ? '+' : '–';
      header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
    function allCollapsed() {
      return sections.every(s => s.classList.contains('collapsed'));
    }
    function updateToggleAllButton() {
      if (!toggleAllBtn) return;
      const nextMode = allCollapsed() ? 'expand' : 'collapse';
      toggleAllBtn.dataset.mode = nextMode;
      toggleAllBtn.textContent = nextMode === 'expand' ? 'Expand all' : 'Collapse all';
      toggleAllBtn.disabled = sections.length === 0;
    }
    function collapseAll() {
      sections.forEach(s => { s.classList.add('collapsed'); setPuck(s); });
      updateToggleAllButton();
    }
    function expandAll() {
      sections.forEach(s => { s.classList.remove('collapsed'); setPuck(s); });
      updateToggleAllButton();
    }
    sections.forEach((section) => {
      const header = section.querySelector('.filter-section-header');
      if (!header) return;
      if (header.dataset.boundCollapse === '1') return;
      header.dataset.boundCollapse = '1';
      setPuck(section);
      header.addEventListener('click', (e) => {
        if (e.target && e.target !== header && e.target.closest('input,select,textarea,a')) return;
        section.classList.toggle('collapsed');
        setPuck(section);
        updateToggleAllButton();
      });
    });
    if (toggleAllBtn && toggleAllBtn.dataset.boundCollapseAll !== '1') {
      toggleAllBtn.dataset.boundCollapseAll = '1';
      toggleAllBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (allCollapsed()) expandAll();
        else collapseAll();
      });
    }
    updateToggleAllButton();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCollapsibleFilters);
  } else {
    initCollapsibleFilters();
  }

})();