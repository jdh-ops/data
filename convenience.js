/* ---------- 엑셀 합치기 모달 (편의 기능 1번) ---------- */
var _excelMergeFiles = [];
var _excelMergeTabs = [];
var _excelMergeActiveTabIndex = 0;

function openExcelMergeModal() {
    _excelMergeFiles = [];
    _excelMergeTabs = [{ sheetIndex: 0, headerRow: 1, keyColumns: '', result: null, removedRows: [] }];
    _excelMergeActiveTabIndex = 0;
    var listEl = document.getElementById('excelMergeFileList');
    var emptyEl = document.getElementById('excelMergeFileListEmpty');
    var fileInput = document.getElementById('excelMergeFileInput');
    if (listEl) listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    if (fileInput) fileInput.value = '';
    var downloadAllBtn = document.getElementById('excelMergeDownloadAllBtn');
    if (downloadAllBtn) downloadAllBtn.style.display = 'none';
    renderExcelMergeTabs();
    var modal = document.getElementById('excelMergeModal');
    if (modal) modal.style.display = 'flex';
}

function excelMergeGetTabLabel(index) {
    return index === 0 ? '첫번째 시트' : (index + 1) + '번째 시트';
}

function excelMergeSwitchTab(index) {
    _excelMergeActiveTabIndex = index;
    var list = document.getElementById('excelMergeTabList');
    var panels = document.getElementById('excelMergeTabPanels');
    if (list) list.querySelectorAll('.excel-merge-tab').forEach(function (el, i) {
        el.classList.toggle('active', i === index);
        el.style.background = i === index ? '#fff' : '#f8fafc';
        el.style.borderBottomColor = i === index ? '#fff' : 'transparent';
    });
    if (panels) panels.querySelectorAll('.excel-merge-panel').forEach(function (panel, i) { panel.style.display = i === index ? 'block' : 'none'; });
}

function excelMergeAddSheetTab() {
    _excelMergeTabs.push({ sheetIndex: _excelMergeTabs.length, headerRow: 1, keyColumns: '', result: null, removedRows: [] });
    renderExcelMergeTabs();
    excelMergeSwitchTab(_excelMergeTabs.length - 1);
}

function excelMergeRemoveTab(index) {
    if (_excelMergeTabs.length <= 1) return;
    _excelMergeTabs.splice(index, 1);
    _excelMergeTabs.forEach(function (t, j) { t.sheetIndex = j; });
    _excelMergeActiveTabIndex = Math.min(_excelMergeActiveTabIndex, _excelMergeTabs.length - 1);
    if (_excelMergeActiveTabIndex < 0) _excelMergeActiveTabIndex = 0;
    renderExcelMergeTabs();
    excelMergeSwitchTab(_excelMergeActiveTabIndex);
}

