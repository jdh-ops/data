// datamng.js
let isEditMode = false;
let rawData = [];
let currentLayout = [];

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

// 공통: 테이블 설정 로드
async function loadTableConfig() {
    const { data } = await _supabase.from('data_config').select('columns_layout').eq('project_key', tableName).maybeSingle();
    currentLayout = data?.columns_layout || JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
}

// --- [page2.html] 전용 로직 ---
window.renderDataTable = async function() {
    await loadTableConfig(); 
    const { data: rows } = await _supabase.from('data_rows').select('*').eq('project_key', tableName).order('created_at', { ascending: false });
    const visibleCols = currentLayout.filter(col => col.isVisible);
    const container = document.getElementById('dataManagerContainer');
    if(!container) return;

    let html = `<table class="data-table"><thead><tr>`;
    if (isEditMode) html += `<th style="width:40px;"></th>`;
    visibleCols.forEach(col => {
        html += `<th style="${col.width ? `width:${col.width}px;` : ''}">${col.customName || col.defaultName}</th>`;
    });
    html += `</tr></thead><tbody>`;

    rows.forEach(row => {
        html += `<tr>`;
        if (isEditMode) html += `<td><input type="checkbox" class="row-check" data-id="${row.id}"></td>`;
        visibleCols.forEach(col => {
            html += `<td onclick="handleCellClick(this, '${row.id}', 'col${col.id}_val')">${row[`col${col.id}_val`] || '-'}</td>`;
        });
        html += `</tr>`;
    });
    container.innerHTML = html + `</tbody></table>`;
};

// ... (생략: toggleEditMode, handleCellClick, 엑셀 업로드 관련은 기존 유지) ...

// --- [chart.html] 전용 로직 ---

// 1. 차트 페이지 초기화
window.initChartPage = async function() {
    const params = new URLSearchParams(window.location.search);
    const tName = params.get('table');
    tableName = tName; 

    const { data: config } = await _supabase.from('data_config').select('columns_layout').eq('project_key', tName).maybeSingle();
    const { data: rows } = await _supabase.from('data_rows').select('*').eq('project_key', tName);
    
    rawData = rows || [];
    currentLayout = config?.columns_layout || DEFAULT_LAYOUT;
    console.log("차트 데이터 로드 완료");
};

// 2. 프리셋별 리포트 생성 (다차원 분석 지원)
window.processAndRender = function(config, type, targetId) {
    // 데이터 필터링
    let filteredData = rawData;
    if (config.filter) {
        filteredData = rawData.filter(r => Object.values(r).some(v => String(v).includes(config.filter)));
    }

    // 데이터 그룹화 (행 기준 x 열 기준)
    const result = {};
    const yCategories = new Set(); 

    filteredData.forEach(item => {
        // 행(X축) 키 추출 및 날짜 월별 처리
        let xKey = item[config.x] || '미지정';
        if (config.x === 'monthly') {
            const m = String(item.col1_val || '').match(/(\d{4})[.-](\d{2})/);
            xKey = m ? `${m[1]}.${m[2]}` : '날짜미상';
        }

        // 열(구분) 키 추출
        let yKey = (type === 'table' && config.yBase !== 'total') ? (item[config.yBase] || '기타') : '수량';
        yCategories.add(yKey);

        if (!result[xKey]) result[xKey] = {};
        result[xKey][yKey] = (result[xKey][yKey] || 0) + 1;
    });

    const target = document.getElementById(targetId);
    const xLabels = Object.keys(result).sort();
    const yLabels = Array.from(yCategories);

    if (type === 'table') {
        // 다차원 표 생성
        let html = `<table class="data-table"><thead><tr><th>분분류(${config.x})</th>`;
        yLabels.forEach(y => html += `<th>${y}</th>`);
        html += `</tr></thead><tbody>`;

        xLabels.forEach(x => {
            html += `<tr><td>${x}</td>`;
            yLabels.forEach(y => { html += `<td>${result[x][y] || 0}</td>`; });
            html += `</tr>`;
        });
        target.innerHTML = html + `</tbody></table>`;
    } else {
        // 멀티 데이터 그래프 생성
        const canvas = document.createElement('canvas');
        target.appendChild(canvas);
        
        const datasets = yLabels.map((y, i) => ({
            label: y,
            data: xLabels.map(x => result[x][y] || 0),
            backgroundColor: `hsla(${i * 60}, 70%, 60%, 0.8)`
        }));

        new Chart(canvas, {
            type: 'bar',
            data: { labels: xLabels, datasets: datasets },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
};

// ... (생략: selectAllRows, deleteSelectedRows, openColumnManagementModal, addNewRow 등 기존 기능 유지) ...