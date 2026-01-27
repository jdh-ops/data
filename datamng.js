// datamng.js
let isEditMode = false;

// 1. 상수 정의
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

// 3. 필터 관련 함수 (누락된 부분 추가)
window.filterTable = function() {
    const input = document.getElementById('tableSearchInput');
    const filter = input.value.toUpperCase();
    const table = document.querySelector(".data-table");
    if (!table) return;
    const tr = table.getElementsByTagName("tr");

    for (let i = 1; i < tr.length; i++) {
        let display = false;
        const td = tr[i].getElementsByTagName("td");
        for (let j = 0; j < td.length; j++) {
            if (td[j] && td[j].innerHTML.toUpperCase().indexOf(filter) > -1) {
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

// 4. 표 렌더링
window.renderDataTable = async function() {
    await loadTableConfig(); 
    const { data: rows, error } = await _supabase
        .from('data_rows')
        .select('*')
        .eq('project_key', tableName)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("데이터 로드 에러:", error);
        return;
    }

    const visibleCols = currentLayout.filter(col => col.isVisible);
    const container = document.getElementById('dataManagerContainer');
    if (!container) return;

    let html = `<table class="data-table"><thead><tr>`;
    visibleCols.forEach(col => {
        html += `<th>${col.customName || col.defaultName}</th>`;
    });
    // 수정 모드일 때만 삭제 버튼 등을 표시하고 싶다면 분기 처리가 필요하지만,
    // 일단 요청하신 대로 '관리' 열 자체는 삭제한 상태로 둡니다.
    html += `</tr></thead><tbody>`;

    if (!rows || rows.length === 0) {
        html += `<tr><td colspan="${visibleCols.length}" class="py-5 text-muted">데이터가 없습니다.</td></tr>`;
    } else {
        rows.forEach(row => {
            html += `<tr>`;
            visibleCols.forEach(col => {
                html += `
                    <td onclick="handleCellClick(this, '${row.id}', 'col${col.id}_val')">
                        ${row[`col${col.id}_val`] || '-'}
                    </td>`;
            });
            html += `</tr>`;
        });
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
};

// 5. 수정 모드 토글
window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeToggle');
    const container = document.getElementById('dataManagerContainer');

    if (isEditMode) {
        btn.innerText = "✅ 수정 완료";
        btn.style.background = "var(--primary-color)";
        btn.style.color = "white";
        container.classList.add('edit-mode-active');
    } else {
        btn.innerText = "✏️ 수정하기";
        btn.style.background = "#edf2f7";
        btn.style.color = "#333";
        container.classList.remove('edit-mode-active');
        renderDataTable(); 
    }
};

// 6. 셀 클릭 핸들러
window.handleCellClick = function(td, rowId, colField) {
    if (!isEditMode) return; 
    if (td.querySelector('input')) return;

    const originalText = td.innerText === '-' ? '' : td.innerText;
    td.innerHTML = `<input type="text" style="width:100%; border:none; text-align:center; background:transparent;" value="${originalText}">`;
    const input = td.querySelector('input');
    input.focus();

    input.onblur = async () => {
        const newText = input.value;
        td.innerText = newText || '-';
        if (originalText !== newText) {
            const updateData = {};
            updateData[colField] = newText;
            await _supabase.from('data_rows').update(updateData).eq('id', rowId);
        }
    };
    input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
};

// 7. 열 설정 관련 (window 객체 연결 유지)
window.updateCustomName = (index, value) => { currentLayout[index].customName = value; };
window.updateVisibility = (index, isChecked) => { currentLayout[index].isVisible = isChecked; };

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
        alert("✅ 설정 저장 완료");
        currentLayout = newLayout;
        renderDataTable();
        if (typeof closeModal === 'function') closeModal();
    }
};

window.openColumnManagementModal = function() {
    const layout = currentLayout.length > 0 ? currentLayout : DEFAULT_LAYOUT;
    const modalHtml = `
        <div class="modal-header d-flex justify-content-between">
            <h5 class="modal-title">📊 열 관리</h5>
            <button type="button" onclick="closeModal()" style="border:none; background:none;">✕</button>
        </div>
        <div class="modal-body">
            <div id="columnSortableList" class="list-group">
                ${layout.map((col, index) => `
                    <div class="list-group-item d-flex align-items-center gap-2 p-2 border mb-1 rounded" data-id="${col.id}">
                        <span class="drag-handle" style="cursor:grab; padding: 0 5px;">☰</span>
                        <input type="checkbox" ${col.isVisible ? 'checked' : ''} onchange="updateVisibility(${index}, this.checked)">
                        <input type="text" class="form-control form-control-sm" value="${col.customName || col.defaultName}" oninput="updateCustomName(${index}, this.value)">
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="modal-footer mt-3">
            <button class="btn-primary w-100" onclick="saveColumnLayout()">설정 저장</button>
        </div>
    `;
    if (typeof showModal === 'function') showModal(modalHtml);
    new Sortable(document.getElementById('columnSortableList'), { handle: '.drag-handle', animation: 150 });
};

// 8. 엑셀 업로드
window.handleExcelUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const visibleCols = currentLayout.filter(c => c.isVisible || c.customName);
        const rowsToInsert = jsonData.map(row => {
            let dbRow = { project_key: tableName };
            visibleCols.forEach(col => {
                const header = col.customName || col.defaultName;
                if (row[header] !== undefined) dbRow[`col${col.id}_val`] = String(row[header]);
            });
            return dbRow;
        });
        await _supabase.from('data_rows').insert(rowsToInsert);
        renderDataTable();
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
};