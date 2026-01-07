/**
 * 정품 이미지 관리 시스템 로직 (auth-image-logic.js)
 * 기능: 이미지 목록 렌더링, 클립보드 복사(이미지/URL), 추가(팝업), 삭제(체크박스)
 */

let isEditMode = false;

// 1. 데이터 불러오기 및 리스트 렌더링
async function fetchImages() {
    const grid = document.getElementById('imageGrid');
    if (!grid) return;

    try {
        // Supabase에서 현재 프로젝트 키워드(tableName)에 해당하는 데이터만 가져옴
        const { data, error } = await _supabase
            .from('product_images')
            .select('*')
            .eq('project_key', tableName)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #a0aec0; background: white; border-radius: 12px;">
                    <p>📸 등록된 정품 이미지가 없습니다.</p>
                </div>`;
            return;
        }

        grid.innerHTML = data.map(item => `
            <div class="image-item" style="display:flex; align-items:center; background:white; padding:15px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06); transition: 0.2s;">
                <input type="checkbox" class="img-checkbox" value="${item.id}" style="display:${isEditMode ? 'block' : 'none'}; margin-right:15px; width:18px; height:18px; cursor:pointer;">
                <img src="${item.thumbnail_url}" style="width:70px; height:70px; object-fit:cover; border-radius:8px; margin-right:20px; border:1px solid #edf2f7;">
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:15px; margin-bottom:8px; color:#2d3748;">${item.name}</div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="copyImageToClipboard('${item.real_url}')" class="btn-select" style="font-size:12px; padding:5px 10px; background:#ebf8ff; color:#2b6cb0; border:none;">🖼️ 이미지 복사</button>
                        <button onclick="copyTextToClipboard('${item.real_url}')" class="btn-select" style="font-size:12px; padding:5px 10px; background:#f7fafc; color:#4a5568; border:none;">🔗 URL 복사</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('이미지 로드 실패:', err);
        grid.innerHTML = `<p style="color:red; padding:20px;">데이터 로드 중 오류가 발생했습니다.</p>`;
    }
}

// 2. 실제 이미지 데이터를 클립보드에 복사
async function copyImageToClipboard(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        
        // 브라우저 호환성을 위해 ClipboardItem 사용
        const item = new ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
        alert('✅ 실제 이미지가 클립보드에 복사되었습니다! (붙여넣기 가능)');
    } catch (err) {
        console.error('이미지 복사 실패:', err);
        alert('이미지 복사 실패: ' + err.message);
    }
}

// 3. URL 텍스트를 클립보드에 복사
function copyTextToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('🔗 이미지 URL이 복사되었습니다.');
    });
}

// 4. 수정/삭제 모드 토글
function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    
    if (btn) btn.innerText = isEditMode ? '✅ 선택 완료' : '✏️ 수정/삭제 모드';
    if (deleteBtn) deleteBtn.style.display = isEditMode ? 'block' : 'none';
    
    fetchImages(); // 체크박스 상태 업데이트를 위해 재렌더링
}

// 5. 이미지 삭제 (DB 반영)
async function deleteSelectedImages() {
    const checkedBoxes = document.querySelectorAll('.img-checkbox:checked');
    const ids = Array.from(checkedBoxes).map(cb => cb.value);

    if (ids.length === 0) return alert('삭제할 항목을 선택해 주세요.');
    if (!confirm(`${ids.length}개의 이미지를 삭제하시겠습니까?`)) return;

    try {
        const { error } = await _supabase.from('product_images').delete().in('id', ids);
        if (error) throw error;
        
        alert('🗑️ 삭제가 완료되었습니다.');
        if (isEditMode) toggleEditMode(); // 삭제 후 모드 해제
        else fetchImages();
    } catch (err) {
        alert('삭제 실패: ' + err.message);
    }
}

// 6. 이미지 추가 팝업 제어
window.openAddPopup = () => document.getElementById('imageModal').style.display = 'flex';
window.closeAddPopup = () => {
    document.getElementById('imageModal').style.display = 'none';
    // 입력창 초기화
    ['itemName', 'thumbUrl', 'realUrl'].forEach(id => document.getElementById(id).value = '');
};

// 7. 새 이미지 데이터베이스 저장
async function saveImage() {
    const name = document.getElementById('itemName').value;
    const thumbnail_url = document.getElementById('thumbUrl').value;
    const real_url = document.getElementById('realUrl').value;

    if (!name || !thumbnail_url || !real_url) return alert('모든 필드를 입력해 주세요.');

    try {
        const { error } = await _supabase.from('product_images').insert([
            { name, thumbnail_url, real_url, project_key: tableName }
        ]);

        if (error) throw error;

        alert('✨ 이미지가 성공적으로 등록되었습니다.');
        closeAddPopup();
        fetchImages();
    } catch (err) {
        alert('저장 실패: ' + err.message);
    }
}