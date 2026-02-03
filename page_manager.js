// [1] 초기 전역 변수 설정 (중복 제거 및 리사이징 변수 통합)
let isEditMode = false;
let currentPage = 0; 
const PAGE_SIZE = 100; 
let currentSortField = 'col1_val'; 
let isAscending = true;
let hotInstance = null;

// 리사이징 상태 관리 변수
let isResizing = false;
let currentResizer = null;
let startX, startWidth, currentColumnId;

// [2] 숫자 우선 추출 함수 (2월, 10월 등 대응)
const getNumericValue = (val) => {
    if (val === null || val === undefined || val === "") return -Infinity;
    const strVal = String(val).replace(/,/g, '').trim();
    const match = strVal.match(/^[-+]?\d+(\.\d+)?/); 
    if (match) return parseFloat(match[0]);
    return strVal;
};

// [3] 리사이징 핵심 로직 (마우스 드래그 이벤트)
window.initResize = function(e, columnId, thElement) {
    isResizing = true;
    currentResizer = thElement;
    startX = e.pageX;
    startWidth = thElement.offsetWidth;
    currentColumnId = columnId;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResize);
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
};

const handleMouseMove = (e) => {
    if (!isResizing || !currentResizer) return;
    const diff = e.pageX - startX;
    const newWidth = Math.max(50, startWidth + diff); 
    currentResizer.style.width = `${newWidth}px`;
    currentResizer.style.minWidth = `${newWidth}px`;
};

const stopResize = async () => {
    if (!isResizing || !currentResizer) return;
    isResizing = false;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';

    const finalWidth = currentResizer.offsetWidth;
    const colIdx = currentLayout.findIndex(c => c.id === currentColumnId);
    
    if (colIdx > -1) {
        currentLayout[colIdx].width = finalWidth;
        await _supabase
            .from('data_config')
            .upsert({ 
                project_key: tableName, 
                columns_layout: currentLayout 
            }, { onConflict: 'project_key' });
    }

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResize);
};

