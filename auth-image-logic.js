/**
 * [auth-image-logic.js]
 * 기능: 이미지 붙여넣기 업로드, 태그 관리, 스마트 필터링, 이미지 그리드 렌더링
 */

// --- [상태 관리 변수] ---
let selectedTerms = []; // 파란색(AND/OR) 검색어
let excludeTerms = [];  // 빨간색(DEL) 검색어
let isEditMode = false;
let filterMode = 'OR';  
let isDelActive = false; 
let savedSearchTerms = JSON.parse(localStorage.getItem('savedSearchTerms') || '["바디", "오일", "수분", "진정"]');
let tempEditList = []; // 팝업 내 임시 데이터 저장 배열
let currentEditId = null; // 태그 수정 시 이미지 ID 저장용
let hoverTimer = null; // 1초 지연을 위한 타이머
let currentMousePos = { x: 0, y: 0 }; // 최신 마우스 위치 저장용
let bulkEditMode = 'ADD'; // 'ADD' 또는 'REMOVE'

// --- [1. 이미지 붙여넣기 및 업로드] ---
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

        checkInputs(); 
    } catch (err) {
        alert("이미지 업로드 실패: " + err.message);
    }
}

function checkInputs() {
    const thumb = document.getElementById('thumbUrl').value;
    const real = document.getElementById('realUrl').value;
    const saveBtn = document.getElementById('saveImgBtn');

    if (thumb && real) {
        saveBtn.disabled = false;
        saveBtn.innerText = "저장하기";
    }
}

// --- [2. 데이터 저장] ---
async function saveImage() {
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
    const tagsInput = document.getElementById('tagsInput') ? document.getElementById('tagsInput').value : "";
    const tagsArray = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== "");

    if (!thumbnail_url || !real_url) return alert('두 이미지를 모두 붙여넣어 주세요.');

    try {
        const { error } = await _supabase.from('product_images').insert([
            { name: autoName, thumbnail_url, real_url, product_url, project_key: tableName, tags: tagsArray }
        ]);

        if (error) throw error;
        alert('✨ 저장되었습니다.');
        closeAddPopup();
        fetchImages();
    } catch (err) {
        alert('저장 실패: ' + err.message);
    }
}

// --- [3. 데이터 로드 및 필터링] ---
async function fetchImages(sortOrder = 'desc') {
    const grid = document.getElementById('imageGrid');
    const tagFilter = document.getElementById('tagFilter').value.trim();
    if (!grid) return;

    grid.innerHTML = "<p style='text-align:center; padding:20px;'>데이터 로딩 중...</p>";

    try {
        let { data: allData, error } = await _supabase
            .from('product_images')
            .select('*')
            .eq('project_key', tableName)
            .order('name', { ascending: sortOrder === 'asc' });

        if (error) throw error;

        const filteredData = allData.filter(item => {
            const itemTags = (item.tags || []).map(t => t.replace(/\s+/g, ''));
            
            // [A] 포함 조건 (파란색 버튼 + 직접 입력)
            let includeTargets = [...selectedTerms];
            if (tagFilter) includeTargets.push(tagFilter);

            // [B] 제외 조건 (빨간색 버튼)
            let excludeTargets = [...excludeTerms];

            // 1차 필터링: 포함 조건 확인 (AND/OR)
            let passInclude = true;
            if (includeTargets.length > 0) {
                const includeMatches = includeTargets.map(term => {
                    const clean = term.replace(/\s+/g, '');
                    return itemTags.some(tag => tag.includes(clean) || clean.includes(tag));
                });
                passInclude = (filterMode === 'AND') ? includeMatches.every(m => m) : includeMatches.some(m => m);
            }

            // 2차 필터링: 제외 조건 확인 (제외 태그가 하나라도 포함되면 탈락)
            let passExclude = true;
            if (excludeTargets.length > 0) {
                const hasExcludeTerm = excludeTargets.some(term => {
                    const clean = term.replace(/\s+/g, '');
                    return itemTags.some(tag => tag.includes(clean) || clean.includes(tag));
                });
                if (hasExcludeTerm) passExclude = false;
            }

            return passInclude && passExclude;
        });

        renderImageGrid(filteredData); // 그리드 그리기
        renderSavedTerms(); // 필터 버튼 상태 업데이트
    } catch (err) { 
        console.error(err); 
        grid.innerHTML = "<p style='color:red; text-align:center;'>로드 실패</p>";
    }
}

