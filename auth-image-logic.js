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

    if (!thumbnail_url || !real_url) return alert('두 이미지를 모두 붙여넣어 주세요.');

    try {
        const { error } = await _supabase.from('product_images').insert([
            { 
                name: autoName, 
                thumbnail_url, 
                real_url, 
                product_url, 
                project_key: tableName 
            }
        ]);

        if (error) throw error;

        alert('✨ 저장되었습니다. (상품명: ' + autoName + ')');
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

// 5. 데이터 불러오기 및 리스트 렌더링 (추가 필요)
async function fetchImages() {
    const grid = document.getElementById('imageGrid');
    if (!grid) return;

    try {
        // 현재 테이블명(tableName)과 일치하는 데이터만 가져옴
        const { data, error } = await _supabase
            .from('product_images')
            .select('*')
            .eq('project_key', tableName)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 데이터가 없을 때 표시
        if (!data || data.length === 0) {
            grid.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #a0aec0; background: white; border-radius: 12px;">
                    <p>📸 등록된 정품 이미지가 없습니다.</p>
                </div>`;
            return;
        }

        // 데이터가 있을 때 HTML 생성
        grid.innerHTML = data.map(item => `
            <div class="image-item" style="display:flex; align-items:center; background:white; padding:15px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <input type="checkbox" class="img-checkbox" value="${item.id}" style="display:${isEditMode ? 'block' : 'none'}; margin-right:15px; width:18px; height:18px;">
                <img src="${item.thumbnail_url}" style="width:70px; height:70px; object-fit:cover; border-radius:8px; margin-right:20px; border:1px solid #edf2f7;">
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:14px; margin-bottom:8px; color:#2d3748;">${item.name}</div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="copyImageToClipboard('${item.real_url}')" class="btn-select" style="font-size:11px; padding:5px 10px; background:#ebf8ff; color:#2b6cb0; border:none; margin-top:0;">🖼️ 이미지 복사</button>
                        <button onclick="copyTextToClipboard('${item.real_url}')" class="btn-select" style="font-size:11px; padding:5px 10px; background:#f7fafc; color:#4a5568; border:none; margin-top:0;">🔗 URL 복사</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('데이터 로드 실패:', err);
        grid.innerHTML = `<p style="color:red; padding:20px;">데이터를 불러오는 중 오류가 발생했습니다.</p>`;
    }
}

// 6. 클립보드 복사 유틸리티 (추가 필요)
async function copyImageToClipboard(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        alert('🖼️ 이미지가 클립보드에 복사되었습니다.');
    } catch (err) { alert('이미지 복사 실패'); }
}

function copyTextToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert('🔗 URL이 복사되었습니다.');
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