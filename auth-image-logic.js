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
let selectedTerms = []; // 현재 선택된 검색어들
let filterMode = 'OR'; // 기본 모드: AND, OR, DEL
let isDelActive = false; // DEL 조합 여부
let savedSearchTerms = JSON.parse(localStorage.getItem('savedSearchTerms') || '["바디", "오일", "수분", "진정"]');

async function fetchImages(sortOrder = 'desc') {
    const grid = document.getElementById('imageGrid');
    const tagInput = document.getElementById('tagFilter');
    const tagFilter = tagInput ? tagInput.value.trim() : "";

    try {
        let query = _supabase.from('product_images').select('*').eq('project_key', tableName);
        const { data: allData, error } = await query.order('name', { ascending: sortOrder === 'asc' });

        if (error) throw error;

        // [필터링 로직] 1-2, 1-3 대응 (공백 무시 및 부분 일치)
        const filteredData = allData.filter(item => {
            const itemTags = (item.tags || []).map(t => t.replace(/\s+/g, '')); // DB 태그 공백 제거
            
            // 검색창 입력값 처리
            let targets = selectedTerms;
            if (tagFilter) targets = [...targets, tagFilter];
            if (targets.length === 0) return true;

            const matches = targets.map(term => {
                const cleanTerm = term.replace(/\s+/g, ''); // 검색어 공백 제거
                return itemTags.some(tag => tag.includes(cleanTerm) || cleanTerm.includes(tag));
            });

            // 3-4, 3-5, 3-6 검색 모드 적용
            let isMatch = false;
            if (filterMode === 'AND') isMatch = matches.every(m => m === true);
            else if (filterMode === 'OR') isMatch = matches.some(m => m === true);
            
            // 3-7 DEL 조합 처리
            if (isDelActive) return !isMatch; 
            return isMatch;
        });

        renderImages(filteredData);
    } catch (err) {
        console.error(err);
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

// 3-3, 3-8 모드 및 색상 관리
function setMode(mode) {
    filterMode = mode;
    document.querySelectorAll('.filter-mode-btn').forEach(b => b.classList.remove('active-and', 'active-or'));
    if(mode === 'AND') document.getElementById('btn-AND').classList.add('active-and');
    else document.getElementById('btn-OR').classList.add('active-or');
    renderSavedTerms();
}

function toggleDel() {
    isDelActive = !isDelActive;
    document.getElementById('btn-DEL').style.background = isDelActive ? '#e53e3e' : '#edf2f7';
    document.getElementById('btn-DEL').style.color = isDelActive ? 'white' : '#4a5568';
    renderSavedTerms();
}

// 3-2 검색어 편집
function editSavedTerms() {
    const res = prompt("검색어 10개를 쉼표(,)로 구분해 입력하세요", savedSearchTerms.join(','));
    if (res) {
        savedSearchTerms = res.split(',').map(s => s.trim()).slice(0, 10);
        localStorage.setItem('savedSearchTerms', JSON.stringify(savedSearchTerms));
        renderSavedTerms();
    }
}

// 3-8 검색어 선택 및 강조
function toggleTerm(term) {
    if (selectedTerms.includes(term)) {
        selectedTerms = selectedTerms.filter(t => t !== term);
    } else {
        selectedTerms.push(term);
    }
    renderSavedTerms();
}

function renderSavedTerms() {
    const list = document.getElementById('savedTermsList');
    list.innerHTML = savedSearchTerms.map(term => {
        const isSelected = selectedTerms.includes(term);
        let activeColor = '#edf2f7'; // 기본
        if (isSelected) {
            if (isDelActive) activeColor = '#fed7d7'; // DEL 강조 (연빨강)
            else if (filterMode === 'AND') activeColor = '#c6f6d5'; // AND 강조 (연초록)
            else activeColor = '#bee3f8'; // OR 강조 (연파랑)
        }
        return `<button onclick="toggleTerm('${term}')" style="padding: 5px 12px; border-radius: 20px; border: 1px solid #cbd5e0; background: ${activeColor}; font-size: 12px; cursor: pointer;">${term}</button>`;
    }).join('');
}

function resetSearch() {
    selectedTerms = [];
    document.getElementById('tagFilter').value = "";
    fetchImages();
}

// 초기 실행
window.onload = () => { setMode('OR'); renderSavedTerms(); };