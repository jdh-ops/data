// datamng.js
let tableName = ""; 
let isEditMode = false;
let currentLayout = [];
let rawData = [];

// [1] 초기화 함수: URL에서 테이블명 추출
function getTableNameFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('table');
    console.log("추출된 테이블명:", t);
    return t || "";
}

// [2] 설정 불러오기
async function loadTableConfig() {
    if (!tableName) tableName = getTableNameFromUrl();
    try {
        const { data } = await _supabase.from('data_config').select('columns_layout').eq('project_key', tableName).maybeSingle();
        // [1] 기본 레이아웃 정의
        const DEFAULT_LAYOUT = [
            { id: 1, defaultName: "날짜", customName: "날짜", isVisible: true },
            { id: 2, defaultName: "URL", customName: "URL", isVisible: true },
            { id: 3, defaultName: "상품명", customName: "상품명", isVisible: true },
            { id: 4, defaultName: "가격", customName: "가격", isVisible: true },
            { id: 5, defaultName: "상태", customName: "상태", isVisible: true },
            { id: 6, defaultName: "태그", customName: "태그", isVisible: true }
        ];
        for (let i = 7; i <= 20; i++) DEFAULT_LAYOUT.push({ id: i, defaultName: `열${i}`, customName: "", isVisible: false });
        
        currentLayout = data?.columns_layout || DEFAULT_LAYOUT;
    } catch (e) {
        console.error("설정 로드 실패:", e);
    }
}

// [3] 표 렌더링 (가장 중요한 부분)
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

// [4] 사이드바 및 버튼 동작을 위한 함수들 (전역 등록)
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        const btn = document.querySelector('.toggle-btn');
        if (btn) btn.innerText = sidebar.classList.contains('collapsed') ? '▶' : '◀';
    }
};

window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeToggle');
    const bar = document.getElementById('editModeBar');
    if(btn) btn.innerText = isEditMode ? "✅ 수정 완료" : "✏️ 수정하기";
    if(bar) bar.style.display = isEditMode ? "flex" : "none";
    renderDataTable();
};

window.openExcelUploadModal = () => { 
    const modal = document.getElementById('excelUploadModal');
    if(modal) modal.style.display = 'flex'; 
};

window.closeExcelModal = () => {
    const modal = document.getElementById('excelUploadModal');
    if(modal) modal.style.display = 'none';
};

// [열 설정] 모달 열기 함수
window.openColumnManagementModal = function() {
    // currentLayout이 비어있으면 기본값 로드
    const layout = currentLayout.length > 0 ? currentLayout : DEFAULT_LAYOUT;
    
    const modalHtml = `
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding-bottom:15px; border-bottom:1px solid #eee;">
            <h5 style="margin:0;">⚙️ 열 관리 및 너비 설정</h5>
            <button type="button" onclick="closeModal()" style="border:none; background:none; cursor:pointer; font-size:20px;">✕</button>
        </div>
        <div class="modal-body" style="padding:15px 0; max-height:400px; overflow-y:auto;">
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
        <div class="modal-footer" style="padding-top:15px; border-top:1px solid #eee;">
            <button class="btn-primary" style="width:100%; padding:12px;" onclick="saveColumnLayout()">설정 저장</button>
        </div>
    `;

    // page2.html에 정의된 showModal 함수 호출
    if (typeof showModal === 'function') {
        showModal(modalHtml);
        // 드래그 앤 드롭 순서 변경 기능 활성화
        new Sortable(document.getElementById('columnSortableList'), { handle: '.drag-handle', animation: 150 });
    } else {
        alert("모달 표시 함수(showModal)를 찾을 수 없습니다.");
    }
};

// 데이터 업데이트용 보조 함수들
window.updateVisibility = (index, isChecked) => { currentLayout[index].isVisible = isChecked; };
window.updateCustomName = (index, value) => { currentLayout[index].customName = value; };
window.updateColumnWidth = (index, value) => { currentLayout[index].width = parseInt(value); };

// 설정 저장 함수
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
        alert("✅ 열 설정이 저장되었습니다.");
        currentLayout = newLayout;
        renderDataTable(); // 표 다시 그리기
        if (typeof closeModal === 'function') closeModal();
    }
};

// datamng.js 내 리포트 생성 핵심 함수
window.processAndRender = function(config, type, targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;

    // 데이터 필터링
    let filteredData = rawData;
    if (config.filter) {
        filteredData = rawData.filter(r => 
            Object.values(r).some(v => String(v).includes(config.filter))
        );
    }

    // [추가] 데이터가 없을 경우 처리
    if (filteredData.length === 0) {
        target.innerHTML = `<div style="padding:50px; text-align:center; color:#94a3b8;">분석할 데이터가 없습니다.</div>`;
        return;
    }

    // 2. 피벗 그룹화 (행 x 열 기준 집계)
    const pivot = {};
    const colCategories = new Set(); // 열(Columns)에 들어갈 카테고리들

    filteredData.forEach(item => {
        // 행(Row) 키 설정
        let rowKey = item[config.x] || '미지정';
        if (config.x === 'monthly') {
            const m = String(item.col1_val || '').match(/(\d{4})[.-](\d{2})/);
            rowKey = m ? `${m[1]}.${m[2]}` : '날짜미상';
        }

        // 열(Column) 키 설정 (피벗의 핵심)
        let colKey = (config.yBase && config.yBase !== 'total') ? (item[config.yBase] || '기타') : '합계';
        colCategories.add(colKey);

        if (!pivot[rowKey]) pivot[rowKey] = {};
        pivot[rowKey][colKey] = (pivot[rowKey][colKey] || 0) + 1;
    });

    const rows = Object.keys(pivot).sort();
    const cols = Array.from(colCategories).sort();

    // 3. 시각화 출력 (Table vs Chart)
    if (type === 'table') {
        let html = `<table class="data-table"><thead><tr><th>구분 (${config.x})</th>`;
        cols.forEach(c => html += `<th>${c}</th>`);
        html += `</tr></thead><tbody>`;

        rows.forEach(r => {
            html += `<tr><td><strong>${r}</strong></td>`;
            cols.forEach(c => {
                const val = pivot[r][c] || 0;
                html += `<td>${val.toLocaleString()}</td>`;
            });
            html += `</tr>`;
        });
        target.innerHTML = html + `</tbody></table>`;
    } else {
        const canvas = document.createElement('canvas');
        target.appendChild(canvas);
        
        // 그래프 데이터셋 구성 (열 기준별 막대 생성)
        const datasets = cols.map((col, i) => ({
            label: col,
            data: rows.map(row => pivot[row][col] || 0),
            backgroundColor: `hsla(${i * (360 / cols.length)}, 70%, 60%, 0.7)`
        }));

        new Chart(canvas, {
            type: 'bar',
            data: { labels: rows, datasets: datasets },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
};