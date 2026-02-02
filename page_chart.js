// page_chart.js
window.initChartPage = async function() {
    tableName = getTableNameFromUrl();
    if (!tableName) return false;
    await loadTableConfig();
    const { data } = await _supabase.from('data_rows').select('*').eq('project_key', tableName);
    rawData = data || [];
    return true;
};

// 피벗 및 차트 렌더링
window.processAndRender = function(config, type, targetId) {
    const target = document.getElementById(targetId);
    if (!target || rawData.length === 0) return;

    let filteredData = config.filter ? rawData.filter(r => Object.values(r).some(v => String(v).includes(config.filter))) : rawData;
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
        let html = `<table class="data-table"><thead><tr><th>구분</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>`;
        rows.forEach(r => {
            html += `<tr><td><strong>${r}</strong></td>${cols.map(c => `<td>${(pivot[r][c] || 0).toLocaleString()}</td>`).join('')}</tr>`;
        });
        target.innerHTML = html + `</tbody></table>`;
    } else {
        const canvas = document.createElement('canvas');
        target.appendChild(canvas);
        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: rows,
                datasets: cols.map((col, i) => ({
                    label: col,
                    data: rows.map(row => pivot[row][col] || 0),
                    backgroundColor: `hsla(${i * (360 / cols.length)}, 70%, 60%, 0.7)`
                }))
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
};

// 프리셋 저장
window.saveAnalysisPreset = async function(presetName, config, type) {
    await _supabase.from('analysis_presets').insert([{ project_key: tableName, preset_name: presetName, type: type, config: config }]);
    alert("💾 저장 완료");
    loadPresets();
};

// 프리셋 로드
window.loadPresets = async function() {
    const { data } = await _supabase.from('analysis_presets').select('*').eq('project_key', tableName).order('created_at', { ascending: false });
    if (typeof renderPresetButtons === 'function') renderPresetButtons(data || []);
};