// [4] 메인 렌더링 함수 (테이블 헤더 리사이저 포함)
window.renderDataTable = async function(searchKeyword = "", page = 0) {
    currentPage = page;
    tableName = getTableNameFromUrl();
    const container = document.getElementById('dataManagerContainer');
    const select = document.getElementById('searchFieldSelect');
    
    // [추가] 수정 모드일 때만 '열 설정' 버튼을 보여줌
    const columnSettingBtn = document.getElementById('columnSettingBtn'); // HTML에 id="columnSettingBtn" 추가 필요
    if (columnSettingBtn) {
        columnSettingBtn.style.display = isEditMode ? "inline-block" : "none";
    }

    if (!container || !tableName) return;

    await loadTableConfig(); 
    
    // 데이터 조회 (서버 정렬은 ID 순으로 고정)
    let { data: rows, error, count } = await _supabase
        .from('data_rows')
        .select('*', { count: 'exact' })
        .eq('project_key', tableName)
        .order('id', { ascending: true }); 

    if (error) return console.error(error);

    let displayRows = rows || [];

    // 숫자 인식 정렬 수행 (Natural Sort)
    displayRows.sort((a, b) => {
        const valA = getNumericValue(a[currentSortField]);
        const valB = getNumericValue(b[currentSortField]);
        if (typeof valA === 'number' && typeof valB === 'number') {
            return isAscending ? valA - valB : valB - valA;
        }
        return isAscending 
            ? String(valA).localeCompare(String(valB), undefined, { numeric: true }) 
            : String(valB).localeCompare(String(valA), undefined, { numeric: true });
    });

    // 검색 필터링
    if (searchKeyword) {
        const searchTarget = select?.value || 'all';
        displayRows = displayRows.filter(row => {
            if (searchTarget === 'all') {
                return Object.values(row).join(" ").toLowerCase().includes(searchKeyword.toLowerCase());
            } else {
                return String(row[searchTarget] || "").toLowerCase().includes(searchKeyword.toLowerCase());
            }
        });
    }

    const totalAfterFilter = displayRows.length;
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    const pagedRows = displayRows.slice(from, to); 
    const visibleCols = currentLayout.filter(col => col.isVisible);

    // 검색 드롭다운 복구
    if (select && select.options.length <= 1) {
        select.innerHTML = '<option value="all">전체 검색</option>';
        visibleCols.forEach(col => {
            const opt = document.createElement('option');
            opt.value = `col${col.id}_val`;
            opt.text = col.customName || col.defaultName;
            select.add(opt);
        });
    }

    const countDisplayHtml = `
        <div id="dataCountDisplay" style="margin: 12px 0 8px 0; padding: 6px 12px; font-size: 13px; color: #4a5568; background: #f7fafc; border-radius: 4px; border-left: 4px solid #3182ce; font-weight: 600;">
            🔍 검색 결과: <span style="color:#3182ce;">${totalAfterFilter.toLocaleString()}</span>건 / 전체: ${count?.toLocaleString() || 0}건
        </div>
    `;

    // 테이블 HTML 생성 (리사이저 포함)
    let html = countDisplayHtml + `
    <div style="width: 100%; overflow-x: auto;">
        <table class="manager-table ${isEditMode ? 'edit-active' : ''}" id="mainDataTable" 
               style="table-layout: fixed; width: 0; min-width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f8fafc;">
                    <th class="col-checkbox" style="width: 50px;"><input type="checkbox" onclick="selectAllRows(this.checked)"></th>
                    ${visibleCols.map(col => {
                        const colKey = `col${col.id}_val`;
                        const isCurrent = currentSortField === colKey;
                        const icon = isCurrent ? (isAscending ? '▲' : '▼') : '↕';
                        const colWidth = col.width || 150; // 기본 너비 150px
                        return `
                            <th style="width:${colWidth}px; position: relative; border-right: 1px solid #edf2f7; background: #f8fafc; padding: 0;" data-col-id="${col.id}">
                                <div style="display: flex; align-items: center; gap: 6px; padding: 10px; cursor: pointer; height: 100%;" onclick="toggleSort('${colKey}')">
                                    <span style="font-size:12px; color:#3182ce; min-width: 14px; text-align: center;">${icon}</span>
                                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px;">${col.customName || col.defaultName}</span>
                                </div>
                                <div class="resizer" 
                                     style="position: absolute; right: 0; top: 0; width: 6px; height: 100%; cursor: col-resize; z-index: 10; background: transparent;"
                                     onmousedown="event.stopPropagation(); initResize(event, ${col.id}, this.parentElement)">
                                </div>
                            </th>`;
                    }).join('')}
                </tr>
            </thead>
            <tbody>`;

    if (pagedRows.length === 0) {
        html += `<tr><td colspan="${visibleCols.length + 1}" style="text-align:center; padding:20px;">데이터가 없습니다.</td></tr>`;
    } else {
        pagedRows.forEach(row => {
            html += `<tr>
                <td class="col-checkbox"><input type="checkbox" class="row-checkbox" data-id="${row.id}"></td>
                ${visibleCols.map(col => {
                    const colKey = `col${col.id}_val`;
                    const val = row[colKey] || "";
                    return `<td onclick="activateEdit(this, '${row.id}', '${colKey}')" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <span class="cell-text">${val}</span>
                    </td>`;
                }).join('')}
            </tr>`;
        });
    }
    
    html += `</tbody></table></div>`;

    
    const paginationHtml = `
        <div class="pagination-controls" style="display: flex; justify-content: center; gap: 20px; margin-top: 20px; padding-bottom: 20px;">
            <button class="btn-select" onclick="renderDataTable('${searchKeyword}', ${currentPage - 1})" ${currentPage === 0 ? 'disabled' : ''}>이전 100개</button>
            <span style="align-self: center; font-weight: bold;">${currentPage + 1} 페이지</span>
            <button class="btn-select" onclick="renderDataTable('${searchKeyword}', ${currentPage + 1})" ${to >= totalAfterFilter ? 'disabled' : ''}>다음 100개</button>
        </div>
    `;
    container.innerHTML = html + paginationHtml;
};

// [5] 정렬 토글 및 기타 UI 제어 함수
window.toggleSort = function(field) {
    if (currentSortField === field) {
        isAscending = !isAscending;
    } else {
        currentSortField = field;
        isAscending = true;
    }
    renderDataTable(document.getElementById('tableSearchInput')?.value || "");
};

window.activateEdit = function(td, rowId, colField) {
    if (!isEditMode || td.querySelector('input')) return;
    const currentText = td.querySelector('.cell-text').innerText;
    td.innerHTML = `<input type="text" class="edit-input" value="${currentText}" style="width:100%; height:100%; border:2px solid #3182ce; border-radius:4px; text-align:center;">`;
    const input = td.querySelector('input');
    input.focus();
    input.onblur = async function() {
        const newVal = this.value;
        if (newVal !== currentText) await updateCell(rowId, colField, newVal);
        td.innerHTML = `<span class="cell-text">${newVal}</span>`;
    };
    input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
};

window.updateCell = async function(rowId, colField, newVal) {
    await _supabase.from('data_rows').update({ [colField]: newVal }).eq('id', rowId);
};

