// datamng.js
let isEditMode = false;
let rawData = []; // 차트용 데이터 저장소

// 1. 상수 정의 (기본 레이아웃 20개 세팅)
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

let currentLayout = [];

// 2. 설정 불러오기
async function loadTableConfig() {
    const { data, error } = await _supabase
        .from('data_config')
        .select('columns_layout')
        .eq('project_key', tableName)
        .maybeSingle();

    if (data && data.columns_layout) {
        currentLayout = data.columns_layout;
    } else {
        currentLayout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    }
}

// 3. 필터 관련 함수 (page2 전용)
window.filterTable = function() {
    const input = document.getElementById('tableSearchInput');
    if(!input) return;
    const filter = input.value.toUpperCase();
    const table = document.querySelector(".data-table");
    if (!table) return;
    const tr = table.getElementsByTagName("tr");

    for (let i = 1; i < tr.length; i++) {
        let display = false;
        const td = tr[i].getElementsByTagName("td");
        for (let j = 0; j < td.length; j++) {
            if (td[j] && td[j].innerText.toUpperCase().indexOf(filter) > -1) {
                display = true;
                break;
            }
        }
        tr[i].style.display = display ? "" : "none";
    }
};

window.resetTableFilter = function() {
    const input = document.getElementById('tableSearchInput');
    if (input) input.value = "";
    window.filterTable();
};