function renderExcelMergeTabs() {
    var tabList = document.getElementById('excelMergeTabList');
    var panelsContainer = document.getElementById('excelMergeTabPanels');
    if (!tabList || !panelsContainer) return;
    tabList.innerHTML = '';
    panelsContainer.innerHTML = '';
    _excelMergeTabs.forEach(function (tab, i) {
        var wrap = document.createElement('div');
        wrap.className = 'excel-merge-tab' + (i === _excelMergeActiveTabIndex ? ' active' : '');
        wrap.setAttribute('data-tab', String(i));
        wrap.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; margin-bottom: -1px; padding: 0; border: 1px solid #e2e8f0; background: ' + (i === _excelMergeActiveTabIndex ? '#fff' : '#f8fafc') + '; border-radius: 6px 6px 0 0; border-bottom-color: ' + (i === _excelMergeActiveTabIndex ? '#fff' : 'transparent') + ';';
        var label = document.createElement('span');
        label.style.cssText = 'padding: 8px 6px 8px 14px; font-size: 13px; color: #475569; cursor: pointer;' + (i === 0 ? ' padding-right: 14px;' : '');
        label.textContent = excelMergeGetTabLabel(i);
        label.onclick = function () { excelMergeSwitchTab(i); };
        wrap.appendChild(label);
        if (i !== 0) {
            var xBtn = document.createElement('button');
            xBtn.type = 'button';
            xBtn.setAttribute('aria-label', '탭 닫기');
            xBtn.textContent = '×';
            xBtn.style.cssText = 'padding: 4px 8px; font-size: 16px; line-height: 1; border: none; background: none; border-radius: 0 5px 0 0; cursor: pointer; color: #64748b;';
            xBtn.onclick = function (e) { e.stopPropagation(); excelMergeRemoveTab(i); };
            wrap.appendChild(xBtn);
        }
        tabList.appendChild(wrap);
        var panel = document.createElement('div');
        panel.className = 'excel-merge-panel';
        panel.setAttribute('data-tab', String(i));
        panel.style.display = i === _excelMergeActiveTabIndex ? 'block' : 'none';
        panel.innerHTML = '<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 10px;">' +
            '<span style="font-size: 13px; color: #475569;">헤더(상품명, 국가, url 등) :</span>' +
            '<input type="number" class="excel-merge-header-row" min="1" value="' + (tab.headerRow || 1) + '" style="width: 56px; padding: 8px 10px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 13px; box-sizing: border-box; text-align: center;">' +
            '<span style="font-size: 13px; color: #475569;">행</span></div>' +
            '<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 12px;">' +
            '<span style="font-size: 13px; color: #475569;">중복 검사 기준 :</span>' +
            '<input type="text" class="excel-merge-key-columns" placeholder="예: A,B" value="' + (tab.keyColumns || '').replace(/"/g, '&quot;') + '" style="width: 90px; padding: 8px 10px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 13px; box-sizing: border-box;">' +
            '<span style="font-size: 13px; color: #475569;">열</span></div>' +
            '<div class="excel-merge-dup-msg" style="font-size: 12px; color: #64748b; margin-top: 8px; overflow-wrap: break-word; word-break: break-word; white-space: normal; max-width: 100%;"></div>';
        panel.querySelector('.excel-merge-header-row').onchange = function () { _excelMergeTabs[i].headerRow = parseInt(this.value, 10) || 1; };
        panel.querySelector('.excel-merge-key-columns').oninput = function () { _excelMergeTabs[i].keyColumns = this.value; };
        if (tab.result && tab.removedRows && tab.removedRows.length > 0) {
            var byFile = {};
            tab.removedRows.forEach(function (item) {
                var fn = item.fileName || '(알 수 없음)';
                if (!byFile[fn]) byFile[fn] = [];
                byFile[fn].push(item.rowInFile);
            });
            function fmtRanges(arr) {
                if (!arr || arr.length === 0) return '';
                var sorted = arr.slice().sort(function (a, b) { return a - b; });
                var parts = [], start = sorted[0], end = sorted[0];
                for (var k = 1; k <= sorted.length; k++) {
                    var n = k < sorted.length ? sorted[k] : null;
                    if (n !== null && n === end + 1) end = n;
                    else { parts.push(start === end ? String(start) : start + '~' + end); if (n !== null) { start = n; end = n; } }
                }
                return parts.join(', ');
            }
            var lines = ['중복으로 제거된 행 : 총 ' + tab.removedRows.length + '건'];
            Object.keys(byFile).forEach(function (fn) { lines.push(fn + ' (' + byFile[fn].length + '건) - ' + fmtRanges(byFile[fn])); });
            panel.querySelector('.excel-merge-dup-msg').innerHTML = lines.join('<br>');
            panel.querySelector('.excel-merge-dup-msg').style.color = '#b45309';
            panel.querySelector('.excel-merge-dup-msg').style.display = 'block';
        } else if (tab.result) {
            panel.querySelector('.excel-merge-dup-msg').textContent = '중복 제거된 행 없음.';
            panel.querySelector('.excel-merge-dup-msg').style.display = 'block';
        }
        panelsContainer.appendChild(panel);
    });
}

function closeExcelMergeModal() {
    var modal = document.getElementById('excelMergeModal');
    if (modal) modal.style.display = 'none';
}

function excelMergeDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    var zone = document.getElementById('excelMergeDropZone');
    if (zone) zone.style.borderColor = '#3182ce';
}

function excelMergeDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    var zone = document.getElementById('excelMergeDropZone');
    if (zone) zone.style.borderColor = '#cbd5e0';
}

function excelMergeDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    var zone = document.getElementById('excelMergeDropZone');
    if (zone) zone.style.borderColor = '#cbd5e0';
    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) excelMergeAddFiles(files);
}

function excelMergeFileSelect(e) {
    var files = e.target && e.target.files;
    if (files && files.length) excelMergeAddFiles(files);
    e.target.value = '';
}

function excelMergeAddFiles(fileList) {
    var XLSX = window.XLSX || window.xlsx;
    if (!XLSX) { alert('엑셀 라이브러리를 불러올 수 없습니다.'); return; }
    var added = 0;
    function addOne(i) {
        if (i >= fileList.length) {
            renderExcelMergeFileList();
            return;
        }
        var file = fileList[i];
        var name = (file.name || '').trim();
        if (!name || (name.indexOf('.xlsx') === -1 && name.indexOf('.xls') === -1 && name.indexOf('.csv') === -1)) {
            addOne(i + 1);
            return;
        }
        var reader = new FileReader();
        reader.onload = function (ev) {
            var buf = ev.target && ev.target.result;
            if (buf) {
                _excelMergeFiles.push({ name: name, arrayBuffer: buf });
                added++;
            }
            addOne(i + 1);
        };
        reader.readAsArrayBuffer(file);
    }
    addOne(0);
}

function renderExcelMergeFileList() {
    var listEl = document.getElementById('excelMergeFileList');
    var emptyEl = document.getElementById('excelMergeFileListEmpty');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = _excelMergeFiles.length ? 'none' : 'block';
    _excelMergeFiles.forEach(function (f, idx) {
        var li = document.createElement('li');
        li.style.cssText = 'padding: 4px 0; display: flex; align-items: center; justify-content: space-between; gap: 8px;';
        li.innerHTML = '<span style="word-break: break-all;">' + (f.name || '').replace(/</g, '&lt;') + '</span>' +
            '<button type="button" style="flex-shrink:0; padding: 2px 8px; font-size: 11px; border: 1px solid #feb2b2; color: #c53030; background: #fff5f5; border-radius: 4px; cursor: pointer;" data-idx="' + idx + '" onclick="excelMergeRemoveFile(' + idx + ')">삭제</button>';
        listEl.appendChild(li);
    });
}

function excelMergeRemoveFile(idx) {
    _excelMergeFiles.splice(idx, 1);
    renderExcelMergeFileList();
}

function excelMergeParseKeyColumns(str) {
    var s = (str || '').trim();
    if (!s) return [];
    var parts = s.split(/[,，\s]+/).map(function (p) { return p.trim(); }).filter(Boolean);
    var indices = [];
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (/^\d+$/.test(p)) {
            var n = parseInt(p, 10);
            if (n >= 1) indices.push(n - 1);
        } else {
            var col = excelMergeColLetterToIndex(p);
            if (col >= 0) indices.push(col);
        }
    }
    return indices;
}

function excelMergeColLetterToIndex(str) {
    var s = (str || '').trim().toUpperCase();
    if (!s) return -1;
    var n = 0;
    for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i) - 64;
        if (c < 1 || c > 26) return -1;
        n = n * 26 + c;
    }
    return n - 1;
}

