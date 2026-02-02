// datamng.js
let isEditMode = false;
let rawData = [];
let currentLayout = [];
let tableName = ""; 

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

// [공통] 테이블 설정 로드
async function loadTableConfig() {
    const params = new URLSearchParams(window.location.search);
    tableName = params.get('table');
    const { data } = await _supabase.from('data_config').select('columns_layout').eq('project_key', tableName).maybeSingle();
    currentLayout = data?.columns_layout || JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
}

// --- [chart.html 전용 초기화 함수] ---
window.initChartPage = async function() {
    try {
        const params = new URLSearchParams(window.location.search);
        tableName = params.get('table');
        
        if (!tableName) throw new Error("프로젝트 정보(table 파라미터)가 없습니다.");

        // 설정과 데이터 동시 로드
        const [configRes, dataRes] = await Promise.all([
            _supabase.from('data_config').select('columns_layout').eq('project_key', tableName).maybeSingle(),
            _supabase.from('data_rows').select('*').eq('project_key', tableName)
        ]);

        currentLayout = configRes.data?.columns_layout || JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
        rawData = dataRes.data || [];
        
        return true;
    } catch (err) {
        console.error("초기화 오류:", err);
        return false;
    }
};

// --- [차트 리포트 렌더링 로직] ---
window.processAndRender = function(config, type, targetId) {
    // 1. 데이터 필터링
    let filteredData = rawData;
    if (config.filter) {
        filteredData = rawData.filter(r => Object.values(r).some(v => String(v).includes(config.filter)));
    }

    // 2. 그룹화 (행 x 열 기준)
    const result = {};
    const yCategories = new Set();

    filteredData.forEach(item => {
        let xKey = item[config.x] || '미지정';
        // 날짜 월별 처리
        if (config.x === 'monthly' || config.x === 'col1_val') {
            const m = String(item.col1_val || '').match(/(\d{4})[.-](\d{2})/);
            xKey = m ? `${m[1]}.${m[2]}` : '날짜미상';
        }

        let yKey = (type === 'table' && config.yBase !== 'total') ? (item[config.yBase] || '기타') : '수량';
        yCategories.add(yKey);

        if (!result[xKey]) result[xKey] = {};
        result[xKey][yKey] = (result[xKey][yKey] || 0) + 1;
    });

    const target = document.getElementById(targetId);
    const xLabels = Object.keys(result).sort();
    const yLabels = Array.from(yCategories);

    if (type === 'table') {
        // 다차원 표 렌더링
        let html = `<table class="data-table"><thead><tr><th>분류(${config.x})</th>`;
        yLabels.forEach(y => html += `<th>${y}</th>`);
        html += `</tr></thead><tbody>`;
        xLabels.forEach(x => {
            html += `<tr><td>${x}</td>`;
            yLabels.forEach(y => html += `<td>${result[x][y] || 0}</td>`);
            html += `</tr>`;
        });
        target.innerHTML = html + `</tbody></table>`;
    } else {
        // 막대 그래프 렌더링
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

// --- [page2.html 표 렌더링 및 기타 기능] ---
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

// ... (기존 toggleEditMode, handleCellClick, Excel업로드 등 로직 유지)