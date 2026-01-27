// datamng.js
let isEditMode = false;

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

// 3. 필터 관련 함수
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

// 4. 표 렌더링 (관리 열 삭제됨)
window.renderDataTable = async function() {
    await loadTableConfig(); 
    const { data: rows } = await _supabase.from('data_rows').select('*').eq('project_key', tableName).order('created_at', { ascending: false });

    const visibleCols = currentLayout.filter(col => col.isVisible);
    const container = document.getElementById('dataManagerContainer');

    let html = `<table class="data-table"><thead><tr>`;
    // 수정 모드일 때만 맨 앞에 체크박스 열 추가
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

window.selectAllRows = function(status) {
    document.querySelectorAll('.row-check').forEach(chk => chk.checked = status);
};

// [1] 선택 삭제 기능
window.deleteSelectedRows = async function() {
    const selectedIds = Array.from(document.querySelectorAll('.row-check:checked')).map(chk => chk.dataset.id);
    if (selectedIds.length === 0) return alert("삭제할 행을 선택해주세요.");
    if (!confirm(`${selectedIds.length}개의 데이터를 삭제하시겠습니까?`)) return;

    const { error } = await _supabase.from('data_rows').delete().in('id', selectedIds);
    if (!error) renderDataTable();
};

// 5. 수정 모드 토글 (버튼 텍스트 및 스타일 제어)
window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeToggle');
    const editBar = document.getElementById('editModeBar');
    
    if (isEditMode) {
        btn.innerText = "✅ 수정 완료";
        btn.style.background = "var(--primary-color)";
        btn.style.color = "white";
        editBar.style.display = "flex";
    } else {
        btn.innerText = "✏️ 수정하기";
        btn.style.background = "#edf2f7";
        btn.style.color = "#333";
        editBar.style.display = "none";
    }
    renderDataTable(); // 체크박스 표시를 위해 재렌더링
};

// 6. 셀 클릭 핸들러 (수정 모드일 때만 활성화)
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
        renderDataTable();
        if (typeof closeModal === 'function') closeModal();
    }
};

window.openColumnManagementModal = function() {
    const layout = currentLayout.length > 0 ? currentLayout : DEFAULT_LAYOUT;
    const modalHtml = `
        <div class="modal-header d-flex justify-content-between" style="padding: 15px; border-bottom: 1px solid #eee;">
            <h5 class="modal-title">📊 열 관리 및 너비 설정</h5>
            <button type="button" onclick="closeModal()" style="border:none; background:none; cursor:pointer; font-size:20px;">✕</button>
        </div>
        <div class="modal-body" style="padding: 15px; max-height: 400px; overflow-y: auto;">
            <div id="columnSortableList" class="list-group">
                ${layout.map((col, index) => `
                    <div class="list-group-item" data-id="${col.id}" style="display:flex; align-items:center; gap:10px; margin-bottom:8px; border:1px solid #ddd; padding:10px; border-radius:6px; background:#fff;">
                        <span class="drag-handle" style="cursor:grab; color:#aaa;">☰</span>
                        <input type="checkbox" ${col.isVisible ? 'checked' : ''} onchange="updateVisibility(${index}, this.checked)">
                        <input type="text" class="form-control" style="flex:2;" value="${col.customName || col.defaultName}" oninput="updateCustomName(${index}, this.value)">
                        <div style="flex:1; display:flex; align-items:center; gap:5px;">
                            <input type="number" class="form-control" style="width:60px;" value="${col.width || 150}" oninput="updateColumnWidth(${index}, this.value)">
                            <span style="font-size:11px; color:#999;">px</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="modal-footer" style="padding: 15px; border-top: 1px solid #eee; background: #f8fafc;">
            <button class="btn-primary" style="width:100%; padding:12px;" onclick="saveColumnLayout()">설정 저장</button>
        </div>
    `;
    if (typeof showModal === 'function') showModal(modalHtml);
    new Sortable(document.getElementById('columnSortableList'), { handle: '.drag-handle', animation: 150 });
};

// 너비 데이터 업데이트 함수
window.updateColumnWidth = (index, value) => { currentLayout[index].width = parseInt(value); };

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

        const { error } = await _supabase.from('data_rows').insert(rowsToInsert);
        if (!error) {
            alert(`✅ ${rowsToInsert.length}건의 데이터가 업로드되었습니다.`);
            renderDataTable();
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
};

// [1] 빈 행 추가 기능
window.addNewRow = async function() {
    // 1. 새 행에 들어갈 기본 데이터 객체 생성
    // 모든 컬럼(col1~col20)을 빈 값으로 초기화하여 삽입합니다.
    const newRow = {
        project_key: tableName,
        created_at: new Date().toISOString()
    };

    // 2. Supabase DB에 행 삽입
    const { data, error } = await _supabase
        .from('data_rows')
        .insert([newRow])
        .select(); // 삽입된 데이터를 다시 가져옴

    if (error) {
        console.error("행 추가 실패:", error);
        alert("행을 추가하지 못했습니다: " + error.message);
    } else {
        // 3. 성공 시 표를 다시 그려서 새 행이 보이게 함
        await renderDataTable();
        
        // 4. (선택사항) 방금 추가된 행의 첫 번째 셀로 포커스 이동 시각화
        console.log("새 행 추가 완료:", data);
    }
};