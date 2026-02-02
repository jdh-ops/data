// page_chart.js

/**
 * [1] 차트 페이지 데이터 초기화
 * 공통 라이브러리(lib_data.js)를 활용하여 레이아웃과 데이터를 불러옵니다.
 */
window.initChartPage = async function() {
    tableName = getTableNameFromUrl();
    if (!tableName) return false;

    try {
        // 1. 열 설정 레이아웃 로드
        await loadTableConfig();
        
        // 2. 해당 프로젝트의 전체 로우 데이터 로드
        const { data, error } = await _supabase
            .from('data_rows')
            .select('*')
            .eq('project_key', tableName);

        if (error) throw error;
        
        rawData = data || [];
        console.log("차트 데이터 로드 완료:", rawData.length, "건");
        return true;
    } catch (err) {
        console.error("차트 초기화 중 오류:", err);
        return false;
    }
};

/**
 * [2] 피벗 처리 및 시각화 (표/차트) 렌더링
 * 행(X)과 열(Y)을 교차 분석하고, 선택된 정렬 방식에 따라 데이터를 정렬합니다.
 */
window.processAndRender = function(config, type, targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;

    // 1. 데이터 필터링 (AND, OR, 제외 로직)
    let filteredData = rawData;
    if (config.filterVal) {
        const keywords = config.filterVal.split(',').map(k => k.trim()).filter(k => k);
        const col = config.filterCol;
        const op = config.filterOp || 'and';

        filteredData = rawData.filter(row => {
            const targets = col === 'all' ? Object.values(row).map(String) : [String(row[col] || '')];
            
            if (op === 'not') {
                return !keywords.some(kw => targets.some(t => t.includes(kw)));
            } else if (op === 'or') {
                return keywords.some(kw => targets.some(t => t.includes(kw)));
            } else {
                return keywords.every(kw => targets.some(t => t.includes(kw)));
            }
        });
    }

    // 2. 피벗 데이터 그룹화 (월별 합산 로직 포함)
    const pivot = {};
    const colSet = new Set();

    filteredData.forEach(item => {
        let rowKey = String(item[config.x] || '미분류');
        let colKey = config.yBase === 'total' ? '합계' : String(item[config.yBase] || '기타');

        // [핵심] 월별 합산 체크 시 날짜 변환 (예: 2025-12-01 -> 2025-12)
        if (config.useMonth) {
            const dateMatch = rowKey.match(/(\d{4})[.-](\d{2})/);
            if (dateMatch) {
                rowKey = `${dateMatch[1]}-${dateMatch[2]}`;
            }
        }

        if (!pivot[rowKey]) pivot[rowKey] = { _total: 0 };
        if (!pivot[rowKey][colKey]) pivot[rowKey][colKey] = 0;

        pivot[rowKey][colKey] += 1;
        pivot[rowKey]._total += 1;
        colSet.add(colKey);
    });

    const cols = Array.from(colSet).sort();

    // 3. 정렬 로직 (합계 기준 정렬 등)
    const rows = Object.keys(pivot).sort((a, b) => {
        const format = config.dateFormat || 'raw';
        if (format === 'totalAsc') return pivot[a]._total - pivot[b]._total;
        if (format === 'totalDesc') return pivot[b]._total - pivot[a]._total;
        if (format === 'monthOnly') {
            return (parseInt(a.replace(/[^0-9]/g, '')) || 0) - (parseInt(b.replace(/[^0-9]/g, '')) || 0);
        }
        if (format === 'yyyy-mm') {
            const getV = (s) => { const m = s.match(/(\d{4})[.-](\d{2})/); return m ? parseInt(m[1]+m[2]) : 0; };
            return getV(a) - getV(b);
        }
        return a.localeCompare(b);
    });

    // 4. 결과 렌더링 (테이블 또는 차트)
    if (type === 'table') {
        const xLabel = currentLayout.find(c => `col${c.id}_val` === config.x)?.customName || '항목';
        renderPivotTable(target, rows, cols, pivot, xLabel);
    } else {
        renderPivotChart(target, rows, cols, pivot, config);
    }
};

/**
 * [보조] 피벗 테이블 HTML 생성 (하단 합계 추가)
 */