function excelMergeDoMerge(tabIndex) {
    var XLSX = window.XLSX || window.xlsx;
    if (!XLSX) { alert('엑셀 라이브러리를 불러올 수 없습니다.'); return; }
    if (_excelMergeFiles.length === 0) { alert('합칠 파일을 먼저 업로드하세요.'); return; }
    var tab = _excelMergeTabs[tabIndex];
    if (!tab) return;
    var panel = document.querySelector('.excel-merge-panel[data-tab="' + tabIndex + '"]');
    if (!panel) return;
    var headerRowInp = panel.querySelector('.excel-merge-header-row');
    var headerRow1Based = (headerRowInp && parseInt(headerRowInp.value, 10) >= 1) ? parseInt(headerRowInp.value, 10) : 1;
    var keyInp = panel.querySelector('.excel-merge-key-columns');
    var keyCols = excelMergeParseKeyColumns(keyInp && keyInp.value ? keyInp.value : '');
    tab.headerRow = headerRow1Based;
    tab.keyColumns = keyInp ? keyInp.value : '';
    var sheetIndex = Math.min(tabIndex, 999);
    var allRows = [];
    var rowSource = [];
    var headerRow = null;
    var headerIdx = headerRow1Based - 1;
    try {
        for (var f = 0; f < _excelMergeFiles.length; f++) {
            var wb = XLSX.read(_excelMergeFiles[f].arrayBuffer, { type: 'array' });
            var sheetIdx = Math.min(sheetIndex, (wb.SheetNames && wb.SheetNames.length) ? wb.SheetNames.length - 1 : 0);
            var sheet = wb.SheetNames && wb.SheetNames[sheetIdx] ? wb.Sheets[wb.SheetNames[sheetIdx]] : null;
            if (!sheet) continue;
            var aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            if (!aoa || aoa.length === 0) continue;
            if (headerIdx >= aoa.length) continue;
            var sheetHeader = aoa[headerIdx];
            var dataStart = headerIdx + 1;
            var fileName = (_excelMergeFiles[f].name || '').trim() || '파일';
            if (f === 0) {
                headerRow = sheetHeader;
                allRows.push(headerRow);
                rowSource.push(null);
                for (var r = dataStart; r < aoa.length; r++) {
                    allRows.push(aoa[r]);
                    rowSource.push({ fileName: fileName, rowInFile: r + 1 });
                }
            } else {
                for (var r = dataStart; r < aoa.length; r++) {
                    allRows.push(aoa[r]);
                    rowSource.push({ fileName: fileName, rowInFile: r + 1 });
                }
            }
        }
        if (!headerRow || allRows.length <= 1) {
            tab.result = { aoa: allRows.length ? allRows : [[]], removedRows: [] };
            tab.removedRows = [];
        } else {
            var seen = {};
            var kept = [allRows[0]];
            var removedRows = [];
            for (var i = 1; i < allRows.length; i++) {
                var row = allRows[i];
                var key = keyCols.length > 0
                    ? keyCols.map(function (c) { var v = row[c]; return v == null ? '' : String(v).trim(); }).join('\t')
                    : null;
                if (key !== null) {
                    if (seen[key]) {
                        var src = rowSource[i];
                        removedRows.push(src ? { fileName: src.fileName, rowInFile: src.rowInFile } : { fileName: '', rowInFile: i + 1 });
                        continue;
                    }
                    seen[key] = true;
                }
                kept.push(row);
            }
            tab.result = { aoa: kept, removedRows: removedRows };
            tab.removedRows = removedRows;
        }
    } catch (err) {
        alert('합치기 중 오류: ' + (err && err.message ? err.message : String(err)));
        return;
    }
    var downloadBtn = panel.querySelector('.excel-merge-download-btn');
    var dupMsg = panel.querySelector('.excel-merge-dup-msg');
    if (downloadBtn) downloadBtn.style.display = 'inline-block';
    if (dupMsg) {
        if (tab.removedRows && tab.removedRows.length > 0) {
            var byFile = {};
            tab.removedRows.forEach(function (item) {
                var fn = item.fileName || '(알 수 없음)';
                if (!byFile[fn]) byFile[fn] = [];
                byFile[fn].push(item.rowInFile);
            });
            function formatConsecutiveRanges(arr) {
                if (!arr || arr.length === 0) return '';
                var sorted = arr.slice().sort(function (a, b) { return a - b; });
                var parts = [], start = sorted[0], end = sorted[0];
                for (var k = 1; k <= sorted.length; k++) {
                    var n = k < sorted.length ? sorted[k] : null;
                    if (n !== null && n === end + 1) end = n;
                    else { parts.push(start === end ? String(start) : start + '~' + end); if (n !== null) { start = n; end = n; } }
                }
                return parts.join(', ');
            }
            var lines = ['중복으로 제거된 행 : 총 ' + tab.removedRows.length + '건'];
            Object.keys(byFile).forEach(function (fn) { lines.push(fn + ' (' + byFile[fn].length + '건) - ' + formatConsecutiveRanges(byFile[fn])); });
            dupMsg.innerHTML = lines.join('<br>');
            dupMsg.style.color = '#b45309';
            dupMsg.style.display = 'block';
        } else {
            dupMsg.textContent = '중복 제거된 행 없음.';
            dupMsg.style.color = '#64748b';
            dupMsg.style.display = 'block';
        }
    }
}

