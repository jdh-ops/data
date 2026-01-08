// 1. 이미지 붙여넣기 핸들러
async function handleImagePaste(event, type) {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    let blob = null;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
            blob = items[i].getAsFile();
            break;
        }
    }

    if (!blob) return;

    // 미리보기 표시
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById(`${type}Preview`).src = e.target.result;
        document.getElementById(`${type}Preview`).style.display = 'block';
        document.getElementById(`${type}Text`).style.display = 'none';
    };
    reader.readAsDataURL(blob);

    // 즉시 Storage 업로드
    try {
        const timestamp = new Date().getTime();
        const fileName = `${timestamp}_${type}.png`;
        const filePath = `${tableName}/product_assets/${fileName}`;
        
        const { error } = await _supabase.storage
            .from('excel-files')
            .upload(filePath, blob);

        if (error) throw error;

        const { data: urlData } = _supabase.storage.from('excel-files').getPublicUrl(filePath);
        document.getElementById(`${type}Url`).value = urlData.publicUrl;

        checkInputs(); // 저장 버튼 활성화 체크
    } catch (err) {
        alert("이미지 업로드 실패: " + err.message);
    }
}

// 2. 저장 버튼 활성화 체크
function checkInputs() {
    const thumb = document.getElementById('thumbUrl').value;
    const real = document.getElementById('realUrl').value;
    const saveBtn = document.getElementById('saveImgBtn');

    if (thumb && real) {
        saveBtn.disabled = false;
        saveBtn.innerText = "저장하기";
    }
}

// 3. 데이터 저장 (상품명 자동 생성)
async function saveImage() {
    // 상품명 자동 생성: ITEM_YYYYMMDD_HHMMSS 형식
    const now = new Date();
    const autoName = "ITEM_" + now.getFullYear() + 
                     String(now.getMonth() + 1).padStart(2, '0') + 
                     String(now.getDate()).padStart(2, '0') + "_" +
                     String(now.getHours()).padStart(2, '0') + 
                     String(now.getMinutes()).padStart(2, '0') + 
                     String(now.getSeconds()).padStart(2, '0');

    const thumbnail_url = document.getElementById('thumbUrl').value;
    const real_url = document.getElementById('realUrl').value;
    const product_url = document.getElementById('productUrl').value;
    
    // [추가] 태그 입력값 가져오기
    const tagsInput = document.getElementById('tagsInput') ? document.getElementById('tagsInput').value : "";
    // 콤마로 분리하여 배열로 만들고 공백 제거
    const tagsArray = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== "");

    if (!thumbnail_url || !real_url) return alert('두 이미지를 모두 붙여넣어 주세요.');

    try {
        const { error } = await _supabase.from('product_images').insert([
            { 
                name: autoName, 
                thumbnail_url, 
                real_url, 
                product_url, 
                project_key: tableName,
                tags: tagsArray // [추가] 태그 배열 저장
            }
        ]);

        if (error) throw error;

        alert('✨ 저장되었습니다. (상품명: ' + autoName + ')');
        
        // [추가] 저장 후 입력창 초기화 (선택사항)
        if(document.getElementById('tagsInput')) document.getElementById('tagsInput').value = "";
        
        closeAddPopup();
        fetchImages();
    } catch (err) {
        alert('저장 실패: ' + err.message);
    }
}