// --- [4. 그리드 렌더링 (카드 크기 70% 축소)] ---
function renderImageGrid(data) {
    const grid = document.getElementById('imageGrid');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    grid.style.gap = '15px';

    if (data.length === 0) {
        grid.innerHTML = "<p style='grid-column:1/-1; text-align:center; padding:40px; color:#a0aec0;'>🔎 결과가 없습니다.</p>";
        return;
    }

    grid.innerHTML = data.map(item => `
        <div class="image-item" style="background:white; padding:12px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; flex-direction:column; align-items:center;">
            <div style="width:100%; display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; min-height:32px;">
                <div style="display:flex; flex-wrap:wrap; gap:3px; max-width: 75%;">
                    ${item.tags && item.tags.length > 0 
                        ? item.tags.map(t => `<span style="background:#edf2f7; color:#4a5568; font-size:9px; padding:1px 5px; border-radius:3px; font-weight:bold;">#${t}</span>`).join('') 
                        : '<span style="color:#cbd5e0; font-size:9px;">#태그없음</span>'}
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                    <input type="checkbox" class="img-checkbox" value="${item.id}" style="display:${isEditMode ? 'block' : 'none'}; width:16px; height:16px;">
                    <button onclick="openEditTagPopup('${item.id}', '${(item.tags || []).join(', ')}')" 
                            style="background:white; border:1px solid #e2e8f0; border-radius:4px; cursor:pointer; font-size:10px; padding:2px 4px; color:#a0aec0;">✏️ 수정</button>
                </div>
            </div>

            <div style="width:100%; aspect-ratio: 1/1; border-radius:8px; overflow:hidden; border:1px solid #edf2f7; background:#f8fafc;"
                 onmouseenter="showImagePreview(event, '${item.real_url}')" 
                 onmouseleave="hideImagePreview()" 
                 onmousemove="saveMousePos(event)">
                <img src="${item.thumbnail_url}" style="width:100%; height:100%; object-fit:contain;">
            </div>

            <div style="width:100%; margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
                <button onclick="copyImageToClipboard('${item.real_url}')" 
                        class="btn-select" style="padding:6px; font-size:11px; margin-top:0;">
                    🖼️ 복사
                </button>
                <button onclick="copyTextToClipboard('${item.product_url || ''}')" 
                        class="btn-select" style="padding:6px; font-size:11px; margin-top:0;">
                    🔗 URL
                </button>
            </div>
        </div>
    `).join('');
}

// --- [5. 필터 및 모드 제어] ---
function setMode(mode) {
    filterMode = mode;
    renderSavedTerms();
}

function toggleDel() {
    isDelActive = !isDelActive;
    renderSavedTerms();
}

function renderSavedTerms() {
    const list = document.getElementById('savedTermsList');
    if (!list) return;

    // 모드 버튼 강조 업데이트
    const btnAnd = document.getElementById('btn-AND');
    const btnOr = document.getElementById('btn-OR');
    const btnDel = document.getElementById('btn-DEL');

    if(btnAnd) btnAnd.className = (filterMode === 'AND' ? 'filter-mode-btn active-and' : 'filter-mode-btn');
    if(btnOr) btnOr.className = (filterMode === 'OR' ? 'filter-mode-btn active-or' : 'filter-mode-btn');
    if(btnDel) {
        btnDel.style.backgroundColor = isDelActive ? '#e53e3e' : '#edf2f7';
        btnDel.style.color = isDelActive ? 'white' : '#4a5568';
    }

    // 검색어 버튼 렌더링
    list.innerHTML = savedSearchTerms.map(term => {
        let bg = '#edf2f7';
        let color = '#4a5568';

        if (selectedTerms.includes(term)) { bg = '#bee3f8'; color = '#2b6cb0'; } // 파란색
        else if (excludeTerms.includes(term)) { bg = '#fed7d7'; color = '#e53e3e'; } // 빨간색

        return `<button onclick="toggleTerm('${term}')" 
                style="padding: 5px 12px; border-radius: 20px; border: 1px solid #cbd5e0; background: ${bg}; color: ${color}; font-size: 12px; cursor: pointer; transition: 0.2s;">
                ${term}
                </button>`;
    }).join('');
}

function toggleTerm(term) {
    if (isDelActive) {
        // DEL 모드: 빨간색(제외)으로 등록/해제
        if (excludeTerms.includes(term)) {
            excludeTerms = excludeTerms.filter(t => t !== term);
        } else {
            excludeTerms.push(term);
            selectedTerms = selectedTerms.filter(t => t !== term); // 파란색에 있으면 제거
        }
    } else {
        // 일반 모드: 파란색(포함)으로 등록/해제
        if (selectedTerms.includes(term)) {
            selectedTerms = selectedTerms.filter(t => t !== term);
        } else {
            selectedTerms.push(term);
            excludeTerms = excludeTerms.filter(t => t !== term); // 빨간색에 있으면 제거
        }
    }
    renderSavedTerms();
}

function resetAllFilters() {
    selectedTerms = [];
    excludeTerms = []; 
    isDelActive = false;
    filterMode = 'OR';
    const tagInput = document.getElementById('tagFilter');
    if(tagInput) tagInput.value = "";
    fetchImages();
}

// --- [2. 필터 검색어 편집 기능 연결] ---
function editSavedTerms() {
    openEditModal("⚙️ 필터 검색어 편집", savedSearchTerms, (updatedTerms) => {
        savedSearchTerms = updatedTerms.slice(0, 10); // 최대 10개 유지
        localStorage.setItem('savedSearchTerms', JSON.stringify(savedSearchTerms));
        renderSavedTerms();
    });
}

// --- [6. 기타 유틸리티] ---
function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeBtn');
    const delBtn = document.getElementById('deleteBtn');
    const bulkBtn = document.getElementById('bulkEditBtn'); // 추가된 버튼 ID

    if(btn) btn.innerText = isEditMode ? '✅ 완료' : '✏️ 수정';
    
    if(delBtn) delBtn.style.display = isEditMode ? 'block' : 'none';
    if(bulkBtn) bulkBtn.style.display = isEditMode ? 'block' : 'none'; 
    
    fetchImages();
}

async function deleteSelectedImages() {
    const ids = Array.from(document.querySelectorAll('.img-checkbox:checked')).map(cb => cb.value);
    if (!ids.length || !confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await _supabase.from('product_images').delete().in('id', ids);
    if (!error) { alert('삭제되었습니다.'); fetchImages(); }
}

// --- [1. 상품 태그 수정 기능 연결] ---
function openEditTagPopup(id, currentTagsString) {
    currentEditId = id;
    const initialTags = currentTagsString ? currentTagsString.split(',').map(t => t.trim()).filter(t => t) : [];
    
    openEditModal("🏷️ 상품 태그 수정", initialTags, async (updatedTags) => {
        const { error } = await _supabase
            .from('product_images')
            .update({ tags: updatedTags })
            .eq('id', currentEditId);

        if (!error) {
            fetchImages();
        } else {
            alert("태그 저장 실패: " + error.message);
        }
    });
}

async function updateImageTags(id, tagsString) {
    const tagsArray = tagsString.split(',').map(t => t.trim()).filter(t => t !== "");
    const { error } = await _supabase.from('product_images').update({ tags: tagsArray }).eq('id', id);
    if (!error) { fetchImages(); }
}

async function copyImageToClipboard(url, btn) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);

        const originalText = btn.innerHTML;
        btn.innerHTML = "✅ 완료";
        btn.style.color = "#38a169"; // 녹색으로 강조
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.color = ""; // 원래 색상으로 복구
        }, 500); // 0.5초 뒤 원상복구
    } catch (err) { 
        console.error('복사 실패:', err);
    }
}

function copyTextToClipboard(text, btn) {
    navigator.clipboard.writeText(text);

    const originalText = btn.innerHTML;
    btn.innerHTML = "✅ 완료";
    btn.style.color = "#38a169";
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.color = "";
    }, 500);
}

// --- [공통 모달 제어] ---
function openEditModal(title, initialData, onSave) {
    const modal = document.getElementById('editModal');
    document.getElementById('editModalTitle').innerText = title;
    document.getElementById('editModalInput').value = "";
    tempEditList = [...initialData];
    
    renderModalList();
    
    document.getElementById('editModalSaveBtn').onclick = () => {
        onSave(tempEditList);
        closeEditModal();
    };
    modal.style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

// 팝업 내 목록 렌더링 (x 버튼 포함)
function renderModalList() {
    const container = document.getElementById('editModalList');
    container.innerHTML = tempEditList.map((item, index) => `
        <div style="display: flex; align-items: center; background: #edf2f7; padding: 4px 10px; border-radius: 20px; font-size: 12px; color: #4a5568;">
            <span>${item}</span>
            <span onclick="removeTermFromModal(${index})" style="margin-left: 6px; cursor: pointer; font-weight: bold; color: #e53e3e;">×</span>
        </div>
    `).join('');
}

// 단어 추가 로직
function addTermToModal() {
    const input = document.getElementById('editModalInput');
    const val = input.value.trim();
    if (val && !tempEditList.includes(val)) {
        tempEditList.push(val);
        input.value = "";
        renderModalList();
    }
}

// 단어 삭제 로직 (x 버튼 클릭 시)
function removeTermFromModal(index) {
    tempEditList.splice(index, 1);
    renderModalList();
}

function showImagePreview(event, url) {
    clearTimeout(hoverTimer);
    // 진입 시점의 좌표도 일단 저장
    saveMousePos(event);

    hoverTimer = setTimeout(() => {
        const preview = document.getElementById('imageHoverPreview');
        const img = document.getElementById('hoverPreviewImg');
        
        if (preview && img) {
            preview.style.opacity = '0';
            preview.style.display = 'block';
            img.src = url;

            img.onload = function() {
                // [수정] event 대신 저장된 최신 좌표(currentMousePos)를 사용
                updatePreviewPosition();
                preview.style.opacity = '1';
            };

            if (img.complete) {
                updatePreviewPosition();
                preview.style.opacity = '1';
            }
        }
    }, 500); 
}

function hideImagePreview() {
    clearTimeout(hoverTimer); // 1초가 되기 전에 마우스가 벗어나면 취소
    const preview = document.getElementById('imageHoverPreview');
    preview.style.display = 'none';
    document.getElementById('hoverPreviewImg').src = "";
}

function updatePreviewPosition() {
    const preview = document.getElementById('imageHoverPreview');
    if (preview && preview.style.display === 'block') {
        const previewWidth = preview.offsetWidth;
        const previewHeight = preview.offsetHeight;

        // 저장된 최신 좌표 사용
        let posY = currentMousePos.y - previewHeight - 10;
        if (posY < 10) { 
            posY = currentMousePos.y + 10; 
        }
        
        let posX = currentMousePos.x - (previewWidth / 2);
        const safePosX = Math.max(10, Math.min(posX, window.innerWidth - previewWidth - 10));

        preview.style.left = safePosX + 'px';
        preview.style.top = posY + 'px';
    }
}

// 마우스 움직임을 실시간으로 기록하는 함수
function saveMousePos(event) {
    currentMousePos.x = event.clientX;
    currentMousePos.y = event.clientY;
    // 이미 미리보기가 떠 있는 상태라면 위치를 즉시 업데이트
    updatePreviewPosition();
}

async function openBulkTagModal() {
    const selectedCheckboxes = document.querySelectorAll('.img-checkbox:checked');
    const ids = Array.from(selectedCheckboxes).map(cb => cb.value);

    if (ids.length === 0) return alert("항목을 먼저 선택해주세요.");

    bulkEditMode = 'ADD'; // 초기값은 추가 모드
    
    // 모달을 열 때 탭 UI를 제목 아래에 삽입
    openEditModal(`📦 ${ids.length}개 항목 일괄 편집`, [], async (inputTags) => {
        if (inputTags.length === 0) return;
        await executeBulkTagAction(ids, inputTags);
    });

    // 제목 바로 아래에 탭 UI 삽입
    const titleEle = document.getElementById('editModalTitle');
    const tabHtml = `
        <div style="display:flex; margin-top:15px; background:#f7fafc; border-radius:8px; padding:4px;">
            <div id="tab-ADD" onclick="switchBulkTab('ADD')" style="flex:1; text-align:center; padding:8px; cursor:pointer; border-radius:6px; font-weight:bold; background:#4299e1; color:white;">➕ 태그 추가</div>
            <div id="tab-REMOVE" onclick="switchBulkTab('REMOVE')" style="flex:1; text-align:center; padding:8px; cursor:pointer; border-radius:6px; font-weight:bold; color:#4a5568;">❌ 태그 삭제</div>
        </div>
    `;
    titleEle.insertAdjacentHTML('afterend', tabHtml);
}

// 탭 전환 함수
function switchBulkTab(mode) {
    bulkEditMode = mode;
    const addTab = document.getElementById('tab-ADD');
    const removeTab = document.getElementById('tab-REMOVE');
    const saveBtn = document.getElementById('editModalSaveBtn');

    if (mode === 'ADD') {
        addTab.style.background = '#4299e1'; addTab.style.color = 'white';
        removeTab.style.background = 'none'; removeTab.style.color = '#4a5568';
        saveBtn.innerText = "선택 항목에 추가하기";
    } else {
        removeTab.style.background = '#ed8936'; removeTab.style.color = 'white';
        addTab.style.background = 'none'; addTab.style.color = '#4a5568';
        saveBtn.innerText = "선택 항목에서 삭제하기";
    }
}

// 실제 DB 적용 로직
async function executeBulkTagAction(ids, inputTags) {
    try {
        const { data: items, error: fetchError } = await _supabase
            .from('product_images')
            .select('id, tags')
            .in('id', ids);

        if (fetchError) throw fetchError;

        const updates = items.map(item => {
            let newTags = item.tags ? [...item.tags] : [];
            if (bulkEditMode === 'ADD') {
                inputTags.forEach(tag => { if (!newTags.includes(tag)) newTags.push(tag); });
            } else {
                newTags = newTags.filter(tag => !inputTags.includes(tag));
            }
            return _supabase.from('product_images').update({ tags: newTags }).eq('id', item.id);
        });

        await Promise.all(updates);
        alert(`✨ ${ids.length}개 항목 처리가 완료되었습니다.`);
        fetchImages();
    } catch (err) {
        alert("일괄 처리 실패: " + err.message);
    }
}



window.openAddPopup = () => { document.getElementById('imageModal').style.display = 'flex'; };
window.closeAddPopup = () => {
    document.getElementById('imageModal').style.display = 'none';
    ['productUrl', 'thumbUrl', 'realUrl', 'tagsInput'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
    document.getElementById('thumbPreview').style.display = 'none';
    document.getElementById('realPreview').style.display = 'none';
    document.getElementById('thumbText').style.display = 'block';
    document.getElementById('realText').style.display = 'block';
    document.getElementById('saveImgBtn').disabled = true;
};

// --- [초기 실행] ---
window.addEventListener('DOMContentLoaded', () => {
    renderSavedTerms();
    fetchImages();
});