function excelMergeDownload(tabIndex) {
    var tab = _excelMergeTabs[tabIndex];
    if (!tab || !tab.result || !tab.result.aoa || tab.result.aoa.length === 0) return;
    var XLSX = window.XLSX || window.xlsx;
    if (!XLSX) { alert('엑셀 라이브러리를 불러올 수 없습니다.'); return; }
    var ws = XLSX.utils.aoa_to_sheet(tab.result.aoa);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '합치기');
    var name = tabIndex === 0 ? 'merged.xlsx' : 'merged_sheet' + (tabIndex + 1) + '.xlsx';
    XLSX.writeFile(wb, name);
}

function excelMergeDoMergeAll() {
    if (_excelMergeFiles.length === 0) { alert('합칠 파일을 먼저 업로드하세요.'); return; }
    for (var i = 0; i < _excelMergeTabs.length; i++) excelMergeDoMerge(i);
    var downloadAllBtn = document.getElementById('excelMergeDownloadAllBtn');
    if (downloadAllBtn) downloadAllBtn.style.display = 'inline-block';
}

function excelMergeDownloadAll() {
    var XLSX = window.XLSX || window.xlsx;
    if (!XLSX) { alert('엑셀 라이브러리를 불러올 수 없습니다.'); return; }
    var hasAny = false;
    var wb = XLSX.utils.book_new();
    _excelMergeTabs.forEach(function (tab, i) {
        if (tab.result && tab.result.aoa && tab.result.aoa.length > 0) {
            var ws = XLSX.utils.aoa_to_sheet(tab.result.aoa);
            var sheetName = (i === 0 ? '첫번째시트' : (i + 1) + '번째시트').substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            hasAny = true;
        }
    });
    if (!hasAny) { alert('합치기를 먼저 실행하세요.'); return; }
    XLSX.writeFile(wb, 'merged.xlsx');
}

// 편의 기능: 예시 5개 (id, title, description)
var CONVENIENCE_FEATURES = [
    { id: 'excelMerge', title: '엑셀 합치기', description: '여러 엑셀 파일을 하나로 합치고 중복 행을 제거합니다.' },
    { id: 'urlConverter', title: 'URL 단축', description: '여러 URL을 붙여넣으면 지원 사이트는 단축해 주고, 복사할 수 있습니다.' },
    { id: 'conv2', title: '제목2', description: '설명입니다.' },
    { id: 'conv3', title: '제목3', description: '설명입니다.' },
    { id: 'conv4', title: '제목4', description: '설명입니다.' },
    { id: 'conv5', title: '제목5', description: '설명입니다.' }
];
var CONVENIENCE_STORAGE_FAV = 'page3_convenience_favorites';