window.deleteSelectedRows = async function() {
    const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
    if (checkedBoxes.length === 0 || !confirm(`정말로 ${checkedBoxes.length}개의 행을 삭제하시겠습니까?`)) return;
    const idsToDelete = Array.from(checkedBoxes).map(cb => cb.dataset.id);
    const { error } = await _supabase.from('data_rows').delete().in('id', idsToDelete);
    if (!error) { alert("삭제되었습니다."); renderDataTable(); }
};

window.selectAllRows = function(isSelected) {
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = isSelected);
};

window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeToggle');
    if(btn) btn.innerText = isEditMode ? "✅ 수정 완료" : "✏️ 수정하기";
    
    // 모드 변경 시 테이블을 다시 그려 버튼 노출 상태를 업데이트함
    renderDataTable(document.getElementById('tableSearchInput')?.value || "");
};

window.addNewRow = function() {
    document.getElementById('addRowModal').style.display = 'flex';
    const container = document.getElementById('handsontableContainer');
    const visibleCols = currentLayout.filter(col => col.isVisible);
    if (!hotInstance) {
        hotInstance = new Handsontable(container, {
            data: Array.from({ length: 10 }, () => Array(visibleCols.length).fill("")), 
            colHeaders: visibleCols.map(c => c.customName || c.defaultName),
            rowHeaders: true,
            width: '100%', height: '400px', stretchH: 'all',
            copyPaste: true, minSpareRows: 1, fillHandle: true,
            licenseKey: 'non-commercial-and-evaluation'
        });
    } else {
        hotInstance.loadData(Array.from({ length: 10 }, () => Array(visibleCols.length).fill("")));
    }
    setTimeout(() => hotInstance.selectCell(0, 0), 100);
};

window.submitNewRows = async function() {
    const rawData = hotInstance.getData();
    const visibleCols = currentLayout.filter(col => col.isVisible);
    const rowsToInsert = rawData.filter(row => row.some(cell => cell !== "" && cell !== null)).map(row => {
        const rowData = { project_key: tableName };
        visibleCols.forEach((col, idx) => { rowData[`col${col.id}_val`] = row[idx]; });
        return rowData;
    });
    if (rowsToInsert.length === 0) return alert("데이터가 없습니다.");
    const { error } = await _supabase.from('data_rows').insert(rowsToInsert);
    if (!error) { 
        alert("추가되었습니다."); 
        document.getElementById('addRowModal').style.display = 'none';
        renderDataTable(); 
    }
};

window.searchData = function() { renderDataTable(document.getElementById('tableSearchInput')?.value || ""); };

window.resetTableFilter = function() {
    const input = document.getElementById('tableSearchInput');
    const select = document.getElementById('searchFieldSelect');
    if(input) input.value = "";
    if(select) select.value = "all";
    renderDataTable();
};

