// [1] 전역 변수 설정 (config.js의 window.tableName과 연동)
let tableName = typeof window.tableName !== 'undefined' ? window.tableName : ""; 
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

// [2] 공통 함수: URL에서 프로젝트 이름 추출
function getTableNameFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('table') || "";
}

// [3] 공통 함수: 테이블 설정 불러오기
// datamng.js 상단 수정
async function loadTableConfig() {
    // tableName이 비어있으면 강제로 다시 읽어오도록 보강
    if (!tableName || tableName === "") {
        tableName = getTableNameFromUrl();
    }
    
    if (!tableName) {
        console.error("Critical: tableName을 찾을 수 없습니다. URL을 확인하세요.");
        return;
    }

    const { data } = await _supabase.from('data_config')
        .select('columns_layout')
        .eq('project_key', tableName)
        .maybeSingle();

    currentLayout = data?.columns_layout || JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
}

// --- [page2.html] 전용: 표 렌더링 ---
window.renderDataTable = async function() {
    if (!tableName) tableName = getTableNameFromUrl();
    const container = document.getElementById('dataManagerContainer');
    if (!container) return; // 요소가 없으면(차트 페이지면) 중단

    await loadTableConfig(); 
    const { data: rows, error } = await _supabase
        .from('data_rows')
        .select('*')
        .eq('project_key', tableName)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("데이터 로드 실패:", error.message);
        return;
    }

    const visibleCols = currentLayout.filter(col => col.isVisible);
    let html = `<table class="data-table"><thead><tr>`;
    if (isEditMode) html += `<th style="width:40px;"></th>`;
    
    visibleCols.forEach(col => {
        html += `<th style="${col.width ? `width:${col.width}px;` : ''}">${col.customName || col.defaultName}</th>`;
    });
    html += `</tr></thead><tbody>`;

    if (!rows || rows.length === 0) {
        html += `<tr><td colspan="${visibleCols.length + (isEditMode ? 1 : 0)}">데이터가 없습니다.</td></tr>`;
    } else {
        rows.forEach(row => {
            html += `<tr>`;
            if (isEditMode) html += `<td><input type="checkbox" class="row-check" data-id="${row.id}"></td>`;
            visibleCols.forEach(col => {
                html += `<td onclick="handleCellClick(this, '${row.id}', 'col${col.id}_val')">${row[`col${col.id}_val`] || '-'}</td>`;
            });
            html += `</tr>`;
        });
    }
    container.innerHTML = html + `</tbody></table>`;
};

// --- [chart.html] 전용: 분석 초기화 및 리포트 ---
window.initChartPage = async function() {
    tableName = getTableNameFromUrl();
    if (!tableName) return false;

    const [configRes, dataRes] = await Promise.all([
        _supabase.from('data_config').select('columns_layout').eq('project_key', tableName).maybeSingle(),
        _supabase.from('data_rows').select('*').eq('project_key', tableName)
    ]);

    currentLayout = configRes.data?.columns_layout || JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    rawData = dataRes.data || [];
    return true;
};

window.processAndRender = function(config, type, targetId) {
    let filteredData = rawData;
    if (config.filter) {
        filteredData = rawData.filter(r => Object.values(r).some(v => String(v).includes(config.filter)));
    }

    const result = {};
    const yCategories = new Set();

    filteredData.forEach(item => {
        let xKey = item[config.x] || '미지정';
        if (config.x === 'monthly' || config.x === 'col1_val') {
            const m = String(item.col1_val || '').match(/(\d{4})[.-](\d{2})/);
            xKey = m ? `${m[1]}.${m[2]}` : '날짜미상';
        }

        let yKey = (type === 'table' && config.yBase !== 'total') ? (item[config.yBase] || '기타') : '수량';
        yCategories.add(yKey);

        if (!result[xKey]) result[xKey] = {};
        result[xKey][yKey] = (result[xKey][yKey] || 0) + 1;
    });

    const target = document.getElementById(targetId);
    const xLabels = Object.keys(result).sort();
    const yLabels = Array.from(yCategories);

    if (type === 'table') {
        let html = `<table class="data-table"><thead><tr><th>분류(${config.x})</th>`;
        yLabels.forEach(y => html += `<th>${y}</th>`);
        html += `</tr></thead><tbody>`;
        xLabels.forEach(x => {
            html += `<tr><td>${x}</td>`;
            yLabels.forEach(y => html += `<td>${result[x][y] || 0}</td>`);
            html += `</tr>`;
        });
        target.innerHTML = html + `</tbody></table>`;
    } else {
        const canvas = document.createElement('canvas');
        target.appendChild(canvas);
        const datasets = yLabels.map((y, i) => ({
            label: y,
            data: xLabels.map(x => result[x][y] || 0),
            backgroundColor: `hsla(${i * 60}, 70%, 60%, 0.8)`
        }));
        new Chart(canvas, {
            type: 'bar',
            data: { labels: xLabels, datasets: datasets },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
};

// --- [page2.html] 기타 기능 (수정, 삭제, 엑셀 등) ---
window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeToggle');
    const bar = document.getElementById('editModeBar');
    if(btn) btn.innerText = isEditMode ? "✅ 수정 완료" : "✏️ 수정하기";
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

window.addNewRow = async () => { 
    if (!tableName) tableName = getTableNameFromUrl();
    await _supabase.from('data_rows').insert([{ project_key: tableName }]); 
    renderDataTable(); 
};

window.deleteSelectedRows = async () => {
    const ids = Array.from(document.querySelectorAll('.row-check:checked')).map(c => c.dataset.id);
    if (ids.length && confirm("삭제하시겠습니까?")) {
        await _supabase.from('data_rows').delete().in('id', ids);
        renderDataTable();
    }
};

window.filterTable = () => {
    const val = document.getElementById('tableSearchInput').value.toUpperCase();
    document.querySelectorAll(".data-table tbody tr").forEach(tr => {
        tr.style.display = Array.from(tr.cells).some(td => td.innerText.toUpperCase().includes(val)) ? "" : "none";
    });
};

window.resetTableFilter = () => { 
    const input = document.getElementById('tableSearchInput');
    if(input) input.value = ""; 
    window.filterTable(); 
};

// 엑셀 업로드 관련
let excelFileToUpload = null;
window.openExcelUploadModal = () => { 
    const modal = document.getElementById('excelUploadModal');
    if(modal) modal.style.display = 'flex'; 
};
window.handleExcelSelect = (e) => { 
    excelFileToUpload = e.target.files[0];
    const nameLabel = document.getElementById('excelFileName');
    const btn = document.getElementById('startExcelUploadBtn');
    if(nameLabel) nameLabel.innerText = excelFileToUpload ? `선택됨: ${excelFileToUpload.name}` : "";
    if(btn) btn.disabled = !excelFileToUpload;
};
window.processExcelUpload = async function() {
    if(!excelFileToUpload) return;
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
        alert("업로드 완료"); 
        location.reload();
    };
    reader.readAsArrayBuffer(excelFileToUpload);
};

window.saveColumnLayout = async function() {
    await _supabase.from('data_config').upsert({ project_key: tableName, columns_layout: currentLayout }, { onConflict: 'project_key' });
    renderDataTable(); 
    if (typeof closeModal === 'function') closeModal();
};