function getConvenienceFavorites() {
    try {
        var raw = localStorage.getItem(CONVENIENCE_STORAGE_FAV);
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}
function setConvenienceFavorites(arr) {
    try { localStorage.setItem(CONVENIENCE_STORAGE_FAV, JSON.stringify(arr)); } catch (e) {}
}
function getConvenienceById(id) {
    return CONVENIENCE_FEATURES.filter(function (f) { return f.id === id; })[0] || null;
}

function renderConvenienceFeature3() {
    var favIds = getConvenienceFavorites();
    var zone = document.getElementById('convenienceFavoritesZone');
    var row = document.getElementById('convenienceFavoritesRow');
    var grid = document.getElementById('convenienceCardsGrid');
    if (!zone || !row || !grid) return;
    if (favIds.length > 0) {
        zone.style.display = 'block';
        row.innerHTML = favIds.map(function (id) {
            var f = getConvenienceById(id);
            return f ? buildConvenienceCardHtml(f, true) : '';
        }).filter(Boolean).join('');
    } else {
        zone.style.display = 'none';
        row.innerHTML = '';
    }
    bindConvenienceCardMenus(row);
    grid.innerHTML = CONVENIENCE_FEATURES.map(function (f) { return buildConvenienceCardHtml(f, false); }).join('');
    bindConvenienceCardMenus(grid);
    bindConvenienceCardClick(grid);
    bindConvenienceCardClick(row);
}

function bindConvenienceCardClick(container) {
    if (!container) return;
    container.querySelectorAll('.convenience-card').forEach(function (card) {
        if (card.getAttribute('data-card-click-bound') === '1') return;
        card.setAttribute('data-card-click-bound', '1');
        card.addEventListener('click', function (e) {
            if (e.target.closest('.card-menu-btn') || e.target.closest('.card-dropdown')) return;
            var id = card.getAttribute('data-id');
            if (id === 'excelMerge') openExcelMergeModal();
            if (id === 'urlConverter') openUrlConverterModal();
        });
    });
}

function buildConvenienceCardHtml(feature, isFavoriteRow) {
    var favIds = getConvenienceFavorites();
    var isFav = favIds.indexOf(feature.id) !== -1;
    var thumbStyle = 'background: linear-gradient(135deg, #334155 0%, #1e293b 100%);';
    return '<div class="convenience-card" data-id="' + feature.id + '" style="width: 100%;">' +
        '<div style="width:100%;height:100%;min-height:90px;' + thumbStyle + '" class="card-thumb-wrap"></div>' +
        '<div class="card-title-top">' + (feature.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' +
        '<div class="card-overlay">' +
        '<div class="card-title">' + (feature.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' +
        '<div class="card-desc">' + (feature.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' +
        '</div>' +
        '<button type="button" class="card-menu-btn" aria-label="메뉴">⋮</button>' +
        '<div class="card-dropdown" style="display:none;">' +
        '<button type="button" data-action="' + (isFav ? 'unfavorite' : 'favorite') + '">' + (isFav ? '즐겨찾기 제거' : '즐겨찾기 추가') + '</button>' +
        '</div></div>';
}

function bindConvenienceCardMenus(container) {
    if (!container) return;
    container.querySelectorAll('.card-menu-btn').forEach(function (btn) {
        btn.onclick = function (e) {
            e.stopPropagation();
            var card = btn.closest('.convenience-card');
            var dd = card ? card.querySelector('.card-dropdown') : null;
            document.querySelectorAll('.convenience-card .card-dropdown').forEach(function (d) {
                if (d !== dd) d.style.display = 'none';
            });
            if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
        };
    });
    container.querySelectorAll('.card-dropdown button').forEach(function (btn) {
        btn.onclick = function (e) {
            e.stopPropagation();
            var card = btn.closest('.convenience-card');
            var id = card ? card.getAttribute('data-id') : null;
            var action = btn.getAttribute('data-action');
            if (!id) return;
            if (action === 'favorite') {
                var fav = getConvenienceFavorites();
                if (fav.indexOf(id) === -1) { fav.push(id); setConvenienceFavorites(fav); }
            } else if (action === 'unfavorite') {
                setConvenienceFavorites(getConvenienceFavorites().filter(function (x) { return x !== id; }));
            }
            var dd = card ? card.querySelector('.card-dropdown') : null;
            if (dd) dd.style.display = 'none';
            setTimeout(function () { renderConvenienceFeature3(); }, 0);
        };
    });
}
document.addEventListener('click', function () {
    document.querySelectorAll('.convenience-card .card-dropdown').forEach(function (d) { d.style.display = 'none'; });
});

function openConvenienceFavoriteOrderModal() {
    var modal = document.getElementById('convenienceFavoriteOrderModal');
    var listEl = document.getElementById('convenienceFavoriteOrderList');
    if (!modal || !listEl) return;
    var fav = getConvenienceFavorites();
    if (fav.length === 0) {
        alert('즐겨찾기에 항목이 없습니다.');
        return;
    }
    listEl.innerHTML = fav.map(function (id, idx) {
        var f = getConvenienceById(id);
        var title = f ? f.title : id;
        return '<li class="convenience-order-item" data-id="' + id + '" data-index="' + idx + '">' +
            '<span class="order-handle">⋮⋮</span>' +
            '<span style="flex:1;">' + (title + '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' +
            '</li>';
    }).join('');
    modal.style.display = 'flex';
    makeConvenienceOrderListSortable(listEl);
}

function makeConvenienceOrderListSortable(listEl) {
    var items = [].slice.call(listEl.querySelectorAll('.convenience-order-item'));
    var dragSrc = null;
    items.forEach(function (item) {
        item.draggable = true;
        item.ondragstart = function (e) { dragSrc = item; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.getAttribute('data-id')); };
        item.ondragover = function (e) { e.preventDefault(); if (dragSrc && dragSrc !== item) item.style.opacity = '0.5'; };
        item.ondragleave = function (e) { item.style.opacity = '1'; };
        item.ondrop = function (e) {
            e.preventDefault();
            item.style.opacity = '1';
            if (!dragSrc || dragSrc === item) return;
            var all = [].slice.call(listEl.querySelectorAll('.convenience-order-item'));
            var idxSrc = all.indexOf(dragSrc);
            var idxDest = all.indexOf(item);
            if (idxSrc === -1 || idxDest === -1) return;
            listEl.insertBefore(dragSrc, idxDest < idxSrc ? item : item.nextSibling);
        };
        item.ondragend = function () { items.forEach(function (i) { i.style.opacity = '1'; }); dragSrc = null; };
    });
}

function closeConvenienceFavoriteOrderModal() {
    var modal = document.getElementById('convenienceFavoriteOrderModal');
    if (modal) modal.style.display = 'none';
}

function saveConvenienceFavoriteOrder() {
    var listEl = document.getElementById('convenienceFavoriteOrderList');
    if (!listEl) return;
    var order = [].map.call(listEl.querySelectorAll('.convenience-order-item'), function (li) { return li.getAttribute('data-id'); });
    var curFav = getConvenienceFavorites();
    var newFav = order.slice();
    curFav.forEach(function (id) { if (order.indexOf(id) === -1) newFav.push(id); });
    setConvenienceFavorites(newFav);
    closeConvenienceFavoriteOrderModal();
    renderConvenienceFeature3();
}

// ---------- URL 단축 (편의 기능) ----------
// 반환: { url: 변환된 URL 또는 원본, site: 'shopee'|'lazada'|'taobao'|null }
function convertUrlBySite(urlStr) {
    var s = (urlStr || '').trim();
    if (!s) return { url: s, site: null };
    try {
        var u = new URL(s);
        var host = (u.hostname || '').toLowerCase().replace(/^www\./, '');
        if (host.indexOf('shopee.') === 0) {
            var match = s.match(/(-i\.\d+\.\d+)/);
            if (match) return { url: u.origin + '/Vanish' + match[1], site: 'shopee' };
        }
        if (host.indexOf('lazada.') === 0) {
            var m = s.match(/-i(\d+)/);
            if (m) return { url: u.origin + '/products/Vanish-i' + m[1] + '.html', site: 'lazada' };
        }
        if (host === 'item.taobao.com' || host.indexOf('taobao.') !== -1) {
            var idMatch = s.match(/[?&]id=(\d+)/);
            if (idMatch) return { url: 'https://item.taobao.com/item.htm?id=' + idMatch[1], site: 'taobao' };
        }
    } catch (e) {}
    return { url: s, site: null };
}

function runUrlConverter() {
    var ta = document.getElementById('urlConverterTextarea');
    var msgEl = document.getElementById('urlConverterMessage');
    if (!ta) return;
    var rawLines = (ta.value || '').split(/\r?\n/);
    var lines = rawLines.map(function (line) { return line.trim(); }).filter(function (line) { return line !== ''; });
    if (lines.length === 0) {
        if (msgEl) { msgEl.textContent = '변환할 URL을 입력해 주세요.'; msgEl.style.color = '#64748b'; }
        return;
    }
    var count = { shopee: 0, lazada: 0, taobao: 0, none: 0 };
    var converted = lines.map(function (line) {
        var r = convertUrlBySite(line);
        if (r.site === 'shopee') count.shopee++;
        else if (r.site === 'lazada') count.lazada++;
        else if (r.site === 'taobao') count.taobao++;
        else count.none++;
        return r.url;
    });
    ta.value = converted.join('\n');
    var parts = [];
    if (count.shopee) parts.push('Shopee ' + count.shopee + '개');
    if (count.lazada) parts.push('Lazada ' + count.lazada + '개');
    if (count.taobao) parts.push('Taobao ' + count.taobao + '개');
    if (parts.length) parts.push('변환됨');
    if (count.none) parts.push('(변환 불가 ' + count.none + '개)');
    if (msgEl) {
        msgEl.textContent = parts.join(' ');
        msgEl.style.color = count.none && !count.shopee && !count.lazada && !count.taobao ? '#64748b' : '#1e293b';
    }
}

function openUrlConverterModal() {
    var modal = document.getElementById('urlConverterModal');
    var ta = document.getElementById('urlConverterTextarea');
    var msgEl = document.getElementById('urlConverterMessage');
    if (modal) modal.style.display = 'flex';
    if (ta) { ta.value = ''; ta.focus(); }
    if (msgEl) msgEl.textContent = '';
}

function closeUrlConverterModal() {
    var modal = document.getElementById('urlConverterModal');
    if (modal) modal.style.display = 'none';
}

function copyUrlConverterResult() {
    var ta = document.getElementById('urlConverterTextarea');
    if (!ta || !ta.value.trim()) {
        alert('복사할 URL이 없습니다. 먼저 URL을 붙여넣고 변환해 주세요.');
        return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value.trim()).then(function () {
            // 알림 없음
        }).catch(function () {
            fallbackCopyUrlConverter(ta.value.trim());
        });
    } else {
        fallbackCopyUrlConverter(ta.value.trim());
    }
}

function fallbackCopyUrlConverter(text) {
    var sel = document.getSelection();
    var range = document.createRange();
    var ta = document.getElementById('urlConverterTextarea');
    if (ta) {
        ta.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            alert('복사에 실패했습니다. 내용을 직접 선택해 복사해 주세요.');
        }
        if (sel) { sel.removeAllRanges(); if (range) sel.addRange(range); }
    }
}
