// [1] 초기 전역 변수 설정 (중복 제거 및 리사이징 변수 통합)
let isEditMode = false;
let currentPage = 0; 
const PAGE_SIZE = 100; 
let currentSortField = 'col1_val'; 
let isAscending = true;
let hotInstance = null;
let displayRows = [];
// currentPresetId는 lib_data.js에서 선언

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
    
    // [보완] 레이아웃이 이미 로드되어 있다면 중복 호출 방지
    if (!currentLayout || currentLayout.length === 0) {
        await loadTableConfig(); 
    }
    
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

    displayRows = rows || [];

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
        <div id="dataCountDisplay" style="margin: 12px 0 8px 0; padding: 6px 12px; font-size: 13px; color: #4a5568; background: #f7fafc; border-radius: 4px; border-left: 4px solid #3182ce; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
            <div>
                🔍 검색 결과: <span style="color:#3182ce;">${totalAfterFilter.toLocaleString()}</span>건 / 전체: ${count?.toLocaleString() || 0}건
            </div>

            <div style="display: flex; gap: 8px; align-items: center;">
                <button onclick="openExcelUploadModal()" class="btn-select" style="padding: 4px 10px; height: 28px; font-size: 12px; background: #fff; border: 1px solid #cbd5e0; border-radius: 4px; display: flex; align-items: center; gap: 5px; cursor: pointer;">
                    엑셀 업로드
                </button>
                <button onclick="downloadExcel()" class="btn-select" style="padding: 4px 10px; height: 28px; font-size: 12px; background: #fff; border: 1px solid #cbd5e0; border-radius: 4px; display: flex; align-items: center; gap: 5px; cursor: pointer;">
                    엑셀 다운로드
                </button>
            </div>
        </div>
    `;

    // 테이블 HTML 생성 (리사이저 포함)
    let html = countDisplayHtml + `
        <div style="width: 100%; overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
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
    // 1. 상태 반전
    isEditMode = !isEditMode;
    
    // 2. 버튼 텍스트 및 스타일 변경
    const btn = document.getElementById('editModeToggle');
    if (btn) {
        btn.innerText = isEditMode ? "✅ 수정 완료" : "✏️ 수정하기";
        btn.style.background = isEditMode ? "#3182ce" : "white";
        btn.style.color = isEditMode ? "white" : "#333";
    }

    // 3. 상단 편집 바 노출 제어
    const editBar = document.getElementById('editModeBar');
    if (editBar) {
        editBar.style.display = isEditMode ? "flex" : "none";
    }

    // 4. [핵심] 테이블 다시 그리기 (이때 .edit-active 클래스가 붙음)
    renderDataTable(document.getElementById('tableSearchInput')?.value || "", currentPage);
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
window.openColumnManagementModal = async function() {
    // 1. 현재 키워드에 저장된 모든 레이아웃 프리셋 불러오기
    const { data: presets } = await _supabase
        .from('data_config')
        .select('id, layout_name, columns_layout')
        .eq('project_key', tableName)
        .order('created_at', { ascending: true });

    const modalHtml = `
        <div class="column-modal-container">
            <div class="preset-sidebar">
                <div style="padding: 15px; font-size: 12px; font-weight: bold; color: #94a3b8; border-bottom: 1px solid #edf2f7; display:flex; justify-content:space-between;">
                    저장된 레이아웃
                    <span title="추천: 가장 최근 설정이 자동 로드됩니다" style="cursor:help;">💡</span>
                </div>
                <div class="preset-list" id="presetListContainer">
                    ${(presets || []).map(p => `
                        <div class="preset-item ${currentPresetId === p.id ? 'active' : ''}" 
                            onclick="loadSelectedPreset('${p.id}')" 
                            style="display: flex; justify-content: space-between; align-items: center; gap: 5px;">
                            <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                📂 ${p.layout_name || '보호원 월말보고'}
                            </span>
                            <div style="display: flex; gap: 4px; flex-shrink: 0;">
                                <button onclick="editPresetName('${p.id}', '${p.layout_name}', event)" 
                                        title="이름 수정"
                                        style="border:none; background:none; cursor:pointer; font-size:12px; color:#a0aec0; padding:2px;">✏️</button>
                                <button onclick="deletePreset('${p.id}', '${p.layout_name}', event)" 
                                        title="삭제"
                                        style="border:none; background:none; cursor:pointer; font-size:12px; color:#e53e3e; padding:2px;">🗑️</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button onclick="addNewLayoutPreset()" style="padding: 15px; background: #fff; border: none; border-top: 1px solid #edf2f7; color: #3182ce; font-weight: bold; cursor: pointer; text-align: left; font-size: 13px;">
                    + 새 프리셋 추가
                </button>
            </div>

            <div class="column-setting-main">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h5 style="margin:0; font-size:16px; color:#2d3748; font-weight:bold;">⚙️ 열 상세 설정</h5>
                    <button onclick="closeModal()" style="border:none; background:none; cursor:pointer; font-size:20px; color:#a0aec0;">✕</button>
                </div>
                
                <div class="column-scroll-area" id="columnSortableList">
                    ${currentLayout.map((col) => `
                        <div class="list-group-item" data-id="${col.id}" 
                             style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                            <span class="drag-handle" style="cursor: grab; color: #cbd5e0; font-size: 18px;">⋮⋮</span>
                            <input type="checkbox" style="width: 18px; height: 18px; cursor: pointer; accent-color: #3182ce;" 
                                   ${col.isVisible ? 'checked' : ''} 
                                   onchange="window.updateLocalLayout(${col.id}, 'isVisible', this.checked)">
                            <input type="text" style="flex:1; padding: 6px 10px; border: 1px solid #edf2f7; border-radius: 6px; font-size: 14px; outline:none;" 
                                   value="${col.customName || col.defaultName}" 
                                   oninput="window.updateLocalLayout(${col.id}, 'customName', this.value)">
                        </div>
                    `).join('')}
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px; padding-top:15px; border-top:1px solid #edf2f7;">
                    <button class="btn-primary" style="padding:10px 20px; background:#48bb78; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600;" onclick="saveColumnLayout()">현재 프리셋에 저장</button>
                    <button class="btn-select" style="padding:10px 20px; border:1px solid #cbd5e0; border-radius:8px; background:#fff; cursor:pointer;" onclick="closeModal()">취소</button>
                </div>
            </div>
        </div>
    `;

    if (typeof showModal === 'function') {
        showModal(modalHtml);
    
        // [수정] 부모 컨테이너(.modal-content)의 스타일을 강제로 확장
        setTimeout(() => {
            const modalWrapper = document.querySelector('#commonModal .modal-content');
            if (modalWrapper) {
                modalWrapper.style.setProperty('width', '800px', 'important'); // 가로 800px로 확장
                modalWrapper.style.setProperty('max-width', '95vw', 'important');
                modalWrapper.style.setProperty('padding', '0', 'important'); // 내부 여백 제거 (사이드바 밀착)
                modalWrapper.style.setProperty('overflow', 'hidden', 'important');
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

// 모달 내 실시간 데이터 동기화 함수
window.updateLocalLayout = function(id, field, value) {
    const col = currentLayout.find(c => c.id === id);
    if (col) col[field] = value;
};

// [핵심 수정] 열 설정 로드 시 'test' 레이아웃을 기본값으로 활용
window.loadTableConfig = async function() {
    tableName = getTableNameFromUrl();
    if (!tableName) return;

    let { data, error } = await _supabase
        .from('data_config')
        .select('id, columns_layout') // [수정] id도 같이 가져와야 프리셋 업데이트가 가능함
        .eq('project_key', tableName)
        .maybeSingle();

    if (data && data.columns_layout) {
        currentLayout = data.columns_layout;
        currentPresetId = data.id; // [추가] 로드된 설정의 ID를 전역 변수에 저장
        console.log(`'${tableName}' 설정을 로드했습니다. (ID: ${currentPresetId})`);
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

//엑셀 다운로드 (라이브러리 사용)
window.downloadExcel = function() {
    if (typeof XLSX === 'undefined') {
        return alert("엑셀 라이브러리가 로드되지 않았습니다.");
    }

    if (!displayRows || displayRows.length === 0) {
        return alert("다운로드할 데이터가 없습니다.");
    }

    const visibleCols = currentLayout.filter(col => col.isVisible);
    const header = visibleCols.map(col => col.customName || col.defaultName);
    const data = displayRows.map(row => 
        visibleCols.map(col => row[`col${col.id}_val`] || "")
    );
    
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");

    // 날짜 생성 (YYMMDD)
    const date = new Date();
    const formattedDate = date.getFullYear().toString().slice(2) + 
                         (date.getMonth() + 1).toString().padStart(2, '0') + 
                         date.getDate().toString().padStart(2, '0');
    
    // [수정] config.js에 선언된 projectKeyName 변수 사용
    // 변수가 없을 경우를 대비해 전역 변수나 tableName을 백업으로 둡니다.
    const finalName = (typeof projectKeyName !== 'undefined' && projectKeyName) 
                      ? projectKeyName 
                      : (window.tableName || 'data');

    const fileName = `${finalName}_${formattedDate}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
};