// 4. 모달 초기화
window.closeAddPopup = () => {
    document.getElementById('imageModal').style.display = 'none';
    ['productUrl', 'thumbUrl', 'realUrl'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('thumbPreview').style.display = 'none';
    document.getElementById('realPreview').style.display = 'none';
    document.getElementById('thumbText').style.display = 'block';
    document.getElementById('realText').style.display = 'block';
    document.getElementById('saveImgBtn').disabled = true;
    document.getElementById('saveImgBtn').innerText = "이미지 대기 중...";
};

// 5. 데이터 불러오기 및 리스트 렌더링 (상품 URL 복사로 수정)
async function fetchImages(sortOrder = 'desc') {
    const grid = document.getElementById('imageGrid');
    if (!grid) return;

    // [수정] 카드 너비 축소: minmax(280px -> 200px)
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    grid.style.gap = '15px'; // 여백도 조금 줄임

    try {
        const tagFilter = document.getElementById('tagFilter') ? document.getElementById('tagFilter').value.trim() : "";
        let query = _supabase.from('product_images').select('*').eq('project_key', tableName);

        if (tagFilter) {
            query = query.contains('tags', [tagFilter]);
        }
        
        query = query.order('name', { ascending: sortOrder === 'asc' });
        const { data, error } = await query;

        if (error) throw error;

        grid.innerHTML = data.map(item => `
            <div class="image-item" style="background:white; padding:12px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; flex-direction:column; align-items:center;">
                
                <div style="width:100%; display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; min-height:32px;">
                    <div style="display:flex; flex-wrap:wrap; gap:3px; max-width: 75%; overflow:hidden;">
                        ${item.tags && item.tags.length > 0 
                            ? item.tags.map(t => `<span style="background:#edf2f7; color:#4a5568; font-size:9px; padding:1px 5px; border-radius:3px; font-weight:bold;">#${t}</span>`).join('') 
                            : '<span style="color:#cbd5e0; font-size:9px;">#태그없음</span>'}
                    </div>
                    
                    <button onclick="openEditTagPopup('${item.id}', '${(item.tags || []).join(', ')}')" 
                            style="background:white; border:1px solid #e2e8f0; border-radius:4px; cursor:pointer; font-size:10px; padding:2px 4px; color:#a0aec0; white-space:nowrap;">
                        ✏️ 수정
                    </button>
                </div>
                
                <div style="width:100%; aspect-ratio: 1/1; border-radius:8px; overflow:hidden; border:1px solid #edf2f7; background:#f8fafc; cursor:pointer;" onclick="window.open('${item.real_url}', '_blank')">
                    <img src="${item.thumbnail_url}" style="width:100%; height:100%; object-fit:contain;">
                </div>
                
                <div style="width:100%; margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
                    <button onclick="copyImageToClipboard('${item.real_url}')" style="padding:6px; font-size:11px; font-weight:bold; color:#2b6cb0; background:#ebf8ff; border:none; border-radius:5px; cursor:pointer;">🖼️ 이미지</button>
                    <button onclick="copyTextToClipboard('${item.product_url || ''}')" style="padding:6px; font-size:11px; font-weight:bold; color:#4a5568; background:#f7fafc; border:none; border-radius:5px; cursor:pointer;">🔗 URL</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = `<p style="color:red; padding:20px;">데이터 로드 실패</p>`;
    }
}

// 6. 클립보드 복사 유틸리티 (추가 필요)
async function copyImageToClipboard(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } catch (err) { alert('이미지 복사 실패'); }
}

function copyTextToClipboard(text) {
    navigator.clipboard.writeText(text);
}

// 7. 수정/삭제 모드 관련 변수 및 함수 (추가 필요)
let isEditMode = false;
function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    if(btn) btn.innerText = isEditMode ? '✅ 선택 완료' : '✏️ 수정/삭제 모드';
    if(deleteBtn) deleteBtn.style.display = isEditMode ? 'block' : 'none';
    fetchImages();
}

async function deleteSelectedImages() {
    const ids = Array.from(document.querySelectorAll('.img-checkbox:checked')).map(cb => cb.value);
    if (ids.length === 0) return alert('삭제할 항목을 선택해 주세요.');
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const { error } = await _supabase.from('product_images').delete().in('id', ids);
    if (!error) {
        alert('삭제되었습니다.');
        fetchImages();
    }
}

// 8. 팝업 열기 (전역 연결)
window.openAddPopup = () => {
    document.getElementById('imageModal').style.display = 'flex';
};

// 9. 태그 수정 팝업 열기
function openEditTagPopup(id, currentTags) {
    const newTags = prompt("수정할 태그를 입력하세요 (쉼표로 구분):", currentTags);
    
    if (newTags !== null) {
        updateImageTags(id, newTags);
    }
}

// 10. DB 업데이트 함수
async function updateImageTags(id, tagsString) {
    const tagsArray = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag !== "");

    try {
        const { error } = await _supabase
            .from('product_images')
            .update({ tags: tagsArray })
            .eq('id', id);

        if (error) throw error;

        alert('✅ 태그가 수정되었습니다.');
        fetchImages(); // 목록 새로고침하여 변경사항 반영
    } catch (err) {
        alert('수정 실패: ' + err.message);
    }
}