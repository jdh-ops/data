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