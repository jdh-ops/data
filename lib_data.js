// lib_data.js
let tableName = ""; 
let currentLayout = [];
let rawData = [];

// [공통] URL에서 테이블명 추출
function getTableNameFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('table') || "";
}

// [공통] 레이아웃 설정 로드
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
        for (let i = 7; i <= 20; i++) {
            DEFAULT_LAYOUT.push({ id: i, defaultName: `열${i}`, customName: "", isVisible: false });
        }
        currentLayout = data?.columns_layout || DEFAULT_LAYOUT;
        return currentLayout;
    } catch (e) {
        console.error("설정 로드 실패:", e);
        return [];
    }
}