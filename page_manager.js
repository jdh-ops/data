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
   
   const getTableKey = () => window.tableName || new URLSearchParams(window.location.search).get('table') || "test_data";

   /** Natural Sort: 텍스트 안 숫자 인식 (2월 < 10월) */
   const getNumericValue = (val) => {
       if (val === null || val === undefined || val === "") return -Infinity;
       const strVal = String(val).replace(/,/g, '').trim();
       const match = strVal.match(/^[-+]?\d+(\.\d+)?/);
       if (match) return parseFloat(match[0]);
       return strVal;
   };
   
   /* ==========================================================================
      [2] 데이터 및 설정 로드
      ========================================================================== */
   /** 기본 레이아웃: project_key=test_data, layout_name=보호원 월말보고 없을 때만 사용 */
   var DEFAULT_LAYOUT_FALLBACK = Array.from({ length: 20 }, function(_, i) {
       return { id: i + 1, defaultName: "필드 " + (i + 1), customName: "", isVisible: i < 6, width: 150 };
   });

   /**
    * 테이블 헤더용 레이아웃 로드.
    * - 열 설정에서 저장한 적이 있으면: 해당 project_key 의 프리셋 중 created_at 최신 1개 사용.
    * - 새로 생성했거나 열 설정을 건드린 적 없으면: project_key=test_data, layout_name='보호원 월말보고' 행의 columns_layout 사용.
    * - 그 행도 없으면: 필드 1~20 기본값 사용.
    */
   window.loadTableConfig = async function() {
       const tableKey = getTableKey();
       try {
           var data = null;
           var res = await _supabase.from('data_config').select('id, columns_layout').eq('project_key', tableKey).order('created_at', { ascending: false }).limit(1);
           if (res.data && res.data.length > 0) data = res.data[0];
           if (data && data.columns_layout && Array.isArray(data.columns_layout) && data.columns_layout.length > 0) {
               window.currentLayout = data.columns_layout;
               window.currentPresetId = data.id;
               return;
           }
           var defaultRes = await _supabase.from('data_config').select('id, columns_layout').eq('project_key', 'test_data').eq('layout_name', '보호원 월말보고').maybeSingle();
           if (defaultRes.data && defaultRes.data.columns_layout && Array.isArray(defaultRes.data.columns_layout) && defaultRes.data.columns_layout.length > 0) {
               window.currentLayout = JSON.parse(JSON.stringify(defaultRes.data.columns_layout));
               window.currentPresetId = data ? data.id : null;
               return;
           }
           window.currentLayout = DEFAULT_LAYOUT_FALLBACK.slice();
           window.currentPresetId = data ? data.id : null;
       } catch (e) { console.error(e); }
   };
   
   window.renderDataTable = async function(searchKeyword = "", page = 0) {
        window.currentPage = page;
        const tableKey = getTableKey();
        const container = document.getElementById('dataManagerContainer');
        if (!container) return;
        if (!tableKey) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#e53e3e;">프로젝트 키가 없습니다. URL에 ?table=프로젝트명 을 넣어 접속해 주세요.</div>';
            return;
        }

        if (!_supabase) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#e53e3e;">Supabase 연결이 없습니다. config.js와 Supabase 스크립트 로드 순서를 확인해 주세요.</div>';
            return;
        }

        container.innerHTML = '<div class="loading-spinner" style="padding:20px;text-align:center;">데이터를 불러오는 중입니다...</div>';
        if (!isInitialLoaded) {
            await window.loadTableConfig();
        } else if (!window.currentLayout || window.currentLayout.length === 0) {
            await window.loadTableConfig();
        }
        if (!Array.isArray(window.currentLayout) || window.currentLayout.length === 0) {
            window.currentLayout = (typeof DEFAULT_LAYOUT_FALLBACK !== 'undefined' && DEFAULT_LAYOUT_FALLBACK) ? DEFAULT_LAYOUT_FALLBACK.slice() : Array.from({ length: 20 }, function(_, i) { return { id: i + 1, defaultName: "필드 " + (i + 1), customName: "", isVisible: i < 6, width: 150 }; });
        }

        if (!isInitialLoaded || searchKeyword === "FORCE_REFRESH") {
            console.log("🌐 data_rows에서 데이터 가져오는 중... project_key=" + tableKey);
            const { data, error } = await _supabase
                .from('data_rows')
                .select('*')
                .eq('project_key', tableKey)
                .order('id', { ascending: true });
            if (error) {
                console.error('data_rows 조회 오류:', error);
                container.innerHTML = '<div style="padding:20px;text-align:center;color:#e53e3e;">데이터 조회 실패 (data_rows): ' + (error.message || JSON.stringify(error)) + '<br><br>사용 중: project_key = <strong>' + tableKey + '</strong></div>';
                return;
            }
            if (!data || data.length === 0) {
                var hint = '';
                var check = await _supabase.from('data_rows').select('project_key').limit(5);
                if (check.data && check.data.length > 0) {
                    var sampleKeys = check.data.map(function (r) { return (r && r.project_key != null) ? String(r.project_key) : '(null)'; });
                    hint = ' DB에 저장된 project_key 예: ' + sampleKeys.join(', ') + '. URL에 ?table=해당값 을 넣어 보세요.';
                } else if (check.error) {
                    hint = ' RLS 등 권한 문제일 수 있습니다. data_rows 테이블에 anon/authenticated 역할로 SELECT 정책을 추가해 주세요.';
                } else {
                    hint = ' RLS로 인해 행이 보이지 않을 수 있습니다. data_rows 테이블 RLS 정책을 확인해 주세요.';
                }
                container.innerHTML = '<div style="padding:20px;text-align:center;color:#c05621;max-width:560px;margin:0 auto;">' +
                    'project_key=<strong>' + tableKey + '</strong>인 행이 없습니다.' + hint +
                    '<br><br><button type="button" class="btn-select" onclick="window.renderDataTable(\'FORCE_REFRESH\')" style="margin-top:8px;">다시 시도</button></div>';
                window.cachedRawData = [];
                isInitialLoaded = true;
                return;
            }
            window.cachedRawData = data || [];
            isInitialLoaded = true;
        }

        updateTableUI(searchKeyword, page);
    };

    function refreshSearchFieldSelect(visibleCols) {
        const sel = document.getElementById('searchFieldSelect');
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = '<option value="all">전체 검색</option>' + (visibleCols || []).map(function (col) {
            var fieldName = 'col' + col.id + '_val';
            var label = (col.customName || col.defaultName || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return '<option value="' + fieldName + '">' + label + '</option>';
        }).join('');
        if (currentVal && sel.querySelector('option[value="' + currentVal + '"]')) sel.value = currentVal;
        else sel.value = 'all';
    }

    function updateTableUI(searchKeyword = "", page = 0) {
        const container = document.getElementById('dataManagerContainer');
        const layout = Array.isArray(window.currentLayout) ? window.currentLayout : [];
        const visibleCols = layout.filter(col => col && col.isVisible !== false);
        refreshSearchFieldSelect(visibleCols);
        if (visibleCols.length > 0 && (window.currentSortField === 'id' || !window.currentSortField)) {
            window.currentSortField = 'col' + visibleCols[0].id + '_val';
        }
        let displayRows = [...window.cachedRawData];

        var searchField = (document.getElementById('searchFieldSelect') || {}).value;
        if (searchKeyword && searchKeyword !== "FORCE_REFRESH") {
            var kw = searchKeyword.toLowerCase();
            if (searchField && searchField !== 'all') {
                displayRows = displayRows.filter(function (row) { return String(row[searchField] || '').toLowerCase().includes(kw); });
            } else {
                displayRows = displayRows.filter(row =>
                    Object.values(row).join(" ").toLowerCase().includes(kw)
                );
            }
        }

        const sortField = window.currentSortField;
        const asc = window.isAscending;
        displayRows.sort((a, b) => {
            const valA = getNumericValue(a[sortField]);
            const valB = getNumericValue(b[sortField]);
            if (typeof valA === 'number' && typeof valB === 'number') {
                return asc ? valA - valB : valB - valA;
            }
            return asc
                ? String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' })
                : String(valB).localeCompare(String(valA), undefined, { numeric: true, sensitivity: 'base' });
        });

        const pagedRows = displayRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

        container.innerHTML = `
            <div style="width: 100%; overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                <table class="manager-table ${window.isEditMode ? 'edit-active' : ''}" style="width: 100%; table-layout: fixed;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="width: 50px;">
                                <div style="cursor:pointer; padding:10px; display:flex; align-items:center; justify-content:center; gap:4px;" onclick="window.toggleSort('id')">
                                    <span style="font-size:11px; color:${sortField === 'id' ? '#3498db' : '#94a3b8'};">${sortField === 'id' ? (asc ? '▲' : '▼') : '↕'}</span>
                                    <span>#</span>
                                </div>
                            </th>
                            ${visibleCols.map(col => {
                                const fieldName = 'col' + col.id + '_val';
                                const isCurrent = sortField === fieldName;
                                const icon = isCurrent ? (asc ? '▲' : '▼') : '↕';
                                const resizerHtml = window.isEditMode
                                    ? `<div class="col-resizer" data-col-id="${col.id}" style="position:absolute; right:0; top:0; bottom:0; width:8px; cursor:col-resize; z-index:1;" title="드래그하여 열 너비 조절"></div>`
                                    : '';
                                return `<th style="position:relative; width:${col.width || 150}px; min-width:60px;">
                                    <div style="cursor:pointer; padding:10px; display:flex; align-items:center; justify-content:center; gap:4px;" onclick="window.toggleSort('${fieldName}')">
                                        <span style="font-size:11px; color:${isCurrent ? '#3498db' : '#94a3b8'};">${icon}</span>
                                        <span>${col.customName || col.defaultName}</span>
                                    </div>
                                    ${resizerHtml}
                                </th>`;
                            }).join('')}
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

        // 수정하기 모드: 열 너비 조절 리사이저 이벤트 바인딩
        if (window.isEditMode) {
            container.querySelectorAll('.col-resizer').forEach(el => {
                el.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    window.initResize(e, this.getAttribute('data-col-id'), this);
                });
            });
        }

        var countEl = document.getElementById('dataRowCount');
        if (countEl) {
            var total = (window.cachedRawData || []).length;
            var hasSearch = searchKeyword && searchKeyword !== "FORCE_REFRESH";
            var tableKey = getTableKey();
            var suffix = (total === 0 && tableKey) ? ' (data_rows · project_key=' + tableKey + ')' : '';
            if (hasSearch) {
                countEl.textContent = '검색 결과: ' + displayRows.length + '건 / 전체: ' + total.toLocaleString() + '건' + suffix;
            } else {
                countEl.textContent = '총 ' + total.toLocaleString() + '건' + suffix;
            }
        }
    }

   window.initResize = function (ev, colId, resizerEl) {
        const th = resizerEl && resizerEl.closest ? resizerEl.closest('th') : null;
        if (!th || colId == null) return;
        const colIdStr = String(colId);
        const layout = window.currentLayout || [];
        const col = layout.find(c => String(c.id) === colIdStr);
        if (!col) return;
        const startX = ev.pageX;
        const startWidth = th.offsetWidth;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        const onMove = function (e) {
            const dx = e.pageX - startX;
            let w = Math.max(60, startWidth + dx);
            th.style.width = w + 'px';
            th.style.minWidth = w + 'px';
            col.width = w;
        };
        const onUp = function () {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

   window.toggleSort = function(fieldName) {
        if (window.currentSortField === fieldName) {
            window.isAscending = !window.isAscending;
        } else {
            window.currentSortField = fieldName;
            window.isAscending = true;
        }
        window.renderDataTable(document.getElementById('tableSearchInput')?.value || "", window.currentPage);
    };
   
   /* ==========================================================================
      [3] 프리셋 및 모달 (속도 최적화 핵심)
      ========================================================================== */
      window.loadSelectedPreset = async function(presetId) {
        var id = presetId != null ? (Number(presetId) || presetId) : null;
        if (id == null) return;
        var res = await _supabase.from('data_config').select('*').eq('id', id).single();
        if (res.error || !res.data) return;
        var data = res.data;
        window.currentPresetId = data.id;
        var raw = data.columns_layout;
        if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch (e) { raw = null; }
        }
        window.currentLayout = (raw && Array.isArray(raw))
            ? JSON.parse(JSON.stringify(raw))
            : [];
        window.currentLayout = window.currentLayout.map(function(c, i) {
            return {
                id: c.id != null ? c.id : i + 1,
                defaultName: c.defaultName != null ? c.defaultName : '필드 ' + (i + 1),
                customName: c.customName != null ? c.customName : (c.defaultName || '필드 ' + (i + 1)),
                isVisible: c.isVisible != null ? c.isVisible : true,
                width: c.width != null ? c.width : 150,
                fixed: c.fixed != null ? c.fixed : false
            };
        });
        var listArea = document.getElementById('commonModal') && document.getElementById('commonModal').querySelector('#modalColumnList');
        if (listArea) {
            var layout = window.currentLayout || [];
            if (layout.length === 0) {
                listArea.innerHTML = '<p class="text-muted" style="padding:12px;">열 설정이 비어 있습니다.</p>';
            } else {
                listArea.innerHTML = layout.map(function(col) {
                    var name = (col.customName != null && col.customName !== '') ? col.customName : (col.defaultName || '');
                    var valueAttr = String(name).replace(/"/g, '&quot;');
                    return '<div class="list-group-item" data-col-id="' + col.id + '" style="display:flex; align-items:center; gap:10px; margin-bottom:8px; padding:8px; border:1px solid #eee; border-radius:8px; background:white;">' +
                        '<span class="column-drag-handle" style="cursor:grab; color:#94a3b8; padding:2px 6px; font-size:14px; flex-shrink:0;" title="드래그하여 순서 변경">⋮⋮</span>' +
                        '<input type="checkbox" ' + (col.isVisible ? 'checked' : '') + ' onchange="window.updateLocalLayout(\'' + col.id + '\', \'isVisible\', this.checked)">' +
                        '<input type="text" style="flex:1; border:1px solid #ddd; padding:5px; border-radius:4px;" value="' + valueAttr + '" oninput="window.updateLocalLayout(\'' + col.id + '\', \'customName\', this.value)">' +
                        '</div>';
                }).join('');
            }
        }
        var commonModal = document.getElementById('commonModal');
        if (commonModal) {
            commonModal.querySelectorAll('.preset-item').forEach(function(el) {
                var did = el.getAttribute('data-id');
                var active = String(window.currentPresetId) === String(did);
                el.style.background = active ? '#ebf8ff' : '';
                el.style.color = active ? '#3182ce' : '#4a5568';
                el.style.fontWeight = active ? 'bold' : '';
            });
        }
    };
   
   window.renderModalColumnList = function() {
       const listArea = document.querySelector('#commonModal #modalColumnList') || document.getElementById('modalColumnList');
       if (!listArea) return;
       const layout = window.currentLayout || [];
       if (layout.length === 0) {
           listArea.innerHTML = '<p class="text-muted" style="padding:12px;">열 설정이 비어 있습니다.</p>';
           return;
       }
       listArea.innerHTML = layout.map(col => {
           const name = (col.customName != null && col.customName !== '') ? col.customName : (col.defaultName || '');
           const valueAttr = String(name).replace(/"/g, '&quot;');
           return `<div class="list-group-item" data-col-id="${col.id}" style="display:flex; align-items:center; gap:10px; margin-bottom:8px; padding:8px; border:1px solid #eee; border-radius:8px; background:white;">
               <span class="column-drag-handle" style="cursor:grab; color:#94a3b8; padding:2px 6px; font-size:14px; flex-shrink:0;" title="드래그하여 순서 변경">⋮⋮</span>
               <input type="checkbox" ${col.isVisible ? 'checked' : ''} onchange="window.updateLocalLayout('${col.id}', 'isVisible', this.checked)">
               <input type="text" style="flex:1; border:1px solid #ddd; padding:5px; border-radius:4px;" value="${valueAttr}" oninput="window.updateLocalLayout('${col.id}', 'customName', this.value)">
           </div>`;
       }).join('');
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
           <div class="column-modal-header" style="display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid #e2e8f0; background:#f8fafc; border-radius:12px 12px 0 0;">
               <span style="font-weight:bold; font-size:16px;">⚙️ 열 설정</span>
               <button type="button" onclick="closeModal()" style="border:none; background:none; cursor:pointer; font-size:22px; line-height:1; color:#64748b; padding:0 4px;">✕</button>
           </div>
           <div class="column-modal-container" style="margin:0; flex:1; min-height:0;">
               <div class="preset-sidebar" style="width:200px; background:#f8fafc; border-right:1px solid #eee; padding-top:10px; flex-shrink:0;">
                   <div style="padding:15px; font-weight:bold; font-size:12px; color:#94a3b8;">레이아웃 프리셋</div>
                   <div style="flex:1; overflow-y:auto;">
                   ${(presets || []).filter(p => p && p.id != null).map(p => {
                       const safeId = String(p.id).replace(/"/g, '&quot;');
                       const label = (p.layout_name || '설정').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                       return `<div class="preset-item" data-id="${safeId}" style="display:flex; align-items:center; gap:4px; padding:10px 12px; border-bottom:1px solid #f1f5f9; font-size:14px; ${String(window.currentPresetId) === String(p.id) ? 'background:#ebf8ff; color:#3182ce; font-weight:bold;' : ''}">
                           <span style="flex:1; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" onclick="window.loadSelectedPreset(this.closest('.preset-item').getAttribute('data-id'))" title="${label}">📂 ${label}</span>
                           <button type="button" onclick="event.stopPropagation(); window.editPresetName(this.closest('.preset-item').getAttribute('data-id'));" style="flex-shrink:0; padding:4px 6px; font-size:11px; border:1px solid #cbd5e0; border-radius:4px; background:#fff; cursor:pointer;" title="이름 수정">✏️</button>
                           <button type="button" onclick="event.stopPropagation(); window.deletePreset(this.closest('.preset-item').getAttribute('data-id'));" style="flex-shrink:0; padding:4px 6px; font-size:11px; border:1px solid #feb2b2; border-radius:4px; background:#fff; color:#c53030; cursor:pointer;" title="삭제">🗑️</button>
                       </div>`;
                   }).join('')}
                   </div>
                   <button type="button" onclick="window.addNewLayoutPreset()" style="margin:12px; padding:12px 16px; background:#3182ce; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:13px;">➕ 프리셋 추가</button>
               </div>
               <div class="column-setting-main" style="flex:1; padding:30px; display:flex; flex-direction:column; background:white; min-width:0;">
                   <h5 style="margin-bottom:20px; font-weight:bold;">열 상세 설정</h5>
                   <div id="modalColumnList" style="flex:1; overflow-y:auto; padding-right:10px; min-height:200px;"></div>
                   <div style="text-align:right; margin-top:20px; padding-top:20px; border-top:1px solid #eee;">
                       <button class="btn-primary" onclick="window.saveColumnLayout()">현재 프리셋에 저장</button>
                       <button class="btn-select" onclick="closeModal()">닫기</button>
                   </div>
               </div>
           </div>`;
   
       showModal(modalHtml);
       window.renderModalColumnList();

       // 오른쪽 열 목록 드래그로 순서 변경 (Sortable)
       const listEl = document.querySelector('#commonModal #modalColumnList') || document.getElementById('modalColumnList');
       if (listEl && typeof Sortable !== 'undefined' && listEl.querySelector('.list-group-item')) {
           if (listEl._sortable) listEl._sortable.destroy();
           listEl._sortable = new Sortable(listEl, {
               animation: 150,
               handle: '.column-drag-handle',
               onEnd: function () {
                   const newOrder = [];
                   listEl.querySelectorAll('.list-group-item').forEach(function (item) {
                       const id = item.getAttribute('data-col-id');
                       if (id != null) newOrder.push(Number(id) || id);
                   });
                   const layout = window.currentLayout || [];
                   const reordered = newOrder.map(function (id) { return layout.find(function (c) { return String(c.id) === String(id); }); }).filter(Boolean);
                   if (reordered.length) window.currentLayout = reordered;
               }
           });
       }

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
   window.closeAddRowModal = function() {
       const modal = document.getElementById('addRowModal');
       if (modal) modal.style.display = 'none';
       if (window.hotInstance) {
           window.hotInstance.destroy();
           window.hotInstance = null;
       }
   };

   window.addNewRow = function() {
       const modal = document.getElementById('addRowModal');
       if (modal) modal.style.display = 'flex';
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

   window.addNewLayoutPreset = async function() {
       var tableKey = getTableKey();
       var defaultName = "새 레이아웃";
       // 새 프리셋은 항상 열1, 열2, 열3... 형식의 기본 레이아웃으로 생성
       var layoutToSave = Array.from({ length: 20 }, function(_, i) {
           return { id: i + 1, defaultName: "열" + (i + 1), customName: "열" + (i + 1), isVisible: i < 6, width: 150 };
       });
       var res = await _supabase.from('data_config').insert({
           project_key: tableKey,
           layout_name: defaultName,
           columns_layout: layoutToSave
       }).select('id').single();
       if (res.error) {
           alert("추가 실패: " + (res.error.message || "알 수 없는 오류"));
           return;
       }
       window.currentPresetId = res.data.id;
       window.currentLayout = JSON.parse(JSON.stringify(layoutToSave));

       // 모달 열린 상태면 사이드바에만 새 항목 추가 (모달 안 닫음)
       var sidebarList = document.querySelector('#commonModal .preset-sidebar > div:nth-child(2)');
       if (sidebarList) {
           var safeId = String(res.data.id).replace(/"/g, '&quot;');
           var label = defaultName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
           var div = document.createElement('div');
           div.className = 'preset-item';
           div.setAttribute('data-id', safeId);
           div.style.cssText = 'display:flex; align-items:center; gap:4px; padding:10px 12px; border-bottom:1px solid #f1f5f9; font-size:14px; background:#ebf8ff; color:#3182ce; font-weight:bold;';
           div.innerHTML = '<span style="flex:1; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" onclick="window.loadSelectedPreset(this.closest(\'.preset-item\').getAttribute(\'data-id\'))" title="' + label + '">📂 ' + label + '</span>' +
               '<button type="button" onclick="event.stopPropagation(); window.editPresetName(this.closest(\'.preset-item\').getAttribute(\'data-id\'));" style="flex-shrink:0; padding:4px 6px; font-size:11px; border:1px solid #cbd5e0; border-radius:4px; background:#fff; cursor:pointer;" title="이름 수정">✏️</button>' +
               '<button type="button" onclick="event.stopPropagation(); window.deletePreset(this.closest(\'.preset-item\').getAttribute(\'data-id\'));" style="flex-shrink:0; padding:4px 6px; font-size:11px; border:1px solid #feb2b2; border-radius:4px; background:#fff; color:#c53030; cursor:pointer;" title="삭제">🗑️</button>';
           sidebarList.appendChild(div);
           // 기존 항목 활성 스타일 제거
           sidebarList.querySelectorAll('.preset-item').forEach(function(el) {
               if (el.getAttribute('data-id') !== safeId) {
                   el.style.background = '';
                   el.style.color = '#4a5568';
                   el.style.fontWeight = '';
               }
           });
           window.renderModalColumnList();
           // 열 목록 DOM이 바뀌었으므로 Sortable 다시 적용
           var listEl = document.querySelector('#commonModal #modalColumnList');
           if (listEl && typeof Sortable !== 'undefined' && listEl.querySelector('.list-group-item')) {
               var sortable = listEl._sortable;
               if (sortable) sortable.destroy();
               listEl._sortable = new Sortable(listEl, {
                   animation: 150,
                   handle: '.column-drag-handle',
                   onEnd: function() {
                       var newOrder = [];
                       listEl.querySelectorAll('.list-group-item').forEach(function(item) {
                           var id = item.getAttribute('data-col-id');
                           if (id != null) newOrder.push(Number(id) || id);
                       });
                       var layout = window.currentLayout || [];
                       var reordered = newOrder.map(function(id) { return layout.find(function(c) { return String(c.id) === String(id); }); }).filter(Boolean);
                       if (reordered.length) window.currentLayout = reordered;
                   }
               });
           }
       } else {
           // 모달이 닫혀 있던 경우(또는 DOM 구조 다름) 기존처럼 모달 열기
           if (typeof closeModal === 'function') closeModal();
           window.openColumnManagementModal();
       }
   };

   window.editPresetName = async function(presetId) {
       var id = presetId != null ? (Number(presetId) || presetId) : null;
       if (id == null) return;
       var res = await _supabase.from('data_config').select('layout_name').eq('id', id).single();
       if (res.error || !res.data) return;
       var name = prompt("프리셋 이름을 입력하세요.", res.data.layout_name || "");
       if (name == null || !name.trim()) return;
       var up = await _supabase.from('data_config').update({ layout_name: name.trim() }).eq('id', id);
       if (up.error) { alert("수정 실패: " + (up.error.message || "")); return; }
       window.currentPresetId = id;
       if (typeof closeModal === 'function') closeModal();
       window.openColumnManagementModal();
   };

   window.deletePreset = async function(presetId) {
       var id = presetId != null ? (Number(presetId) || presetId) : null;
       if (id == null) return;
       if (!confirm("이 프리셋을 삭제하시겠습니까?")) return;
       var res = await _supabase.from('data_config').delete().eq('id', id);
       if (res.error) { alert("삭제 실패: " + (res.error.message || "")); return; }

       var modalOpen = document.querySelector('#commonModal .preset-sidebar');
       if (modalOpen) {
           document.querySelectorAll('#commonModal .preset-item').forEach(function(el) {
               if (String(el.getAttribute('data-id')) === String(id)) el.remove();
           });
           if (String(window.currentPresetId) === String(id)) {
               var remaining = document.querySelectorAll('#commonModal .preset-item');
               if (remaining.length > 0) {
                   var nextId = remaining[0].getAttribute('data-id');
                   if (nextId) window.loadSelectedPreset(nextId);
                   var listEl = document.querySelector('#commonModal #modalColumnList');
                   if (listEl && typeof Sortable !== 'undefined' && listEl.querySelector('.list-group-item')) {
                       if (listEl._sortable) listEl._sortable.destroy();
                       listEl._sortable = new Sortable(listEl, {
                           animation: 150,
                           handle: '.column-drag-handle',
                           onEnd: function() {
                               var newOrder = [];
                               listEl.querySelectorAll('.list-group-item').forEach(function(item) {
                                   var cid = item.getAttribute('data-col-id');
                                   if (cid != null) newOrder.push(Number(cid) || cid);
                               });
                               var layout = window.currentLayout || [];
                               var reordered = newOrder.map(function(cid) { return layout.find(function(c) { return String(c.id) === String(cid); }); }).filter(Boolean);
                               if (reordered.length) window.currentLayout = reordered;
                           }
                       });
                   }
               } else {
                   window.currentPresetId = null;
                   window.currentLayout = [];
                   window.renderModalColumnList();
               }
           }
       } else {
           if (String(window.currentPresetId) === String(id)) {
               window.currentPresetId = null;
               window.currentLayout = [];
           }
           if (typeof closeModal === 'function') closeModal();
           window.openColumnManagementModal();
       }
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

   window.resetTableFilter = function () {
        var input = document.getElementById('tableSearchInput');
        var sel = document.getElementById('searchFieldSelect');
        if (input) input.value = '';
        if (sel) sel.value = 'all';
        window.renderDataTable('');
    };

   window.downloadCurrentExcel = function () {
        var XLSX = window.XLSX || window.xlsx;
        if (!XLSX) { alert('엑셀 라이브러리를 불러올 수 없습니다.'); return; }
        var layout = Array.isArray(window.currentLayout) ? window.currentLayout : [];
        var visibleCols = layout.filter(function (c) { return c && c.isVisible !== false; });
        var rows = window.cachedRawData || [];
        var headers = ['#'].concat(visibleCols.map(function (c) { return c.customName || c.defaultName || '필드' + c.id; }));
        var data = rows.map(function (row, i) {
            var arr = [row.id != null ? row.id : i + 1];
            visibleCols.forEach(function (c) { arr.push(row['col' + c.id + '_val'] != null ? row['col' + c.id + '_val'] : ''); });
            return arr;
        });
        var ws = XLSX.utils.aoa_to_sheet([headers].concat(data));
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '데이터');
        var keyword = (window.projectKeyName || getTableKey() || 'data').replace(/[/\\?*:|"]/g, '_');
        var d = new Date();
        var yymmdd = d.getFullYear().toString().slice(-2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
        XLSX.writeFile(wb, keyword + '_' + yymmdd + '.xlsx');
    };

   /* 엑셀 업로드 모달: 선택 파일 보관 및 드래그/선택 핸들러 */
   window._excelSelectedFile = null;

   window.handleExcelDragOver = function(e) {
        e.preventDefault();
        e.stopPropagation();
        var zone = document.getElementById('excelDropZone');
        if (zone) zone.style.background = '#edf2f7';
    };
   window.handleExcelDragLeave = function(e) {
        e.preventDefault();
        e.stopPropagation();
        var zone = document.getElementById('excelDropZone');
        if (zone) zone.style.background = '#f8fafc';
    };
   window.handleExcelDrop = function(e) {
        e.preventDefault();
        e.stopPropagation();
        var zone = document.getElementById('excelDropZone');
        if (zone) zone.style.background = '#f8fafc';
        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length > 0) {
            window._excelSelectedFile = files[0];
            var nameEl = document.getElementById('excelFileName');
            if (nameEl) nameEl.textContent = files[0].name;
            var btn = document.getElementById('startExcelUploadBtn');
            if (btn) btn.disabled = false;
        }
    };
   window.handleExcelSelect = function(e) {
        var files = e.target && e.target.files;
        if (files && files.length > 0) {
            window._excelSelectedFile = files[0];
            var nameEl = document.getElementById('excelFileName');
            if (nameEl) nameEl.textContent = files[0].name;
            var btn = document.getElementById('startExcelUploadBtn');
            if (btn) btn.disabled = false;
        }
    };

   window.downloadExcelTemplate = function() {
        var XLSX = window.XLSX || window.xlsx;
        if (!XLSX) { alert('엑셀 라이브러리를 불러올 수 없습니다.'); return; }
        var layout = Array.isArray(window.currentLayout) ? window.currentLayout : [];
        var visibleCols = layout.filter(function (c) { return c && c.isVisible !== false; });
        if (visibleCols.length === 0) { alert('표시 중인 열이 없습니다. 열 설정에서 열을 추가해 주세요.'); return; }
        var headers = visibleCols.map(function (c) { return c.customName || c.defaultName || '필드' + c.id; });
        var ws = XLSX.utils.aoa_to_sheet([headers]);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '데이터');
        XLSX.writeFile(wb, 'upload_template.xlsx');
    };

   window.processExcelUpload = async function() {
        var file = window._excelSelectedFile;
        if (!file) { alert('파일을 선택해 주세요.'); return; }
        var XLSX = window.XLSX || window.xlsx;
        if (!XLSX) { alert('엑셀 라이브러리를 불러올 수 없습니다.'); return; }
        var layout = Array.isArray(window.currentLayout) ? window.currentLayout : [];
        var visibleCols = layout.filter(function (c) { return c && c.isVisible !== false; });
        if (visibleCols.length === 0) { alert('표시 중인 열이 없습니다.'); return; }
        var modeRadio = document.querySelector('input[name="uploadMode"]:checked');
        var isOverwrite = modeRadio && modeRadio.value === 'overwrite';
        var tableKey = getTableKey();

        var arrayBuffer = await new Promise(function(resolve, reject) {
            var r = new FileReader();
            r.onload = function() { resolve(r.result); };
            r.onerror = reject;
            r.readAsArrayBuffer(file);
        });
        var wb = XLSX.read(arrayBuffer, { type: 'array' });
        var firstSheet = wb.SheetNames && wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : null;
        if (!firstSheet) { alert('시트를 읽을 수 없습니다.'); return; }
        var aoa = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
        if (!aoa || aoa.length < 2) { alert('데이터 행이 없습니다.'); return; }
        var dataRows = aoa.slice(1).filter(function(row) { return row && row.some(function(cell) { return cell !== '' && cell != null; }); });
        var toInsert = dataRows.map(function(row) {
            var obj = { project_key: tableKey };
            visibleCols.forEach(function (col, idx) {
                var val = row[idx];
                obj['col' + col.id + '_val'] = val !== undefined && val !== null && val !== '' ? val : null;
            });
            return obj;
        });
        if (toInsert.length === 0) { alert('삽입할 데이터가 없습니다.'); return; }
        if (isOverwrite) {
            var del = await _supabase.from('data_rows').delete().eq('project_key', tableKey);
            if (del.error) { alert('기존 데이터 삭제 실패: ' + (del.error.message || '')); return; }
        }
        var chunk = 100;
        for (var i = 0; i < toInsert.length; i += chunk) {
            var slice = toInsert.slice(i, i + chunk);
            var res = await _supabase.from('data_rows').insert(slice);
            if (res.error) { alert('저장 실패: ' + (res.error.message || '')); return; }
        }
        window._excelSelectedFile = null;
        document.getElementById('excelFileName').textContent = '';
        document.getElementById('startExcelUploadBtn').disabled = true;
        if (document.getElementById('excelFileInput')) document.getElementById('excelFileInput').value = '';
        closeExcelModal();
        window.renderDataTable('FORCE_REFRESH');
        alert('업로드 완료: ' + toInsert.length + '건');
    };