window.closeAddRowModal = function() {
    const modal = document.getElementById('addRowModal');
    if (modal) modal.style.display = 'none';
};

window.closeExcelModal = function() {
    const modal = document.getElementById('excelUploadModal');
    if (modal) modal.style.display = 'none';
};

// [저장] 프리셋 ID 있으면 업데이트, 없으면 project_key 기준 업서트
window.saveColumnLayout = async function() {
    const items = document.querySelectorAll('#columnSortableList .list-group-item');
    const newLayout = Array.from(items).map(item => {
        const id = parseInt(item.dataset.id);
        return currentLayout.find(c => c.id === id);
    });

    let result;
    if (currentPresetId) {
        result = await _supabase
            .from('data_config')
            .update({ columns_layout: newLayout })
            .eq('id', currentPresetId);
    } else {
        // [수정] 최초 저장 시 기본 프리셋 이름을 '보호원 월말보고'로 설정
        result = await _supabase
            .from('data_config')
            .upsert({ 
                project_key: tableName, 
                columns_layout: newLayout, 
                layout_name: '보호원 월말보고' 
            }, { onConflict: 'project_key' });
    }

    if (result.error) {
        alert("저장 실패: " + result.error.message);
    } else {
        currentLayout = newLayout;
        alert("💾 레이아웃이 성공적으로 저장되었습니다.");
        if (typeof closeModal === 'function') closeModal();
        renderDataTable();
    }
};