// [6] 열 설정 모달 및 레이아웃 저장
window.openColumnManagementModal = function() {
    const layout = currentLayout;
    if (!layout || layout.length === 0) return alert("데이터를 로딩 중입니다.");

    const modalHtml = `
        <style>
            /* 부모 컨테이너가 무엇이든 이 클래스가 포함된 부모의 너비를 강제 고정 */
            .modal-content, .modal-dialog, #columnModalWrapper {
                width: 300px !important; /* 가로길이 조절 포인트 */
                min-width: 300px !important;
                padding: 10px !important; /* 외부 여백 조절 포인트 */
                margin: auto !important;
            }
        </style>

        <div id="columnModalWrapper" style="width: 100%; box-sizing: border-box; overflow: hidden;">
            <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:5px; border-bottom:1px solid #edf2f7;">
                <h5 style="margin:0; font-size:14px; color:#4a5568; font-weight: 600;">⚙️ 열 설정</h5>
                <button onclick="closeModal()" style="border:none; background:none; cursor:pointer; font-size:18px; color:#a0aec0; line-height: 1;">✕</button>
            </div>
            
            <div class="modal-body" style="max-height: 400px; overflow-y: auto; overflow-x: hidden; padding: 0;">
                <div id="columnSortableList" style="display: flex; flex-direction: column; gap: 4px; padding-right: 2px;">
                    ${layout.map((col) => `
                        <div class="list-group-item" data-id="${col.id}" 
                             style="display: flex; align-items: center; gap: 6px; background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); width: 100%; box-sizing: border-box;">
                            
                            <span class="drag-handle" style="cursor: grab; color: #cbd5e0; font-size: 14px; flex-shrink: 0; user-select: none;">⋮⋮</span>
                            <input type="checkbox" style="width: 14px; height: 14px; cursor: pointer; accent-color: #319795; flex-shrink: 0;" 
                                   ${col.isVisible ? 'checked' : ''} 
                                   onchange="currentLayout.find(c => c.id === ${col.id}).isVisible = this.checked">
                            
                            <div style="flex: 1; min-width: 0;">
                                <input type="text" style="width: 100%; box-sizing: border-box; padding: 4px 6px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 14px; color: #2d3748; outline: none;" 
                                       value="${col.customName || col.defaultName}" 
                                       oninput="currentLayout.find(c => c.id === ${col.id}).customName = this.value">
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:10px; padding-top:10px; border-top:1px solid #edf2f7;">
                <button class="btn-primary" style="padding:5px 12px; background:#3182ce; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:600;" onclick="saveColumnLayout()">설정 저장</button>
                <button class="btn-select" style="padding:5px 12px; border:1px solid #cbd5e0; border-radius:4px; background:#fff; cursor:pointer; font-size:12px;" onclick="closeModal()">취소</button>
            </div>
        </div>
    `;

    if (typeof showModal === 'function') {
        showModal(modalHtml);
        
        // 부모의 스타일을 강제로 한 번 더 입힘
        setTimeout(() => {
            const wrapper = document.getElementById('columnModalWrapper');
            let parent = wrapper.parentElement;
            while (parent) {
                // 프로젝트의 모달 클래스 명칭을 찾아 너비 강제 적용
                if (parent.classList.contains('modal-content') || parent.classList.contains('modal-dialog')) {
                    parent.style.setProperty('width', '320px', 'important');
                    parent.style.setProperty('padding', '10px', 'important');
                    break;
                }
                parent = parent.parentElement;
            }
        }, 50);

        if (window.Sortable) {
            new Sortable(document.getElementById('columnSortableList'), { 
                handle: '.drag-handle', 
                animation: 150
            });
        }
    }
};


window.saveColumnLayout = async function() {
    const items = document.querySelectorAll('#columnSortableList .list-group-item');
    const newLayout = Array.from(items).map(item => {
        const id = parseInt(item.dataset.id);
        return currentLayout.find(c => c.id === id);
    });
    
    const { error } = await _supabase
        .from('data_config')
        .upsert({ 
            project_key: tableName, 
            columns_layout: newLayout 
        }, { onConflict: 'project_key' });
    
    if (error) {
        alert("저장 실패: " + error.message);
    } else {
        currentLayout = newLayout;
        alert("설정이 저장되었습니다.");
        if (typeof closeModal === 'function') closeModal();
        renderDataTable(); 
    }
};

// [핵심 수정] 열 설정 로드 시 'test' 레이아웃을 기본값으로 활용
window.loadTableConfig = async function() {
    tableName = getTableNameFromUrl();
    if (!tableName) return;

    // [1] 현재 키워드(예: 코이즈) 설정 조회
    let { data, error } = await _supabase
        .from('data_config')
        .select('columns_layout')
        .eq('project_key', tableName)
        .maybeSingle(); // 데이터가 없어도 에러를 뱉지 않음

    if (data && data.columns_layout && data.columns_layout.length > 0) {
        // 현재 키워드 전용 설정이 있다면 사용
        currentLayout = data.columns_layout;
        console.log(`'${tableName}' 전용 설정을 로드했습니다.`);
    } else {
        // [2] 설정이 없다면 'test' 설정을 가져옴
        console.warn(`'${tableName}' 설정이 없어 'test' 설정을 조회합니다.`);
        
        let { data: defaultData } = await _supabase
            .from('data_config')
            .select('columns_layout')
            .eq('project_key', 'test_data')
            .maybeSingle();

        if (defaultData && defaultData.columns_layout) {
            currentLayout = defaultData.columns_layout;
            console.log("'test' 설정을 기본값으로 적용했습니다.");
            
            // [3] 옵션: 가져온 'test' 설정을 '코이즈'에도 즉시 저장하여 동기화
            // 이렇게 해두면 다음 접속 시 '코이즈' 전용 데이터로 바로 인식됩니다.
            await _supabase.from('data_config').upsert({
                project_key: tableName,
                columns_layout: currentLayout
            }, { onConflict: 'project_key' });
        } else {
            // [4] 'test' 조차 없다면 완전 초기화
            currentLayout = Array.from({ length: 20 }, (_, i) => ({
                id: i + 1,
                defaultName: `필드 ${i + 1}`,
                customName: "",
                isVisible: true,
                width: 150
            }));
        }
    }
};