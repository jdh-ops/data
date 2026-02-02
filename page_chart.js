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

    // 1. 데이터 필터링
    let filteredData = rawData;
    if (config.filter) {
        filteredData = rawData.filter(r => 
            Object.values(r).some(v => String(v).includes(config.filter))
        );
    }

    // [변경사항] 데이터 수 표시를 위해 상위 제목 요소 업데이트
    const headerElement = target.closest('.report-item')?.querySelector('h4, h3');
    if (headerElement) {
        // 기존 텍스트 유지하며 (N건) 추가
        const originalTitle = headerElement.innerText.split('(')[0].trim();
        headerElement.innerText = `${originalTitle} (${filteredData.length}건)`;
    }

    if (filteredData.length === 0) {
        target.innerHTML = `<div style="padding:50px; text-align:center; color:#94a3b8;">분석할 데이터가 없습니다.</div>`;
        return;
    }

    // 2. 피벗 그룹화 (교차 집계)
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

    // 3. 행 정렬 (사용자 선택 방식 적용)
    const rows = Object.keys(pivot).sort((a, b) => {
        const format = config.dateFormat || 'raw';
        if (format === 'monthOnly') {
            const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
            const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
            return numA - numB;
        }
        if (format === 'yyyy-mm') {
            const getVal = (str) => {
                const m = str.match(/(\d{4})[.-](\d{2})/);
                return m ? parseInt(m[1] + m[2]) : 0;
            };
            const valA = getVal(a);
            const valB = getVal(b);
            if (valA && valB) return valA - valB;
        }
        return a.localeCompare(b);
    });

    const cols = Array.from(colCategories).sort();

    // 4. 최종 출력
    if (type === 'table') {
        renderPivotTable(target, rows, cols, pivot, config.x);
    } else {
        renderPivotChart(target, rows, cols, pivot);
    }
};

/**
 * [보조] 피벗 테이블 HTML 생성 (하단 합계 추가)
 */
function renderPivotTable(target, rows, cols, pivot, xLabel) {
    let html = `<table class="data-table"><thead><tr><th>구분 (${xLabel})</th>`;
    cols.forEach(c => html += `<th>${c}</th>`);
    html += `<th style="background:#f8fafc; font-weight:bold;">총계</th></tr></thead><tbody>`;

    // 열별 합계를 저장할 객체
    const colTotals = {};
    let grandTotal = 0;

    rows.forEach(r => {
        let rowTotal = 0;
        html += `<tr><td><strong>${r}</strong></td>`;
        cols.forEach(c => {
            const val = pivot[r][c] || 0;
            html += `<td>${val.toLocaleString()}</td>`;
            rowTotal += val;
            colTotals[c] = (colTotals[c] || 0) + val;
        });
        html += `<td style="background:#f8fafc; font-weight:bold;">${rowTotal.toLocaleString()}</td></tr>`;
        grandTotal += rowTotal;
    });

    // [변경사항] 하단 합계 행(Tfoot) 추가
    html += `</tbody><tfoot><tr style="background:#edf2f7; font-weight:bold;"><td>합계</td>`;
    cols.forEach(c => {
        html += `<td>${(colTotals[c] || 0).toLocaleString()}</td>`;
    });
    html += `<td>${grandTotal.toLocaleString()}</td></tr></tfoot></table>`;
    
    target.innerHTML = html;
}

/**
 * [보조] Chart.js 그래프 생성
 */
function renderPivotChart(target, rows, cols, pivot) {
    const canvas = document.createElement('canvas');
    target.innerHTML = ''; 
    target.appendChild(canvas);
    
    const datasets = cols.map((col, i) => ({
        label: col,
        data: rows.map(row => pivot[row][col] || 0),
        backgroundColor: `hsla(${i * (360 / cols.length)}, 70%, 60%, 0.7)`
    }));

    new Chart(canvas, {
        type: 'bar',
        data: { labels: rows, datasets: datasets },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                legend: { position: 'top' },
                title: { display: false } // 제목은 HTML 태그에서 직접 처리
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