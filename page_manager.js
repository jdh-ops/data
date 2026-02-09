(function() {
    // 페이지 중복 실행 방지 플래그
    if (window.isPageManagerInitialized) return;
    window.isPageManagerInitialized = true;

    // 초기 로딩 시 데이터와 레이아웃을 동시에 호출 (Promise.all 활용)
    window.renderDataTable = async function(searchKeyword = "") {
        const container = document.getElementById('dataManagerContainer');
        if (!container) return;

        // 로딩 표시기 즉시 노출
        container.innerHTML = `<div class="loading-spinner">데이터를 불러오는 중입니다...</div>`;

        try {
            // [개선] 설정과 데이터를 각각 따로 기다리지 않고 동시에 요청함 (속도 2배 향상)
            const [configRes, dataRes] = await Promise.all([
                window.currentLayout.length === 0 ? window.loadTableConfig() : Promise.resolve(),
                _supabase.from('data_rows').select('*').eq('project_key', getTableKey()).order('id', { ascending: true })
            ]);

            // 이후 렌더링 로직...
        } catch (e) { console.error(e); }
    }
})();

/* ==========================================================================
   [1] 전역 상태 관리
   ========================================================================== */
   window.isEditMode = false;
   window.currentPage = 0;
   const PAGE_SIZE = 100;
   window.currentSortField = 'col1_val';
   window.isAscending = true;
   window.displayRows = [];
   window.hotInstance = null;
   window.currentPresetId = window.currentPresetId || null;
   window.currentLayout = window.currentLayout || [];
   window.cachedRawData = []; // 서버에서 가져온 원본 데이터 보관함
   let isInitialLoaded = false; // 최초 로드 여부 플래그
   
   // 프로젝트 키 추출 유틸리티
   const getTableKey = () => window.tableName || new URLSearchParams(window.location.search).get('table') || "test_data";
   
   /* ==========================================================================
      [2] 데이터 및 설정 로드
      ========================================================================== */
   window.loadTableConfig = async function() {
       const tableKey = getTableKey();
       try {
           let { data } = await _supabase.from('data_config').select('id, columns_layout').eq('project_key', tableKey).maybeSingle();
           if (data) {
               window.currentLayout = data.columns_layout;
               window.currentPresetId = data.id;
           } else {
               // 기본값 전략
               window.currentLayout = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, defaultName: `필드 ${i + 1}`, isVisible: true, width: 150 }));
           }
       } catch (e) { console.error(e); }
   };
   
   window.renderDataTable = async function(searchKeyword = "", page = 0) {
        const tableKey = getTableKey();
        const container = document.getElementById('dataManagerContainer');
        if (!container || !tableKey) return;

        // 1. 설정이 없으면 딱 한 번 로드
        if (window.currentLayout.length === 0) {
            await window.loadTableConfig();
        }

        // 2. [핵심] 데이터가 없거나 새로고침이 필요할 때만 서버 통신
        if (!isInitialLoaded || searchKeyword === "FORCE_REFRESH") {
            console.log("🌐 서버에서 데이터를 새로 가져옵니다...");
            const { data, error } = await _supabase
                .from('data_rows')
                .select('*')
                .eq('project_key', tableKey)
                .order('id', { ascending: true });
            
            if (error) return console.error(error);
            window.cachedRawData = data || [];
            isInitialLoaded = true;
        }

        // 3. 실제 화면을 그리는 로직 호출 (서버 통신 없음)
        updateTableUI(searchKeyword, page);
    };

    function updateTableUI(searchKeyword = "", page = 0) {
        const container = document.getElementById('dataManagerContainer');
        const visibleCols = window.currentLayout.filter(col => col.isVisible);
        
        // 메모리에 있는 cachedRawData를 필터링/정렬만 해서 바로 출력
        let displayRows = [...window.cachedRawData];
        
        if (searchKeyword && searchKeyword !== "FORCE_REFRESH") {
            displayRows = displayRows.filter(row => 
                Object.values(row).join(" ").toLowerCase().includes(searchKeyword.toLowerCase())
            );
        }
    
        const pagedRows = displayRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    
        container.innerHTML = `
            <div style="width: 100%; overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                <table class="manager-table ${window.isEditMode ? 'edit-active' : ''}" style="width: 100%; table-layout: fixed;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="width: 50px;">#</th>
                            ${visibleCols.map(col => `<th style="width:${col.width || 150}px;">${col.customName || col.defaultName}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${pagedRows.map(row => `
                            <tr>
                                <td><input type="checkbox" class="row-checkbox" data-id="${row.id}"></td>
                                ${visibleCols.map(col => `<td>${row['col'+col.id+'_val'] || ''}</td>`).join('')}
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    }
   
   /* ==========================================================================
      [3] 프리셋 및 모달 (속도 최적화 핵심)
      ========================================================================== */
      window.loadSelectedPreset = async function(presetId) {
        const { data } = await _supabase.from('data_config').select('*').eq('id', presetId).single();
        if (data) {
            window.currentPresetId = data.id;
            window.currentLayout = data.columns_layout;
            
            // 모달 상세 설정 갱신
            window.renderModalColumnList(); 
            
            // [중요] 서버 호출 없이 메모리 데이터로 UI만 즉시 갱신
            updateTableUI(); 
        }
    };
   
   window.renderModalColumnList = function() {
       const listArea = document.getElementById('modalColumnList');
       if (!listArea) return;
       listArea.innerHTML = window.currentLayout.map(col => `
           <div class="list-group-item" style="display:flex; align-items:center; gap:10px; margin-bottom:8px; padding:8px; border:1px solid #eee; border-radius:8px; background:white;">
               <input type="checkbox" ${col.isVisible ? 'checked' : ''} onchange="window.updateLocalLayout('${col.id}', 'isVisible', this.checked)">
               <input type="text" style="flex:1; border:1px solid #ddd; padding:5px; border-radius:4px;" value="${col.customName || col.defaultName}" oninput="window.updateLocalLayout('${col.id}', 'customName', this.value)">
           </div>`).join('');
   };
   
   window.openColumnManagementModal = async function() {
       const tableKey = getTableKey();
       if (!tableKey) return alert("프로젝트 정보가 없습니다. URL을 확인하세요.");
       const { data: presets } = await _supabase.from('data_config').select('id, layout_name').eq('project_key', tableKey).order('created_at', { ascending: true });
   
       // 프리셋이 하나만 있거나, 현재 선택이 없을 때 첫 번째 프리셋 자동 선택
       if ((presets && presets.length > 0) && !window.currentPresetId) {
           window.currentPresetId = presets[0].id;
           const { data: first } = await _supabase.from('data_config').select('columns_layout').eq('id', presets[0].id).single();
           if (first && first.columns_layout) window.currentLayout = first.columns_layout;
       }
       // 열 레이아웃이 비어 있으면 기본값으로 채우기
       if (!window.currentLayout || window.currentLayout.length === 0) {
           window.currentLayout = Array.from({ length: 20 }, (_, i) => ({
               id: i + 1, defaultName: `필드 ${i + 1}`, customName: `필드 ${i + 1}`, isVisible: i < 6, width: 150
           }));
       }
   
       const modalHtml = `
           <div class="column-modal-container">
               <div class="preset-sidebar" style="width:200px; background:#f8fafc; border-right:1px solid #eee; padding-top:10px;">
                   <div style="padding:15px; font-weight:bold; font-size:12px; color:#94a3b8;">레이아웃 프리셋</div>
                   ${(presets || []).map(p => `
                       <div class="preset-item" data-id="${p.id}" onclick="window.loadSelectedPreset('${p.id}')" 
                            style="padding:12px 20px; cursor:pointer; border-bottom:1px solid #f1f5f9; font-size:14px; ${window.currentPresetId === p.id ? 'background:#ebf8ff; color:#3182ce; font-weight:bold;' : ''}">
                           📂 ${p.layout_name || '설정'}
                       </div>`).join('')}
               </div>
               <div class="column-setting-main" style="flex:1; padding:30px; display:flex; flex-direction:column; background:white;">
                   <h5 style="margin-bottom:20px; font-weight:bold;">⚙️ 열 상세 설정</h5>
                   <div id="modalColumnList" style="flex:1; overflow-y:auto; padding-right:10px;"></div>
                   <div style="text-align:right; margin-top:20px; padding-top:20px; border-top:1px solid #eee;">
                       <button class="btn-primary" onclick="window.saveColumnLayout()">현재 프리셋에 저장</button>
                       <button class="btn-select" onclick="closeModal()">닫기</button>
                   </div>
               </div>
           </div>`;
   
       showModal(modalHtml);
       window.renderModalColumnList();
   
       // CSS 강제 제압 (너비 확장)
       const content = document.querySelector('#commonModal .modal-content');
       if (content) {
           content.style.setProperty('width', '900px', 'important');
           content.style.setProperty('padding', '0', 'important');
       }
   };
   
   /* ==========================================================================
      [4] 행 추가 기능 (Handsontable 먹통 해결)
      ========================================================================== */
   window.addNewRow = function() {
       const modal = document.getElementById('addRowModal');
       modal.style.display = 'flex';
       const container = document.getElementById('handsontableContainer');
       const visibleCols = window.currentLayout.filter(col => col.isVisible);
       
       if (window.hotInstance) window.hotInstance.destroy();
       
       window.hotInstance = new Handsontable(container, {
           data: Array.from({ length: 5 }, () => Array(visibleCols.length).fill("")),
           colHeaders: visibleCols.map(c => c.customName || c.defaultName),
           rowHeaders: true, width: '100%', height: '400px', stretchH: 'all',
           licenseKey: 'non-commercial-and-evaluation'
       });
   };
   
   window.submitNewRows = async function() {
       const rawData = window.hotInstance.getData();
       const tableKey = getTableKey();
       const visibleCols = window.currentLayout.filter(col => col.isVisible);
       
       const toInsert = rawData.filter(row => row.some(cell => cell !== "" && cell !== null)).map(row => {
           let obj = { project_key: tableKey };
           visibleCols.forEach((col, idx) => { obj[`col${col.id}_val`] = row[idx]; });
           return obj;
       });
   
       if (toInsert.length === 0) return alert("데이터가 없습니다.");
       await _supabase.from('data_rows').insert(toInsert);
       document.getElementById('addRowModal').style.display = 'none';
       window.renderDataTable();
   };
   
   /* ==========================================================================
      [5] 기타 공통 기능들
      ========================================================================== */
   window.updateLocalLayout = (id, field, value) => {
       const col = window.currentLayout.find(c => String(c.id) === String(id));
       if (col) col[field] = value;
   };
   
   window.saveColumnLayout = async function() {
       const tableKey = getTableKey();
       let err = null;
       if (window.currentPresetId) {
           const res = await _supabase.from('data_config').update({ columns_layout: window.currentLayout }).eq('id', window.currentPresetId);
           err = res.error;
       } else {
           const res = await _supabase.from('data_config').upsert(
               { project_key: tableKey, columns_layout: window.currentLayout, layout_name: '기본 설정' },
               { onConflict: 'project_key' }
           );
           err = res.error;
           if (!err && res.data && res.data[0]) window.currentPresetId = res.data[0].id;
       }
       if (err) {
           alert("저장 실패: " + (err.message || "알 수 없는 오류"));
           return;
       }
       alert("💾 저장되었습니다.");
       if (typeof closeModal === 'function') closeModal();
       window.renderDataTable();
   };
   
   window.toggleEditMode = function() {
       window.isEditMode = !window.isEditMode;
       document.getElementById('editModeToggle').innerText = window.isEditMode ? "✅ 수정 완료" : "✏️ 수정하기";
       document.getElementById('editModeBar').style.display = window.isEditMode ? "flex" : "none";
       window.renderDataTable();
   };
   
   window.deleteSelectedRows = async function() {
       const checked = document.querySelectorAll('.row-checkbox:checked');
       if (checked.length === 0 || !confirm("삭제하시겠습니까?")) return;
       const ids = Array.from(checked).map(c => c.dataset.id);
       await _supabase.from('data_rows').delete().in('id', ids);
       window.renderDataTable();
   };
   
   window.selectAllRows = (v) => document.querySelectorAll('.row-checkbox').forEach(c => c.checked = v);
   window.searchData = () => window.renderDataTable(document.getElementById('tableSearchInput')?.value || "");