// page_chart.js 내 renderPivotTable 함수 수정
function renderPivotTable(target, rows, cols, pivot, xLabel) {
    // 1. 우측 합계 열을 표시할지 결정 (열 구분이 'total'인 경우 숨김)
    // cols가 ['개수'] 하나만 있고, 데이터 상에 열 구분이 없는 경우를 체크합니다.
    const isTotalMode = cols.length === 1 && (cols[0] === '개수' || cols[0] === '합계');

    let html = `<table class="data-table"><thead><tr><th>구분 (${xLabel})</th>`;
    cols.forEach(c => html += `<th>${c}</th>`);
    
    // 전체 합계 모드가 아닐 때만 우측 '전체 합계' 헤더 추가
    if (!isTotalMode) {
        html += `<th style="background:#f8fafc; font-weight:bold;">전체 합계</th></tr></thead><tbody>`;
    } else {
        html += `</tr></thead><tbody>`;
    }

    let grandTotal = 0;
    const colTotals = {};

    rows.forEach(r => {
        let rowTotal = 0;
        html += `<tr><td><strong>${r}</strong></td>`;
        cols.forEach(c => {
            const val = pivot[r][c] || 0;
            html += `<td>${val.toLocaleString()}</td>`;
            rowTotal += val;
            colTotals[c] = (colTotals[c] || 0) + val;
        });

        // 전체 합계 모드가 아닐 때만 우측 행별 합계 수치 추가
        if (!isTotalMode) {
            html += `<td style="background:#f8fafc; font-weight:bold;">${rowTotal.toLocaleString()}</td></tr>`;
        } else {
            html += `</tr>`;
        }
        grandTotal += rowTotal;
    });

    // 2. 하단 합계 행은 항상 유지합니다.
    html += `</tbody><tfoot><tr style="background:#edf2f7; font-weight:bold;"><td>합계</td>`;
    cols.forEach(c => html += `<td>${(colTotals[c] || 0).toLocaleString()}</td>`);
    
    // 전체 합계 모드가 아닐 때만 우측 하단 모서리 총합계 추가
    if (!isTotalMode) {
        html += `<td>${grandTotal.toLocaleString()}</td></tr></tfoot></table>`;
    } else {
        html += `</tr></tfoot></table>`;
    }
    
    target.innerHTML = html;
}

/**
 * [보조] Chart.js 그래프 생성
 */
function renderPivotChart(target, rows, cols, pivot, config) {
    const canvas = document.createElement('canvas');
    target.innerHTML = ''; 
    target.appendChild(canvas);
    
    const chartType = config.chartType || 'bar'; // 사용자가 선택한 타입 적용
    
    const datasets = cols.map((col, i) => ({
        label: col,
        data: rows.map(row => pivot[row][col] || 0),
        backgroundColor: chartType === 'pie' || chartType === 'doughnut' 
            ? rows.map((_, idx) => `hsla(${idx * (360 / rows.length)}, 70%, 60%, 0.7)`) // 파이차트는 항목별 색상 다르게
            : `hsla(${i * (360 / cols.length)}, 70%, 60%, 0.7)`
    }));

    new Chart(canvas, {
        type: chartType,
        data: { labels: rows, datasets: datasets },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                legend: { position: chartType === 'pie' ? 'right' : 'top' } 
            }
        }
    });
}

/**
 * [3] 프리셋 저장 및 로드
 */
window.saveAnalysisPreset = async function(presetName, config, type) {
    if (!tableName) tableName = getTableNameFromUrl();
    const { error } = await _supabase.from('analysis_presets').insert([{
        project_key: tableName,
        preset_name: presetName,
        type: type,
        config: config
    }]);
    if (!error) {
        alert("💾 프리셋이 저장되었습니다.");
        loadPresets();
    } else {
        alert("저장 실패: " + error.message);
    }
};

window.loadPresets = async function() {
    if (!tableName) tableName = getTableNameFromUrl();
    const { data, error } = await _supabase
        .from('analysis_presets')
        .select('*')
        .eq('project_key', tableName)
        .order('created_at', { ascending: false });
    if (!error && typeof renderPresetButtons === 'function') {
        renderPresetButtons(data || []);
    }
};

// [추가] 프리셋 삭제 함수
window.deleteAnalysisPreset = async function(presetId, event) {
    // 버튼 클릭 시 프리셋 적용(부모 이벤트)이 발생하지 않도록 방지
    if (event) event.stopPropagation();

    if (!confirm("이 프리셋을 영구적으로 삭제하시겠습니까?")) return;

    try {
        const { error } = await _supabase
            .from('analysis_presets')
            .delete()
            .eq('id', presetId);

        if (!error) {
            alert("🗑️ 프리셋이 삭제되었습니다.");
            await loadPresets(); // 목록 새로고침
        } else {
            throw error;
        }
    } catch (err) {
        alert("삭제 중 오류 발생: " + err.message);
    }
};