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

// 2. 설정 불러오기 및 초기화
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

// 3. 모달 제어 함수 (전역 연결)
window.updateCustomName = function(index, value) { currentLayout[index].customName = value; };
window.updateVisibility = function(index, isChecked) { currentLayout[index].isVisible = isChecked; };

// 4. 설정 저장
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
        .upsert({
            project_key: tableName,
            columns_layout: newLayout
        }, { onConflict: 'project_key' });

    if (!error) {
        alert("✅ 열 설정이 저장되었습니다.");
        currentLayout = newLayout;
        renderDataTable();
        if (typeof closeModal === 'function') closeModal();
    } else {
        alert("저장 실패: " + error.message);
    }
};

// 5. 열 설정 모달 열기
window.openColumnManagementModal = function() {
    const layout = currentLayout.length > 0 ? currentLayout : DEFAULT_LAYOUT;

    const modalHtml = `
        <div class="modal-header d-flex justify-content-between">
            <h5 class="modal-title">📊 데이터 열 관리</h5>
            <button type="button" class="btn-close" onclick="closeModal()" style="border:none; background:none;">✕</button>
        </div>
        <div class="modal-body">
            <p class="text-muted small">* 드래그하여 순서를 변경하거나 이름을 수정하세요.</p>
            <div id="columnSortableList" class="list-group">
                ${layout.map((col, index) => `
                    <div class="list-group-item d-flex align-items-center gap-2 p-2 border mb-1 rounded" data-id="${col.id}">
                        <span class="drag-handle" style="cursor:grab; padding: 0 5px;">☰</span>
                        <input type="checkbox" class="form-check-input" ${col.isVisible ? 'checked' : ''} 
                               onchange="updateVisibility(${index}, this.checked)">
                        <input type="text" class="form-control form-control-sm" 
                               value="${col.customName || col.defaultName}" 
                               placeholder="${col.defaultName}"
                               oninput="updateCustomName(${index}, this.value)">
                        ${col.fixed ? '<span class="badge bg-secondary" style="font-size:10px;">기본</span>' : ''}
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="modal-footer d-flex gap-2 mt-3">
            <button class="btn btn-primary w-100" onclick="saveColumnLayout()">설정 저장</button>
        </div>
    `;
    
    if (typeof showModal === 'function') showModal(modalHtml);

    new Sortable(document.getElementById('columnSortableList'), {
        handle: '.drag-handle',
        animation: 150
    });
};

// 6. 데이터 테이블 렌더링
window.renderDataTable = async function() {
    await loadTableConfig(); 
    
    const { data: rows, error } = await _supabase
        .from('data_rows')
        .select('*')
        .eq('project_key', tableName)
        .order('created_at', { ascending: false });

    const visibleCols = currentLayout.filter(col => col.isVisible);
    const container = document.getElementById('dataManagerContainer');
    if (!container) return;

    // 표 디자인: table-bordered(선 추가), text-center(가운데 정렬) 적용
    let html = `
        <table class="table table-bordered table-hover align-middle text-center mb-0" style="min-width: 1200px;">
            <thead class="table-light">
                <tr>
                    ${visibleCols.map(col => `<th class="py-3 px-2" style="background:#f8fafc;">${col.customName || col.defaultName}</th>`).join('')}
                    <th class="py-3 px-2" style="width: 150px; background:#f8fafc;">관리</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (!rows || rows.length === 0) {
        html += `<tr><td colspan="${visibleCols.length + 1}" class="py-5 text-muted">데이터가 없습니다.</td></tr>`;
    } else {
        rows.forEach(row => {
            html += `<tr>
                ${visibleCols.map(col => `
                    <td class="px-2" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${row[`col${col.id}_val`] || '-'}
                    </td>
                `).join('')}
                <td>
                    <div class="d-flex justify-content-center gap-1">
                        <button class="btn btn-sm btn-outline-primary" onclick="openDataEditModal('${row.id}')">수정</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteDataRow('${row.id}')">삭제</button>
                    </div>
                </td>
            </tr>`;
        });
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
};

window.openDataEditModal = async function(rowId) {
    const { data, error } = await _supabase.from('data_rows').select('*').eq('id', rowId).single();
    if (!data) return;

    const fieldsContainer = document.getElementById('dataEditFields');
    const visibleCols = currentLayout.filter(col => col.isVisible);
    
    fieldsContainer.innerHTML = visibleCols.map(col => `
        <div>
            <label class="form-label small fw-bold text-muted">${col.customName || col.defaultName}</label>
            <input type="text" class="form-control edit-input" data-col="col${col.id}_val" value="${data[`col${col.id}_val`] || ''}">
        </div>
    `).join('');

    const modal = document.getElementById('dataEditModal');
    modal.style.display = 'flex';

    document.getElementById('saveDataBtn').onclick = async () => {
        const inputs = fieldsContainer.querySelectorAll('.edit-input');
        const updateData = {};
        inputs.forEach(input => {
            updateData[input.getAttribute('data-id') || input.dataset.col] = input.value;
        });

        const { error: updateError } = await _supabase.from('data_rows').update(updateData).eq('id', rowId);
        if (!updateError) {
            alert("수정되었습니다.");
            closeDataEditModal();
            renderDataTable();
        }
    };
};

window.closeDataEditModal = () => { document.getElementById('dataEditModal').style.display = 'none'; };


// 7. 인라인 편집 및 삭제 기능
window.makeEditable = async function(td, rowId, colField) {
    if (td.querySelector('input')) return;
    const originalText = td.innerText === '-' ? '' : td.innerText;
    td.innerHTML = `<input type="text" class="form-control form-control-sm" value="${originalText}">`;
    const input = td.querySelector('input');
    input.focus();

    input.onblur = async () => {
        const newText = input.value;
        td.innerText = newText || '-';
        if (originalText !== newText) {
            const updateData = {};
            updateData[colField] = newText;
            const { error } = await _supabase.from('data_rows').update(updateData).eq('id', rowId);
            if (error) alert("수정 실패: " + error.message);
        }
    };
    input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
};

window.deleteDataRow = async function(rowId) {
    if (!confirm("정말 이 데이터를 삭제하시겠습니까?")) return;
    const { error } = await _supabase.from('data_rows').delete().eq('id', rowId);
    if (!error) renderDataTable();
};

// 8. 엑셀 업로드 처리
window.handleExcelUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (jsonData.length === 0) return alert("엑셀에 데이터가 없습니다.");

        const visibleCols = currentLayout.filter(c => c.isVisible || c.customName);
        const rowsToInsert = jsonData.map(row => {
            let dbRow = { project_key: tableName };
            visibleCols.forEach(col => {
                const excelHeader = col.customName || col.defaultName;
                if (row[excelHeader] !== undefined) {
                    dbRow[`col${col.id}_val`] = String(row[excelHeader]);
                }
            });
            return dbRow;
        });

        const { error } = await _supabase.from('data_rows').insert(rowsToInsert);
        if (!error) {
            alert(`✨ ${rowsToInsert.length}건 업로드 완료!`);
            renderDataTable();
        } else {
            alert("업로드 실패: " + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
};