// 4. 표 렌더링 (page2 전용)
window.renderDataTable = async function() {
    await loadTableConfig(); 
    const { data: rows } = await _supabase.from('data_rows').select('*').eq('project_key', tableName).order('created_at', { ascending: false });

    const visibleCols = currentLayout.filter(col => col.isVisible);
    const container = document.getElementById('dataManagerContainer');
    if(!container) return; // 차트 페이지일 경우 중단

    let html = `<table class="data-table"><thead><tr>`;
    if (isEditMode) html += `<th style="width:40px;"></th>`;
    
    visibleCols.forEach(col => {
        const widthStyle = col.width ? `width:${col.width}px;` : '';
        html += `<th style="${widthStyle}">${col.customName || col.defaultName}</th>`;
    });
    html += `</tr></thead><tbody>`;

    rows.forEach(row => {
        html += `<tr>`;
        if (isEditMode) {
            html += `<td><input type="checkbox" class="row-check" data-id="${row.id}"></td>`;
        }
        visibleCols.forEach(col => {
            html += `<td onclick="handleCellClick(this, '${row.id}', 'col${col.id}_val')">${row[`col${col.id}_val`] || '-'}</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
};

// 5. 수정 모드 토글 (page2 전용)
window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeToggle');
    const editBar = document.getElementById('editModeBar');
    
    if (isEditMode) {
        btn.innerText = "✅ 수정 완료";
        btn.style.background = "var(--primary-color)";
        btn.style.color = "white";
        if(editBar) editBar.style.display = "flex";
    } else {
        btn.innerText = "✏️ 수정하기";
        btn.style.background = "#edf2f7";
        btn.style.color = "#333";
        if(editBar) editBar.style.display = "none";
    }
    renderDataTable(); 
};

// 6. 셀 클릭 핸들러 (page2 전용)
window.handleCellClick = function(td, rowId, colField) {
    if (!isEditMode) return; 
    if (td.querySelector('input')) return;

    const originalText = td.innerText === '-' ? '' : td.innerText;
    td.innerHTML = `<input type="text" style="width:100%; border:1px solid var(--primary-color); text-align:center; background:white; padding:5px; border-radius:4px;" value="${originalText}">`;
    const input = td.querySelector('input');
    input.focus();

    input.onblur = async () => {
        const newText = input.value;
        td.innerText = newText || '-';
        if (originalText !== newText) {
            const updateData = {};
            updateData[colField] = newText;
            const { error } = await _supabase.from('data_rows').update(updateData).eq('id', rowId);
            if (error) console.error("수정 실패:", error);
        }
    };
    input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
};

// 7. 열 설정 관련
window.updateCustomName = (index, value) => { currentLayout[index].customName = value; };
window.updateVisibility = (index, isChecked) => { currentLayout[index].isVisible = isChecked; };
window.updateColumnWidth = (index, value) => { currentLayout[index].width = parseInt(value); };

window.saveColumnLayout = async function() {
    const items = document.querySelectorAll('#columnSortableList .list-group-item');
    const newLayout = [];
    items.forEach(item => {
        const id = parseInt(item.getAttribute('data-id'));
        const found = currentLayout.find(c => c.id === id);
        if (found) newLayout.push(found);
    });

    const { error } = await _supabase
        .from('data_config')
        .upsert({ project_key: tableName, columns_layout: newLayout }, { onConflict: 'project_key' });

    if (!error) {
        alert("✅ 설정이 저장되었습니다.");
        currentLayout = newLayout;
        if(document.getElementById('dataManagerContainer')) renderDataTable();
        if (typeof closeModal === 'function') closeModal();
    }
};

// 8. 엑셀 업로드 관련
window.openExcelUploadModal = function() {
    const modal = document.getElementById('excelUploadModal');
    if(modal) modal.style.display = 'flex';
};

window.processExcelUpload = async function() {
    const fileInput = document.getElementById('excelFileInput');
    const file = fileInput.files[0];
    if (!file) return;
    
    const uploadMode = document.querySelector('input[name="uploadMode"]:checked').value;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        const visibleCols = currentLayout.filter(c => c.isVisible);
        const rowsToInsert = jsonData.map(row => {
            let dbRow = { project_key: tableName };
            visibleCols.forEach(col => {
                const header = col.customName || col.defaultName;
                if (row[header] !== undefined) dbRow[`col${col.id}_val`] = String(row[header]);
            });
            return dbRow;
        });

        if (uploadMode === 'overwrite') {
            await _supabase.from('data_rows').delete().eq('project_key', tableName);
        }
        await _supabase.from('data_rows').insert(rowsToInsert);
        alert("업로드 완료");
        location.reload();
    };
    reader.readAsArrayBuffer(file);
};

// 9. 차트 분석 페이지 전용 로직 (chart.html 전용)
window.initChartPage = async function() {
    const params = new URLSearchParams(window.location.search);
    const tName = params.get('table');
    if(!tName) return;

    const { data: config } = await _supabase.from('data_config').select('columns_layout').eq('project_key', tName).maybeSingle();
    const { data: rows } = await _supabase.from('data_rows').select('*').eq('project_key', tName);
    
    rawData = rows || [];
    const layout = config?.columns_layout || DEFAULT_LAYOUT;

    const xSelect = document.getElementById('presetXAxis');
    const ySelect = document.getElementById('presetYAxis');
    if(!xSelect || !ySelect) return;

    layout.filter(c => c.isVisible).forEach(col => {
        const opt = `<option value="col${col.id}_val">${col.customName || col.defaultName}</option>`;
        xSelect.innerHTML += opt;
        ySelect.innerHTML += opt;
    });
};

window.generateAnalysis = function() {
    const filterKeyword = document.getElementById('presetFilter').value.trim();
    const viewType = document.getElementById('presetViewType').value;
    const xAxis = document.getElementById('presetXAxis').value;

    let filteredData = rawData;
    if (filterKeyword) {
        filteredData = rawData.filter(row => 
            Object.values(row).some(val => String(val).includes(filterKeyword))
        );
    }

    const resultData = {};
    filteredData.forEach(item => {
        let key = item[xAxis] || '기타';
        // 날짜 처리 로직
        if (xAxis === 'monthly' || xAxis === 'col1_val') {
            const rawDate = String(item.col1_val || '');
            const match = rawDate.match(/(\d{4})[.-](\d{2})/);
            key = match ? `${match[1]}.${match[2]}` : '날짜미상';
        }
        resultData[key] = (resultData[key] || 0) + 1;
    });

    renderResult(resultData, viewType);
};

function renderResult(data, type) {
    const area = document.getElementById('analysisResultArea');
    if(!area) return;
    area.innerHTML = ''; 

    if (type === 'table') {
        let html = `<table class="data-table"><thead><tr><th>분류</th><th>수량</th></tr></thead><tbody>`;
        Object.entries(data).forEach(([k, v]) => {
            html += `<tr><td>${k}</td><td>${v.toLocaleString()}</td></tr>`;
        });
        html += `</tbody></table>`;
        area.innerHTML = html;
    } else {
        const canvas = document.createElement('canvas');
        area.appendChild(canvas);
        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: Object.keys(data),
                datasets: [{ label: '수량', data: Object.values(data), backgroundColor: 'rgba(52, 152, 219, 0.7)' }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}