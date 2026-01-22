// 1. 상수 정의 (기본 레이아웃 6개 + 나머지 14개)
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

// 3. 모달 제어 함수
function updateCustomName(index, value) {
    currentLayout[index].customName = value;
}

function updateVisibility(index, isChecked) {
    currentLayout[index].isVisible = isChecked;
}

// 4. 설정 저장
async function saveColumnLayout() {
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
        closeModal();
    } else {
        alert("저장 실패: " + error.message);
    }
}

// 5. 열 설정 모달 열기
function openColumnManagementModal() {
    // currentLayout이 비어있을 수 있으므로 다시 한번 체크
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
    
    showModal(modalHtml);

    new Sortable(document.getElementById('columnSortableList'), {
        handle: '.drag-handle',
        animation: 150
    });
}

// 6. 데이터 테이블 렌더링
async function renderDataTable() {
    await loadTableConfig(); 
    
    const { data: rows, error } = await _supabase
        .from('data_rows')
        .select('*')
        .eq('project_key', tableName)
        .order('created_at', { ascending: false });

    const visibleCols = currentLayout.filter(col => col.isVisible);
    const container = document.getElementById('dataManagerContainer');

    let html = `
        <table class="table table-hover align-middle shadow-sm" style="min-width: 1000px; background:white;">
            <thead class="table-light">
                <tr>
                    ${visibleCols.map(col => `<th class="py-3 px-3">${col.customName || col.defaultName}</th>`).join('')}
                    <th class="text-center">작업</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (!rows || rows.length === 0) {
        html += `<tr><td colspan="${visibleCols.length + 1}" class="text-center py-5 text-muted">데이터가 없습니다. 엑셀 업로드로 데이터를 추가해보세요.</td></tr>`;
    } else {
        rows.forEach(row => {
            html += `<tr>
                ${visibleCols.map(col => `
                    <td class="px-3" style="cursor:pointer;" onclick="makeEditable(this, '${row.id}', 'col${col.id}_val')">
                        ${row[`col${col.id}_val`] || '-'}
                    </td>
                `).join('')}
                <td class="text-center">
                    <button class="btn btn-sm text-danger" onclick="deleteRow('${row.id}')">삭제</button>
                </td>
            </tr>`;
        });
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// 7. 인라인 편집 기능 (추가됨)
async