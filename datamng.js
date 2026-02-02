// datamng.js
let isEditMode = false;
let rawData = [];
let currentLayout = [];

const DEFAULT_LAYOUT = [
    { id: 1, defaultName: "날짜", customName: "날짜", isVisible: true, fixed: true },
    { id: 2, defaultName: "URL", customName: "URL", isVisible: true, fixed: true },
    { id: 3, defaultName: "상품명", customName: "상품명", isVisible: true, fixed: true },
    { id: 4, defaultName: "가격", customName: "가격", isVisible: true, fixed: true },
    { id: 5, defaultName: "상태", customName: "상태", isVisible: true, fixed: true },
    { id: 6, defaultName: "태그", customName: "태그", isVisible: true, fixed: true }
];
for (let i = 7; i <= 20; i++) {
    DEFAULT_LAYOUT.push({ id: i, defaultName: `열${i}`, customName: "", isVisible: false, fixed: false });
}

async function loadTableConfig() {
    const { data } = await _supabase.from('data_config').select('columns_layout').eq('project_key', tableName).maybeSingle();
    currentLayout = data?.columns_layout || JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
}

// 데이터 관리 표 관련
window.renderDataTable = async function() {
    await loadTableConfig(); 
    const { data: rows } = await _supabase.from('data_rows').select('*').eq('project_key', tableName).order('created_at', { ascending: false });
    const visibleCols = currentLayout.filter(col => col.isVisible);
    const container = document.getElementById('dataManagerContainer');
    if(!container) return;

    let html = `<table class="data-table"><thead><tr>`;
    if (isEditMode) html += `<th style="width:40px;"></th>`;
    visibleCols.forEach(col => {
        html += `<th style="${col.width ? `width:${col.width}px;` : ''}">${col.customName || col.defaultName}</th>`;
    });
    html += `</tr></thead><tbody>`;

    rows.forEach(row => {
        html += `<tr>`;
        if (isEditMode) html += `<td><input type="checkbox" class="row-check" data-id="${row.id}"></td>`;
        visibleCols.forEach(col => {
            html += `<td onclick="handleCellClick(this, '${row.id}', 'col${col.id}_val')">${row[`col${col.id}_val`] || '-'}</td>`;
        });
        html += `</tr>`;
    });
    container.innerHTML = html + `</tbody></table>`;
};

window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeToggle');
    const bar = document.getElementById('editModeBar');
    btn.innerText = isEditMode ? "✅ 수정 완료" : "✏️ 수정하기";
    btn.style.background = isEditMode ? "var(--primary-color)" : "#edf2f7";
    btn.style.color = isEditMode ? "white" : "#333";
    if(bar) bar.style.display = isEditMode ? "flex" : "none";
    renderDataTable();
};

window.handleCellClick = function(td, rowId, colField) {
    if (!isEditMode || td.querySelector('input')) return;
    const original = td.innerText === '-' ? '' : td.innerText;
    td.innerHTML = `<input type="text" class="form-control" style="text-align:center;" value="${original}">`;
    const input = td.querySelector('input');
    input.focus();
    input.onblur = async () => {
        const val = input.value;
        td.innerText = val || '-';
        if (original !== val) await _supabase.from('data_rows').update({ [colField]: val }).eq('id', rowId);
    };
    input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
};

// 엑셀 업로드 관련
let excelFileToUpload = null;
window.openExcelUploadModal = () => { document.getElementById('excelUploadModal').style.display = 'flex'; };
window.handleExcelSelect = (e) => { 
    excelFileToUpload = e.target.files[0];
    document.getElementById('excelFileName').innerText = excelFileToUpload ? `선택됨: ${excelFileToUpload.name}` : "";
    document.getElementById('startExcelUploadBtn').disabled = !excelFileToUpload;
};
window.processExcelUpload = async function() {
    const mode = document.querySelector('input[name="uploadMode"]:checked').value;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const rowsToInsert = jsonData.map(row => {
            let dbRow = { project_key: tableName };
            currentLayout.filter(c => c.isVisible).forEach(col => {
                const h = col.customName || col.defaultName;
                if (row[h] !== undefined) dbRow[`col${col.id}_val`] = String(row[h]);
            });
            return dbRow;
        });
        if (mode === 'overwrite') await _supabase.from('data_rows').delete().eq('project_key', tableName);
        await _supabase.from('data_rows').insert(rowsToInsert);
        alert("업로드 완료"); location.reload();
    };
    reader.readAsArrayBuffer(excelFileToUpload);
};

