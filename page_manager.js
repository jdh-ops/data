// page_manager.js
let isEditMode = false;

// 표 렌더링
window.renderDataTable = async function() {
    tableName = getTableNameFromUrl();
    const container = document.getElementById('dataManagerContainer');
    if (!container || !tableName) return;

    await loadTableConfig(); 
    const { data: rows, error } = await _supabase.from('data_rows').select('*').eq('project_key', tableName).order('created_at', { ascending: false });

    if (error) return console.error("데이터 로드 에러:", error);

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

// 수정 모드 토글
window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeToggle');
    const bar = document.getElementById('editModeBar');
    if(btn) btn.innerText = isEditMode ? "✅ 수정 완료" : "✏️ 수정하기";
    if(bar) bar.style.display = isEditMode ? "flex" : "none";
    renderDataTable();
};

// 셀 수정
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

// 열 설정 모달
window.openColumnManagementModal = function() {
    const layout = currentLayout;
    const modalHtml = `
        <div class="modal-header"><h5>⚙️ 열 설정</h5><button onclick="closeModal()">✕</button></div>
        <div class="modal-body">
            <div id="columnSortableList">
                ${layout.map((col, index) => `
                    <div class="list-group-item" data-id="${col.id}" style="display:flex; align-items:center; gap:10px; padding:10px; border:1px solid #ddd; margin-bottom:5px;">
                        <span class="drag-handle">☰</span>
                        <input type="checkbox" ${col.isVisible ? 'checked' : ''} onchange="currentLayout[${index}].isVisible = this.checked">
                        <input type="text" value="${col.customName || col.defaultName}" oninput="currentLayout[${index}].customName = this.value">
                        <input type="number" style="width:60px;" value="${col.width || 150}" oninput="currentLayout[${index}].width = parseInt(this.value)">
                    </div>
                `).join('')}
            </div>
        </div>
        <button class="btn-primary" onclick="saveColumnLayout()">설정 저장</button>
    `;
    if (typeof showModal === 'function') {
        showModal(modalHtml);
        new Sortable(document.getElementById('columnSortableList'), { handle: '.drag-handle', animation: 150 });
    }
};

window.saveColumnLayout = async function() {
    const items = document.querySelectorAll('#columnSortableList .list-group-item');
    const newLayout = Array.from(items).map(item => currentLayout.find(c => c.id === parseInt(item.dataset.id)));
    await _supabase.from('data_config').upsert({ project_key: tableName, columns_layout: newLayout }, { onConflict: 'project_key' });
    currentLayout = newLayout;
    renderDataTable();
    closeModal();
};