// page_manager.js
let isEditMode = false;

// [1] 표 렌더링 (조회 제한 해제)
// [수정] 표 렌더링 함수 (수정모드에서만 체크박스 노출)
window.renderDataTable = async function(searchKeyword = "") {
    // 1. 기초 정보 설정
    tableName = getTableNameFromUrl();
    const container = document.getElementById('dataManagerContainer');
    const countDisplay = document.getElementById('dataCountDisplay');
    
    if (!container || !tableName) return;

    // 2. 테이블 레이아웃 로드
    await loadTableConfig(); 
    
    // 3. Supabase 데이터 조회 (.limit(10000) 유지)
    let { data: rows, error } = await _supabase
        .from('data_rows')
        .select('*')
        .eq('project_key', tableName)
        .order('created_at', { ascending: false }) 
        .limit(10000); // 1000건 제한 해제 확인됨

    if (error) {
        console.error("데이터 로드 에러:", error);
        if (countDisplay) countDisplay.innerText = "데이터 로드 오류";
        return;
    }

    // 4. 필터링 및 카운트 처리
    let displayRows = rows || [];
    const totalCount = rows ? rows.length : 0; // 전체 가져온 개수 (1000개 이상 확인용)
    
    if (searchKeyword) {
        const searchTarget = document.getElementById('searchFieldSelect').value;
        displayRows = rows.filter(row => {
            if (searchTarget === 'all') {
                return Object.values(row).join(" ").toLowerCase().includes(searchKeyword.toLowerCase());
            } else {
                return String(row[searchTarget] || "").toLowerCase().includes(searchKeyword.toLowerCase());
            }
        });
    }

    // 5. 상단 건수 표시 업데이트
    if (countDisplay) {
        const currentCount = displayRows.length;
        countDisplay.innerText = searchKeyword 
            ? `검색 결과: ${currentCount}건 / 전체: ${totalCount}건`
            : `전체: ${totalCount}건`;
    }

    // 6. 테이블 렌더링
    const visibleCols = currentLayout.filter(col => col.isVisible);
    let html = `<table class="manager-table">
        <thead>
            <tr>
                ${isEditMode ? '<th style="width:50px;">선택</th>' : ''}
                ${visibleCols.map(col => `<th style="width:${col.width || 150}px;">${col.customName || col.defaultName}</th>`).join('')}
            </tr>
        </thead>
        <tbody>`;

    if (displayRows.length === 0) {
        html += `<tr><td colspan="${visibleCols.length + (isEditMode ? 1 : 0)}">데이터가 없습니다.</td></tr>`;
    } else {
        displayRows.forEach(row => {
            html += `<tr>
                ${isEditMode ? `<td><input type="checkbox" class="row-checkbox" data-id="${row.id}"></td>` : ''}
                ${visibleCols.map(col => {
                    const colKey = `col${col.id}_val`;
                    const val = row[colKey] || "";
                    return `<td>
                        ${isEditMode 
                            ? `<input type="text" value="${val}" style="width:95%; height:28px; border:1px solid #ddd; border-radius:4px; text-align:center;" onchange="updateCell('${row.id}', '${colKey}', this.value)">` 
                            : val}
                    </td>`;
                }).join('')}
            </tr>`;
        });
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
};

// [추가] 선택 삭제 기능
window.deleteSelectedRows = async function() {
    const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
    if (checkedBoxes.length === 0) return alert("삭제할 행을 선택해주세요.");

    if (!confirm(`정말로 ${checkedBoxes.length}개의 행을 삭제하시겠습니까?`)) return;

    const idsToDelete = Array.from(checkedBoxes).map(cb => cb.dataset.id);

    const { error } = await _supabase
        .from('data_rows')
        .delete()
        .in('id', idsToDelete);

    if (error) {
        alert("삭제 실패: " + error.message);
    } else {
        alert("성공적으로 삭제되었습니다.");
        await renderDataTable(); // 삭제 후 리로드
    }
};

// [추가] 전체 선택/취소
window.selectAllRows = function(isSelected) {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => cb.checked = isSelected);
};

// 셀 개별 수정 함수
window.updateCell = async function(rowId, colField, newVal) {
    const { error } = await _supabase
        .from('data_rows')
        .update({ [colField]: newVal })
        .eq('id', rowId);
    
    if (error) console.error("수정 실패:", error.message);
};

// [2] 대량 데이터 업로드 (배치 처리 추가)
// 엑셀 업로드 시 이 함수를 호출하도록 연결하세요.
window.uploadExcelData = async function(allData) {
    if (!tableName) tableName = getTableNameFromUrl();
    const BATCH_SIZE = 500; // 500건씩 끊어서 안전하게 업로드
    let successCount = 0;

    for (let i = 0; i < allData.length; i += BATCH_SIZE) {
        const batch = allData.slice(i, i + BATCH_SIZE).map(item => ({
            ...item,
            project_key: tableName // 프로젝트 키 자동 삽입
        }));

        const { error } = await _supabase.from('data_rows').insert(batch);

        if (error) {
            console.error(`${i}번째 데이터부터 업로드 실패:`, error.message);
            alert(`업로드 중 오류 발생: ${error.message}`);
            return;
        }
        successCount += batch.length;
        console.log(`${successCount}건 업로드 완료...`);
    }

    alert(`총 ${successCount}건의 데이터가 성공적으로 업로드되었습니다.`);
    renderDataTable();
};

// ... (기존 toggleEditMode, handleCellClick, openColumnManagementModal, saveColumnLayout은 동일하게 유지)

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

// 행 추가 함수 전체 코드
window.addNewRow = async function() {
    tableName = getTableNameFromUrl();
    if (!tableName) return alert("프로젝트를 먼저 선택해주세요.");

    // 1. Supabase에 빈 행을 먼저 생성합니다.
    // project_key만 넣고 나머지 colN_val은 빈 값으로 생성합니다.
    const { data, error } = await _supabase
        .from('data_rows')
        .insert([{ project_key: tableName }])
        .select();

    if (error) {
        console.error("행 추가 에러:", error.message);
        return alert("행을 추가하지 못했습니다: " + error.message);
    }

    // 2. 행 추가 성공 시, 사용자 경험을 위해 강제로 수정 모드를 켭니다.
    isEditMode = true;
    const btn = document.getElementById('editModeToggle');
    const bar = document.getElementById('editModeBar');
    if(btn) btn.innerText = "✅ 수정 완료";
    if(bar) bar.style.display = "flex";

    // 3. 표를 다시 그려서 방금 추가된 빈 행이 화면에 나타나게 합니다.
    await renderDataTable();

    // 4. (선택 사항) 추가된 행으로 화면 스크롤 이동
    console.log("새로운 행이 추가되었습니다 ID:", data[0].id);
};

// [추가] 검색 실행 함수
window.searchData = function() {
    const keyword = document.getElementById('tableSearchInput').value;
    renderDataTable(keyword);
};

// [추가] 초기화 함수
window.resetTableFilter = function() {
    document.getElementById('tableSearchInput').value = "";
    document.getElementById('searchFieldSelect').value = "all";
    renderDataTable();
};