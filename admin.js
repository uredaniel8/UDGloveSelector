document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  console.log("Admin JS loaded");

  // --- CONFIG ---
  const STORAGE_PRODUCTS = "gloveAdmin.products.v2";
  const STORAGE_FILTERS = "gloveAdmin.filters.v2";
  const STORAGE_COL_ORDER = "gloveAdmin.colOrder.v1";
  const SESSION_KEY = "gloveAdmin.session.v1";
  
  // Credentials
  const LOGIN_USER = "admin";
  const LOGIN_PASS = "just1source-admin";

  // --- STATE ---
  let products = [];
  let filters = { categories: {}, productMap: {}, featureCategories: [] };
  let currentEditingCode = null;
  let isDirty = false;
  let columnOrder = [];

  // --- DOM ELEMENTS ---
  const get = (id) => document.getElementById(id);

  const els = {
    loginView: get('loginView'),
    appView: get('appView'),
    user: get('user'),
    pass: get('pass'),
    loginBtn: get('loginBtn'),
    loginMsg: get('loginMsg'),
    
    tableHeaderRow: get('tableHeaderRow'),
    tableBody: get('productListBody'),
    searchBox: get('searchBox'),
    totalCount: get('totalCount'),
    dirtyFlag: get('dirtyFlag'),
    statusMsg: get('statusMsg'),

    productModal: get('productModal'),
    btnManageFilters: get('btnManageFilters'),
    filterManagerModal: get('filterManagerModal'),

    modalTitle: get('modalTitle'),
    modalClose: get('modalClose'),
    filterManagerClose: get('filterManagerClose'),
    
    btnSaveModal: get('btnSaveModal'),
    btnDeleteProduct: get('btnDeleteProduct'),
    btnDuplicate: get('btnDuplicate'),
    btnNewProduct: get('btnNewProduct'),
    btnExport: get('btnExport'),
    btnExportExcel: get('btnExportExcel'), // New Button
    btnLogout: get('btnLogout'),
    
    f_code: get('f_code'),
    f_name: get('f_name'),
    f_brand: get('f_brand'),
    f_sizes: get('f_sizes'),
    f_image: get('f_image'),
    f_datasheet: get('f_datasheet'),
    filtersContainer: get('filtersContainer'),

    catManagerList: get('catManagerList'),
    newCatName: get('newCatName'),
    btnAddCat: get('btnAddCat')
  };

  // --- HELPERS ---
  const normalizeCode = (s) => String(s || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  function setDirty(val) {
    isDirty = val;
    if(els.dirtyFlag) els.dirtyFlag.textContent = val ? "Yes (Unsaved)" : "No";
  }

  function showStatus(msg) {
    if(!els.statusMsg) return;
    els.statusMsg.textContent = msg;
    els.statusMsg.style.display = 'block';
    setTimeout(() => els.statusMsg.style.display = 'none', 3000);
  }

  // --- DATA LOADING ---
  function loadData() {
    try {
      const storedP = localStorage.getItem(STORAGE_PRODUCTS);
      const storedF = localStorage.getItem(STORAGE_FILTERS);

      if (storedP && storedF) {
        products = JSON.parse(storedP);
        filters = JSON.parse(storedF);
      } else {
        products = (window.GLOVES || []).map(p => ({...p})); 
        const baseF = window.FILTERS || {};
        filters = {
          categories: { ...(baseF.categories || {}) },
          productMap: { ...(baseF.productMap || {}) },
          featureCategories: (baseF.featureCategories || []).slice()
        };
      }
      
      // Ensure specific categories exist
      if (!filters.categories['Brand']) filters.categories['Brand'] = [];
      if (!filters.categories['Industry']) filters.categories['Industry'] = [];
      
      // Sync brands from products to categories
      products.forEach(p => {
        if(p.brand && !filters.categories['Brand'].includes(p.brand)) {
          filters.categories['Brand'].push(p.brand);
        }
      });
      filters.categories['Brand'].sort();

      initColumnOrder(); 

    } catch (err) {
      console.error(err);
      localStorage.removeItem(STORAGE_PRODUCTS);
      localStorage.removeItem(STORAGE_FILTERS);
    }
  }

  // --- COLUMN MANAGEMENT ---
  function initColumnOrder() {
    const savedOrder = localStorage.getItem(STORAGE_COL_ORDER);
    const standardCols = [
      { key: 'Code', label: 'Code', type: 'core' },
      { key: 'Name', label: 'Name', type: 'core' },
      { key: 'Brand', label: 'Brand', type: 'core' },
      { key: 'Sizes', label: 'Sizes', type: 'core' }
    ];
    
    const filterKeys = Object.keys(filters.categories).filter(k => k !== 'Brand').sort();
    const filterCols = filterKeys.map(k => ({ key: k, label: k, type: 'filter' }));

    // Merge standard + filter cols
    let allCols = [...standardCols, ...filterCols];

    if (savedOrder) {
      try {
        const savedKeys = JSON.parse(savedOrder);
        const ordered = [];
        savedKeys.forEach(k => {
          const found = allCols.find(c => c.key === k);
          if(found) ordered.push(found);
        });
        allCols.forEach(c => {
          if (!savedKeys.includes(c.key)) ordered.push(c);
        });
        columnOrder = ordered;
      } catch (e) {
        columnOrder = allCols;
      }
    } else {
      columnOrder = allCols;
    }
  }

  function saveColumnOrder() {
    const keys = columnOrder.map(c => c.key);
    localStorage.setItem(STORAGE_COL_ORDER, JSON.stringify(keys));
  }

  // --- UI: RENDER TABLE ---
  function renderTable() {
    if(!els.tableBody || !els.tableHeaderRow) return;

    const q = (els.searchBox.value || "").toLowerCase();
    els.tableBody.innerHTML = '';
    
    // Sort Rows
    products.sort((a,b) => (a.code||'').localeCompare(b.code||''));

    const filtered = products.filter(p => 
      (p.code||'').toLowerCase().includes(q) || 
      (p.name||'').toLowerCase().includes(q)
    );

    if(els.totalCount) els.totalCount.textContent = products.length;

    // --- RENDER HEADER ---
    let headerHTML = '';
    columnOrder.forEach((col, index) => {
      headerHTML += `<th class="draggable" draggable="true" data-index="${index}">${col.label}</th>`;
    });
    headerHTML += `<th class="col-actions" style="text-align:right;">Actions</th>`;
    els.tableHeaderRow.innerHTML = headerHTML;

    // Bind Drag Events
    const headers = els.tableHeaderRow.querySelectorAll('th.draggable');
    headers.forEach(th => {
      th.addEventListener('dragstart', handleDragStart);
      th.addEventListener('dragover', handleDragOver);
      th.addEventListener('drop', handleDrop);
      th.addEventListener('dragenter', handleDragEnter);
      th.addEventListener('dragleave', handleDragLeave);
    });

    // --- RENDER ROWS ---
    filtered.forEach(p => {
      const tr = document.createElement('tr');
      const norm = normalizeCode(p.code);
      const pm = filters.productMap[norm] || {};

      let rowHTML = '';

      columnOrder.forEach(col => {
        let val = '';
        if (col.type === 'core') {
          if(col.key === 'Code') val = p.code || '';
          else if(col.key === 'Name') val = p.name || '';
          else if(col.key === 'Brand') val = p.brand || '';
          else if(col.key === 'Sizes') val = p.sizes || '';
        } else {
          val = pm[col.key];
          // Fallback check for old keys if current key is empty (handle legacy data)
          if (!val && col.key === 'Cut Level') val = pm['Cut'] || pm['Cut Level']; 
          
          if (Array.isArray(val)) val = val.join(', ');
          if (!val) val = '';
        }

        const displayVal = val || '-';
        if(col.key === 'Code') {
            rowHTML += `<td style="font-weight:700; color:#0a4f86;">${displayVal}</td>`;
        } else {
            rowHTML += `<td><span class="cell-text" title="${val || ''}">${displayVal}</span></td>`;
        }
      });

      rowHTML += `
        <td class="col-actions">
          <div class="cell-actions">
            <button class="btn btn-white btn-edit" data-code="${p.code}" style="padding:4px 10px; font-size:12px;">Edit</button>
          </div>
        </td>
      `;

      tr.innerHTML = rowHTML;
      tr.addEventListener('dblclick', function() { openEditModal(p.code); });
      els.tableBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        openEditModal(btn.dataset.code);
      });
    });
  }

  // --- DRAG & DROP LOGIC ---
  let dragSrcIndex = null;

  function handleDragStart(e) {
    dragSrcIndex = this.getAttribute('data-index');
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
  }

  function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDragEnter(e) {
    this.classList.add('drag-over');
  }

  function handleDragLeave(e) {
    this.classList.remove('drag-over');
  }

  function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    
    const dragDestIndex = this.getAttribute('data-index');
    
    if (dragSrcIndex !== dragDestIndex) {
      const srcIdx = parseInt(dragSrcIndex, 10);
      const destIdx = parseInt(dragDestIndex, 10);
      
      const itemToMove = columnOrder[srcIdx];
      columnOrder.splice(srcIdx, 1);
      columnOrder.splice(destIdx, 0, itemToMove);

      saveColumnOrder();
      renderTable();
    }
    
    return false;
  }

  // --- MODAL LOGIC ---
  function openEditModal(codeRaw) {
    const norm = normalizeCode(codeRaw);
    const p = products.find(x => normalizeCode(x.code) === norm);
    if(!p) return;

    currentEditingCode = norm;
    
    if(els.f_code) els.f_code.value = p.code || "";
    if(els.f_name) els.f_name.value = p.name || "";
    if(els.f_sizes) els.f_sizes.value = p.sizes || "";
    if(els.f_image) els.f_image.value = p.image || "";
    if(els.f_datasheet) els.f_datasheet.value = p.datasheet || "";
    
    updateBrandSelect(p.brand);
    renderFilterChecks(norm);

    els.modalTitle.textContent = "Edit Product: " + p.code;
    els.productModal.classList.add('open');
    
    const firstTab = document.querySelector('.tab[data-tab="tab-core"]');
    if(firstTab) firstTab.click();
  }

  function updateBrandSelect(selectedBrand) {
    if(!els.f_brand) return;
    els.f_brand.innerHTML = '<option value="">-- Select --</option>';
    const brands = filters.categories['Brand'] || [];
    brands.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      if(b === selectedBrand) opt.selected = true;
      els.f_brand.appendChild(opt);
    });
  }

  function renderFilterChecks(productCodeNorm) {
    if(!els.filtersContainer) return;
    els.filtersContainer.innerHTML = '';
    const map = filters.productMap[productCodeNorm] || {};
    const cats = Object.keys(filters.categories).filter(c => c !== 'Brand').sort();

    cats.forEach(cat => {
      const group = document.createElement('div');
      
      const title = document.createElement('div');
      title.className = 'filter-group-title';
      title.textContent = cat;
      group.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'check-grid';

      const options = filters.categories[cat] || [];
      const selected = map[cat] || [];

      options.forEach(opt => {
        const label = document.createElement('label');
        label.className = 'check-label';
        
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = opt;
        chk.checked = selected.includes(opt);
        chk.dataset.category = cat; 

        label.appendChild(chk);
        label.appendChild(document.createTextNode(opt));
        grid.appendChild(label);
      });

      if(options.length === 0) grid.innerHTML = '<em style="font-size:12px; color:#999;">No options.</em>';

      group.appendChild(grid);
      els.filtersContainer.appendChild(group);
    });
  }

  function saveProductFromModal() {
    const oldNorm = currentEditingCode;
    const newCodeRaw = els.f_code.value.trim();
    const newNorm = normalizeCode(newCodeRaw);

    if(!newNorm) { alert("Product Code is required."); return; }

    if(newNorm !== oldNorm) {
      if(products.find(p => normalizeCode(p.code) === newNorm)) {
        alert("Product code already exists!");
        return;
      }
    }

    let p = products.find(x => normalizeCode(x.code) === oldNorm);
    if(!p) { p = {}; products.push(p); }

    p.code = newCodeRaw;
    p.name = els.f_name.value.trim();
    p.brand = els.f_brand.value;
    p.sizes = els.f_sizes.value.trim();
    p.image = els.f_image.value.trim();
    p.datasheet = els.f_datasheet.value.trim();

    const checks = els.filtersContainer.querySelectorAll('input[type="checkbox"]');
    const newMapEntry = {};
    if(p.brand) newMapEntry['Brand'] = [p.brand];

    checks.forEach(chk => {
      if(chk.checked) {
        const cat = chk.dataset.category;
        if(!newMapEntry[cat]) newMapEntry[cat] = [];
        newMapEntry[cat].push(chk.value);
      }
    });

    if(oldNorm && oldNorm !== newNorm) delete filters.productMap[oldNorm];
    filters.productMap[newNorm] = newMapEntry;

    saveToStorage();
    renderTable();
    closeModal();
    showStatus("Saved " + p.code);
  }

  function createNewProduct() {
    currentEditingCode = null; 
    els.f_code.value = "";
    els.f_name.value = "";
    els.f_sizes.value = "";
    els.f_image.value = "";
    els.f_datasheet.value = "";
    updateBrandSelect("");
    renderFilterChecks("NEW_TEMP_KEY"); 
    
    els.modalTitle.textContent = "New Product";
    els.productModal.classList.add('open');
    const t = document.querySelector('.tab[data-tab="tab-core"]');
    if(t) t.click();
  }

  function deleteProduct() {
    if(!currentEditingCode) return;
    if(!confirm("Delete this product?")) return;
    products = products.filter(p => normalizeCode(p.code) !== currentEditingCode);
    delete filters.productMap[currentEditingCode];
    saveToStorage();
    renderTable();
    closeModal();
    showStatus("Product deleted.");
  }

  function duplicateProduct() {
    if(!currentEditingCode) return;
    const p = products.find(x => normalizeCode(x.code) === currentEditingCode);
    if(!p) return;
    els.f_code.value = p.code + "-COPY";
    els.f_name.value = p.name + " (Copy)";
    currentEditingCode = null; 
    els.modalTitle.textContent = "Duplicate Product";
    showStatus("Mode: Copying. Change code and click Save.");
  }

  // --- MANAGER MODAL ---
  function openFilterManager() {
    renderManagerList();
    if(els.filterManagerModal) els.filterManagerModal.classList.add('open');
  }

  function renderManagerList() {
    if(!els.catManagerList) return;
    els.catManagerList.innerHTML = '';
    const cats = Object.keys(filters.categories).sort();
    
    cats.forEach(cat => {
      const div = document.createElement('div');
      div.style.cssText = "margin-bottom:16px; border:1px solid #eee; padding:10px; border-radius:8px;";
      
      const head = document.createElement('div');
      head.style.cssText = "display:flex; justify-content:space-between; font-weight:bold; margin-bottom:8px;";
      head.innerHTML = `<span>${cat}</span>`;
      
      const delBtn = document.createElement('button');
      delBtn.className = "btn btn-danger";
      delBtn.style.cssText = "padding:2px 8px; font-size:11px;";
      delBtn.textContent = "Delete Category";
      delBtn.onclick = () => deleteCategory(cat);
      if(cat === 'Brand' || cat === 'Industry') delBtn.disabled = true; 
      head.appendChild(delBtn);
      div.appendChild(head);

      const optContainer = document.createElement('div');
      optContainer.style.cssText = "display:flex; flex-wrap:wrap; gap:4px;";

      (filters.categories[cat] || []).forEach(opt => {
         const pill = document.createElement('span');
         pill.className = "badge";
         pill.style.cssText = "background:#eff6ff; color:#1e40af; border:1px solid #dbeafe;";
         pill.innerHTML = `${opt} <span style="cursor:pointer;margin-left:4px;color:red;" class="del-opt-btn" data-cat="${cat}" data-opt="${opt}">×</span>`;
         optContainer.appendChild(pill);
      });
      
      const addRow = document.createElement('div');
      addRow.style.cssText = "margin-top:8px; display:flex; gap:4px;";
      addRow.innerHTML = `
        <input placeholder="Add option..." class="add-opt-input" data-cat="${cat}" style="padding:4px; font-size:12px; border:1px solid #ccc; border-radius:4px;">
        <button class="btn btn-white add-opt-btn" data-cat="${cat}" style="padding:2px 8px;">+</button>
      `;

      div.appendChild(optContainer);
      div.appendChild(addRow);
      els.catManagerList.appendChild(div);
    });

    document.querySelectorAll('.add-opt-btn').forEach(b => {
      b.onclick = () => addOption(b.dataset.cat);
    });
    document.querySelectorAll('.del-opt-btn').forEach(b => {
      b.onclick = () => delOption(b.dataset.cat, b.dataset.opt);
    });
  }

  window.addOption = function(cat) {
    const inp = document.querySelector(`.add-opt-input[data-cat="${cat}"]`);
    if(!inp) return;
    const val = inp.value.trim();
    if(!val) return;
    if(!filters.categories[cat].includes(val)) {
      filters.categories[cat].push(val);
      filters.categories[cat].sort();
      saveToStorage();
      renderManagerList();
    }
  }

  window.delOption = function(cat, opt) {
    if(!confirm(`Remove option "${opt}"?`)) return;
    filters.categories[cat] = filters.categories[cat].filter(x => x !== opt);
    Object.keys(filters.productMap).forEach(k => {
      if(filters.productMap[k][cat]) {
        filters.productMap[k][cat] = filters.productMap[k][cat].filter(x => x !== opt);
      }
    });
    saveToStorage();
    renderManagerList();
  }

  function deleteCategory(cat) {
    if(!confirm(`Delete category "${cat}"?`)) return;
    delete filters.categories[cat];
    Object.keys(filters.productMap).forEach(k => delete filters.productMap[k][cat]);
    
    // Remove from featureCategories array
    if(filters.featureCategories && Array.isArray(filters.featureCategories)) {
      filters.featureCategories = filters.featureCategories.filter(c => c !== cat);
    }
    
    saveToStorage();
    renderManagerList();
    loadData(); 
    renderTable(); 
  }

  // --- SAVE & EXPORT ---
  function saveToStorage() {
    localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(products));
    localStorage.setItem(STORAGE_FILTERS, JSON.stringify(filters));
    setDirty(true);
  }

  function exportData() {
    // 1. Prepare clean products array
    const cleanProducts = products.map(p => {
        const norm = normalizeCode(p.code);
        const mapEntry = filters.productMap[norm] || {};
        
        // Helper: retrieve a single string value from the product map
        const getVal = (cat) => {
            const val = mapEntry[cat];
            if (Array.isArray(val) && val.length > 0) return val[0];
            return undefined; // Use undefined so strict key order ignores it if missing
        };

        // Helper: retrieve an array value
        const getArr = (cat) => {
            const val = mapEntry[cat];
            if (Array.isArray(val) && val.length > 0) return val;
            return undefined;
        };

        // --- STRICT ORDER OBJECT CONSTRUCTION ---
        // We build the object in this specific sequence so "Code" is always first, etc.
        const strictObj = {};

        // A. Core Identity
        if (p.code) strictObj.code = p.code;
        if (p.name) strictObj.name = p.name;
        if (p.brand) strictObj.brand = p.brand;
        if (p.sizes) strictObj.sizes = p.sizes;
        if (p.image) strictObj.image = p.image;
        if (p.datasheet) strictObj.datasheet = p.datasheet;

        // B. Primary Specs (Standard Categories)
        const gauge = getVal('Gauge');
        if (gauge) strictObj.gauge = gauge;

        const coating = getVal('Coating');
        if (coating) strictObj.coating = coating;
        
        const leather = getVal('Leather');
        if (leather) strictObj.leather = leather;

        const liner = getVal('Liner Material');
        if (liner) strictObj.liner = liner; // mapped to 'liner' prop for app.js

        const cut = getVal('Cut Level');
        if (cut) strictObj.cutLevel = cut;

        const style = getArr('Style');
        if (style) strictObj.style = style;
        
        const reqs = getArr('Requirements');
        if (reqs) strictObj.requirementsList = reqs;

        const inds = getArr('Industry');
        if (inds) strictObj.industries = inds;

        // C. Dynamic / Custom Categories
        const knownKeys = [
          'Gauge', 'Coating', 'Leather', 'Liner Material', 
          'Cut Level', 'Style', 'Requirements', 'Industry', 'Brand'
        ];
        
        Object.keys(mapEntry).sort().forEach(catKey => {
           if (!knownKeys.includes(catKey)) {
             const val = mapEntry[catKey];
             if (Array.isArray(val) && val.length > 0) {
                let propKey = catKey.replace(/\s+/g, '');
                propKey = propKey.charAt(0).toLowerCase() + propKey.slice(1);
                strictObj[propKey] = val.length === 1 ? val[0] : val;
             }
           }
        });

        return strictObj;
    });
    
    cleanProducts.sort((a, b) => (a.code || "").localeCompare(b.code || ""));

    // 2. Clean up Product Map
    const cleanProductMap = {};
    products.forEach(p => {
        const norm = normalizeCode(p.code);
        const entry = filters.productMap[norm];
        if (!entry) return;

        const cleanEntry = {};
        Object.keys(entry).forEach(cat => {
            if (Array.isArray(entry[cat]) && entry[cat].length > 0) {
                cleanEntry[cat] = entry[cat];
            }
        });
        
        if (Object.keys(cleanEntry).length > 0) {
            cleanProductMap[norm] = cleanEntry;
        }
    });
    
    // 3. Clean Categories (Sort keys and values)
    const sortedCategories = {};
    Object.keys(filters.categories).sort().forEach(key => {
        sortedCategories[key] = filters.categories[key].sort();
    });

    // 4. Clean and validate featureCategories
    const validFeatureCategories = (filters.featureCategories || []).filter(cat => 
      Object.prototype.hasOwnProperty.call(filters.categories, cat) && cat !== 'Brand' && cat !== 'Industry'
    );

    const cleanFilters = {
        categories: sortedCategories,
        productMap: cleanProductMap,
        featureCategories: validFeatureCategories
    };

    const fileContent = `// Auto-generated by Glove Admin on ${new Date().toISOString()}

window.GLOVES = 
${JSON.stringify(cleanProducts, null, 2)};

window.FILTERS = 
${JSON.stringify(cleanFilters, null, 2)};
`;
    
    // Trigger download
    const blob = new Blob([fileContent], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "data.js";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    setDirty(false);
  }

  // --- NEW EXCEL EXPORT ---
  function exportToExcel() {
    if (!products || products.length === 0) {
      alert("No data to export");
      return;
    }
    
    if (typeof XLSX === 'undefined') {
      alert("SheetJS library not loaded. Check internet connection or admin.html");
      return;
    }

    // 1. Prepare Product Data (Sheet 1)
    // We flatten core properties + attribute map into single objects
    const productRows = products.map(p => {
        const norm = normalizeCode(p.code);
        const mapEntry = filters.productMap[norm] || {};
        
        // Start with Core Fields
        const row = {
            "Product Code": p.code,
            "Name": p.name,
            "Brand": p.brand || "", // Explicitly use p.brand
            "Sizes": p.sizes,
            "Image Path": p.image,
            "Datasheet Path": p.datasheet
        };

        // Add attributes dynamically based on all available categories
        const catKeys = Object.keys(filters.categories).sort();
        
        catKeys.forEach(cat => {
            // SKIP Brand here so we don't overwrite p.brand with potentially missing map data
            if (cat === 'Brand') return;

            const val = mapEntry[cat];
            if (val && Array.isArray(val) && val.length > 0) {
               row[cat] = val.join(", "); // Join arrays with commas for Excel cells
            } else if (val && !Array.isArray(val)) {
               row[cat] = val;
            } else {
               row[cat] = ""; // Empty string for missing values
            }
        });

        return row;
    });

    // 2. Prepare Filters/Definitions Data (Sheet 2)
    const filterRows = [];
    Object.keys(filters.categories).sort().forEach(cat => {
        const options = filters.categories[cat];
        // Create an object where keys are the options themselves for visual layout?
        // OR simply: Category Name, Option 1, Option 2, etc.
        // User requested: Category Name top rows, available options below.
        
        // Let's make it vertical list per category? 
        // "Category Name" column, "Option" column
        // But user said: "category name as the top rows, and the available options listed below."
        // This implies a vertical column PER category.
        
        // We need to pivot.
        // Columns = Categories
        // Rows = Options (max length of longest category)
    });

    // Pivot logic for Sheet 2
    const cats = Object.keys(filters.categories).sort();
    const pivotedRows = [];
    
    // Find max depth
    let maxDepth = 0;
    cats.forEach(c => {
      if(filters.categories[c].length > maxDepth) maxDepth = filters.categories[c].length;
    });

    for(let i=0; i < maxDepth; i++) {
      const row = {};
      cats.forEach(c => {
        const opt = filters.categories[c][i];
        row[c] = opt || "";
      });
      pivotedRows.push(row);
    }

    // 3. Create Workbook & Sheets
    const wb = XLSX.utils.book_new();

    // Sheet 1: Products
    const wsProducts = XLSX.utils.json_to_sheet(productRows);
    XLSX.utils.book_append_sheet(wb, wsProducts, "All Products");

    // Sheet 2: Definitions (Pivoted)
    const wsFilters = XLSX.utils.json_to_sheet(pivotedRows);
    XLSX.utils.book_append_sheet(wb, wsFilters, "Filter Definitions");

    // 4. Download
    const filename = "Glove_Admin_Export_" + new Date().toISOString().slice(0,10) + ".xlsx";
    XLSX.writeFile(wb, filename);
  }

  // --- INIT ---
  function closeModal() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  }

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const target = document.getElementById(t.dataset.tab);
      if(target) target.classList.add('active');
    });
  });

  if(els.modalClose) els.modalClose.onclick = closeModal;
  if(els.filterManagerClose) els.filterManagerClose.onclick = closeModal;
  
  if(els.searchBox) els.searchBox.oninput = renderTable;
  if(els.btnSaveModal) els.btnSaveModal.onclick = saveProductFromModal;
  if(els.btnNewProduct) els.btnNewProduct.onclick = createNewProduct;
  if(els.btnDeleteProduct) els.btnDeleteProduct.onclick = deleteProduct;
  if(els.btnDuplicate) els.btnDuplicate.onclick = duplicateProduct;
  
  if(els.btnManageFilters) {
    els.btnManageFilters.onclick = function(e) {
      e.preventDefault();
      openFilterManager();
    };
  }

  if(els.btnAddCat) els.btnAddCat.onclick = () => {
    const name = els.newCatName.value.trim();
    if(!name) return;
    if(filters.categories[name]) return alert("Category exists");
    filters.categories[name] = [];
    if(!filters.featureCategories) filters.featureCategories = [];
    if(!filters.featureCategories.includes(name)) filters.featureCategories.push(name);
    saveToStorage();
    renderManagerList();
    loadData(); 
    renderTable(); 
    els.newCatName.value = '';
  };

  if(els.btnExport) els.btnExport.onclick = exportData;
  if(els.btnExportExcel) els.btnExportExcel.onclick = exportToExcel; // Bind new button

  if(els.btnLogout) els.btnLogout.onclick = () => {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  };

  function doLogin() {
    if(els.user.value === LOGIN_USER && els.pass.value === LOGIN_PASS) {
      sessionStorage.setItem(SESSION_KEY, "1");
      location.reload();
    } else {
      els.loginMsg.textContent = "Invalid credentials";
    }
  }

  if(els.loginBtn) els.loginBtn.onclick = doLogin;
  
  if(els.pass) {
    els.pass.addEventListener('keydown', function(e) {
      if(e.key === 'Enter') doLogin();
    });
  }

  if(sessionStorage.getItem(SESSION_KEY) === "1") {
    if(els.loginView) els.loginView.classList.add('hidden');
    if(els.appView) els.appView.classList.remove('hidden');
    loadData();
    renderTable();
  }

});