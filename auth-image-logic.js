/**
 * [auth-image-logic.js]
 * 기능: 이미지 붙여넣기 업로드, 태그 관리, 스마트 필터링, 이미지 그리드 렌더링
 */

// --- [상태 관리 변수] ---
let selectedTerms = []; 
let filterMode = 'OR'; // 'AND' 또는 'OR'
let isDelActive = false; 
let isEditMode = false;
let savedSearchTerms = JSON.parse(localStorage.getItem('savedSearchTerms') || '["바디", "오일", "수분", "진정"]');

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
    const sortOrder = document.getElementById('sortSelect') ? document.getElementById('sortSelect').value : 'desc';
    const tagFilter = document.getElementById('tagFilter') ? document.getElementById('tagFilter').value.trim() : "";
    
    if (!grid) return;
    grid.innerHTML = "<p style='text-align:center; padding:20px;'>데이터 로딩 중...</p>";

    try {
        let { data: allData, error } = await _supabase
            .from('product_images')
            .select('*')
            .eq('project_key', tableName)
            .order('name', { ascending: sortOrder === 'asc' });

        if (error) throw error;

        // 지능형 필터링 (공백 무시 및 AND/OR/DEL 조합)
        const filteredData = allData.filter(item => {
            const itemTags = (item.tags || []).map(t => t.replace(/\s+/g, '')); 
            let searchTargets = [...selectedTerms];
            if (tagFilter) searchTargets.push(tagFilter);

            if (searchTargets.length === 0) return true;

            const matches = searchTargets.map(term => {
                const cleanTerm = term.replace(/\s+/g, '');
                return itemTags.some(tag => tag.includes(cleanTerm) || cleanTerm.includes(tag));
            });

            let isMatched = (filterMode === 'AND') ? matches.every(m => m === true) : matches.some(m => m === true);
            return isDelActive ? !isMatched : isMatched;
        });

        renderImageGrid(filteredData);
        renderSavedTerms(); 
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
            <div style="width:100%; aspect-ratio: 1/1; border-radius:8px; overflow:hidden; border:1px solid #edf2f7; background:#f8fafc; cursor:pointer;" onclick="window.open('${item.real_url}', '_blank')">
                <img src="${item.thumbnail_url}" style="width:100%; height:100%; object-fit:contain;">
            </div>
            <div style="width:100%; margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
                <button onclick="copyImageToClipboard('${item.real_url}')" class="btn-select" style="padding:6px; font-size:11px; margin-top:0;">🖼️ 복사</button>
                <button onclick="copyTextToClipboard('${item.product_url || ''}')" class="btn-select" style="padding:6px; font-size:11px; margin-top:0;">🔗 URL</button>
            </div>
        </div>
    `).join('');
}

// --- [5. 필터 및 모드 제어] ---
function setMode(mode) {
    filterMode = mode;
    fetchImages();
}

function toggleDel() {
    isDelActive = !isDelActive;
    fetchImages();
}

function renderSavedTerms() {
    const btnAnd = document.getElementById('btn-AND');
    const btnOr = document.getElementById('btn-OR');
    const btnDel = document.getElementById('btn-DEL');
    const list = document.getElementById('savedTermsList');

    if(btnAnd) btnAnd.className = filterMode === 'AND' ? 'filter-mode-btn active-and' : 'filter-mode-btn';
    if(btnOr) btnOr.className = filterMode === 'OR' ? 'filter-mode-btn active-or' : 'filter-mode-btn';
    if(btnDel) {
        btnDel.style.background = isDelActive ? '#e53e3e' : '#edf2f7';
        btnDel.style.color = isDelActive ? 'white' : '#4a5568';
    }

    list.innerHTML = savedSearchTerms.map(term => {
        const isSelected = selectedTerms.includes(term);
        let bg = '#edf2f7';
        if (isSelected) {
            bg = isDelActive ? '#fed7d7' : (filterMode === 'AND' ? '#c6f6d5' : '#bee3f8');
        }
        return `<button onclick="toggleTerm('${term}')" style="padding: 5px 12px; border-radius: 20px; border: 1px solid #cbd5e0; background: ${bg}; font-size: 12px; cursor: pointer;">${term}</button>`;
    }).join('');
}

function toggleTerm(term) {
    selectedTerms = selectedTerms.includes(term) ? selectedTerms.filter(t => t !== term) : [...selectedTerms, term];
    renderSavedTerms();
}

function resetSearch() {
    selectedTerms = [];
    isDelActive = false;
    filterMode = 'OR';
    document.getElementById('tagFilter').value = "";
    fetchImages();
}

function editSavedTerms() {
    const res = prompt("검색어 10개를 쉼표(,)로 구분해 입력", savedSearchTerms.join(','));
    if (res) {
        savedSearchTerms = res.split(',').map(s => s.trim()).slice(0, 10);
        localStorage.setItem('savedSearchTerms', JSON.stringify(savedSearchTerms));
        renderSavedTerms();
    }
}

// --- [6. 기타 유틸리티] ---
function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeBtn');
    const delBtn = document.getElementById('deleteBtn');
    if(btn) btn.innerText = isEditMode ? '✅ 완료' : '✏️ 수정/삭제';
    if(delBtn) delBtn.style.display = isEditMode ? 'block' : 'none';
    fetchImages();
}

async function deleteSelectedImages() {
    const ids = Array.from(document.querySelectorAll('.img-checkbox:checked')).map(cb => cb.value);
    if (!ids.length || !confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await _supabase.from('product_images').delete().in('id', ids);
    if (!error) { alert('삭제되었습니다.'); fetchImages(); }
}

function openEditTagPopup(id, currentTags) {
    const res = prompt("태그 수정 (쉼표 구분)", currentTags);
    if (res !== null) updateImageTags(id, res);
}

async function updateImageTags(id, tagsString) {
    const tagsArray = tagsString.split(',').map(t => t.trim()).filter(t => t !== "");
    const { error } = await _supabase.from('product_images').update({ tags: tagsArray }).eq('id', id);
    if (!error) { fetchImages(); }
}

async function copyImageToClipboard(url) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        alert('🖼️ 이미지가 클립보드에 복사되었습니다.');
    } catch (err) { alert('복사 실패'); }
}

function copyTextToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert('🔗 URL이 복사되었습니다.');
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