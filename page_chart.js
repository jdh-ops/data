// page_chart.js

/**
 * [1] 차트 페이지 데이터 초기화
 * 공통 라이브러리(lib_data.js)를 활용하여 레이아웃과 데이터를 불러옵니다.
 */
window.initChartPage = async function() {
    tableName = getTableNameFromUrl();
    if (!tableName) return false;

    try {
        // 열 설정과 로우 데이터를 병렬로 로드하여 속도 개선 (Promise.all 활용 가능)
        const [configResult, dataResult] = await Promise.all([
            loadTableConfig(),
            _supabase.from('data_rows').select('*').eq('project_key', tableName)
        ]);

        if (dataResult.error) throw dataResult.error;
        
        rawData = dataResult.data || [];
        // [수정] 불필요한 리렌더링을 방지하기 위해 로드가 확실히 끝난 뒤 true 반환
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
    
    const chartType = config.chartType || 'bar';
    
    const datasets = cols.map((col, i) => ({
        label: col,
        data: rows.map(row => pivot[row][col] || 0),
        backgroundColor: (chartType === 'pie' || chartType === 'doughnut') 
            ? rows.map((_, idx) => `hsla(${idx * (360 / rows.length)}, 70%, 60%, 0.7)`)
            : `hsla(${i * (360 / cols.length)}, 70%, 60%, 0.7)`,
        // 막대/선 그래프일 때 숫자가 위로 잘 보이라고 위치 조정
        datalabels: {
            anchor: (chartType === 'pie' || chartType === 'doughnut') ? 'center' : 'end',
            align: (chartType === 'pie' || chartType === 'doughnut') ? 'center' : 'top',
            offset: 5
        }
    }));

    new Chart(canvas, {
        type: chartType,
        // [수정] 플러그인 등록: ChartDataLabels 추가
        plugins: [ChartDataLabels], 
        data: { labels: rows, datasets: datasets },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            // 숫자가 잘리지 않도록 상단 여백 확보
            layout: {
                padding: {
                    top: chartType === 'pie' || chartType === 'doughnut' ? 0 : 25
                }
            },
            plugins: { 
                legend: { position: chartType === 'pie' ? 'right' : 'top' },
                // [수정] 데이터 라벨 세부 설정
                datalabels: {
                    color: (chartType === 'pie' || chartType === 'doughnut') ? '#fff' : '#444',
                    font: { weight: 'bold', size: 11 },
                    formatter: function(value, context) {
                        // 1. 값이 0이면 표시하지 않음 (지저분함 방지)
                        if (value === 0) return null;

                        // 2. 파이/도넛 차트는 전체 대비 퍼센트 계산
                        if (chartType === 'pie' || chartType === 'doughnut') {
                            const dataset = context.dataset.data;
                            const total = dataset.reduce((acc, data) => acc + data, 0);
                            const percentage = ((value / total) * 100).toFixed(1) + '%';
                            return percentage;
                        }
                        
                        // 3. 막대/선 차트는 천단위 콤마 포함한 숫자 표시
                        return value.toLocaleString();
                    }
                }
            }
        }
    });
}

/**
 * [3] 프리셋 저장 및 로드
 */
window.saveAnalysisPreset = async function(presetName, config, type) {
    // project_key를 tableName 대신 'COMMON'으로 고정하여 모든 페이지에서 보이게 함
    const { error } = await _supabase.from('analysis_presets').insert([{
        project_key: 'COMMON', 
        preset_name: presetName,
        type: type,
        config: config
    }]);
    if (!error) {
        alert("💾 공통 프리셋이 저장되었습니다.");
        loadPresets();
    } else {
        alert("저장 실패: " + error.message);
    }
};

window.loadPresets = async function() {
    // .eq 조건을 삭제하여 접속 키워드와 상관없이 전체 프리셋을 로드함
    const { data, error } = await _supabase
        .from('analysis_presets')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (!error) {
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

window.injectCompactModalStyle = function() {
    if (document.getElementById('compact-modal-style')) return;

    const style = document.createElement('style');
    style.id = 'compact-modal-style';
    style.innerHTML = `
        /* 1. 프리셋 카드 전체 여백 조절 */
        .preset-card {
            min-height: auto !important;
            padding: 12px 18px !important; /* 상하 여백 25px -> 12px로 축소 */
            margin-bottom: 12px !important;
        }

        /* 2. 상단 (TABLE 배지 / 이름 / 저장 버튼) 영역 축소 */
        .preset-card > div:first-child {
            margin-bottom: 8px !important;
            padding-bottom: 5px !important;
            gap: 5px !important;
        }

        /* 3. '1. 필터 설정' 하늘색 박스 영역 슬림화 */
        .preset-card > div:nth-child(2) {
            padding: 8px 12px !important; /* 내부 여백 축소 */
            margin-bottom: 10px !important; /* 다음 항목과의 간격 축소 */
            border-radius: 8px !important;
        }

        /* 4. 필터 설정 내부 요소 (select, input, radio) 정렬 */
        .preset-card .p-filter-col, 
        .preset-card .p-filter-val {
            height: 32px !important; /* 입력창 높이 축소 */
            font-size: 13px !important;
        }

        /* 5. '2. 행(X축)', '3. 열' 등 라벨과 컨트롤 사이의 간격 축소 */
        .preset-card .form-label {
            margin-bottom: 2px !important; /* 라벨을 입력창에 가깝게 붙임 */
            font-size: 12px !important;
        }

        /* 6. 피벗 컨트롤 (행/열 선택창) 간격 축소 */
        .pivot-controls {
            gap: 10px !important; /* 좌우 간격 축소 */
            margin-top: 5px !important;
        }
        
        .pivot-controls select {
            height: 32px !important;
            font-size: 13px !important;
        }

        /* 7. 하단 '정렬 방식' 및 '삭제' 버튼 여백 제거 */
        .preset-card select.p-date-format {
            margin-top: 0px !important;
        }

        .preset-card button[onclick*="remove"] {
            margin-top: 5px !important;
            padding: 0 !important;
            font-size: 11px !important;
        }
    `;
    document.head.appendChild(style);
};

// 즉시 실행
window.injectCompactModalStyle();