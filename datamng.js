// [1] 전역 변수 설정
let tableName = ""; 
let isEditMode = false;
let currentLayout = [];
let rawData = [];

// [2] 초기화 및 설정 로드 함수
function getTableNameFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('table');
    return t || "";
}

async function loadTableConfig() {
    if (!tableName) tableName = getTableNameFromUrl();
    try {
        const { data } = await _supabase.from('data_config').select('columns_layout').eq('project_key', tableName).maybeSingle();
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
    } catch (e) { console.error("설정 로드 실패:", e); }
}

// [3] 차트/리포트 전용 함수
window.initChartPage = async function() {
    tableName = getTableNameFromUrl();
    if (!tableName) return false;
    try {
        await loadTableConfig();
        const { data } = await _supabase.from('data_rows').select('*').eq('project_key', tableName);
        rawData = data || [];
        return true;
    } catch (err) { return false; }
};

window.saveAnalysisPreset = async function(presetName, config, type) {
    if (!tableName) tableName = getTableNameFromUrl();
    const { error } = await _supabase.from('analysis_presets').insert([{
        project_key: tableName, preset_name: presetName, type: type, config: config
    }]);
    if (!error) {
        alert("💾 프리셋이 저장되었습니다.");
        loadPresets();
    } else { alert("저장 실패: " + error.message); }
};

window.loadPresets = async function() {
    if (!tableName) tableName = getTableNameFromUrl();
    const { data, error } = await _supabase.from('analysis_presets').select('*').eq('project_key', tableName).order('created_at', { ascending: false });
    if (!error && typeof renderPresetButtons === 'function') {
        renderPresetButtons(data || []);
    }
};

window.processAndRender = function(config, type, targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;

    let filteredData = rawData;
    if (config.filter) {
        filteredData = rawData.filter(r => Object.values(r).some(v => String(v).includes(config.filter)));
    }

    if (filteredData.length === 0) {
        target.innerHTML = `<div style="padding:50px; text-align:center; color:#94a3b8;">데이터가 없습니다.</div>`;
        return;
    }

    const pivot = {};
    const colCategories = new Set();

    filteredData.forEach(item => {
        let rowKey = item[config.x] || '미지정';
        if (config.x === 'monthly') {
            const m = String(item.col1_val || '').match(/(\d{4})[.-](\d{2})/);
            rowKey = m ? `${m[1]}.${m[2]}` : '날짜미상';
        }
        let colKey = (config.yBase && config.yBase !== 'total') ? (item[config.yBase] || '기타') : '합계';
        colCategories.add(colKey);
        if (!pivot[rowKey]) pivot[rowKey] = {};
        pivot[rowKey][colKey] = (pivot[rowKey][colKey] || 0) + 1;
    });

    const rows = Object.keys(pivot).sort();
    const cols = Array.from(colCategories).sort();

    if (type === 'table') {
        let html = `<table class="data-table"><thead><tr><th>구분</th>`;
        cols.forEach(c => html += `<th>${c}</th>`);
        html += `</tr></thead><tbody>`;
        rows.forEach(r => {
            html += `<tr><td><strong>${r}</strong></td>`;
            cols.forEach(c => html += `<td>${(pivot[r][c] || 0).toLocaleString()}</td>`);
            html += `</tr>`;
        });
        target.innerHTML = html + `</tbody></table>`;
    } else {
        const canvas = document.createElement('canvas');
        target.appendChild(canvas);
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

// [4] 기존 표 관리 함수 (renderDataTable, toggleSidebar 등은 기존 유지)
window.renderDataTable = async function() { /* 기존 코드 유지 */ };
window.toggleSidebar = function() { /* 기존 코드 유지 */ };
window.toggleEditMode = function() { /* 기존 코드 유지 */ };