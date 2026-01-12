/**
 * [auth-image-logic.js]
 * 기능: 이미지 붙여넣기 업로드, 태그 관리, 스마트 필터링, 이미지 그리드 렌더링
 */

// --- [상태 관리 변수] ---
let savedSearchTerms = [];
let selectedTerms = []; // 파란색(AND/OR) 검색어
let excludeTerms = [];  // 빨간색(DEL) 검색어
let isEditMode = false;
let filterMode = 'OR';  
let isDelActive = false; 
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
async function fetchImages() {
    const grid = document.getElementById('imageGrid');
    const tagFilter = document.getElementById('tagFilter').value.trim();
    // [수정] select 엘리먼트에서 현재 정렬 값을 실시간으로 가져옴
    const sortOrder = document.getElementById('sortSelect').value; 
    
    if (!grid) return;

    grid.innerHTML = "<p style='text-align:center; padding:20px;'>데이터 로딩 중...</p>";

    try {
        let { data: allData, error } = await _supabase
            .from('product_images')
            .select('*')
            .eq('project_key', tableName)
            // [수정] 파일명(name)을 기준으로 정렬 (날짜 정보가 포함되어 있음)
            .order('name', { ascending: sortOrder === 'asc' }); 

        if (error) throw error;

        // ... (필터링 로직은 기존과 동일) ...
        const filteredData = allData.filter(item => {
            // 기존 필터링 코드 유지
            const itemTags = (item.tags || []).map(t => t.replace(/\s+/g, ''));
            let includeTargets = [...selectedTerms];
            if (tagFilter) includeTargets.push(tagFilter);
            let excludeTargets = [...excludeTerms];

            let passInclude = true;
            if (includeTargets.length > 0) {
                const includeMatches = includeTargets.map(term => {
                    const clean = term.replace(/\s+/g, '');
                    return itemTags.some(tag => tag.includes(clean) || clean.includes(tag));
                });
                passInclude = (filterMode === 'AND') ? includeMatches.every(m => m) : includeMatches.some(m => m);
            }

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

        renderImageGrid(filteredData); 
    } catch (err) { 
        console.error(err); 
        grid.innerHTML = "<p style='color:red; text-align:center;'>로드 실패</p>";
    }
}

// --- [4. 그리드 렌더링 (카드 클릭 범위 확장 및 카운터 연동)] ---
function renderImageGrid(data) {
    const grid = document.getElementById('imageGrid');
    if (!grid) return;

    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    grid.style.gap = '15px';

    if (data.length === 0) {
        grid.innerHTML = "<p style='grid-column:1/-1; text-align:center; padding:40px; color:#a0aec0;'>🔎 결과가 없습니다.</p>";
        return;
    }

    grid.innerHTML = data.map(item => `
        <div class="image-item" 
             onclick="handleCardClick(event, '${item.id}')" 
             style="background:white; padding:12px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; flex-direction:column; align-items:center; cursor:${isEditMode ? 'pointer' : 'default'}; position:relative;">
            
            <div style="width:100%; display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; min-height:32px;">
                <div style="display:flex; flex-wrap:wrap; gap:3px; max-width: 75%;">
                    ${item.tags && item.tags.length > 0 
                        ? item.tags.map(t => `<span style="background:#edf2f7; color:#4a5568; font-size:9px; padding:1px 5px; border-radius:3px; font-weight:bold;">#${t}</span>`).join('') 
                        : '<span style="color:#cbd5e0; font-size:9px;">#태그없음</span>'}
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                    <input type="checkbox" class="img-checkbox" value="${item.id}" 
                           onclick="event.stopPropagation(); updateSelectCount();" 
                           style="display:${isEditMode ? 'block' : 'none'}; width:18px; height:18px; cursor:pointer;">
                    
                    <button onclick="event.stopPropagation(); openEditTagPopup('${item.id}', '${(item.tags || []).join(', ')}')" 
                            style="background:white; border:1px solid #e2e8f0; border-radius:4px; cursor:pointer; font-size:10px; padding:2px 4px; color:#a0aec0;">✏️ 수정</button>
                </div>
            </div>

            <div style="width:100%; aspect-ratio: 1/1; border-radius:8px; overflow:hidden; border:1px solid #edf2f7; background:#f8fafc; display:flex; align-items:center; justify-content:center;"
                 onmouseenter="showImagePreview(event, '${item.real_url}')" 
                 onmouseleave="hideImagePreview()" 
                 onmousemove="saveMousePos(event)">
                <img src="${item.thumbnail_url}" style="width:100%; height:100%; object-fit:contain;">
            </div>

            <div style="width:100%; margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
                <button onclick="event.stopPropagation(); copyImageToClipboard('${item.real_url}', this)" 
                        class="btn-select" style="padding:6px; font-size:11px; margin-top:0;">🖼️ 복사</button>
                <button onclick="event.stopPropagation(); copyTextToClipboard('${item.product_url || ''}', this)" 
                        class="btn-select" style="padding:6px; font-size:11px; margin-top:0;">🔗 URL</button>
            </div>
        </div>
    `).join('');

    updateSelectCount(); // 렌더링 시점에 카운터 초기화
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
    // 1. 현재 서버에서 불러와 저장되어 있는 필터 버튼 목록(savedSearchTerms)을 가져옴
    // 2. [...savedSearchTerms] 로 복사본을 만들어 모달에 전달
    openEditModal("🏷️ 필터 버튼 일괄 편집", [...savedSearchTerms], async (newTerms) => {
        // 사용자가 모달에서 '저장' 버튼을 눌렀을 때 실행되는 콜백
        try {
            // 서버 저장 함수 호출 (이미 만들어두신 함수 활용)
            await saveSavedTermsToServer(newTerms);
        } catch (err) {
            alert("필터 저장 중 오류가 발생했습니다: " + err.message);
        }
    });
}

// --- [6. 기타 유틸리티] ---
function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeBtn');
    const controls = document.getElementById('editModeControls');

    if (btn) btn.innerText = isEditMode ? '✅ 완료' : '✏️ 수정';
    if (controls) controls.style.display = isEditMode ? 'flex' : 'none';
    
    // 모드 전환 시 현재 선택된 정렬 기준을 유지하며 다시 불러옴
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

    bulkEditMode = 'ADD'; 
    
    openEditModal(`📦 ${ids.length}개 항목 일괄 편집`, [], async (inputTags) => {
        if (inputTags.length === 0) return;
        await executeBulkTagAction(ids, inputTags);
    });

    // [수정 포인트] 이미 탭이 존재하는지 확인 (id="bulkTabContainer" 추가)
    const existingTab = document.getElementById('bulkTabContainer');
    if (!existingTab) {
        const titleEle = document.getElementById('editModalTitle');
        const tabHtml = `
            <div id="bulkTabContainer" style="display:flex; margin-top:15px; background:#f7fafc; border-radius:8px; padding:4px; margin-bottom:15px;">
                <div id="tab-ADD" onclick="switchBulkTab('ADD')" style="flex:1; text-align:center; padding:8px; cursor:pointer; border-radius:6px; font-weight:bold; background:#4299e1; color:white;">➕ 태그 추가</div>
                <div id="tab-REMOVE" onclick="switchBulkTab('REMOVE')" style="flex:1; text-align:center; padding:8px; cursor:pointer; border-radius:6px; font-weight:bold; color:#4a5568;">❌ 태그 삭제</div>
            </div>
        `;
        titleEle.insertAdjacentHTML('afterend', tabHtml);
    } else {
        // 이미 탭이 있다면 초기 상태(추가 모드)로 강제 리셋
        switchBulkTab('ADD');
    }
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

// [기능 3] 카드 전체 클릭 처리
function handleCardClick(event, id) {
    if (!isEditMode) return;
    
    // 버튼이나 이미 클릭된 체크박스를 누른 경우 중복 처리 방지
    if (event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT') return;

    const checkbox = event.currentTarget.querySelector('.img-checkbox');
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        updateSelectCount();
    }
}

// [기능 2] 선택된 개수 업데이트
function updateSelectCount() {
    const total = document.querySelectorAll('.img-checkbox').length;
    const selected = document.querySelectorAll('.img-checkbox:checked').length;
    const display = document.getElementById('selectCountDisplay');
    const selectAllBtn = document.getElementById('selectAllBtn');

    if (display) display.innerText = `${selected}개 선택됨`;
    
    // [기능 1] 모든 카드가 선택되었는지에 따라 버튼 텍스트 변경
    if (selectAllBtn) {
        selectAllBtn.innerText = (selected > 0 && selected === total) ? "선택 해제" : "전체 선택";
    }
}

// [기능 1] 전체 선택/해제 토글
function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.img-checkbox');
    const selected = document.querySelectorAll('.img-checkbox:checked').length;
    
    // 하나라도 안 뽑힌 게 있으면 전체 선택, 다 뽑혀 있으면 전체 해제
    const shouldSelect = selected < checkboxes.length;
    
    checkboxes.forEach(cb => {
        cb.checked = shouldSelect;
    });
    
    updateSelectCount();
}

async function loadSavedTerms() {
    try {
        const { data, error } = await _supabase
            .from('product_images')
            .select('tags')
            .eq('project_key', 'SYSTEM_SETTINGS_' + tableName)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        savedSearchTerms = (data && data.tags) ? data.tags : ["바디", "오일", "수분", "진정"];
        
        renderSavedTerms(); // 버튼 그리기
    } catch (err) {
        console.error("필터 로드 실패:", err);
        savedSearchTerms = ["바디", "오일", "수분", "진정"];
        renderSavedTerms();
    }
}

async function saveSavedTermsToServer(newTerms) {
    try {
        const key = 'SYSTEM_SETTINGS_' + tableName;
        
        const { data: existing, error: fetchError } = await _supabase
            .from('product_images')
            .select('id')
            .eq('project_key', key)
            .maybeSingle();

        if (fetchError) throw fetchError;

        let error;
        if (existing) {
            const result = await _supabase
                .from('product_images')
                .update({ tags: newTerms })
                .eq('id', existing.id);
            error = result.error;
        } else {
            // [수정] 필수 컬럼(NOT NULL) 제약을 피하기 위해 더미 값을 넣습니다.
            const result = await _supabase
                .from('product_images')
                .insert({ 
                    project_key: key, 
                    name: 'FILTER_BUTTONS',
                    tags: newTerms,
                    thumbnail_url: 'SETTINGS', // 빈 값이 아니도록 더미 텍스트 입력
                    real_url: 'SETTINGS'      // 빈 값이 아니도록 더미 텍스트 입력
                });
            error = result.error;
        }

        if (error) throw error;

        savedSearchTerms = newTerms;
        renderSavedTerms();
        
    } catch (err) {
        console.error("필터 저장 실패:", err);
        alert("필터 저장 실패: " + err.message);
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
window.addEventListener('DOMContentLoaded', async () => {
    await loadSavedTerms(); // 서버에서 버튼 목록을 먼저 가져옴
    fetchImages();          // 그 후 이미지를 로드
});