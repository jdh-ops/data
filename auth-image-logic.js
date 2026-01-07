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

// 5. 데이터 불러오기 및 리스트 렌더링 (상품 URL 복사로 수정)
async function fetchImages() {
    const grid = document.getElementById('imageGrid');
    if (!grid) return;

    try {
        const { data, error } = await _supabase
            .from('product_images')
            .select('*')
            .eq('project_key', tableName)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = `<p style="text-align:center; padding:40px; color:#a0aec0;">📸 등록된 이미지가 없습니다.</p>`;
            return;
        }

        grid.innerHTML = data.map(item => `
            <div class="image-item" style="display:flex; align-items:center; background:white; padding:20px; border-radius:15px; box-shadow:0 4px 12px rgba(0,0,0,0.05); margin-bottom:10px;">
                <input type="checkbox" class="img-checkbox" value="${item.id}" style="display:${isEditMode ? 'block' : 'none'}; margin-right:20px; width:22px; height:22px; cursor:pointer;">
                
                <div style="width:150px; height:150px; border-radius:12px; overflow:hidden; border:1px solid #edf2f7; background:#f8fafc; flex-shrink:0;">
                    <img src="${item.thumbnail_url}" style="width:100%; height:100%; object-fit:contain; cursor:pointer;" onclick="window.open('${item.real_url}', '_blank')">
                </div>
                
                <div style="margin-left:30px; display:flex; flex-direction:column; gap:12px;">
                    <button onclick="copyImageToClipboard('${item.real_url}')" class="btn-select" style="padding:10px 20px; font-weight:bold; color:#2b6cb0; background:#ebf8ff; border:none; border-radius:8px; cursor:pointer; font-size:14px;">🖼️ 이미지 복사</button>
                    
                    <button onclick="copyTextToClipboard('${item.product_url || ''}')" class="btn-select" style="padding:10px 20px; font-weight:bold; color:#4a5568; background:#f7fafc; border:none; border-radius:8px; cursor:pointer; font-size:14px;">🔗 상품 URL 복사</button>
                    
                    ${item.product_url ? `<button onclick="window.open('${item.product_url}', '_blank')" class="btn-select" style="padding:10px 20px; font-weight:bold; color:#2f855a; background:#f0fff4; border:none; border-radius:8px; cursor:pointer; font-size:14px;">🛒 상품 페이지 이동</button>` : ''}
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