window.loadSelectedPreset = async function(presetId) {
    const { data } = await _supabase
        .from('data_config')
        .select('*')
        .eq('id', presetId)
        .single();
    if (data) {
        currentPresetId = data.id;
        currentLayout = data.columns_layout;
        openColumnManagementModal();
    }
};

window.addNewLayoutPreset = async function() {
    const name = prompt("새 레이아웃 프리셋 이름을 입력하세요:");
    if (!name) return;
    const { data, error } = await _supabase
        .from('data_config')
        .insert([{ project_key: tableName, layout_name: name, columns_layout: currentLayout }])
        .select();
    if (!error) {
        currentPresetId = data[0].id;
        alert("✨ 새 프리셋이 생성되었습니다.");
        openColumnManagementModal();
    }
};

// 프리셋 이름 수정 함수
window.editPresetName = async function(presetId, oldName, event) {
    if (event) event.stopPropagation(); // 부모 클릭 이벤트(프리셋 선택) 방지

    const newName = prompt("변경할 프리셋 이름을 입력하세요:", oldName);
    if (!newName || newName === oldName) return;

    const { error } = await _supabase
        .from('data_config')
        .update({ layout_name: newName })
        .eq('id', presetId);

    if (!error) {
        alert("✅ 이름이 변경되었습니다.");
        openColumnManagementModal(); // 모달 UI 갱신
    } else {
        alert("이름 변경 실패: " + error.message);
    }
};

window.deletePreset = async function(presetId, presetName, event) {
    if (event) event.stopPropagation(); // 프리셋 선택 방지

    if (!confirm(`'${presetName}' 프리셋을 정말로 삭제하시겠습니까?`)) return;

    const { error } = await _supabase
        .from('data_config')
        .delete()
        .eq('id', presetId);

    if (!error) {
        alert("🗑️ 프리셋이 삭제되었습니다.");
        
        // 만약 현재 사용 중인 프리셋을 삭제했다면 변수 초기화
        if (currentPresetId === presetId) {
            currentPresetId = null;
        }
        
        openColumnManagementModal(); // 모달 UI 갱신
    } else {
        alert("삭제 실패: " + error.message);
    }
};