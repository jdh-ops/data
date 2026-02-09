// lib_data.js
let tableName = ""; 
let currentLayout = [];
let rawData = [];
let currentPresetId = null;

// [공통] URL에서 테이블명 추출
function getTableNameFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('table') || "";
}

// [공통] 레이아웃 설정 로드
async function loadTableConfig() {
    if (!tableName) tableName = getTableNameFromUrl();
    try {
        // [수정] 단일 항목이 아니라 목록을 가져와서 첫 번째 것을 기본값으로 사용
        const { data } = await _supabase
            .from('data_config')
            .select('id, columns_layout, layout_name')
            .eq('project_key', tableName)
            .order('created_at', { ascending: true });

        const DEFAULT_LAYOUT = [
            { id: 1, defaultName: "날짜", customName: "날짜", isVisible: true },
            { id: 2, defaultName: "URL", customName: "URL", isVisible: true },
            { id: 3, defaultName: "상품명", customName: "상품명", isVisible: true },
            { id: 4, defaultName: "가격", customName: "가격", isVisible: true },
            { id: 5, defaultName: "상태", customName: "상태", isVisible: true },
            { id: 6, defaultName: "태그", customName: "태그", isVisible: true }
        ];
        for (let i = 7; i <= 20; i++) {
            DEFAULT_LAYOUT.push({ id: i, defaultName: `열${i}`, customName: "", isVisible: false });
        }

        if (data && data.length > 0) {
            currentPresetId = data[0].id; // 첫 번째 설정을 현재 ID로 지정
            currentLayout = data[0].columns_layout;
        } else {
            currentLayout = DEFAULT_LAYOUT;
        }
        
        return currentLayout;
    } catch (e) {
        console.error("설정 로드 실패:", e);
        return [];
    }
}

//프리셋 목록 전체를 불러오는 함수
async function fetchAllPresets() {
    const { data } = await _supabase
        .from('data_config')
        .select('id, layout_name, columns_layout')
        .eq('project_key', tableName)
        .order('created_at', { ascending: true });
    return data || [];
}