// 차트 분석 전용
window.initChartPage = async function() {
    const params = new URLSearchParams(window.location.search);
    const tName = params.get('table');
    const { data: config } = await _supabase.from('data_config').select('columns_layout').eq('project_key', tName).maybeSingle();
    const { data: rows } = await _supabase.from('data_rows').select('*').eq('project_key', tName);
    rawData = rows || [];
    const layout = config?.columns_layout || DEFAULT_LAYOUT;
    const xSelect = document.getElementById('presetXAxis');
    const ySelect = document.getElementById('presetYAxis');
    layout.filter(c => c.isVisible).forEach(col => {
        const opt = `<option value="col${col.id}_val">${col.customName || col.defaultName}</option>`;
        xSelect.innerHTML += opt; ySelect.innerHTML += opt;
    });
};

window.generateAnalysis = function() {
    const filter = document.getElementById('presetFilter').value.trim();
    const type = document.getElementById('presetViewType').value;
    const xAxis = document.getElementById('presetXAxis').value;
    let filtered = rawData.filter(r => Object.values(r).some(v => String(v).includes(filter)));
    const res = {};
    filtered.forEach(item => {
        let key = item[xAxis] || '기타';
        if (xAxis === 'monthly' || xAxis === 'col1_val') {
            const m = String(item.col1_val || '').match(/(\d{4})[.-](\d{2})/);
            key = m ? `${m[1]}.${m[2]}` : '날짜미상';
        }
        res[key] = (res[key] || 0) + 1;
    });
    renderResult(res, type);
};

function renderResult(data, type) {
    const area = document.getElementById('analysisResultArea');
    area.innerHTML = '';
    if (type === 'table') {
        let html = `<table class="data-table"><thead><tr><th>분류</th><th>수량</th></tr></thead><tbody>`;
        Object.entries(data).forEach(([k, v]) => { html += `<tr><td>${k}</td><td>${v}</td></tr>`; });
        area.innerHTML = html + `</tbody></table>`;
    } else {
        const canvas = document.createElement('canvas'); area.appendChild(canvas);
        new Chart(canvas, { type: 'bar', data: { labels: Object.keys(data), datasets: [{ label: '수량', data: Object.values(data), backgroundColor: '#3498db' }] } });
    }
}

// 기타 기능 (선택삭제, 열설정 등 기존 로직 포함)
window.selectAllRows = (s) => document.querySelectorAll('.row-check').forEach(c => c.checked = s);
window.deleteSelectedRows = async () => {
    const ids = Array.from(document.querySelectorAll('.row-check:checked')).map(c => c.dataset.id);
    if (ids.length && confirm("삭제하시겠습니까?")) {
        await _supabase.from('data_rows').delete().in('id', ids);
        renderDataTable();
    }
};
window.openColumnManagementModal = function() {
    const modalHtml = `
        <div class="modal-header"><h5>⚙️ 열 설정</h5><button onclick="closeModal()">✕</button></div>
        <div id="columnSortableList" style="max-height:300px; overflow-y:auto;">
            ${currentLayout.map((c, i) => `
                <div class="list-group-item" data-id="${c.id}" style="display:flex; gap:10px; margin-bottom:5px; border-bottom:1px solid #eee; padding:5px;">
                    <input type="checkbox" ${c.isVisible ? 'checked' : ''} onchange="currentLayout[${i}].isVisible=this.checked">
                    <input type="text" value="${c.customName || c.defaultName}" oninput="currentLayout[${i}].customName=this.value" style="flex:1;">
                    <input type="number" value="${c.width || 150}" oninput="currentLayout[${i}].width=parseInt(this.value)" style="width:60px;">
                </div>`).join('')}
        </div>
        <button class="btn-primary" onclick="saveColumnLayout()" style="width:100%; margin-top:10px;">저장</button>`;
    showModal(modalHtml);
    new Sortable(document.getElementById('columnSortableList'), { animation: 150 });
};
window.saveColumnLayout = async function() {
    await _supabase.from('data_config').upsert({ project_key: tableName, columns_layout: currentLayout }, { onConflict: 'project_key' });
    renderDataTable(); closeModal();
};
window.addNewRow = async () => { 
    await _supabase.from('data_rows').insert([{ project_key: tableName }]); 
    renderDataTable(); 
};
window.filterTable = () => {
    const val = document.getElementById('tableSearchInput').value.toUpperCase();
    document.querySelectorAll(".data-table tbody tr").forEach(tr => {
        tr.style.display = Array.from(tr.cells).some(td => td.innerText.toUpperCase().includes(val)) ? "" : "none";
    });
};
window.resetTableFilter = () => { document.getElementById('tableSearchInput').value = ""; window.filterTable(); };