// lib_data.js

// [중요] 변수가 중복 선언되지 않도록 window 객체를 사용합니다.
// 이렇게 하면 page_manager.js나 config.js에서도 window.tableName으로 공통 접근이 가능합니다.
window.tableName = window.tableName || ""; 
window.currentLayout = window.currentLayout || [];
window.rawData = window.rawData || [];
window.currentPresetId = window.currentPresetId || null;

/**
 * [공통] 프리셋 목록 전체를 불러오는 함수
 * 어느 페이지에서든 프리셋 리스트가 필요할 때 이 함수를 사용합니다.
 */
async function fetchAllPresets() {
    // tableName이 비어있다면 URL에서 즉시 추출
    if (!window.tableName) {
        window.tableName = new URLSearchParams(window.location.search).get('table') || "";
    }
    
    try {
        const { data, error } = await _supabase
            .from('data_config')
            .select('id, layout_name, columns_layout')
            .eq('project_key', window.tableName)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("프리셋 목록 로드 실패:", e);
        return [];
    }
}