var page3KeywordList = [];
var page3KeywordListFiltered = [];
var _supabase = window._supabase;

window.page3Ready = function () {
    if (document.body) document.body.style.visibility = 'visible';
    try {
        var key = PAGE3_SECTION_STORAGE_KEY + (getProjectKey() ? '_' + getProjectKey() : '');
        var saved = sessionStorage.getItem(key);
        if (saved && PAGE3_SECTION_IDS.indexOf(saved) !== -1) showSection(saved);
    } catch (e) {}
};

function getProjectKey() {
    return (window.tableName || new URLSearchParams(window.location.search).get('table') || '').trim() || 'default';
}

var ROLE_KEYS = ['책임연구원', '연구원', '연구보조원'];
var ROLE_SALARY_DEFAULTS = { '책임연구원': 7567456, '연구원': 5802624, '연구보조원': 3878858 };

function buildSalaryByRoleFromConfig(salaryRows, projectKey) {
    var salaryByRole = {};
    var byTable = {};
    (salaryRows || []).forEach(function (r) {
        var t = r.target_table || '';
        if (!byTable[t]) byTable[t] = [];
        byTable[t].push(r);
    });
    ['default', projectKey].forEach(function (t) {
        var rows = byTable[t];
        if (!rows || !rows.length) return;
        var r = rows[0];
        var senior = Number(r.salary_senior) || 0;
        var researcher = Number(r.salary_researcher) || 0;
        var assistant = Number(r.salary_assistant) || 0;
        if (senior) salaryByRole['책임연구원'] = senior;
        if (researcher) salaryByRole['연구원'] = researcher;
        if (assistant) { salaryByRole['보조연구원'] = assistant; salaryByRole['연구보조원'] = assistant; }
    });
    return salaryByRole;
}

function loadStatusSummary() {
    if (!_supabase) {
        console.error('Supabase 클라이언트를 사용할 수 없습니다. config.js가 로드되었는지, SUPABASE_KEY가 설정되었는지 확인하세요.');
        var progressApplyEl = document.getElementById('contractStatusProgressApply');
        var progressSelectedEl = document.getElementById('contractStatusProgressSelected');
        var totalEl = document.getElementById('contractStatusTotalAmount');
        var personnelEl = document.getElementById('personnelStatusContent');
        var amountEl = document.getElementById('amountStatusContent');
        if (progressApplyEl) progressApplyEl.textContent = '—';
        if (progressSelectedEl) progressSelectedEl.textContent = '—';
        if (totalEl) totalEl.textContent = '—';
        if (personnelEl) personnelEl.textContent = '연결 오류';
        if (amountEl) amountEl.textContent = '연결 오류';
        return;
    }
    var projectKey = getProjectKey();
    var progressApplyEl = document.getElementById('contractStatusProgressApply');
    var progressSelectedEl = document.getElementById('contractStatusProgressSelected');
    var totalEl = document.getElementById('contractStatusTotalAmount');
    var personnelEl = document.getElementById('personnelStatusContent');
    var amountEl = document.getElementById('amountStatusContent');
    if (!personnelEl) return;
    if (progressApplyEl) progressApplyEl.textContent = '…';
    if (progressSelectedEl) progressSelectedEl.textContent = '…';
    if (totalEl) totalEl.textContent = '…';
    personnelEl.textContent = '데이터를 불러오는 중...';
    if (amountEl) amountEl.textContent = '데이터를 불러오는 중...';
    Promise.all([
        _supabase.from('personnel_master').select('id, position, rest_rate').eq('target_table', projectKey),
        _supabase.from('salary_config').select('target_table, corp_size, salary_senior, salary_researcher, salary_assistant, cash_under_3y, kind_under_3y').or('target_table.eq.' + projectKey + ',target_table.eq.default'),
        _supabase.from('page3_participation').select('personnel_id, contract_id, rate'),
        _supabase.from('contract_registry').select('id, status, total_budget').eq('target_table', projectKey)
    ]).then(function (results) {
        var personnelRes = results[0];
        var salaryRes = results[1];
        var partRes = results[2];
        var contractsList = results[3].data || [];
        var activeContracts = contractsList.filter(function (c) { return (c.status || '').trim() !== '탈락'; });
        var applyCount = activeContracts.filter(function (c) { return (c.status || '').trim() === '신청'; }).length;
        var selectedCount = activeContracts.filter(function (c) { return (c.status || '').trim() === '선정'; }).length;
        var totalBudgetSum = activeContracts.reduce(function (a, c) { return a + (Number(c.total_budget) || 0); }, 0);
        if (progressApplyEl) progressApplyEl.textContent = applyCount.toLocaleString('ko-KR');
        if (progressSelectedEl) progressSelectedEl.textContent = selectedCount.toLocaleString('ko-KR');
        if (totalEl) totalEl.textContent = totalBudgetSum.toLocaleString('ko-KR');
        var contractById = {};
        contractsList.forEach(function (c) { contractById[c.id] = c; });
        var personnelList = (personnelRes && personnelRes.data) ? personnelRes.data : [];
        var salaryRows = (salaryRes && salaryRes.data) ? salaryRes.data : [];
        var partList = (partRes && partRes.data) ? partRes.data : [];
        var salaryByRole = buildSalaryByRoleFromConfig(salaryRows, projectKey);
        ROLE_KEYS.forEach(function (r) { if (salaryByRole[r] == null) salaryByRole[r] = ROLE_SALARY_DEFAULTS[r] || 0; });
        var partByPerson = {};
        partList.forEach(function (p) {
            if (!partByPerson[p.personnel_id]) partByPerson[p.personnel_id] = [];
            var status = (contractById[p.contract_id] || {}).status || '';
            if (status === '신청' || status === '선정') partByPerson[p.personnel_id].push(Number(p.rate) || 0);
        });
        var totalAmount = 0;
        personnelList.forEach(function (p) {
            var sal = salaryByRole[p.position] || 0;
            var rates = partByPerson[p.id] || [];
            var cum = rates.reduce(function (a, b) { return a + b; }, 0);
            totalAmount += sal * (cum / 100);
        });
        if (personnelEl) personnelEl.innerHTML = '등록 인력 <strong>' + personnelList.length + '</strong>명';
        if (amountEl) amountEl.innerHTML = '월 인건비 합계 <strong>' + Math.round(totalAmount).toLocaleString() + '</strong>원';
        updatePersonnelStatusTable(projectKey, personnelList, salaryByRole, salaryRows);
    }).catch(function (err) {
        if (progressApplyEl) progressApplyEl.textContent = '—';
        if (progressSelectedEl) progressSelectedEl.textContent = '—';
        if (totalEl) totalEl.textContent = '—';
        if (personnelEl) personnelEl.textContent = '인력 테이블 없음 또는 오류.';
        if (amountEl) amountEl.textContent = '금액 집계 오류.';
    });
}

function updatePersonnelStatusTable(projectKey, personnelList, salaryByRole, salaryRows) {
    var thead = document.getElementById('personnelStatusTableHead');
    var tbody = document.getElementById('personnelStatusTableBody');
    if (!thead || !tbody) return;
    var currentMonth = new Date().getMonth() + 1;
    var m1, m2, m3;
    if (12 - currentMonth - 2 >= 1) {
        m1 = 12 - currentMonth;
        m2 = m1 - 1;
        m3 = m1 - 2;
    } else {
        m1 = 3;
        m2 = 2;
        m3 = 1;
    }
    var months = [m1, m2, m3];
    var theadRow = thead.querySelector('tr');
    if (theadRow) {
        var cells = theadRow.querySelectorAll('th');
        if (cells.length >= 4) {
            cells[0].textContent = '';
            cells[1].textContent = m1 + '개월';
            cells[2].textContent = m2 + '개월';
            cells[3].textContent = m3 + '개월';
        }
    }
    var costPerMonth = 0;
    (personnelList || []).forEach(function (p) {
        var sal = salaryByRole[p.position] || 0;
        var rest = (p.rest_rate != null && p.rest_rate !== '') ? Number(p.rest_rate) : 0;
        costPerMonth += sal * (rest / 100);
    });
    var laborCosts = months.map(function (M) { return Math.round(costPerMonth * M); });
    var kindRatioPct = 0;
    (salaryRows || []).forEach(function (r) {
        var corp = (r.corp_size || '').trim();
        if (corp !== 'mid' && corp !== '중기업') return;
        var k = Number(r.kind_under_3y) || 0;
        if (k > 0 && k <= 1) k = k * 100;
        if (k > 0) kindRatioPct = k;
    });
    if (kindRatioPct <= 0 || kindRatioPct >= 100) kindRatioPct = 0;
    var totalAmounts = laborCosts.map(function (personnelSum) {
        if (personnelSum <= 0) return 0;
        var totalCost = personnelSum * 1.06;
        var projectExpense = totalCost * (11 / 10);
        var denom = 1 - kindRatioPct / 100;
        if (denom <= 0) return Math.round(projectExpense);
        return Math.round(projectExpense / denom);
    });
    var fmt = function (n) { return (n != null && !isNaN(n)) ? n.toLocaleString('ko-KR') : '—'; };
    var rows = tbody.querySelectorAll('tr');
    if (rows.length >= 2) {
        [0, 1, 2].forEach(function (i) {
            var cell = rows[0].querySelectorAll('td')[i + 1];
            if (cell) cell.textContent = fmt(laborCosts[i]);
        });
        [0, 1, 2].forEach(function (i) {
            var cell = rows[1].querySelectorAll('td')[i + 1];
            if (cell) cell.textContent = fmt(totalAmounts[i]);
        });
    }
}

function loadPersonnelTable() {
    if (!_supabase) {
        var tbody = document.getElementById('personnelTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="padding: 16px; text-align: center; color: #c53030;">Supabase 연결 불가. config.js API 키를 확인하세요.</td></tr>';
        return;
    }
    var projectKey = getProjectKey();
    var theadContract = document.getElementById('personnelContractHeaders');
    var tbody = document.getElementById('personnelTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="padding: 16px; text-align: center; color: #94a3b8;">데이터를 불러오는 중...</td></tr>';
    Promise.all([
        _supabase.from('contract_registry').select('id, company_name, num_tag, status').eq('target_table', projectKey).order('id', { ascending: true }),
        _supabase.from('personnel_master').select('id, position, name').eq('target_table', projectKey),
        _supabase.from('page3_participation').select('personnel_id, contract_id, rate'),
        _supabase.from('salary_config').select('target_table, salary_senior, salary_researcher, salary_assistant').or('target_table.eq.' + projectKey + ',target_table.eq.default')
    ]).then(function (results) {
        var contracts = (results[0] && results[0].data) ? results[0].data : [];
        var personnel = (results[1] && results[1].data) ? results[1].data : [];
        var partList = (results[2] && results[2].data) ? results[2].data : [];
        var salaryRows = (results[3] && results[3].data) ? results[3].data : [];
        var salaryByRole = buildSalaryByRoleFromConfig(salaryRows, projectKey);
        ROLE_KEYS.forEach(function (r) { if (salaryByRole[r] == null) salaryByRole[r] = ROLE_SALARY_DEFAULTS[r] || 0; });
        var partMap = {};
        partList.forEach(function (p) {
            var key = p.personnel_id + '_' + p.contract_id;
            partMap[key] = Number(p.rate) || 0;
        });
        if (theadContract) {
            theadContract.innerHTML = contracts.map(function (c) {
                var name = ((c.num_tag || '') + ' ' + (c.company_name || '')).trim() || '(협약)';
                name = name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                var status = (c.status || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return '<th style="padding: 8px 12px; text-align: right; white-space: nowrap;" title="' + status + '">' + name + '<br><small style="color:#94a3b8;">' + status + '</small></th>';
            }).join('');
        }
        if (personnel.length === 0) {
            tbody.innerHTML = '<tr><td colspan="' + (4 + contracts.length) + '" style="padding: 16px; text-align: center; color: #94a3b8;">등록된 인력이 없습니다.</td></tr>';
            return;
        }
        tbody.innerHTML = personnel.map(function (p) {
            var sal = salaryByRole[p.position] || 0;
            var cumRates = [];
            contracts.forEach(function (c) {
                var key = p.id + '_' + c.id;
                if (c.status === '신청' || c.status === '선정') cumRates.push(partMap[key] || 0);
            });
            var cum = cumRates.reduce(function (a, b) { return a + b; }, 0);
            var row = '<tr><td style="padding: 8px 12px;">' + (p.position || '').replace(/</g, '&lt;') + '</td><td style="padding: 8px 12px;">' + (p.name || '').replace(/</g, '&lt;') + '</td><td style="padding: 8px 12px; text-align: right;">' + sal.toLocaleString() + '</td><td style="padding: 8px 12px; text-align: right;">' + cum.toFixed(1) + '%</td>';
            contracts.forEach(function (c) {
                var rate = partMap[p.id + '_' + c.id] || 0;
                row += '<td style="padding: 8px 12px; text-align: right;">' + (rate ? rate + '%' : '-') + '</td>';
            });
            row += '</tr>';
            return row;
        }).join('');
    }).catch(function () {
        tbody.innerHTML = '<tr><td colspan="4" style="padding: 16px; text-align: center; color: #e53e3e;">로드 실패. personnel_master 확인 후 새로고침하세요.</td></tr>';
    });
}

function formatContractDate(d) {
    if (d == null || d === '') return '—';
    var s = String(d).trim();
    if (s.length >= 10) {
        var y = s.substring(0, 4);
        var m = s.substring(5, 7);
        var d_ = s.substring(8, 10);
        var yy = y.length === 4 ? y.substring(2, 4) : y;
        return yy + '.' + m + '.' + d_;
    }
    return s;
}
function normalizeDateForInput(d) {
    if (d == null || d === '') return '';
    var s = String(d).trim();
    if (s.length >= 10) return s.substring(0, 10);
    return '';
}
function openContractPeriodEditModal(numTag, startVal, endVal) {
    var modal = document.getElementById('contractPeriodEditModal');
    var label = document.getElementById('contractPeriodEditModalLabel');
    var startInput = document.getElementById('contractPeriodEditStart');
    var endInput = document.getElementById('contractPeriodEditEnd');
    if (!modal || !label || !startInput || !endInput) return;
    modal.setAttribute('data-num-tag', numTag || '');
    label.textContent = '구분: ' + (numTag || '—');
    startInput.value = startVal || '';
    endInput.value = endVal || '';
    modal.style.display = 'flex';
    modal.onclick = function (e) { if (e.target === modal) closeContractPeriodEditModal(); };
}
function closeContractPeriodEditModal() {
    var modal = document.getElementById('contractPeriodEditModal');
    if (modal) { modal.style.display = 'none'; modal.onclick = null; }
}
function confirmContractPeriodEdit() {
    var modal = document.getElementById('contractPeriodEditModal');
    var numTag = modal ? modal.getAttribute('data-num-tag') : '';
    var startInput = document.getElementById('contractPeriodEditStart');
    var endInput = document.getElementById('contractPeriodEditEnd');
    if (!_supabase || !startInput || !endInput) return;
    var projectKey = getProjectKey();
    var newStart = startInput.value.trim();
    var newEnd = endInput.value.trim();
    var payload = { start_date: newStart || null, end_date: newEnd || null };
    function done() {
        closeContractPeriodEditModal();
        loadContractDetailApplicationTable();
    }
    if (numTag === '(미지정)') {
        Promise.all([
            _supabase.from('contract_registry').update(payload).eq('target_table', projectKey).is('num_tag', null),
            _supabase.from('contract_registry').update(payload).eq('target_table', projectKey).eq('num_tag', '')
        ]).then(function (results) {
            var err = results[0].error || results[1].error;
            if (err) alert('수정 실패: ' + (err.message || ''));
            done();
        });
    } else {
        _supabase.from('contract_registry').update(payload).eq('target_table', projectKey).eq('num_tag', numTag).then(function (upRes) {
            if (upRes.error) alert('수정 실패: ' + (upRes.error.message || ''));
            done();
        });
    }
}
function loadContractDetailApplicationTable() {
    var tbody = document.getElementById('contractDetailApplicationBody');
    if (!tbody) return;
    if (!_supabase) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 16px; text-align: center; color: #e53e3e;">연결 불가.</td></tr>';
        return;
    }
    var projectKey = getProjectKey();
    tbody.innerHTML = '<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8;">데이터를 불러오는 중...</td></tr>';
    _supabase.from('contract_registry').select('id, num_tag, start_date, end_date, status').eq('target_table', projectKey).order('num_tag').order('id', { ascending: true }).then(function (res) {
        var rows = (res.data || []);
        var byNumTag = {};
        rows.forEach(function (r) {
            var tag = (r.num_tag || '').trim() || '(미지정)';
            if (!byNumTag[tag]) byNumTag[tag] = { num_tag: tag, start_date: r.start_date, end_date: r.end_date, 신청: 0, 선정: 0, 탈락: 0 };
            var st = (r.status || '').trim();
            if (st === '신청') byNumTag[tag].신청 += 1;
            else if (st === '선정') byNumTag[tag].선정 += 1;
            else if (st === '탈락') byNumTag[tag].탈락 += 1;
            if (r.start_date != null) byNumTag[tag].start_date = r.start_date;
            if (r.end_date != null) byNumTag[tag].end_date = r.end_date;
        });
        var groups = Object.keys(byNumTag).sort().map(function (k) { return byNumTag[k]; });
        var total신청 = 0, total선정 = 0, total탈락 = 0;
        groups.forEach(function (g) { total신청 += g.신청; total선정 += g.선정; total탈락 += g.탈락; });
        var periodLabel = function (g) {
            var s = formatContractDate(g.start_date);
            var e = formatContractDate(g.end_date);
            if (s === '—' && e === '—') return '—';
            return s + ' ~ ' + e;
        };
        var escapeTag = function (t) { return (t || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
        if (groups.length === 0) {
            tbody.innerHTML = '<tr><td style="border: 1px solid #e2e8f0; padding: 10px 12px;">—</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center;">—</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center;">0</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center;">0</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center;">0</td></tr>';
            return;
        }
        tbody.innerHTML = groups.map(function (g) {
            var period = periodLabel(g);
            var tagEsc = escapeTag(g.num_tag);
            return '<tr data-num-tag="' + tagEsc + '"><td style="border: 1px solid #e2e8f0; padding: 10px 12px;">' + tagEsc + '</td><td class="contract-detail-period-cell" style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center; cursor: pointer;" data-start="' + (g.start_date || '') + '" data-end="' + (g.end_date || '') + '" title="클릭하여 수정">' + period + '</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center;">' + g.신청 + '</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center;">' + g.선정 + '</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center;">' + g.탈락 + '</td></tr>';
        }).join('') + '<tr style="background: #f8fafc; font-weight: 600;"><td style="border: 1px solid #e2e8f0; padding: 10px 12px;">합계</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center;">—</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center;">' + total신청 + '</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center;">' + total선정 + '</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center;">' + total탈락 + '</td></tr>';
        tbody.querySelectorAll('.contract-detail-period-cell').forEach(function (cell) {
            cell.addEventListener('click', function () {
                var numTag = cell.closest('tr').getAttribute('data-num-tag');
                if (!numTag) return;
                var startVal = normalizeDateForInput(cell.getAttribute('data-start'));
                var endVal = normalizeDateForInput(cell.getAttribute('data-end'));
                openContractPeriodEditModal(numTag, startVal, endVal);
            });
        });
    }).catch(function () {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 16px; text-align: center; color: #e53e3e;">로드 실패.</td></tr>';
    });
}

function loadContractDetailAmountTable() {
    var tbody = document.getElementById('contractDetailAmountBody');
    if (!tbody) return;
    if (!_supabase) {
        tbody.innerHTML = '<tr><td colspan="6" style="border: 1px solid #e2e8f0; padding: 16px; text-align: center; color: #e53e3e;">연결 불가.</td></tr>';
        return;
    }
    var projectKey = getProjectKey();
    tbody.innerHTML = '<tr><td colspan="6" style="border: 1px solid #e2e8f0; padding: 16px; text-align: center; color: #94a3b8;">데이터를 불러오는 중...</td></tr>';
    _supabase.from('contract_registry').select('num_tag, status, total_budget, gov_contribution, corp_cash, corp_kind').eq('target_table', projectKey).order('num_tag').then(function (res) {
        var rows = (res.data || []).filter(function (r) {
            var st = (r.status || '').trim();
            return st !== '탈락';
        });
        var byNumTag = {};
        rows.forEach(function (r) {
            var tag = (r.num_tag || '').trim() || '(미지정)';
            if (!byNumTag[tag]) byNumTag[tag] = { num_tag: tag, total_budget: 0, gov_contribution: 0, corp_cash: 0, corp_kind: 0 };
            byNumTag[tag].total_budget += Number(r.total_budget) || 0;
            byNumTag[tag].gov_contribution += Number(r.gov_contribution) || 0;
            byNumTag[tag].corp_cash += Number(r.corp_cash) || 0;
            byNumTag[tag].corp_kind += Number(r.corp_kind) || 0;
        });
        var groups = Object.keys(byNumTag).sort().map(function (k) { return byNumTag[k]; });
        var fmt = function (n) { var x = Number(n); return isNaN(x) ? '0' : x.toLocaleString('ko-KR'); };
        var escapeTag = function (t) { return (t || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
        if (groups.length === 0) {
            tbody.innerHTML = '<tr><td style="border: 1px solid #e2e8f0; padding: 10px 12px;">—</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right;">—</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right;">—</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right;">—</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right;">—</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right;">—</td></tr>';
            return;
        }
        var sumTotal = 0, sumGov = 0, sumCash = 0, sumKind = 0;
        groups.forEach(function (g) {
            sumTotal += g.total_budget;
            sumGov += g.gov_contribution;
            sumCash += g.corp_cash;
            sumKind += g.corp_kind;
        });
        var numCellStyle = 'border: 1px solid #e2e8f0; padding: 8px 10px; text-align: right; white-space: nowrap;';
        tbody.innerHTML = groups.map(function (g) {
            var tagEsc = escapeTag(g.num_tag);
            var cashSum = (Number(g.gov_contribution) || 0) + (Number(g.corp_cash) || 0);
            return '<tr><td style="border: 1px solid #e2e8f0; padding: 8px 6px;">' + tagEsc + '</td><td style="' + numCellStyle + '">' + fmt(g.total_budget) + '</td><td style="' + numCellStyle + '">' + fmt(cashSum) + '</td><td style="' + numCellStyle + '">' + fmt(g.gov_contribution) + '</td><td style="' + numCellStyle + '">' + fmt(g.corp_cash) + '</td><td style="' + numCellStyle + '">' + fmt(g.corp_kind) + '</td></tr>';
        }).join('') + '<tr style="background: #f8fafc; font-weight: 600;"><td style="border: 1px solid #e2e8f0; padding: 8px 6px;">합계</td><td style="' + numCellStyle + '">' + fmt(sumTotal) + '</td><td style="' + numCellStyle + '">' + fmt(sumGov + sumCash) + '</td><td style="' + numCellStyle + '">' + fmt(sumGov) + '</td><td style="' + numCellStyle + '">' + fmt(sumCash) + '</td><td style="' + numCellStyle + '">' + fmt(sumKind) + '</td></tr>';
    }).catch(function () {
        tbody.innerHTML = '<tr><td colspan="6" style="border: 1px solid #e2e8f0; padding: 16px; text-align: center; color: #e53e3e;">로드 실패.</td></tr>';
    });
}

function loadContractDetailList() {
    var area = document.getElementById('contractDetailListArea');
    if (!area) return;
    if (!_supabase) {
        area.innerHTML = '<p style="color: #e53e3e;">연결 불가.</p>';
        return;
    }
    var projectKey = getProjectKey();
    var includeDropout = document.getElementById('contractListIncludeDropout') && document.getElementById('contractListIncludeDropout').checked;
    area.innerHTML = '<p style="color: #94a3b8;">데이터를 불러오는 중...</p>';
    _supabase.from('contract_registry').select('id, company_name, brand_name, corp_size, corp_cash, corp_kind, total_budget, num_tag, status, ref_no').eq('target_table', projectKey).order('num_tag').order('id', { ascending: true }).then(function (res) {
        var rows = (res.data || []);
        if (!includeDropout) rows = rows.filter(function (r) { var s = (r.status || '').trim(); return s === '신청' || s === '선정'; });
        var byNumTag = {};
        rows.forEach(function (r) {
            var tag = (r.num_tag || '').trim() || '(미지정)';
            if (!byNumTag[tag]) byNumTag[tag] = [];
            byNumTag[tag].push(r);
        });
        var tagOrder = Object.keys(byNumTag).sort();
        tagOrder.forEach(function (tag) {
            byNumTag[tag].sort(function (a, b) {
                var sa = (a.status || '').trim();
                var sb = (b.status || '').trim();
                if (sa === '선정' && sb === '선정') {
                    var ra = (a.ref_no || '').toString().trim();
                    var rb = (b.ref_no || '').toString().trim();
                    var cmp = ra.localeCompare(rb, 'ko-KR', { numeric: true });
                    return cmp !== 0 ? cmp : ((a.id || 0) - (b.id || 0));
                }
                if (sa === '선정') return -1;
                if (sb === '선정') return 1;
                return ((a.id || 0) - (b.id || 0));
            });
        });
        function escapeHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
        function fmtNum(n) { var x = Number(n); return isNaN(x) ? '0' : x.toLocaleString('ko-KR'); }
        function cardHtml(c) {
            var company = escapeHtml(c.company_name || '');
            var brand = escapeHtml(c.brand_name || '');
            var isSelected = (c.status || '').trim() === '선정';
            var refNo = (c.ref_no || '').trim();
            var companyTitle = company + (brand ? ' (' + brand + ')' : '') || '—';
            var corpSize = escapeHtml(c.corp_size || '—');
            var cash = fmtNum(c.corp_cash);
            var kind = fmtNum(c.corp_kind);
            var total = fmtNum(c.total_budget);
            var status = (c.status || '').trim() || '—';
            var statusColor = status === '선정' ? '#059669' : status === '탈락' ? '#dc2626' : '#2563eb';
            var refNoLine = (isSelected && refNo) ? ('<div style="font-weight: 600; font-size: 14px; color: #1e293b; margin-bottom: 4px;">[' + escapeHtml(refNo) + ']</div>') : '';
            return '<div class="contract-list-card" data-contract-id="' + (c.id != null ? c.id : '') + '" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; background: #fff; min-width: 180px; cursor: pointer;">' +
                refNoLine +
                '<div style="font-weight: 600; font-size: 14px; color: #1e293b; margin-bottom: 10px;">' + companyTitle + '</div>' +
                '<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px;">' +
                '<div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; color: #475569;"><span>기업규모</span><span>' + corpSize + '</span></div>' +
                '<span style="font-size: 12px; font-weight: 600; color: ' + statusColor + '; flex-shrink: 0;">' + escapeHtml(status) + '</span>' +
                '</div>' +
                '<div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; color: #475569;">' +
                '<span>기업 현금</span><span>' + cash + '원</span>' +
                '<span>기업 현물</span><span>' + kind + '원</span>' +
                '<span>총액</span><span style="font-weight: 600;">' + total + '원</span>' +
                '</div></div>';
        }
        if (tagOrder.length === 0) {
            area.innerHTML = '<p style="color: #94a3b8;">등록된 협약이 없습니다.</p>';
            return;
        }
        var html = '';
        tagOrder.forEach(function (tag, idx) {
            if (idx > 0) html += '<hr style="border: none; border-top: 2px solid #cbd5e0; margin: 20px 0 16px 0;">';
            html += '<div style="margin-bottom: 12px;"><span style="font-weight: 600; font-size: 13px; color: #475569;">' + escapeHtml(tag) + '</span></div>';
            html += '<div style="display: flex; flex-wrap: wrap; gap: 12px;">';
            byNumTag[tag].forEach(function (c) { html += cardHtml(c); });
            html += '</div>';
        });
        area.innerHTML = html;
        area.querySelectorAll('.contract-list-card[data-contract-id]').forEach(function (card) {
            var id = card.getAttribute('data-contract-id');
            if (!id) return;
            card.addEventListener('click', function () { openAddContractModal(parseInt(id, 10)); });
        });
    }).catch(function () {
        area.innerHTML = '<p style="color: #e53e3e;">로드 실패.</p>';
    });
}

function renderAgreementListFromData() {
    var area = document.getElementById('agreementListArea');
    var data = window._agreementListData;
    if (!area || !data) return;
    var inputEl = document.getElementById('agreementSearchInput');
    var rawQuery = (inputEl && inputEl.value) ? inputEl.value.trim() : '';
    var personnelId = window._agreementListFilterPersonnelId != null && window._agreementListFilterPersonnelId !== '' ? window._agreementListFilterPersonnelId : null;
    var rows = data.rows;
    if (personnelId && data.contractIdsByPersonnelId) {
        var allowIds = {};
        var ids = data.contractIdsByPersonnelId[personnelId];
        if (ids && ids.length > 0) {
            ids.forEach(function (id) { allowIds[id] = true; });
            rows = rows.filter(function (r) { return allowIds[r.id]; });
        } else {
            rows = [];
        }
    }
    var assigneeIdToNameForSearch = {};
    (data.personnelList || []).forEach(function (p) {
        if (p.id != null) assigneeIdToNameForSearch[p.id] = (p.name || '').trim() || '';
    });
    var filtered = rows;
    if (rawQuery) {
        var excludeList = [];
        var queryWithoutExclude = rawQuery.replace(/-\s*([^\s+,]+)/g, function (_, term) {
            if (term && term.trim()) excludeList.push(term.trim().toLowerCase());
            return '';
        });
        var orSegments = [];
        var segments = queryWithoutExclude.split(',');
        for (var si = 0; si < segments.length; si++) {
            var seg = segments[si].trim();
            if (!seg) continue;
            var andTerms = [];
            var parts = seg.split('+');
            for (var pi = 0; pi < parts.length; pi++) {
                var token = parts[pi].trim();
                if (token) andTerms.push(token.toLowerCase());
            }
            if (andTerms.length > 0) orSegments.push(andTerms);
        }
        filtered = rows.filter(function (r) {
            var ref = (r.ref_no != null && r.ref_no !== '') ? String(r.ref_no).trim() : '';
            var company = (r.company_name || '').trim();
            var brand = (r.brand_name || '').trim();
            var numTag = (r.num_tag || '').trim();
            var assigneeName = (r.assignee_id != null && r.assignee_id !== '') ? (assigneeIdToNameForSearch[r.assignee_id] || assigneeIdToNameForSearch[String(r.assignee_id)] || '') : '';
            var combined = (ref + ' ' + company + ' ' + brand + ' ' + numTag + ' ' + assigneeName).toLowerCase();
            var ei;
            for (ei = 0; ei < excludeList.length; ei++) {
                if (combined.indexOf(excludeList[ei]) !== -1) return false;
            }
            if (orSegments.length === 0) return true;
            for (var si = 0; si < orSegments.length; si++) {
                var all = true;
                for (var ti = 0; ti < orSegments[si].length; ti++) {
                    if (combined.indexOf(orSegments[si][ti]) === -1) { all = false; break; }
                }
                if (all) return true;
            }
            return false;
        });
    }
    if (filtered.length === 0) {
        area.innerHTML = rawQuery ? '<p style="color: #94a3b8;">검색 결과가 없습니다.</p>' : '<p style="color: #94a3b8;">선정된 협약이 없습니다.</p>';
        return;
    }
    var titleByContractId = data.titleByContractId;
    var rateByContractId = data.rateByContractId;
    filtered.sort(function (a, b) {
        var ta = (a.num_tag || '').trim();
        var tb = (b.num_tag || '').trim();
        var c = ta.localeCompare(tb, 'ko-KR', { numeric: true });
        if (c !== 0) return c;
        var ra = (a.ref_no != null && a.ref_no !== '') ? String(a.ref_no).trim() : '';
        var rb = (b.ref_no != null && b.ref_no !== '') ? String(b.ref_no).trim() : '';
        return ra.localeCompare(rb, 'ko-KR', { numeric: true });
    });
    function escapeHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    var assigneeIdToName = {};
    (data.personnelList || []).forEach(function (p) {
        if (p.id != null) assigneeIdToName[p.id] = (p.name || '').trim() || '(이름 없음)';
    });
    var defaultChartContractIds = (filtered.length > 0 && filtered.length < rows.length) ? filtered.map(function (r) { return r.id; }) : null;
    var html = '<div style="overflow-x: auto;">';
    html += '<table class="manager-table" style="width: 100%; font-size: 13px; border-collapse: collapse; border: 1px solid #e2e8f0;">';
    html += '<colgroup><col style="width: 60px;"><col style="width: 100px;"><col style="width: 210px;"><col style="width: 70px;"><col style="width: 110px;"><col style="width: 85px;"><col style="width: 80px;"><col style="width: 85px;"><col style="width: 105px;"><col style="width: 50px;"><col style="width: auto;"></colgroup>';
    html += '<thead><tr style="background: #f8fafc;">';
    html += '<th style="border: 1px solid #e2e8f0; padding: 8px 6px; text-align: center;">차수</th>';
    html += '<th style="border: 1px solid #e2e8f0; padding: 8px 6px; text-align: center;">과제번호</th>';
    html += '<th style="border: 1px solid #e2e8f0; padding: 8px 6px; text-align: center;">브랜드명(기업명)</th>';
    html += '<th style="border: 1px solid #e2e8f0; padding: 8px 6px; text-align: center;">담당자</th>';
    html += '<th style="border: 1px solid #e2e8f0; padding: 8px 6px; text-align: center;"></th>';
    html += '<th style="border: 1px solid #e2e8f0; padding: 8px 6px; text-align: center;"></th>';
    html += '<th style="border: 1px solid #e2e8f0; padding: 8px 6px; text-align: center;"></th>';
    html += '<th style="border: 1px solid #e2e8f0; padding: 8px 6px; text-align: center;"></th>';
    html += '<th style="border: 1px solid #e2e8f0; padding: 8px 6px; text-align: center;"></th>';
    html += '<th style="border: 1px solid #e2e8f0; padding: 8px 6px; text-align: center;"><button type="button" class="btn-select" style="padding: 4px 6px; font-size: 12px; border: 1px solid #cbd5e0; border-radius: 6px; background: #f8fafc; cursor: pointer;" onclick="openAgreementChartSelected()">분석</button></th>';
    html += '<th style="border: 1px solid #e2e8f0; padding: 8px 6px; text-align: center;"></th></tr></thead><tbody>';
    filtered.forEach(function (r) {
        var numTag = escapeHtml((r.num_tag || '').trim() || '(미지정)');
        var refNo = escapeHtml((r.ref_no != null && r.ref_no !== '') ? String(r.ref_no).trim() : '');
        var company = escapeHtml(r.company_name || '');
        var brand = escapeHtml(r.brand_name || '');
        var cell2 = (brand || company) ? ('<span style="font-weight: bold; color: #1a202c;">' + brand + '</span>' + (company ? ' <span style="color: #64748b;">(' + company + ')</span>' : '')) : '—';
        var assigneeName = (r.assignee_id != null && r.assignee_id !== '') ? (assigneeIdToName[r.assignee_id] || assigneeIdToName[String(r.assignee_id)] || '—') : '—';
        var assigneeCell = escapeHtml(assigneeName);
        var monthLabel = (titleByContractId[r.id] || '--').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        var cellStyle = 'border: 1px solid #e2e8f0; padding: 8px 6px; text-align: center;';
        var contractId = r.id != null ? r.id : '';
        html += '<tr>';
        html += '<td style="' + cellStyle + '">' + numTag + '</td>';
        html += '<td style="' + cellStyle + '">' + refNo + '</td>';
        html += '<td style="' + cellStyle + '"><span role="button" tabindex="0" style="cursor:pointer;text-decoration:underline;text-underline-offset:2px;" onclick="event.stopPropagation(); openAddContractModal(' + contractId + ');">' + cell2 + '</span></td>';
        html += '<td style="' + cellStyle + '">' + assigneeCell + '</td>';
        var kpiRate = (rateByContractId[r.id] || '-%').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        html += '<td style="' + cellStyle + '"><button type="button" class="btn-select kpi-rate-btn" data-contract-id="' + r.id + '" style="padding: 4px 6px; font-size: 12px; width: 100%; box-sizing: border-box;" onclick="openKpiModal(' + r.id + ')">KPI : ' + kpiRate + '</button></td>';
        html += '<td style="' + cellStyle + '"><button type="button" class="btn-select" style="padding: 4px 6px; font-size: 12px; width: 100%; box-sizing: border-box;" onclick="openOutputStatementModal(' + r.id + ')">산출내역서</button></td>';
        html += '<td style="' + cellStyle + '"><button type="button" class="btn-select" style="padding: 4px 6px; font-size: 12px; width: 100%; box-sizing: border-box;" onclick="openInKindModal(' + r.id + ')">현물출자</button></td>';
        html += '<td style="' + cellStyle + '"><button type="button" class="btn-select" style="padding: 4px 6px; font-size: 12px; width: 100%; box-sizing: border-box;" onclick="openAdvanceBalanceModal(' + r.id + ')">선금/잔금</button></td>';
        html += '<td style="' + cellStyle + '"><button type="button" class="btn-select month-report-btn" data-contract-id="' + r.id + '" style="padding: 4px 6px; font-size: 12px; width: 100%; box-sizing: border-box;" onclick="openMonthReportModal(' + r.id + ')">월말 엑셀 : ' + monthLabel + '</button></td>';
        html += '<td style="' + cellStyle + '"><label style="display:block;cursor:pointer;margin:-8px -6px;padding:8px 6px;min-height:20px;"><input type="checkbox" class="agreement-chart-cb" data-contract-id="' + r.id + '" aria-label="데이터 분석 대상 선택" style="cursor:pointer;"></label></td>';
        html += '<td style="' + cellStyle + '"></td>';
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    area.innerHTML = html;
}

function applyAgreementNameFilter() {
    var sel = document.getElementById('agreementFilterPersonnel');
    var val = sel && sel.value ? sel.value.trim() : '';
    window._agreementListFilterPersonnelId = val || null;
    renderAgreementListFromData();
}

function resetAgreementListFilter() {
    var inputEl = document.getElementById('agreementSearchInput');
    if (inputEl) inputEl.value = '';
    var sel = document.getElementById('agreementFilterPersonnel');
    if (sel) sel.value = '';
    window._agreementListFilterPersonnelId = null;
    renderAgreementListFromData();
}

function loadAgreementList() {
    var area = document.getElementById('agreementListArea');
    if (!area) return;
    if (!_supabase) {
        area.innerHTML = '<p style="color: #e53e3e;">연결 불가.</p>';
        return;
    }
    var projectKey = getProjectKey();
    area.innerHTML = '<p style="color: #94a3b8;">데이터를 불러오는 중...</p>';
    _supabase.from('contract_registry').select('id, num_tag, company_name, brand_name, status, ref_no, block_target, assignee_id').eq('target_table', projectKey).eq('status', '선정').order('num_tag').order('id', { ascending: true }).then(function (res) {
        var rows = res.data || [];
        if (rows.length === 0) {
            area.innerHTML = '<p style="color: #94a3b8;">선정된 협약이 없습니다.</p>';
            return;
        }
        var contractIds = rows.map(function (r) { return r.id; });
        Promise.all([
            _supabase.from('contract_month_report').select('contract_id, file_name').in('contract_id', contractIds),
            _supabase.from('data_rows').select('contract_id').in('contract_id', contractIds),
            _supabase.from('personnel_master').select('id, name').eq('target_table', projectKey).order('name'),
            _supabase.from('page3_participation').select('personnel_id, contract_id').in('contract_id', contractIds)
        ]).then(function (results) {
            var reportRes = results[0];
            var dataRowsRes = results[1];
            var personnelRes = results[2];
            var partRes = results[3];
            return { reportRes: reportRes, dataRowsRes: dataRowsRes, personnelList: (personnelRes && personnelRes.data) ? personnelRes.data : [], partList: (partRes && partRes.data) ? partRes.data : [] };
        }).catch(function () {
            return { reportRes: { data: [] }, dataRowsRes: { data: [] }, personnelList: [], partList: [] };
        }).then(function (payload) {
            var reportRows = (payload.reportRes && payload.reportRes.data) ? payload.reportRes.data : [];
            var dataRows = (payload.dataRowsRes && payload.dataRowsRes.data) ? payload.dataRowsRes.data : [];
            var personnelList = payload.personnelList || [];
            var partList = payload.partList || [];
            var contractIdsByPersonnelId = {};
            partList.forEach(function (p) {
                var pid = p.personnel_id;
                if (!contractIdsByPersonnelId[pid]) contractIdsByPersonnelId[pid] = [];
                contractIdsByPersonnelId[pid].push(p.contract_id);
            });
            var titleByContractId = {};
            reportRows.forEach(function (row) {
                var fid = row.contract_id;
                var fn = row.file_name || row.fileName || '';
                titleByContractId[fid] = typeof monthReportDeriveTitle === 'function' ? monthReportDeriveTitle(fn) : (fn ? fn.replace(/\.[^/.]+$/, '').split('_').pop() || '—' : '—');
            });
            var countByContractId = {};
            dataRows.forEach(function (row) {
                var cid = row.contract_id;
                countByContractId[cid] = (countByContractId[cid] || 0) + 1;
            });
            var rateByContractId = {};
            rows.forEach(function (r) {
                var n = (r.block_target != null && r.block_target !== '') ? parseInt(r.block_target, 10) : 0;
                if (isNaN(n)) n = 0;
                var m = countByContractId[r.id] || 0;
                rateByContractId[r.id] = n > 0 ? (m / n * 100).toFixed(1) + '%' : '-%';
            });
            window._agreementListData = { rows: rows, titleByContractId: titleByContractId, rateByContractId: rateByContractId, personnelList: personnelList, contractIdsByPersonnelId: contractIdsByPersonnelId };
            var sel = document.getElementById('agreementFilterPersonnel');
            if (sel) {
                var currentVal = sel.value;
                sel.innerHTML = '<option value="">참여 인력</option>' + personnelList.map(function (p) {
                    var name = (p.name || '').trim() || '(이름 없음)';
                    return '<option value="' + (p.id != null ? p.id : '') + '">' + name.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</option>';
                }).join('');
                if (currentVal && personnelList.some(function (p) { return String(p.id) === String(currentVal); })) sel.value = currentVal;
            }
            renderAgreementListFromData();
            if (!window._agreementSearchListenerAttached) {
                window._agreementSearchListenerAttached = true;
                var searchInput = document.getElementById('agreementSearchInput');
                if (searchInput) searchInput.addEventListener('input', function () { renderAgreementListFromData(); });
            }
        });
    }).catch(function () {
        area.innerHTML = '<p style="color: #e53e3e;">로드 실패.</p>';
    });
}

/* ---------- KPI 모달 (contract_registry.block_target + contract_kpi_target) ---------- */
var _kpiStore = {};

function openKpiModal(contractId) {
    window._kpiCurrentContractId = contractId;
    var targetEl = document.getElementById('kpiViewTargetCount');
    var tbody = document.getElementById('kpiViewTableBody');
    var modal = document.getElementById('kpiViewModal');

    function renderKpiView(data) {
        var targetCountRaw = (data && data.targetCount !== '' && data.targetCount != null) ? String(data.targetCount) : '';
        var targetCountDisplay = targetCountRaw === '' ? '—' : (function () {
            var num = Number(targetCountRaw);
            return (isNaN(num) ? targetCountRaw : num.toLocaleString('ko-KR')) + ' 건';
        })();
        var rows = (data && data.rows) ? data.rows : [];
        if (targetEl) targetEl.textContent = targetCountDisplay;

        var uniqueCountries = {};
        var uniquePlatforms = {};
        rows.forEach(function (r) {
            var c = (r.country || '').trim();
            if (c) uniqueCountries[c] = true;
            var platformStr = (r.platform || '').trim();
            if (platformStr) {
                platformStr.split(',').forEach(function (part) {
                    var p = part.trim();
                    if (p) uniquePlatforms[p] = true;
                });
            }
        });
        var countryCount = Object.keys(uniqueCountries).length;
        var platformCount = Object.keys(uniquePlatforms).length;
        var countryHeader = document.getElementById('kpiViewCountryHeader');
        var platformHeader = document.getElementById('kpiViewPlatformHeader');
        if (countryHeader) countryHeader.textContent = '국가 (' + countryCount + '개)';
        if (platformHeader) platformHeader.textContent = '플랫폼 (' + platformCount + '개)';

        if (tbody) {
            if (rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" style="border: 1px solid #e2e8f0; padding: 16px; text-align: center; color: #94a3b8;">데이터 없음</td></tr>';
            } else {
                tbody.innerHTML = rows.map(function (r) {
                    var c = (r.country || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    var p = (r.platform || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return '<tr><td style="border: 1px solid #e2e8f0; padding: 8px 12px;">' + c + '</td><td style="border: 1px solid #e2e8f0; padding: 8px 12px;">' + p + '</td></tr>';
                }).join('');
            }
        }
        if (modal) modal.style.display = 'flex';
    }

    if (_supabase) {
        if (targetEl) targetEl.textContent = '…';
        if (tbody) tbody.innerHTML = '<tr><td colspan="2" style="border: 1px solid #e2e8f0; padding: 16px; text-align: center; color: #94a3b8;">불러오는 중...</td></tr>';
        if (modal) modal.style.display = 'flex';
        Promise.all([
            _supabase.from('contract_registry').select('block_target').eq('id', contractId).single(),
            _supabase.from('contract_kpi_target').select('country, platform, sort_order').eq('contract_id', contractId).order('sort_order', { ascending: true })
        ]).then(function (results) {
            var reg = (results[0] && results[0].data) ? results[0].data : null;
            var kpiRes = results[1];
            var targetCount = (reg && reg.block_target != null && reg.block_target !== '') ? String(reg.block_target) : '';
            var kpiRows = (kpiRes && kpiRes.data) ? kpiRes.data : [];
            var rows = kpiRows.map(function (r) { return { country: r.country || '', platform: r.platform || '' }; });
            _kpiStore[contractId] = { targetCount: targetCount, rows: rows };
            renderKpiView(_kpiStore[contractId]);
        }).catch(function () {
            var data = _kpiStore[contractId] || { targetCount: '', rows: [] };
            renderKpiView(data);
        });
    } else {
        var data = _kpiStore[contractId] || { targetCount: '', rows: [] };
        renderKpiView(data);
    }
}

function closeKpiViewModal() {
    var modal = document.getElementById('kpiViewModal');
    if (modal) modal.style.display = 'none';
}

/* ---------- 산출내역서(총괄표) 모달 ---------- */
function openOutputStatementModal(contractId) {
    var modal = document.getElementById('outputStatementModal');
    var personnelBody = document.getElementById('outputStatementPersonnelBody');
    if (!modal || !personnelBody) return;
    personnelBody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8;">불러오는 중...</td></tr>';
    modal.style.display = 'flex';

    if (!_supabase) {
        personnelBody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #e53e3e;">DB 연결 불가.</td></tr>';
        return;
    }
    var projectKey = getProjectKey();
    Promise.all([
        _supabase.from('contract_registry').select('target_table, corp_size, total_budget, total_cash, vat, sum_p, gov_contribution, corp_kind, corp_cash, participation_rate').eq('id', contractId).single(),
        _supabase.from('page3_participation').select('personnel_id, rate').eq('contract_id', contractId).order('personnel_id'),
        _supabase.from('salary_config').select('target_table, corp_size, salary_senior, salary_researcher, salary_assistant').or('target_table.eq.' + projectKey + ',target_table.eq.default')
    ]).then(function (results) {
        var contractRes = results[0];
        var partRes = results[1];
        var salaryRes = results[2];
        if (contractRes.error || !contractRes.data) {
            personnelBody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #e53e3e;">협약 데이터를 불러올 수 없습니다.</td></tr>';
            return;
        }
        var contract = contractRes.data;
        var partRows = (partRes && partRes.data) ? partRes.data : [];
        var personnelIds = partRows.map(function (r) { return r.personnel_id; });
        if (personnelIds.length === 0) {
            renderOutputStatementPersonnel([], contract, personnelBody);
            fillOutputStatementSummary(contract, 0);
            return;
        }
        _supabase.from('personnel_master').select('id, position, name').in('id', personnelIds).then(function (personRes) {
            var personnelList = (personRes && personRes.data) ? personRes.data : [];
            var personnelById = {};
            personnelList.forEach(function (p) {
                personnelById[p.id] = p;
                personnelById[String(p.id)] = p;
            });
            var salaryRows = (salaryRes && salaryRes.data) ? salaryRes.data : [];
            var salaryByCorp = {};
            var corpSize = (contract.corp_size || '').trim() || '중기업';
            var corpKey = CORP_LABEL_TO_KEY[corpSize] || corpSize;
            salaryRows.forEach(function (r) {
                var c = (r.corp_size || '').trim();
                if (!c) return;
                var rowData = {
                    salary_senior: Number(r.salary_senior) || 0,
                    salary_researcher: Number(r.salary_researcher) || 0,
                    salary_assistant: Number(r.salary_assistant) || 0
                };
                var t = (r.target_table || '').trim();
                function setSalary(key) {
                    if (t === projectKey) salaryByCorp[key] = rowData;
                    else if (!salaryByCorp[key]) salaryByCorp[key] = rowData;
                }
                setSalary(c);
                if (CORP_KEY_TO_LABEL[c]) setSalary(CORP_KEY_TO_LABEL[c]);
                if (CORP_LABEL_TO_KEY[c]) setSalary(CORP_LABEL_TO_KEY[c]);
            });
            var prArray = Array.isArray(contract.participation_rate) ? contract.participation_rate : [];
            var personnelRows = [];
            var personnelSubtotal = 0;
            partRows.forEach(function (pr, idx) {
                var p = personnelById[pr.personnel_id] || personnelById[String(pr.personnel_id)];
                var position = (p && (p.position || '').trim()) ? p.position.trim() : '';
                var name = (p && (p.name || '').trim()) ? p.name.trim() : '';
                var rate = Number(pr.rate) || 0;
                var period = 0;
                var prItem = prArray[idx];
                if (prItem && (prItem.period != null || prItem.기간 != null)) {
                    var periodVal = prItem.period != null ? prItem.period : prItem.기간;
                    period = parseFloat(String(periodVal).replace(/,/g, '')) || 0;
                } else {
                    var byName = prArray.filter(function (x) { return (x.name || '').trim() === name; });
                    if (byName.length && (byName[0].period != null || byName[0].기간 != null)) {
                        var pv = byName[0].period != null ? byName[0].period : byName[0].기간;
                        period = parseFloat(String(pv).replace(/,/g, '')) || 0;
                    }
                }
                var salaryMap = salaryByCorp[corpSize] || salaryByCorp[corpKey] || salaryByCorp['중기업'] || salaryByCorp['mid'] || {};
                var key = ROLE_SALARY_KEYS[position];
                var monthlySalary = key ? (salaryMap[key] || 0) : 0;
                var cost = Math.round(monthlySalary * (rate / 100) * period);
                personnelSubtotal += cost;
                personnelRows.push({
                    position: position,
                    name: name,
                    amount: cost,
                    monthlySalary: monthlySalary,
                    rate: rate,
                    period: period
                });
            });
            renderOutputStatementPersonnel(personnelRows, contract, personnelBody);
            fillOutputStatementSummary(contract, personnelSubtotal);
        });
    }).catch(function () {
        var personnelBody = document.getElementById('outputStatementPersonnelBody');
        if (personnelBody) personnelBody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #e53e3e;">로드 실패.</td></tr>';
    });
}

function renderOutputStatementPersonnel(rows, contract, personnelBody) {
    if (!personnelBody) return;
    var escapeHtml = function (s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var fmtNum = function (n) { return (n != null && n !== '') ? Number(n).toLocaleString('ko-KR') : ''; };
    if (rows.length === 0) {
        personnelBody.innerHTML = '<tr><td style="border: 1px solid #e2e8f0; padding: 8px 10px; color: #94a3b8;">인력 없음</td><td style="border: 1px solid #e2e8f0; padding: 8px 10px;"></td><td style="border: 1px solid #e2e8f0; padding: 8px 10px;"></td><td style="border: 1px solid #e2e8f0; padding: 8px 10px;"></td><td style="border: 1px solid #e2e8f0; padding: 8px 10px;"></td><td style="border: 1px solid #e2e8f0; padding: 8px 10px;"></td></tr>' +
            '<tr style="background: #f1f5f9;"><td style="border: 1px solid #e2e8f0; padding: 8px 10px; font-weight: 600;">①소계</td><td style="border: 1px solid #e2e8f0; padding: 8px 10px; text-align: right;">0원</td><td style="border: 1px solid #e2e8f0; padding: 8px 10px;"></td><td style="border: 1px solid #e2e8f0; padding: 8px 10px;"></td><td style="border: 1px solid #e2e8f0; padding: 8px 10px;"></td><td style="border: 1px solid #e2e8f0; padding: 8px 10px;"></td></tr>';
        return;
    }
    var subTotal = 0;
    var trs = rows.map(function (r) {
        subTotal += r.amount;
        var roleName = (r.position ? r.position + ' (' + r.name + ')' : r.name) || '—';
        return '<tr><td style="border: 1px solid #e2e8f0; padding: 8px 10px;">' + escapeHtml(roleName) + '</td><td style="border: 1px solid #e2e8f0; padding: 8px 10px; text-align: right;">' + fmtNum(r.amount) + '</td><td style="border: 1px solid #e2e8f0; padding: 8px 10px; text-align: right;">' + fmtNum(r.monthlySalary) + '</td><td style="border: 1px solid #e2e8f0; padding: 8px 10px; text-align: center;">' + (r.rate != null ? r.rate : '') + '</td><td style="border: 1px solid #e2e8f0; padding: 8px 10px; text-align: center;">' + (r.period != null ? r.period : '') + '</td><td style="border: 1px solid #e2e8f0; padding: 8px 10px;"></td></tr>';
    });
    var subRow = '<tr style="background: #f1f5f9;"><td style="border: 1px solid #e2e8f0; padding: 8px 10px; font-weight: 600;">①소계</td><td style="border: 1px solid #e2e8f0; padding: 8px 10px; text-align: right;">' + fmtNum(subTotal) + '원</td><td style="border: 1px solid #e2e8f0; padding: 8px 10px;"></td><td style="border: 1px solid #e2e8f0; padding: 8px 10px;"></td><td style="border: 1px solid #e2e8f0; padding: 8px 10px;"></td><td style="border: 1px solid #e2e8f0; padding: 8px 10px;"></td></tr>';
    personnelBody.innerHTML = trs.join('') + subRow;
}

function fillOutputStatementSummary(contract, personnelSubtotal) {
    var expenseSubtotal = 0;
    var totalCash = Number(contract.total_cash) || 0;
    var vat = Number(contract.vat) || 0;
    var sumP = Number(contract.sum_p) || 0;
    var corpKind = Number(contract.corp_kind) || 0;
    var totalBudget = Number(contract.total_budget) || 0;
    var generalAdmin = totalCash - personnelSubtotal - expenseSubtotal;
    var fmt = function (n) { return (n != null && n !== '' && !isNaN(n)) ? Number(n).toLocaleString('ko-KR') : ''; };
    var setCell = function (id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    setCell('osExp1', '');
    setCell('osExp2', '');
    setCell('osExp3', '');
    setCell('osExp4', '');
    setCell('osExpSubtotal', fmt(expenseSubtotal) ? fmt(expenseSubtotal) + '원' : '');
    setCell('osGeneralAdmin', fmt(generalAdmin) ? fmt(generalAdmin) + '원' : '');
    setCell('osTotalCost', fmt(totalCash) ? fmt(totalCash) + '원' : '');
    setCell('osVat', fmt(vat) ? fmt(vat) + '원' : '');
    setCell('osProjectExpense', fmt(sumP) ? fmt(sumP) + '원' : '');
    setCell('osCorpKind', fmt(corpKind) ? fmt(corpKind) + '원' : '');
    setCell('osTotalBudget', fmt(totalBudget) ? fmt(totalBudget) + '원' : '');
}

function closeOutputStatementModal() {
    var modal = document.getElementById('outputStatementModal');
    if (modal) modal.style.display = 'none';
}

/* ---------- 선금/잔금 모달 (총액, 기업부담 현물/현금, 정부지원금 → 선금 70% 소수 첫째 자리 내림, 잔금 = 정부지원금 - 선금) ---------- */
function openAdvanceBalanceModal(contractId) {
    var modal = document.getElementById('advanceBalanceModal');
    var tbody = document.getElementById('advanceBalanceTableBody');
    if (!modal || !tbody) return;
    modal.style.display = 'flex';
    tbody.innerHTML = '<tr><td colspan="6" style="border: 1px solid #e2e8f0; padding: 16px; text-align: center; color: #94a3b8;">불러오는 중...</td></tr>';
    if (!_supabase) {
        tbody.innerHTML = '<tr><td colspan="6" style="border: 1px solid #e2e8f0; padding: 16px; text-align: center; color: #e53e3e;">연결할 수 없습니다.</td></tr>';
        return;
    }
    _supabase.from('contract_registry').select('ref_no, company_name, brand_name, total_budget, corp_kind, corp_cash, gov_contribution').eq('id', contractId).single().then(function (res) {
        if (res.error || !res.data) {
            tbody.innerHTML = '<tr><td colspan="6" style="border: 1px solid #e2e8f0; padding: 16px; text-align: center; color: #e53e3e;">협약 데이터를 불러올 수 없습니다.</td></tr>';
            return;
        }
        var c = res.data;
        var refNo = (c.ref_no != null && c.ref_no !== '') ? String(c.ref_no).trim() : '';
        var company = (c.company_name || '').trim();
        var brand = (c.brand_name || '').trim();
        var subtitleText = (refNo ? '[' + refNo + ']' : '') + company + (brand ? '(' + brand + ')' : '');
        var subtitleEl = document.getElementById('advanceBalanceSubtitle');
        if (subtitleEl) subtitleEl.textContent = subtitleText || '—';
        var total = Number(c.total_budget) || 0;
        var corpKind = Number(c.corp_kind) || 0;
        var corpCash = Number(c.corp_cash) || 0;
        var gov = Number(c.gov_contribution) || 0;
        var advance = Math.floor(gov * 0.7 * 10) / 10;
        var balance = gov - advance;
        function fmt(n) { return (n != null && !isNaN(n)) ? n.toLocaleString('ko-KR') : '0'; }
        var cellStyle = 'border: 1px solid #e2e8f0; padding: 8px 10px; text-align: right;';
        tbody.innerHTML = '<tr>' +
            '<td style="' + cellStyle + '">' + fmt(total) + '원</td>' +
            '<td style="' + cellStyle + '">' + fmt(corpKind) + '원</td>' +
            '<td style="' + cellStyle + '">' + fmt(corpCash) + '원</td>' +
            '<td style="' + cellStyle + '">' + fmt(gov) + '원</td>' +
            '<td style="' + cellStyle + '">' + fmt(advance) + '원</td>' +
            '<td style="' + cellStyle + '">' + fmt(balance) + '원</td>' +
            '</tr>';
    }).catch(function () {
        tbody.innerHTML = '<tr><td colspan="6" style="border: 1px solid #e2e8f0; padding: 16px; text-align: center; color: #e53e3e;">로드 실패.</td></tr>';
    });
}

function closeAdvanceBalanceModal() {
    var modal = document.getElementById('advanceBalanceModal');
    if (modal) modal.style.display = 'none';
}

/* ---------- 현물출자 모달 ---------- */
function openInKindModal(contractId) {
    var modal = document.getElementById('inKindModal');
    var personnelBody = document.getElementById('inKindPersonnelBody');
    if (!modal) return;
    modal.style.display = 'flex';
    var refEl = document.getElementById('inKindRefNo');
    var companyEl = document.getElementById('inKindCompanyName');
    var bizNoEl = document.getElementById('inKindBizNo');
    var bizNoInp = document.getElementById('inKindBizNoInput');
    var periodEl = document.getElementById('inKindPeriod');
    var totalEl = document.getElementById('inKindTotalBudget');
    var inKindAmountEl = document.getElementById('inKindInKindAmount');
    var totalCell = document.getElementById('inKindPersonnelTotal');
    inKindModalSetViewMode();
    if (refEl) refEl.textContent = '—';
    if (companyEl) companyEl.textContent = '—';
    if (bizNoEl) bizNoEl.textContent = '';
    var bizNoInp = document.getElementById('inKindBizNoInput');
    if (bizNoInp) bizNoInp.value = '';
    if (periodEl) periodEl.textContent = '—';
    if (totalEl) totalEl.textContent = '—';
    if (inKindAmountEl) inKindAmountEl.textContent = '';
    if (totalCell) totalCell.textContent = '';
    if (personnelBody) personnelBody.innerHTML = '<tr><td colspan="8" style="padding: 16px; text-align: center; color: #94a3b8;">불러오는 중...</td></tr>';

    if (!_supabase) {
        if (personnelBody) personnelBody.innerHTML = '<tr><td colspan="8" style="padding: 16px; text-align: center; color: #e53e3e;">DB 연결 불가.</td></tr>';
        return;
    }
    var projectKey = getProjectKey();
    Promise.all([
        _supabase.from('contract_registry').select('ref_no, company_name, total_budget, start_date, end_date, corp_kind, corp_size, in_kind_personnel, biz_no').eq('id', contractId).single(),
        _supabase.from('salary_config').select('target_table, corp_size, salary_senior, salary_researcher, salary_assistant').or('target_table.eq.' + projectKey + ',target_table.eq.default')
    ]).then(function (results) {
        var contractRes = results[0];
        var salaryRes = results[1];
        if (contractRes.error || !contractRes.data) {
            if (personnelBody) personnelBody.innerHTML = '<tr><td colspan="8" style="padding: 16px; text-align: center; color: #e53e3e;">협약 데이터를 불러올 수 없습니다.</td></tr>';
            return;
        }
        var c = contractRes.data;
        var refNo = (c.ref_no != null && c.ref_no !== '') ? String(c.ref_no).trim() : '—';
        var company = (c.company_name != null && c.company_name !== '') ? String(c.company_name).trim() : '—';
        var totalBudget = c.total_budget != null && c.total_budget !== '' ? Number(c.total_budget) : NaN;
        var totalStr = isNaN(totalBudget) ? '—' : totalBudget.toLocaleString('ko-KR') + '원';
        var corpKind = c.corp_kind != null && c.corp_kind !== '' ? Number(c.corp_kind) : NaN;
        var corpKindStr = isNaN(corpKind) ? '' : corpKind.toLocaleString('ko-KR') + '원';
        var s = formatContractDate(c.start_date);
        var e = formatContractDate(c.end_date);
        var periodStr = (s === '—' && e === '—') ? '—' : s + ' ~ ' + e;
        if (refEl) refEl.textContent = refNo;
        if (companyEl) companyEl.textContent = company;
        var bizNoVal = (c.biz_no != null && c.biz_no !== '') ? String(c.biz_no).trim() : '';
        if (bizNoEl) bizNoEl.textContent = bizNoVal;
        if (bizNoInp) bizNoInp.value = bizNoVal;
        if (periodEl) periodEl.textContent = periodStr;
        if (totalEl) totalEl.textContent = totalStr;
        if (inKindAmountEl) inKindAmountEl.textContent = corpKindStr;

        var inKindList = Array.isArray(c.in_kind_personnel) ? c.in_kind_personnel : [];
        var salaryRows = (salaryRes && salaryRes.data) ? salaryRes.data : [];
        var salaryByCorp = {};
        var corpSize = (c.corp_size || '').trim() || '중기업';
        var corpKey = CORP_LABEL_TO_KEY[corpSize] || corpSize;
        salaryRows.forEach(function (r) {
            var corp = (r.corp_size || '').trim();
            if (!corp) return;
            var rowData = {
                salary_senior: Number(r.salary_senior) || 0,
                salary_researcher: Number(r.salary_researcher) || 0,
                salary_assistant: Number(r.salary_assistant) || 0
            };
            var t = (r.target_table || '').trim();
            function setSalary(key) {
                if (t === projectKey) salaryByCorp[key] = rowData;
                else if (!salaryByCorp[key]) salaryByCorp[key] = rowData;
            }
            setSalary(corp);
            if (CORP_KEY_TO_LABEL[corp]) setSalary(CORP_KEY_TO_LABEL[corp]);
            if (CORP_LABEL_TO_KEY[corp]) setSalary(CORP_LABEL_TO_KEY[corp]);
        });
        var salaryMap = salaryByCorp[corpSize] || salaryByCorp[corpKey] || salaryByCorp['중기업'] || salaryByCorp['mid'] || {};
        var personnelRows = [];
        inKindList.forEach(function (row) {
            var position = (row.position || row.구분 || '').trim();
            var name = (row.name || row.이름 || '').trim();
            var role_title = (row.role_title || row.직책 || '').trim();
            var rate = Number(row.rate != null ? row.rate : row.참여율) || 0;
            var period = parseFloat(String(row.period != null ? row.period : row.기간 || '').replace(/,/g, '')) || 0;
            var remark = (row.remark || row.비고 || '').trim();
            var key = ROLE_SALARY_KEYS[position];
            var monthlySalary = key ? (salaryMap[key] || 0) : 0;
            var cost = Math.floor(monthlySalary * (rate / 100) * period);
            personnelRows.push({
                position: position,
                name: name,
                role_title: role_title,
                amount: cost,
                monthlySalary: monthlySalary,
                rate: rate,
                period: period,
                remark: remark
            });
        });
        window._inKindModalContractId = contractId;
        window._inKindModalContract = c;
        window._inKindModalSalaryByCorp = salaryByCorp;
        window._inKindModalCorpKey = corpKey;
        renderInKindPersonnel(personnelRows, personnelBody, totalCell);
    }).catch(function () {
        if (personnelBody) personnelBody.innerHTML = '<tr><td colspan="8" style="padding: 16px; text-align: center; color: #e53e3e;">로드 실패.</td></tr>';
    });
}

function inKindModalSetViewMode() {
    var viewWrap = document.getElementById('inKindPersonnelViewWrap');
    var editWrap = document.getElementById('inKindPersonnelEditWrap');
    var viewModeBtns = document.getElementById('inKindViewModeBtns');
    var editModeBtns = document.getElementById('inKindEditModeBtns');
    var bizNoSpan = document.getElementById('inKindBizNo');
    var bizNoInput = document.getElementById('inKindBizNoInput');
    if (viewWrap) viewWrap.style.display = '';
    if (editWrap) editWrap.style.display = 'none';
    if (viewModeBtns) viewModeBtns.style.display = '';
    if (editModeBtns) editModeBtns.style.display = 'none';
    if (bizNoSpan) bizNoSpan.style.display = '';
    if (bizNoInput) bizNoInput.style.display = 'none';
}

function inKindModalSetEditMode() {
    var viewWrap = document.getElementById('inKindPersonnelViewWrap');
    var editWrap = document.getElementById('inKindPersonnelEditWrap');
    var viewModeBtns = document.getElementById('inKindViewModeBtns');
    var editModeBtns = document.getElementById('inKindEditModeBtns');
    var bizNoSpan = document.getElementById('inKindBizNo');
    var bizNoInput = document.getElementById('inKindBizNoInput');
    if (viewWrap) viewWrap.style.display = 'none';
    if (editWrap) editWrap.style.display = 'block';
    if (viewModeBtns) viewModeBtns.style.display = 'none';
    if (editModeBtns) editModeBtns.style.display = 'flex';
    if (bizNoSpan) bizNoSpan.style.display = 'none';
    if (bizNoInput) { bizNoInput.style.display = 'block'; bizNoInput.value = (bizNoSpan && bizNoSpan.textContent) ? bizNoSpan.textContent : ''; }
}

function getInKindModalSalaryForRole(role) {
    var map = window._inKindModalSalaryByCorp;
    var key = window._inKindModalCorpKey;
    if (!map || !key) return 0;
    var row = map[key] || map['중기업'] || map['mid'];
    if (!row) return 0;
    var k = ROLE_SALARY_KEYS[role];
    return k ? (row[k] || 0) : 0;
}

function buildInKindModalEditRowHtml() {
    var opts = PERSONNEL_DETAIL_ROLES.map(function (r) {
        return '<option value="' + r.replace(/"/g, '&quot;') + '">' + r + '</option>';
    }).join('');
    var cell = 'border: 1px solid #e2e8f0; padding: 6px 8px;';
    return '<tr><td style="' + cell + ' text-align: center;"><button type="button" class="btn-select inkind-edit-delete" style="padding: 4px 8px; font-size: 11px; border-color: #feb2b2; color: #c53030;">-</button></td>' +
        '<td style="' + cell + ' background: #f8fafc;"><select class="inkind-edit-role" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e0; border-radius: 4px; background: white; font-size: 13px; box-sizing: border-box;">' + opts + '</select></td>' +
        '<td style="' + cell + '"><input type="text" class="inkind-edit-name" placeholder="성명" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;"></td>' +
        '<td style="' + cell + '"><input type="text" class="inkind-edit-role-title" placeholder="직책" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;"></td>' +
        '<td class="inkind-edit-monthly" style="' + cell + ' text-align: right; background: #f8fafc;"></td>' +
        '<td style="' + cell + '"><input type="text" class="inkind-edit-rate" placeholder="%" style="width: 60px; padding: 6px 8px; border: 1px solid #cbd5e0; border-radius: 4px; text-align: center; box-sizing: border-box;"></td>' +
        '<td style="' + cell + '"><input type="text" class="inkind-edit-period" placeholder="기간" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;"></td>' +
        '<td class="inkind-edit-cost" style="' + cell + ' text-align: right; background: #f8fafc;"></td>' +
        '<td style="' + cell + '"><input type="text" class="inkind-edit-remark" placeholder="비고" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;"></td></tr>';
}

function calcInKindModalEditRowCost(tr) {
    var roleSel = tr.querySelector('.inkind-edit-role');
    var rateInp = tr.querySelector('.inkind-edit-rate');
    var periodInp = tr.querySelector('.inkind-edit-period');
    var monthlyCell = tr.querySelector('.inkind-edit-monthly');
    var costCell = tr.querySelector('.inkind-edit-cost');
    var role = roleSel && roleSel.value ? roleSel.value.trim() : '';
    var salary = getInKindModalSalaryForRole(role);
    var rate = parseFloat(rateInp && rateInp.value ? rateInp.value.replace(/,/g, '').replace(/%/g, '') : 0) || 0;
    var period = parseFloat(periodInp && periodInp.value ? periodInp.value.replace(/,/g, '') : 0) || 0;
    var cost = Math.floor(salary * (rate / 100) * period);
    if (monthlyCell) monthlyCell.textContent = salary ? salary.toLocaleString('ko-KR') : '';
    if (costCell) costCell.textContent = cost ? cost.toLocaleString('ko-KR') : '';
    return cost;
}

function updateInKindModalEditSubtotal() {
    var tbody = document.getElementById('inKindModalEditPersonnelBody');
    var displayEl = document.getElementById('inKindModalEditSubtotal');
    if (!tbody || !displayEl) return;
    var sum = 0;
    tbody.querySelectorAll('.inkind-edit-cost').forEach(function (td) {
        var t = (td.textContent || '').replace(/,/g, '').replace(/\s/g, '');
        var n = parseInt(t, 10);
        if (!isNaN(n)) sum += n;
    });
    displayEl.textContent = sum ? sum.toLocaleString('ko-KR') : '';
}

function bindInKindModalEditRowEvents(tr) {
    if (tr.getAttribute('data-inkind-modal-bound') === '1') return;
    tr.setAttribute('data-inkind-modal-bound', '1');
    var roleSel = tr.querySelector('.inkind-edit-role');
    var rateInp = tr.querySelector('.inkind-edit-rate');
    var periodInp = tr.querySelector('.inkind-edit-period');
    function onUpdate() {
        calcInKindModalEditRowCost(tr);
        updateInKindModalEditSubtotal();
    }
    if (roleSel) roleSel.addEventListener('change', onUpdate);
    if (rateInp) { rateInp.addEventListener('input', onUpdate); rateInp.addEventListener('change', onUpdate); }
    if (periodInp) { periodInp.addEventListener('input', onUpdate); periodInp.addEventListener('change', onUpdate); }
    var delBtn = tr.querySelector('.inkind-edit-delete');
    if (delBtn) delBtn.addEventListener('click', function () { removeInKindModalEditRow(tr); });
}

function addInKindModalEditRow() {
    var tbody = document.getElementById('inKindModalEditPersonnelBody');
    if (!tbody) return;
    var tr = document.createElement('tr');
    tr.innerHTML = buildInKindModalEditRowHtml().replace(/^<tr>|<\/tr>$/g, '');
    tbody.appendChild(tr);
    bindInKindModalEditRowEvents(tr);
}

function removeInKindModalEditRow(tr) {
    if (!tr || !tr.parentNode) return;
    tr.remove();
    updateInKindModalEditSubtotal();
}

function inKindModalEnterEdit() {
    var c = window._inKindModalContract;
    var tbody = document.getElementById('inKindModalEditPersonnelBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    var list = Array.isArray(c && c.in_kind_personnel) ? c.in_kind_personnel : [];
    if (list.length > 0) {
        list.forEach(function (row) {
            var tr = document.createElement('tr');
            tr.innerHTML = buildInKindModalEditRowHtml().replace(/^<tr>|<\/tr>$/g, '');
            tbody.appendChild(tr);
            var roleSel = tr.querySelector('.inkind-edit-role');
            var nameInp = tr.querySelector('.inkind-edit-name');
            var roleTitleInp = tr.querySelector('.inkind-edit-role-title');
            var rateInp = tr.querySelector('.inkind-edit-rate');
            var periodInp = tr.querySelector('.inkind-edit-period');
            var remarkInp = tr.querySelector('.inkind-edit-remark');
            if (roleSel && (row.position || row.구분)) roleSel.value = (row.position || row.구분 || '').trim() || roleSel.value;
            if (nameInp) nameInp.value = (row.name || row.이름 || '').trim();
            if (roleTitleInp) roleTitleInp.value = (row.role_title || row.직책 || '').trim();
            if (rateInp) rateInp.value = (row.rate != null || row.참여율 != null) ? String(row.rate != null ? row.rate : row.참여율) : '';
            if (periodInp) periodInp.value = (row.period != null && row.period !== '' ? row.period : (row.기간 || '')) !== '' ? String(row.period != null ? row.period : row.기간 || '') : '';
            if (remarkInp) remarkInp.value = (row.remark || row.비고 || '').trim();
            bindInKindModalEditRowEvents(tr);
            calcInKindModalEditRowCost(tr);
        });
    } else {
        addInKindModalEditRow();
        var firstTr = tbody.querySelector('tr');
        if (firstTr) {
            var roleSel = firstTr.querySelector('.inkind-edit-role');
            if (roleSel) roleSel.value = '연구보조원';
        }
    }
    updateInKindModalEditSubtotal();
    inKindModalSetEditMode();
}

function inKindModalExitEdit() {
    var bizNoSpan = document.getElementById('inKindBizNo');
    var bizNoInput = document.getElementById('inKindBizNoInput');
    if (bizNoSpan && bizNoInput) bizNoSpan.textContent = (bizNoInput.value || '').trim();
    inKindModalSetViewMode();
}

function inKindModalSave() {
    var contractId = window._inKindModalContractId;
    if (!contractId || !_supabase) return;
    var bizNoInput = document.getElementById('inKindBizNoInput');
    var bizNo = (bizNoInput && bizNoInput.value) ? bizNoInput.value.trim() : '';
    var tbody = document.getElementById('inKindModalEditPersonnelBody');
    var inKindPersonnel = [];
    if (tbody) {
        tbody.querySelectorAll('tr').forEach(function (tr) {
            var roleSel = tr.querySelector('.inkind-edit-role');
            var nameInp = tr.querySelector('.inkind-edit-name');
            var roleTitleInp = tr.querySelector('.inkind-edit-role-title');
            var rateInp = tr.querySelector('.inkind-edit-rate');
            var periodInp = tr.querySelector('.inkind-edit-period');
            var remarkInp = tr.querySelector('.inkind-edit-remark');
            var position = (roleSel && roleSel.value ? roleSel.value : '').trim();
            var name = (nameInp && nameInp.value ? nameInp.value : '').trim();
            var role_title = (roleTitleInp && roleTitleInp.value ? roleTitleInp.value : '').trim();
            var rate = parseFloat(rateInp && rateInp.value ? rateInp.value.replace(/,/g, '').replace(/%/g, '') : 0) || 0;
            var period = (periodInp && periodInp.value ? periodInp.value : '').trim();
            var remark = (remarkInp && remarkInp.value ? remarkInp.value : '').trim();
            inKindPersonnel.push({ position: position, name: name, role_title: role_title, rate: rate, period: period, remark: remark });
        });
    }
    var payload = { in_kind_personnel: inKindPersonnel.length ? inKindPersonnel : null };
    payload.biz_no = bizNo || null;
    function onSaveDone() {
        if (window._inKindModalContract) {
            window._inKindModalContract.biz_no = bizNo;
            window._inKindModalContract.in_kind_personnel = inKindPersonnel;
        }
        var personnelBody = document.getElementById('inKindPersonnelBody');
        var totalCell = document.getElementById('inKindPersonnelTotal');
        var salaryMap = window._inKindModalSalaryByCorp && window._inKindModalCorpKey ? (window._inKindModalSalaryByCorp[window._inKindModalCorpKey] || window._inKindModalSalaryByCorp['중기업'] || window._inKindModalSalaryByCorp['mid'] || {}) : {};
        var personnelRows = inKindPersonnel.map(function (row) {
            var key = ROLE_SALARY_KEYS[row.position || ''];
            var monthlySalary = key ? (salaryMap[key] || 0) : 0;
            var rate = Number(row.rate) || 0;
            var period = parseFloat(String(row.period || '').replace(/,/g, '')) || 0;
            var cost = Math.floor(monthlySalary * (rate / 100) * period);
            return { position: row.position, name: row.name, role_title: row.role_title, amount: cost, monthlySalary: monthlySalary, rate: rate, period: period, remark: row.remark };
        });
        renderInKindPersonnel(personnelRows, personnelBody, totalCell);
        var bizNoSpan = document.getElementById('inKindBizNo');
        if (bizNoSpan) bizNoSpan.textContent = bizNo;
        inKindModalExitEdit();
    }
    _supabase.from('contract_registry').update(payload).eq('id', contractId).then(function (res) {
        if (res.error) {
            var msg = res.error.message || '';
            if (payload.biz_no !== undefined && (msg.indexOf('biz_no') !== -1 || msg.indexOf('column') !== -1)) {
                delete payload.biz_no;
                _supabase.from('contract_registry').update(payload).eq('id', contractId).then(function (res2) {
                    if (res2.error) alert('저장 실패: ' + (res2.error && res2.error.message ? res2.error.message : ''));
                    else onSaveDone();
                });
                return;
            }
            alert('저장 실패: ' + msg);
            return;
        }
        onSaveDone();
    }).catch(function (err) {
        alert('저장 실패: ' + (err && err.message ? err.message : String(err)));
    });
}

function renderInKindPersonnel(rows, personnelBody, totalCell) {
    if (!personnelBody) return;
    var escapeHtml = function (s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var fmtNum = function (n) { return (n != null && n !== '') ? Number(n).toLocaleString('ko-KR') : ''; };
    var cellStyle = 'border: 1px solid #e2e8f0; padding: 8px 10px;';
    if (rows.length === 0) {
        personnelBody.innerHTML = '<tr><td colspan="8" style="' + cellStyle + ' color: #94a3b8; text-align: center;">인력 없음</td></tr>';
        if (totalCell) totalCell.textContent = '';
        return;
    }
    var subTotal = 0;
    var trs = rows.map(function (r) {
        subTotal += r.amount;
        var 구분 = escapeHtml(r.position || '');
        var 성명 = escapeHtml(r.name || '');
        var 직책 = escapeHtml(r.role_title || '');
        var 월단가 = fmtNum(r.monthlySalary);
        var 투입률 = r.rate != null && r.rate !== '' ? r.rate : '';
        var 투입기간 = r.period != null && r.period !== '' ? r.period : '';
        var 현물인건비 = fmtNum(r.amount);
        var 비고 = escapeHtml(r.remark || '');
        return '<tr><td style="' + cellStyle + ' text-align: center;">' + 구분 + '</td><td style="' + cellStyle + ' text-align: center;">' + 성명 + '</td><td style="' + cellStyle + ' text-align: center;">' + 직책 + '</td><td style="' + cellStyle + ' text-align: right;">' + 월단가 + '</td><td style="' + cellStyle + ' text-align: center;">' + 투입률 + '</td><td style="' + cellStyle + ' text-align: center;">' + 투입기간 + '</td><td style="' + cellStyle + ' text-align: right;">' + 현물인건비 + '</td><td style="' + cellStyle + ' text-align: left;">' + 비고 + '</td></tr>';
    });
    personnelBody.innerHTML = trs.join('');
    if (totalCell) totalCell.textContent = subTotal > 0 ? subTotal.toLocaleString('ko-KR') + '원' : '';
}

function closeInKindModal() {
    var modal = document.getElementById('inKindModal');
    if (modal) modal.style.display = 'none';
}

/* ---------- 월말보고서 모달 (파일: 메모리 저장, DB/Storage 연동 시 확장) ---------- */
var _monthReportStore = {};
var MONTH_REPORT_BUCKET = 'month-reports';
var _monthReportBusy = false;
// 월말보고용 엑셀에서 '신고결과' 헤더가 위치한 컬럼에 대응하는 data_rows 컬럼 이름
// 현재 '신고결과'는 P열(16번째 열)이므로 col16_val 사용
var MONTH_REPORT_RESULT_COL = 'col16_val';

function monthReportDeriveTitle(fileName) {
    var base = String(fileName || '').trim();
    if (!base) return '—';
    // 마지막 언더바(_) 뒤 내용을 추출, 확장자 제거 후 큰 글씨로 표시
    var parts = base.split('_');
    var last = (parts.length > 1 ? parts.pop() : parts[0]) || '';
    last = last.replace(/\.[^/.]+$/, '').trim();
    return last || '월말 보고서';
}

function monthReportSetStatus(msg, isError) {
    var el = document.getElementById('monthReportUploadStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = isError ? '#e53e3e' : '#94a3b8';
}

function monthReportSyncUI(data) {
    var nameEl = document.getElementById('monthReportFileName');
    var titleEl = document.getElementById('monthReportTitle');
    var deleteBtn = document.getElementById('monthReportDeleteBtn');
    var downloadBtn = document.getElementById('monthReportDownloadBtn');
    var dropText = document.getElementById('monthReportDropText');
    var fileName = (data && (data.fileName || data.file_name)) ? String(data.fileName || data.file_name) : '';
    if (titleEl) titleEl.textContent = fileName ? monthReportDeriveTitle(fileName) : '—';
    if (nameEl) nameEl.textContent = fileName || '—';
    var show = fileName ? 'inline-block' : 'none';
    if (deleteBtn) deleteBtn.style.display = show;
    if (downloadBtn) downloadBtn.style.display = show;
    if (dropText) dropText.innerHTML = fileName ? '다른 파일로 변경하려면 끌어다 놓거나 클릭' : '📤 파일을 여기로 끌어다 놓거나<br>클릭하여 선택';
}

function monthReportSafeObjectName(fileName) {
    // Storage 키는 ASCII만 사용 (공백·한글 등으로 Invalid key 방지). 확장자만 추출.
    var name = String(fileName || 'report');
    var dot = name.lastIndexOf('.');
    var ext = dot >= 0 ? name.slice(dot) : '';
    // 확장자가 비ASCII 포함 시 .bin 등 안전한 값으로
    if (!/^.[A-Za-z0-9]+$/.test(ext)) ext = '.bin';
    return ext;
}

function monthReportLoadFromDb(contractId) {
    if (!_supabase) return Promise.resolve(null);
    return _supabase
        .from('contract_month_report')
        .select('contract_id, file_name, file_path, uploaded_at')
        .eq('contract_id', contractId)
        .maybeSingle()
        .then(function (res) {
            if (res && res.error) throw res.error;
            return res && res.data ? res.data : null;
        });
}

function getChartUrlForContract(contractId) {
    var projectKey = getProjectKey();
    var base = (window._page3Base || '').replace(/\/?$/, '');
    var path = base ? base + '/' + 'chart.html' : 'chart.html';
    return path + '?table=' + encodeURIComponent(projectKey) + '&contract_id=' + encodeURIComponent(contractId);
}
function openAgreementChartSelected() {
    var area = document.getElementById('agreementListArea');
    if (!area) return;
    var checked = area.querySelectorAll('.agreement-chart-cb:checked');
    var ids = [];
    if (checked && checked.length > 0) {
        checked.forEach(function (cb) {
            var id = cb.getAttribute('data-contract-id');
            if (id) ids.push(id);
        });
    }
    var url = getChartUrlForProject(ids.length > 0 ? ids : null);
    window.open(url, '_blank');
}
function getChartUrlForProject(contractIds) {
    var projectKey = getProjectKey();
    var base = (window._page3Base || '').replace(/\/?$/, '');
    var path = base ? base + '/' + 'chart.html' : 'chart.html';
    var url = path + '?table=' + encodeURIComponent(projectKey);
    if (contractIds && contractIds.length > 0) {
        url += '&contract_id=' + encodeURIComponent(contractIds.join(','));
    }
    return url;
}
function openChartForContract(contractId) {
    window.open(getChartUrlForContract(contractId), '_blank');
}

function openMonthReportModal(contractId) {
    window._monthReportCurrentContractId = contractId;
    monthReportSetStatus('', false);
    monthReportSyncUI(_monthReportStore[contractId] || { fileName: '' });
    var fileInput = document.getElementById('monthReportFileInput');
    if (fileInput) fileInput.value = '';
    var modal = document.getElementById('monthReportModal');
    if (modal) modal.style.display = 'flex';

    monthReportRefreshPlatformStatus(contractId);

    // DB에서 최신 파일 메타 로드
    if (_supabase) {
        monthReportSetStatus('불러오는 중...', false);
        monthReportLoadFromDb(contractId).then(function (row) {
            if (!row) {
                _monthReportStore[contractId] = { fileName: '', filePath: '' };
                monthReportSyncUI(_monthReportStore[contractId]);
                monthReportSetStatus('', false);
                return;
            }
            _monthReportStore[contractId] = { fileName: row.file_name || row.fileName || '', filePath: row.file_path || row.filePath || '' };
            monthReportSyncUI(_monthReportStore[contractId]);
            monthReportSetStatus('', false);
        }).catch(function (e) {
            monthReportSetStatus('로드 실패: ' + (e && e.message ? e.message : String(e)), true);
        });
    }
}

/**
 * KPI 목표(국가-플랫폼)와 업로드 엑셀(3열=국가, 4열=플랫폼) 유니크 조합을 읽어 플랫폼 현황 영역에 표시.
 * KPI에 있는 조합 = 초록, 없는 조합 = 빨강.
 */
function monthReportRefreshPlatformStatus(contractId) {
    var summaryEl = document.getElementById('monthReportPlatformSummary');
    var kpiEl = document.getElementById('monthReportKpiTags');
    var excelEl = document.getElementById('monthReportExcelTags');
    if (!kpiEl || !excelEl) return;
    kpiEl.innerHTML = '';
    excelEl.innerHTML = '';
    if (summaryEl) summaryEl.textContent = '현재 : 0건 / 목표 건수 : 0건 / 달성률 : —%';

    if (!_supabase || contractId == null) return;

    var resultCol = MONTH_REPORT_RESULT_COL;

    Promise.all([
        _supabase.from('contract_registry').select('block_target').eq('id', contractId).single(),
        _supabase.from('contract_kpi_target').select('country, platform').eq('contract_id', contractId),
        _supabase.from('data_rows').select('col3_val, col4_val, ' + resultCol).eq('contract_id', contractId)
    ]).then(function (results) {
        var regRes = results[0];
        var kpiRes = results[1];
        var rowsRes = results[2];
        var blockTarget = (regRes && regRes.data && regRes.data.block_target != null && regRes.data.block_target !== '')
            ? parseInt(regRes.data.block_target, 10) : 0;
        if (isNaN(blockTarget)) blockTarget = 0;
        var kpiRows = (kpiRes && kpiRes.data) ? kpiRes.data : [];
        var dataRows = (rowsRes && rowsRes.data) ? rowsRes.data : [];

        // KPI: 유니크 (country, platform). platform은 쉼표 구분으로 펼침
        var kpiSet = {};
        kpiRows.forEach(function (r) {
            var country = String(r.country || '').trim();
            var platformStr = String(r.platform || '').trim();
            if (!platformStr) {
                if (country) kpiSet[country + '|'] = { country: country, platform: '' };
                return;
            }
            platformStr.split(',').forEach(function (p) {
                var platform = p.trim();
                if (country || platform) kpiSet[country + '|' + platform] = { country: country, platform: platform };
            });
        });
        // 업로드 데이터: 3열=국가(col3_val), 4열=플랫폼(col4_val) 유니크
        var excelSet = {};
        dataRows.forEach(function (r) {
            var country = String(r.col3_val != null ? r.col3_val : '').trim();
            var platform = String(r.col4_val != null ? r.col4_val : '').trim();
            var key = country + '|' + platform;
            if (!excelSet[key]) excelSet[key] = { country: country, platform: platform };
        });
        var excelPairs = Object.keys(excelSet).map(function (k) { return excelSet[k]; });
        // '신고결과'가 '차단완료'인 행만 카운트
        var blockedCount = 0;
        dataRows.forEach(function (r) {
            var resultVal = String(r[resultCol] != null ? r[resultCol] : '').trim();
            if (resultVal === '차단완료') blockedCount++;
        });
        var m = blockedCount;
        var n = blockTarget;
        var rateStr = n > 0 ? ((m / n * 100).toFixed(1) + '%') : '—%';
        if (summaryEl) summaryEl.textContent = '현재 : ' + m.toLocaleString('ko-KR') + '건 / 목표 건수 : ' + n.toLocaleString('ko-KR') + '건 / 달성률 : ' + rateStr;

        // 상단 KPI: 하단(업로드)에 이미 있는 조합은 제외 → 아직 데이터 없는 목표만 표시
        var kpiPairsToShow = Object.keys(kpiSet).filter(function (k) { return !excelSet[k]; }).map(function (k) { return kpiSet[k]; });

        kpiPairsToShow.forEach(function (p) {
            var span = document.createElement('span');
            span.style.cssText = 'display: inline-block; padding: 4px 10px; font-size: 12px; border-radius: 6px; background: #e2e8f0; color: #475569;';
            span.textContent = (p.country || '(국가)') + ' - ' + (p.platform || '(플랫폼)');
            kpiEl.appendChild(span);
        });

        excelPairs.forEach(function (p) {
            var span = document.createElement('span');
            var key = p.country + '|' + p.platform;
            var inKpi = kpiSet[key] !== undefined;
            span.style.cssText = 'display: inline-block; padding: 4px 10px; font-size: 12px; border-radius: 6px; color: #1a202c; ' +
                (inKpi ? 'background: #c6f6d5;' : 'background: #fed7d7;');
            span.textContent = (p.country || '(국가)') + ' - ' + (p.platform || '(플랫폼)');
            excelEl.appendChild(span);
        });
    }).catch(function () {
        kpiEl.innerHTML = '<span style="font-size: 12px; color: #94a3b8;">로드 실패</span>';
    });
}

function closeMonthReportModal() {
    var modal = document.getElementById('monthReportModal');
    if (modal) modal.style.display = 'none';
}


/**
 * 엑셀 파일 파싱: 2행=헤더, 3행부터 데이터. data_rows에 contract_id로 저장 (해당 협약 기존 데이터 삭제 후 삽입).
 * @param {File} file - 엑셀 파일
 * @param {number} contractId - contract_registry.id (월말보고서 모달에서 선택된 협약)
 * @returns {Promise<number>} 저장한 행 수. xlsx가 아니거나 실패 시 0, 파싱만 스킵 시 -1
 */
function monthReportParseExcelToDataRows(file, contractId) {
    if (!file || !_supabase || contractId == null) return Promise.resolve(-1);
    var XLSX = window.XLSX || window.xlsx;
    if (!XLSX) return Promise.resolve(-1);
    var name = (file.name || '').toLowerCase();
    if (name.indexOf('.xlsx') === -1 && name.indexOf('.xls') === -1) return Promise.resolve(-1);

    return new Promise(function (resolve, reject) {
        var r = new FileReader();
        r.onload = function () {
            try {
                var wb = XLSX.read(r.result, { type: 'array' });
                var firstSheet = wb.SheetNames && wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : null;
                if (!firstSheet) { resolve(0); return; }
                var aoa = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
                if (!aoa || aoa.length < 3) { resolve(0); return; }
                var dataRows = aoa.slice(2).filter(function (row) {
                    if (!row) return false;
                    var emptyCount = 0;
                    for (var c = 0; c < 20; c++) {
                        var v = row[c];
                        if (v === undefined || v === '' || v === null) emptyCount++;
                    }
                    return emptyCount < 10;
                });
                if (dataRows.length === 0) { resolve(0); return; }

                var projectKey = getProjectKey();
                var toInsert = dataRows.map(function (row) {
                    var obj = { contract_id: contractId, project_key: projectKey };
                    for (var i = 0; i < 20; i++) {
                        var v = row[i];
                        obj['col' + (i + 1) + '_val'] = (v !== undefined && v !== '' && v !== null) ? v : null;
                    }
                    return obj;
                });

                _supabase.from('data_rows').delete().eq('contract_id', contractId).then(function (delRes) {
                    if (delRes.error) { reject(delRes.error); return; }
                    var chunk = 100;
                    function runChunk(idx) {
                        if (idx >= toInsert.length) {
                            resolve(toInsert.length);
                            return;
                        }
                        var slice = toInsert.slice(idx, idx + chunk);
                        _supabase.from('data_rows').insert(slice).then(function (res) {
                            if (res.error) { reject(res.error); return; }
                            runChunk(idx + chunk);
                        }).catch(reject);
                    }
                    runChunk(0);
                }).catch(reject);
            } catch (e) {
                reject(e);
            }
        };
        r.onerror = function () { reject(new Error('파일 읽기 실패')); };
        r.readAsArrayBuffer(file);
    });
}

function monthReportUploadFile(file) {
    var contractId = window._monthReportCurrentContractId;
    if (!contractId || !file) return;
    if (!_supabase) {
        alert('Supabase 연결 불가.');
        return;
    }
    if (_monthReportBusy) return;
    _monthReportBusy = true;
    monthReportSetStatus('업로드 중...', false);

    // 기존 파일 있으면 삭제 (DB + Storage)
    var existing = _monthReportStore[contractId] || { fileName: '', filePath: '' };
    var deletePromise = Promise.resolve();
    if (existing.filePath) {
        deletePromise = _supabase.storage.from(MONTH_REPORT_BUCKET).remove([existing.filePath]).then(function () {
            return _supabase.from('contract_month_report').delete().eq('contract_id', contractId);
        });
    }

    var path = String(contractId) + '/' + Date.now() + monthReportSafeObjectName(file.name);

    deletePromise.then(function () {
        return _supabase.storage.from(MONTH_REPORT_BUCKET).upload(path, file, { upsert: false });
    }).then(function (upRes) {
        if (upRes && upRes.error) throw upRes.error;
        return _supabase.from('contract_month_report').upsert(
            { contract_id: contractId, file_name: file.name, file_path: path },
            { onConflict: 'contract_id' }
        );
    }).then(function (metaRes) {
        if (metaRes && metaRes.error) throw metaRes.error;
        _monthReportStore[contractId] = { fileName: file.name, filePath: path };
        monthReportSyncUI(_monthReportStore[contractId]);
        return monthReportParseExcelToDataRows(file, contractId);
    }).then(function (rowCount) {
        monthReportRefreshPlatformStatus(contractId);
        updateAgreementRowButtons(contractId, monthReportDeriveTitle(file.name));
        monthReportSetStatus(rowCount >= 0 ? '업로드 완료' + (rowCount > 0 ? ' (' + rowCount + '건 데이터 저장)' : '') : '업로드 완료', false);
        setTimeout(function () { monthReportSetStatus('', false); }, 2500);
    }).catch(function (e) {
        monthReportSetStatus('업로드 실패: ' + (e && e.message ? e.message : String(e)), true);
    }).finally(function () {
        _monthReportBusy = false;
    });
}

/**
 * 협약 행의 '월말 엑셀' 버튼·'KPI' 버튼 문구를 한 번에 갱신.
 * @param {string} contractId - 협약 ID
 * @param {string} [monthReportLabel] - 월말 엑셀 버튼에 쓸 라벨(생략 시 월말 엑셀 버튼은 건드리지 않음)
 */
function updateAgreementRowButtons(contractId, monthReportLabel) {
    var monthBtn = document.querySelector('.month-report-btn[data-contract-id="' + contractId + '"]');
    var kpiBtn = document.querySelector('.kpi-rate-btn[data-contract-id="' + contractId + '"]');
    if (monthReportLabel !== undefined && monthBtn) {
        monthBtn.textContent = '월말 엑셀 : ' + (monthReportLabel || '--');
    }
    if (!kpiBtn) return;
    if (!_supabase) {
        kpiBtn.textContent = 'KPI : -%';
        return;
    }
    Promise.all([
        _supabase.from('contract_registry').select('block_target').eq('id', contractId).single(),
        _supabase.from('data_rows').select('contract_id').eq('contract_id', contractId)
    ]).then(function (results) {
        var reg = results[0] && results[0].data;
        var rows = results[1] && results[1].data ? results[1].data : [];
        var n = (reg && reg.block_target != null && reg.block_target !== '') ? parseInt(reg.block_target, 10) : 0;
        var m = rows.length;
        var rateStr = n > 0 ? (m / n * 100).toFixed(1) + '%' : '-%';
        kpiBtn.textContent = 'KPI : ' + rateStr;
    }).catch(function () {
        kpiBtn.textContent = 'KPI : -%';
    });
}

function monthReportDownloadFile() {
    var contractId = window._monthReportCurrentContractId;
    if (!contractId || !_supabase) return;
    var existing = _monthReportStore[contractId] || { fileName: '', filePath: '' };
    if (!existing.filePath || !existing.fileName) return;
    monthReportSetStatus('다운로드 중...', false);
    _supabase.storage.from(MONTH_REPORT_BUCKET).download(existing.filePath).then(function (res) {
        if (res && res.error) throw res.error;
        var blob = res.data;
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = existing.fileName || 'report.xlsx';
        a.click();
        URL.revokeObjectURL(url);
        monthReportSetStatus('다운로드 완료', false);
        setTimeout(function () { monthReportSetStatus('', false); }, 1500);
    }).catch(function (e) {
        monthReportSetStatus('다운로드 실패: ' + (e && e.message ? e.message : String(e)), true);
    });
}

function monthReportDeleteFile() {
    var contractId = window._monthReportCurrentContractId;
    if (!contractId) return;
    if (!_supabase) {
        _monthReportStore[contractId] = { fileName: '', filePath: '' };
        monthReportSyncUI(_monthReportStore[contractId]);
        monthReportSetStatus('', false);
        return;
    }
    if (_monthReportBusy) return;
    _monthReportBusy = true;
    monthReportSetStatus('삭제 중...', false);
    var existing = _monthReportStore[contractId] || { fileName: '', filePath: '' };
    var removePromise = Promise.resolve();
    if (existing.filePath) {
        removePromise = _supabase.storage.from(MONTH_REPORT_BUCKET).remove([existing.filePath]);
    }
    removePromise.then(function (rmRes) {
        if (rmRes && rmRes.error) throw rmRes.error;
        return _supabase.from('contract_month_report').delete().eq('contract_id', contractId);
    }).then(function (delRes) {
        if (delRes && delRes.error) throw delRes.error;
        return _supabase.from('data_rows').delete().eq('contract_id', contractId);
    }).then(function (dataRowsRes) {
        if (dataRowsRes && dataRowsRes.error) throw dataRowsRes.error;
        _monthReportStore[contractId] = { fileName: '', filePath: '' };
        monthReportSyncUI(_monthReportStore[contractId]);
        monthReportRefreshPlatformStatus(contractId);
        updateAgreementRowButtons(contractId, '--');
        monthReportSetStatus('삭제 완료', false);
        setTimeout(function () { monthReportSetStatus('', false); }, 1500);
    }).catch(function (e) {
        monthReportSetStatus('삭제 실패: ' + (e && e.message ? e.message : String(e)), true);
    }).finally(function () {
        _monthReportBusy = false;
        var fileInput = document.getElementById('monthReportFileInput');
        if (fileInput) fileInput.value = '';
    });
}

function monthReportDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    var zone = document.getElementById('monthReportDropZone');
    if (zone) zone.style.borderColor = '#3182ce';
}

function monthReportDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    var zone = document.getElementById('monthReportDropZone');
    if (zone) zone.style.borderColor = '#cbd5e0';
}

function monthReportDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    var zone = document.getElementById('monthReportDropZone');
    if (zone) zone.style.borderColor = '#cbd5e0';
    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) monthReportUploadFile(files[0]);
}

function monthReportFileSelect(e) {
    var files = e.target && e.target.files;
    if (files && files.length) monthReportUploadFile(files[0]);
}

function openKpiEditModal() {
    var contractId = window._kpiCurrentContractId;
    if (contractId == null) return;
    var data = _kpiStore[contractId] || { targetCount: '', rows: [] };
    var targetInput = document.getElementById('kpiEditTargetCount');
    var tbody = document.getElementById('kpiEditTableBody');
    if (targetInput) targetInput.value = (data.targetCount !== '' && data.targetCount != null) ? String(data.targetCount) : '';
    if (tbody) {
        var rows = data.rows || [];
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td contenteditable="true" style="border: 1px solid #e2e8f0; padding: 8px 12px; min-height: 36px;"></td><td contenteditable="true" style="border: 1px solid #e2e8f0; padding: 8px 12px; min-height: 36px;"></td></tr>';
        } else {
            tbody.innerHTML = rows.map(function (r) {
                var c = (r.country || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                var p = (r.platform || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return '<tr><td contenteditable="true" style="border: 1px solid #e2e8f0; padding: 8px 12px; min-height: 36px;">' + c + '</td><td contenteditable="true" style="border: 1px solid #e2e8f0; padding: 8px 12px; min-height: 36px;">' + p + '</td></tr>';
            }).join('');
        }
    }
    attachKpiEditPasteHandler();
    var modal = document.getElementById('kpiEditModal');
    if (modal) modal.style.display = 'flex';
}

function closeKpiEditModal() {
    var modal = document.getElementById('kpiEditModal');
    if (modal) modal.style.display = 'none';
}

function attachKpiEditPasteHandler() {
    var table = document.getElementById('kpiEditTable');
    if (!table) return;
    table.onpaste = function (e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData('text');
        var rawLines = (text || '').split(/\r?\n/);
        var lines = rawLines.map(function (line) { return line.trim(); }).filter(function (line) { return line !== ''; });
        if (lines.length === 0) return;
        var tbody = document.getElementById('kpiEditTableBody');
        if (!tbody) return;
        var rows = [];
        var hasTab = rawLines.some(function (line) { return line.indexOf('\t') !== -1; });
        if (hasTab) {
            for (var i = 0; i < lines.length; i++) {
                var cells = lines[i].split(/\t/);
                var c0, c1;
                if (cells.length >= 2) {
                    c0 = (cells[0] || '').trim();
                    c1 = (cells[1] || '').trim();
                } else {
                    var line = (lines[i] || '').trim();
                    var firstSpace = line.indexOf(' ');
                    if (firstSpace > 0) {
                        c0 = line.slice(0, firstSpace).trim();
                        c1 = line.slice(firstSpace).trim();
                    } else {
                        c0 = line;
                        c1 = '';
                    }
                }
                rows.push({ country: c0, platform: c1 });
            }
        } else {
            for (var j = 0; j < lines.length; j += 2) {
                var country = (lines[j] || '').trim();
                var platform = (lines[j + 1] != null) ? (lines[j + 1] || '').trim() : '';
                rows.push({ country: country, platform: platform });
            }
        }
        tbody.innerHTML = rows.map(function (r) {
            var c = (r.country || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var p = (r.platform || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return '<tr><td contenteditable="true" style="border: 1px solid #e2e8f0; padding: 8px 12px; min-height: 36px;">' + c + '</td><td contenteditable="true" style="border: 1px solid #e2e8f0; padding: 8px 12px; min-height: 36px;">' + p + '</td></tr>';
        }).join('');
    };
}

function saveKpi() {
    var contractId = window._kpiCurrentContractId;
    if (contractId == null) return;
    var targetInput = document.getElementById('kpiEditTargetCount');
    var tbody = document.getElementById('kpiEditTableBody');
    var targetCount = (targetInput && targetInput.value) ? targetInput.value.trim() : '';
    var rows = [];
    if (tbody) {
        var trs = tbody.querySelectorAll('tr');
        for (var i = 0; i < trs.length; i++) {
            var cells = trs[i].querySelectorAll('td');
            var country = (cells[0] && cells[0].textContent) ? cells[0].textContent.trim() : '';
            var platform = (cells[1] && cells[1].textContent) ? cells[1].textContent.trim() : '';
            if (country || platform) rows.push({ country: country, platform: platform });
        }
    }
    _kpiStore[contractId] = { targetCount: targetCount, rows: rows };

    if (!_supabase) {
        closeKpiEditModal();
        openKpiModal(contractId);
        if (typeof updateAgreementRowButtons === 'function') updateAgreementRowButtons(contractId);
        return;
    }
    var blockTargetVal = targetCount === '' ? null : (isNaN(Number(targetCount)) ? targetCount : Number(targetCount));
    _supabase.from('contract_registry').update({ block_target: blockTargetVal }).eq('id', contractId).then(function (upRes) {
        if (upRes.error) {
            alert('목표 건수 저장 실패: ' + (upRes.error.message || ''));
            return;
        }
        _supabase.from('contract_kpi_target').delete().eq('contract_id', contractId).then(function (delRes) {
            if (rows.length === 0) {
                closeKpiEditModal();
                openKpiModal(contractId);
                if (typeof updateAgreementRowButtons === 'function') updateAgreementRowButtons(contractId);
                return;
            }
            var toInsert = rows.map(function (r, idx) {
                return { contract_id: contractId, country: r.country || '', platform: r.platform || '', sort_order: idx };
            });
            _supabase.from('contract_kpi_target').insert(toInsert).then(function (insRes) {
                if (insRes.error) {
                    alert('KPI 표 저장 실패: ' + (insRes.error.message || ''));
                    return;
                }
                closeKpiEditModal();
                openKpiModal(contractId);
                if (typeof updateAgreementRowButtons === 'function') updateAgreementRowButtons(contractId);
            });
        });
    });
}

var personnelDetailListCache = [];
var personnelDetailEditMode = false;
var personnelDetailOriginalIds = [];
var PERSONNEL_DETAIL_ROLES = ['책임연구원', '연구원', '연구보조원', '예비'];
var PERSONNEL_ROLE_ORDER = { '책임연구원': 0, '연구원': 1, '연구보조원': 2, '예비': 3 };

var _personnelNameCollator = null;
function getPersonnelNameCollator() {
    if (_personnelNameCollator) return _personnelNameCollator;
    try {
        _personnelNameCollator = new Intl.Collator('ko-KR', { sensitivity: 'base' });
    } catch (e) {
        _personnelNameCollator = { compare: function (a, b) { return (a || '').localeCompare(b || '', 'ko-KR'); } };
    }
    return _personnelNameCollator;
}

function sortPersonnelByRoleThenName(list) {
    if (!list || !list.length) return list;
    var nameCompare = getPersonnelNameCollator().compare;
    return list.slice().sort(function (a, b) {
        var posA = (a.position || '').trim();
        var posB = (b.position || '').trim();
        var orderA = PERSONNEL_ROLE_ORDER[posA];
        var orderB = PERSONNEL_ROLE_ORDER[posB];
        if (orderA != null && orderB != null && orderA !== orderB) return orderA - orderB;
        if (orderA != null && orderB == null) return -1;
        if (orderA == null && orderB != null) return 1;
        var nameA = (a.name || '').trim();
        var nameB = (b.name || '').trim();
        return nameCompare(nameA, nameB);
    });
}

function joinContractSearchText(joinContract) {
    if (joinContract == null) return '';
    var arr = Array.isArray(joinContract) ? joinContract : [];
    return arr.map(function (item) {
        return joinContractItemSearchText(item);
    }).filter(Boolean).join(' ');
}
function joinContractItemSearchText(item) {
    if (item == null) return '';
    if (Array.isArray(item)) return [(item[0] != null) ? String(item[0]) : '', (item[1] != null) ? String(item[1]) : '', (item[2] != null) ? String(item[2]) : ''].join(' ');
    if (item && typeof item === 'object') return [item.company || item.회사명 || '', item.brand || item.브랜드명 || '', item.rate != null ? String(item.rate) : (item.참여율 != null ? String(item.참여율) : '')].join(' ');
    return '';
}
function formatJoinContractTags(joinContract, searchQuery) {
    if (joinContract == null) return '';
    var arr = Array.isArray(joinContract) ? joinContract : [];
    var q = (searchQuery && typeof searchQuery === 'string') ? searchQuery.trim().toLowerCase() : '';
    if (q) arr = arr.filter(function (item) { return joinContractItemSearchText(item).toLowerCase().includes(q); });
    var spans = arr.map(function (item) {
        var company = '', brand = '', rate = '';
        if (Array.isArray(item)) {
            company = (item[0] != null) ? String(item[0]) : '';
            brand = (item[1] != null) ? String(item[1]) : '';
            rate = (item[2] != null) ? String(item[2]) : '';
        } else if (item && typeof item === 'object') {
            company = item.company || item.회사명 || '';
            brand = item.brand || item.브랜드명 || '';
            rate = item.rate != null ? String(item.rate) : (item.참여율 != null ? String(item.참여율) : '');
        }
        if (!company && !brand && !rate) return '';
        var rateStr = (rate || '').trim();
        if (rateStr && rateStr.indexOf('%') === -1) rateStr += '%';
        var label = company + (brand ? '(' + brand + ')' : '') + (rateStr ? ' : ' + rateStr : '');
        return '<span style="display: inline-block; margin: 2px 4px 2px 0; padding: 4px 8px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-size: 12px;">' + (label.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')) + '</span>';
    }).filter(Boolean);
    if (spans.length === 0) return '';
    return '<span class="join-contract-tags-wrap">' + spans.join('') + '</span>';
}

function joinContractTooltipText(joinContract, searchQuery) {
    if (joinContract == null) return '';
    var arr = Array.isArray(joinContract) ? joinContract : [];
    var q = (searchQuery && typeof searchQuery === 'string') ? searchQuery.trim().toLowerCase() : '';
    if (q) arr = arr.filter(function (item) { return joinContractItemSearchText(item).toLowerCase().includes(q); });
    var lines = arr.map(function (item) {
        var company = '', brand = '', rate = '';
        if (Array.isArray(item)) {
            company = (item[0] != null) ? String(item[0]) : '';
            brand = (item[1] != null) ? String(item[1]) : '';
            rate = (item[2] != null) ? String(item[2]) : '';
        } else if (item && typeof item === 'object') {
            company = item.company || item.회사명 || '';
            brand = item.brand || item.브랜드명 || '';
            rate = item.rate != null ? String(item.rate) : (item.참여율 != null ? String(item.참여율) : '');
        }
        if (!company && !brand && !rate) return '';
        var rateStr = (rate || '').trim();
        if (rateStr && rateStr.indexOf('%') === -1) rateStr += '%';
        return company + (brand ? '(' + brand + ')' : '') + (rateStr ? ' : ' + rateStr : '');
    }).filter(Boolean);
    return lines.join('||');
}

function loadPersonnelDetailTable() {
    var tbody = document.getElementById('personnelDetailTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="padding: 24px; text-align: center; color: #94a3b8;">데이터를 불러오는 중...</td></tr>';
    var projectKey = getProjectKey();
    Promise.all([
        _supabase.from('personnel_master').select('id, position, name, total_rate, rest_rate, join_contract').eq('target_table', projectKey),
        _supabase.from('page3_participation').select('personnel_id, contract_id, rate'),
        _supabase.from('contract_registry').select('id, status').eq('target_table', projectKey)
    ]).then(function (results) {
        var personnelRes = results[0];
        var partRes = results[1];
        var contractsRes = results[2];
        var list = (personnelRes && personnelRes.data) ? personnelRes.data : [];
        list = sortPersonnelByRoleThenName(list);
        var partList = (partRes && partRes.data) ? partRes.data : [];
        var contracts = (contractsRes && contractsRes.data) ? contractsRes.data : [];
        var partMap = {};
        partList.forEach(function (p) { partMap[p.personnel_id + '_' + p.contract_id] = Number(p.rate) || 0; });
        var contractById = {};
        contracts.forEach(function (c) { contractById[c.id] = c; });
        list.forEach(function (p) {
            var cum = 0;
            contracts.forEach(function (c) {
                if (c.status === '신청' || c.status === '선정') cum += partMap[p.id + '_' + c.id] || 0;
            });
            cum = Math.round(cum * 1000) / 1000;
            p._cumulative = (p.total_rate != null && p.total_rate !== '') ? (Math.round(Number(p.total_rate) * 1000) / 1000) : cum;
            p._rest = (p.rest_rate != null && p.rest_rate !== '') ? Number(p.rest_rate) : null;
        });
        personnelDetailListCache = list;
        renderPersonnelDetailRows(list, personnelDetailEditMode);
    }).catch(function (err) {
        var projectKey = getProjectKey();
        Promise.all([
            _supabase.from('personnel_master').select('id, position, name').eq('target_table', projectKey),
            _supabase.from('page3_participation').select('personnel_id, contract_id, rate'),
            _supabase.from('contract_registry').select('id, status').eq('target_table', projectKey)
        ]).then(function (results) {
            var list = (results[0] && results[0].data) ? results[0].data : [];
            list = sortPersonnelByRoleThenName(list);
            var partList = (results[1] && results[1].data) ? results[1].data : [];
            var contracts = (results[2] && results[2].data) ? results[2].data : [];
            var partMap = {};
            partList.forEach(function (p) { partMap[p.personnel_id + '_' + p.contract_id] = Number(p.rate) || 0; });
            list.forEach(function (p) {
                var cum = 0;
                contracts.forEach(function (c) {
                    if (c.status === '신청' || c.status === '선정') cum += partMap[p.id + '_' + c.id] || 0;
                });
                p._cumulative = Math.round(cum * 1000) / 1000;
                p._rest = null;
                p.join_contract = null;
            });
            personnelDetailListCache = list;
            renderPersonnelDetailRows(list, personnelDetailEditMode);
        }).catch(function () {
            personnelDetailListCache = [];
            if (document.getElementById('personnelDetailTableBody')) {
                document.getElementById('personnelDetailTableBody').innerHTML = '<tr><td colspan="5" style="padding: 24px; text-align: center; color: #e53e3e;">로드 실패.</td></tr>';
            }
        });
    });
}

function renderPersonnelDetailRows(list, editMode) {
    var thead = document.getElementById('personnelDetailTableHead');
    var tbody = document.getElementById('personnelDetailTableBody');
    var q = (document.getElementById('personnelDetailSearch') || {}).value.trim().toLowerCase();
    if (q) list = list.filter(function (p) {
        var nameMatch = (p.position || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q);
        var joinMatch = joinContractSearchText(p.join_contract).toLowerCase().includes(q);
        return nameMatch || joinMatch;
    });
    if (thead) {
        if (editMode) {
            thead.innerHTML = '<tr style="background: #f8fafc;"><th class="col-checkbox"></th><th class="col-role">구분</th><th class="col-name">이름</th><th class="col-cumulative">누적</th><th class="col-rest">잉여</th><th class="col-join">참여 협약</th></tr>';
        } else {
            thead.innerHTML = '<tr style="background: #f8fafc;"><th class="col-role">구분</th><th class="col-name">이름</th><th class="col-cumulative">누적</th><th class="col-rest">잉여</th><th class="col-join">참여 협약</th></tr>';
        }
    }
    if (!tbody) return;
    if (list.length === 0 && !editMode) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 24px; text-align: center; color: #94a3b8;">등록된 인력이 없습니다.</td></tr>';
        return;
    }
    if (list.length === 0 && editMode) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8;">아래 "추가" 버튼으로 행을 추가하세요.</td></tr>';
        return;
    }
    var colspan = editMode ? 6 : 5;
    if (editMode) {
        tbody.innerHTML = list.map(function (p, idx) {
            var id = p.id != null ? p.id : 'new-' + idx;
            var posVal = (p.position || '').replace(/"/g, '&quot;');
            var nameVal = (p.name || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var opts = PERSONNEL_DETAIL_ROLES.map(function (r) {
                var sel = (r === (p.position || '')) ? ' selected' : '';
                return '<option value="' + r.replace(/"/g, '&quot;') + '"' + sel + '>' + r + '</option>';
            }).join('');
            var isYeobi = (p.position || '').trim() === '예비';
            var cumStr = isYeobi ? '' : ((p._cumulative != null) ? (Math.round(Number(p._cumulative) * 1000) / 1000 + '%') : '—');
            var restStr = isYeobi ? '' : ((p._rest != null) ? (Number(p._rest) + '%') : '—');
            var tags = formatJoinContractTags(p.join_contract, q) || '—';
            var tooltipRaw = joinContractTooltipText(p.join_contract, q);
            var tooltipAttr = tooltipRaw ? tooltipRaw.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
            return '<tr data-id="' + (p.id != null ? p.id : '') + '" data-new="' + (p.id == null ? '1' : '0') + '"><td class="col-checkbox"><input type="checkbox" class="personnel-detail-row-cb"></td><td class="col-role"><select class="personnel-detail-position" style="border: 1px solid #cbd5e0; border-radius: 4px;">' + opts + '</select></td><td class="col-name"><input type="text" class="personnel-detail-name" value="' + nameVal + '" placeholder="이름" style="border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;"></td><td class="col-cumulative">' + cumStr + '</td><td class="col-rest">' + restStr + '</td><td class="col-join"' + (tooltipAttr ? ' data-join-tooltip="' + tooltipAttr + '"' : '') + '>' + tags + '</td></tr>';
        }).join('');
        tbody.querySelectorAll('.personnel-detail-position').forEach(function (sel) {
            sel.onchange = function () {
                var tr = sel.closest('tr');
                if (!tr) return;
                var cumTd = tr.querySelector('.col-cumulative');
                var restTd = tr.querySelector('.col-rest');
                if ((sel.value || '').trim() === '예비') {
                    if (cumTd) cumTd.textContent = '';
                    if (restTd) restTd.textContent = '';
                }
            };
        });
    } else {
        tbody.innerHTML = list.map(function (p) {
            var isYeobi = (p.position || '').trim() === '예비';
            var cumStr = isYeobi ? '' : ((p._cumulative != null) ? (Math.round(Number(p._cumulative) * 1000) / 1000 + '%') : '—');
            var restStr = isYeobi ? '' : ((p._rest != null) ? (Number(p._rest) + '%') : '—');
            var tags = formatJoinContractTags(p.join_contract, q) || '—';
            var tooltipRaw = joinContractTooltipText(p.join_contract, q);
            var tooltipAttr = tooltipRaw ? tooltipRaw.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
            return '<tr><td class="col-role">' + (p.position || '').replace(/</g, '&lt;') + '</td><td class="col-name">' + (p.name || '').replace(/</g, '&lt;') + '</td><td class="col-cumulative">' + cumStr + '</td><td class="col-rest">' + restStr + '</td><td class="col-join"' + (tooltipAttr ? ' data-join-tooltip="' + tooltipAttr + '"' : '') + '>' + tags + '</td></tr>';
        }).join('');
    }
}

function enterPersonnelDetailEditMode() {
    personnelDetailEditMode = true;
    personnelDetailOriginalIds = personnelDetailListCache.map(function (p) { return p.id; }).filter(function (id) { return id != null; });
    document.getElementById('personnelDetailViewBtns').style.display = 'none';
    document.getElementById('personnelDetailEditBtns').style.display = 'inline-flex';
    renderPersonnelDetailRows(personnelDetailListCache, true);
}

function exitPersonnelDetailEditMode() {
    syncPersonnelDetailFromTable();
    var projectKey = getProjectKey();
    var currentIds = personnelDetailListCache.map(function (p) { return p.id; }).filter(function (id) { return id != null; });
    var toDelete = personnelDetailOriginalIds.filter(function (id) { return currentIds.indexOf(id) === -1; });
    var toUpdate = personnelDetailListCache.filter(function (p) { return p.id != null; });
    var toInsert = personnelDetailListCache.filter(function (p) { return p.id == null && (p.position || p.name); });

    function checkRes(res) {
        if (res && res.error) throw new Error(res.error.message || res.error.code || 'DB 오류');
        return res;
    }

    function runSave() {
        var chain = Promise.resolve();
        if (toDelete.length) {
            chain = chain.then(function () {
                return _supabase.from('personnel_master').delete().in('id', toDelete).then(checkRes);
            });
        }
        toUpdate.forEach(function (p) {
            chain = chain.then(function () {
                return _supabase.from('personnel_master').update({ position: p.position || '', name: p.name || '' }).eq('id', p.id).then(checkRes);
            });
        });
        if (toInsert.length) {
            var rows = toInsert.map(function (p) { return { target_table: projectKey, position: p.position || '', name: p.name || '' }; });
            chain = chain.then(function () {
                return _supabase.from('personnel_master').insert(rows).then(checkRes);
            });
        }
        return chain;
    }

    if (!projectKey || projectKey === 'default') {
        alert('저장 실패: 프로젝트(target_table)를 선택한 뒤 다시 시도하세요.');
        return;
    }

    runSave().then(function () {
        personnelDetailEditMode = false;
        document.getElementById('personnelDetailViewBtns').style.display = 'inline';
        document.getElementById('personnelDetailEditBtns').style.display = 'none';
        loadPersonnelDetailTable();
        loadStatusSummary();
        loadPersonnelTable();
    }).catch(function (err) {
        alert('저장 실패: ' + (err && err.message ? err.message : String(err)));
    });
}

function syncPersonnelDetailFromTable() {
    var rows = document.querySelectorAll('#personnelDetailTableBody tr[data-id], #personnelDetailTableBody tr[data-new]');
    if (!rows.length) return;
    var list = [];
    rows.forEach(function (tr, idx) {
        var orig = personnelDetailListCache[idx];
        var id = tr.getAttribute('data-id');
        var isNew = tr.getAttribute('data-new') === '1';
        var posEl = tr.querySelector('.personnel-detail-position');
        var nameEl = tr.querySelector('.personnel-detail-name');
        var position = posEl ? posEl.value : (orig && orig.position) || '';
        var name = nameEl ? nameEl.value.trim() : (orig && orig.name) || '';
        list.push({
            id: isNew ? null : (id ? parseInt(id, 10) : null),
            position: position,
            name: name,
            _cumulative: orig && orig._cumulative != null ? orig._cumulative : null,
            _rest: orig && orig._rest != null ? orig._rest : null,
            join_contract: orig && orig.join_contract != null ? orig.join_contract : null
        });
    });
    personnelDetailListCache = list;
}

function addPersonnelDetailRow() {
    syncPersonnelDetailFromTable();
    personnelDetailListCache.push({ id: null, position: '책임연구원', name: '', _cumulative: 0, _rest: null, join_contract: null });
    renderPersonnelDetailRows(personnelDetailListCache, true);
}

function deletePersonnelDetailRows() {
    var rows = document.querySelectorAll('#personnelDetailTableBody tr');
    var checkedIndices = {};
    rows.forEach(function (tr, idx) {
        if (tr.querySelector('.personnel-detail-row-cb:checked')) checkedIndices[idx] = true;
    });
    if (Object.keys(checkedIndices).length === 0) { alert('삭제할 행을 선택하세요.'); return; }
    var list = personnelDetailListCache.filter(function (p, idx) { return !checkedIndices[idx]; });
    personnelDetailListCache = list;
    renderPersonnelDetailRows(personnelDetailListCache, true);
}

function openPersonnelDetailModal() {
    document.getElementById('personnelDetailModal').style.display = 'flex';
    document.getElementById('personnelDetailSearch').value = '';
    loadPersonnelDetailTable();
}

function closePersonnelDetailModal() {
    if (personnelDetailEditMode) {
        personnelDetailEditMode = false;
        document.getElementById('personnelDetailViewBtns').style.display = 'inline';
        document.getElementById('personnelDetailEditBtns').style.display = 'none';
    }
    document.getElementById('personnelDetailModal').style.display = 'none';
}

var addContractPersonnelList = [];
var addContractLoadedPersonnelById = {};
var addContractSalaryByCorpKey = {};
var addContractMaxGovSupport = 0;
var _addContractEditingId = null;
var _loadContractFullList = [];

function toggleLoadContractSearch() {
    var popup = document.getElementById('loadContractPopup');
    var listEl = document.getElementById('loadContractList');
    if (!popup) return;
    if (popup.style.display === 'none' || !popup.style.display) {
        popup.style.display = 'flex';
        if (_loadContractFullList.length === 0) {
            if (listEl) listEl.innerHTML = '<p style="margin:0; color:#94a3b8;">불러오기 목록을 불러오는 중...</p>';
            loadAllContractsForSearch();
        } else {
            renderLoadContractList((document.getElementById('loadContractSearchInput') || {}).value || '');
        }
        var inp = document.getElementById('loadContractSearchInput');
        if (inp) {
            inp.value = '';
            inp.removeEventListener('input', onLoadContractSearchInput);
            inp.addEventListener('input', onLoadContractSearchInput);
        }
    } else {
        closeLoadContractPopup();
    }
}

function closeLoadContractPopup() {
    var popup = document.getElementById('loadContractPopup');
    var inp = document.getElementById('loadContractSearchInput');
    if (popup) popup.style.display = 'none';
    if (inp) inp.value = '';
}

function onLoadContractSearchInput() {
    var inp = document.getElementById('loadContractSearchInput');
    renderLoadContractList(inp ? inp.value : '');
}

function loadAllContractsForSearch() {
    var listEl = document.getElementById('loadContractList');
    _supabase.from('gateways').select('keyword, target_table').eq('target_page', 'page3').then(function (gwRes) {
        var gateways = (gwRes.data || []).filter(function (r) {
            var kw = (r.keyword || '').trim();
            return (r.target_table || '').trim() && kw !== '보호원';
        });
        var keywordByTable = {};
        gateways.forEach(function (r) { keywordByTable[r.target_table] = (r.keyword || r.target_table || '').trim(); });
        var tables = gateways.map(function (r) { return r.target_table; }).filter(function (t, i, arr) { return arr.indexOf(t) === i; });
        if (tables.length === 0) {
            _loadContractFullList = [];
            if (listEl) listEl.innerHTML = '<p style="margin:0; color:#94a3b8;">협약이 없습니다.</p>';
            return;
        }
        var promises = tables.map(function (t) {
            return _supabase.from('contract_registry').select('id, target_table, company_name, brand_name').eq('target_table', t);
        });
        Promise.all(promises).then(function (results) {
            var combined = [];
            results.forEach(function (res) {
                var rows = res.data || [];
                rows.forEach(function (row) {
                    var kw = keywordByTable[row.target_table] || row.target_table || '';
                    if (kw === '보호원') return;
                    combined.push({
                        id: row.id,
                        target_table: row.target_table,
                        company_name: (row.company_name || '').trim(),
                        brand_name: (row.brand_name || '').trim(),
                        keyword: kw
                    });
                });
            });
            _loadContractFullList = combined;
            renderLoadContractList((document.getElementById('loadContractSearchInput') || {}).value || '');
        }).catch(function (err) {
            console.error('협약 목록 로드 실패:', err);
            if (listEl) listEl.innerHTML = '<p style="margin:0; color:#e53e3e;">목록을 불러오지 못했습니다.</p>';
        });
    });
}

function renderLoadContractList(filter) {
    var listEl = document.getElementById('loadContractList');
    if (!listEl) return;
    var q = (filter || '').trim().toLowerCase();
    var items = _loadContractFullList;
    if (q) {
        items = items.filter(function (x) {
            var kw = (x.keyword || '').toLowerCase();
            var company = (x.company_name || '').toLowerCase();
            var brand = (x.brand_name || '').toLowerCase();
            return kw.indexOf(q) !== -1 || company.indexOf(q) !== -1 || brand.indexOf(q) !== -1;
        });
    }
    if (items.length === 0) {
        listEl.innerHTML = '<p style="margin:0; color:#94a3b8;">' + (q ? '검색 결과가 없습니다.' : '협약이 없습니다.') + '</p>';
        return;
    }
    var html = items.map(function (x) {
        var label = x.keyword + '-' + x.company_name + (x.brand_name ? '(' + x.brand_name + ')' : '');
        var safe = (label || '').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        return '<div class="load-contract-item" data-id="' + x.id + '" style="padding:8px 10px; border-bottom:1px solid #e2e8f0; cursor:pointer; border-radius:4px;" onmouseover="this.style.background=\'#edf2f7\'" onmouseout="this.style.background=\'transparent\'">' + safe + '</div>';
    }).join('');
    listEl.innerHTML = html;
    listEl.querySelectorAll('.load-contract-item').forEach(function (el) {
        el.addEventListener('click', function () {
            var id = parseInt(el.getAttribute('data-id'), 10);
            closeLoadContractPopup();
            var modal = document.getElementById('addContractModal');
            var isAddMode = modal && modal.style.display === 'flex' && _addContractEditingId == null;
            openAddContractModal(id, isAddMode ? { loadDataOnly: true } : undefined);
        });
    });
}

function getRefNoDefault() {
    var key = (window.tableName || window.projectKeyName || '').toString().trim();
    var year = new Date().getFullYear();
    if (/^\d{4}$/.test(key)) year = parseInt(key, 10);
    return year + '-PS';
}
function toggleAddContractRefNo() {
    var statusEl = document.getElementById('addContractStatus');
    var wrap = document.getElementById('addContractRefNoWrap');
    if (wrap) wrap.style.display = (statusEl && statusEl.value === '선정') ? 'inline' : 'none';
}
var CORP_LABEL_TO_KEY = { '소기업': 'small', '중기업': 'mid', '중견기업': 'midlarge', '대기업': 'large' };
var CORP_KEY_TO_LABEL = { small: '소기업', mid: '중기업', midlarge: '중견기업', large: '대기업' };
var YEARS_LABEL_TO_KEY = { '3년미만': 'under_3y', '3년차': 'year_3', '5년차': 'year_5', '7년 이상': 'over_7y' };
var ROLE_SALARY_KEYS = { '책임연구원': 'salary_senior', '연구원': 'salary_researcher', '보조연구원': 'salary_assistant', '연구보조원': 'salary_assistant' };
var YEARS_TO_RATIO_KEYS = { '3년미만': { cash: 'cash_under_3y', kind: 'kind_under_3y' }, '3년차': { cash: 'cash_year_3', kind: 'kind_year_3' }, '5년차': { cash: 'cash_year_5', kind: 'kind_year_5' }, '7년 이상': { cash: 'cash_over_7y', kind: 'kind_over_7y' } };
var YEARS_VALUE_TO_KEYS = { under_3y: { cash: 'cash_under_3y', kind: 'kind_under_3y' }, year_3: { cash: 'cash_year_3', kind: 'kind_year_3' }, year_5: { cash: 'cash_year_5', kind: 'kind_year_5' }, over_7y: { cash: 'cash_over_7y', kind: 'kind_over_7y' } };

function openAddContractModal(contractId, options) {
    var modal = document.getElementById('addContractModal');
    var titleEl = document.getElementById('addContractModalTitle');
    var tbody = document.getElementById('addContractPersonnelBody');
    if (!modal) return;
    var loadDataOnly = options && options.loadDataOnly === true;
    var fetchId = contractId || null;
    _addContractEditingId = loadDataOnly ? null : fetchId;
    addContractLoadedPersonnelById = {};
    modal.style.display = 'flex';
    if (titleEl) titleEl.textContent = _addContractEditingId ? '협약 수정' : '협약 추가';
    var deleteBtn = document.getElementById('addContractDeleteBtn');
    if (deleteBtn) deleteBtn.style.display = _addContractEditingId ? 'inline-block' : 'none';
    var statusEl = document.getElementById('addContractStatus');
    if (statusEl && !_addContractEditingId) statusEl.value = '신청';
    var refNoEl = document.getElementById('addContractRefNo');
    if (refNoEl) refNoEl.value = getRefNoDefault();
    var assigneeEl = document.getElementById('addContractAssignee');
    if (assigneeEl && !_addContractEditingId) assigneeEl.value = '';
    toggleAddContractRefNo();
    var totalAmountEl = document.getElementById('addContractTotalAmount');
    if (totalAmountEl) {
        totalAmountEl.removeEventListener('input', updateAddContractFinancialTable);
        totalAmountEl.removeEventListener('change', updateAddContractFinancialTable);
        totalAmountEl.removeEventListener('blur', formatAddContractTotalAmountInput);
        totalAmountEl.addEventListener('input', updateAddContractFinancialTable);
        totalAmountEl.addEventListener('change', updateAddContractFinancialTable);
        totalAmountEl.addEventListener('blur', formatAddContractTotalAmountInput);
    }
    var projectKey = getProjectKey();
    function applyPersonnelAndSalary(participationRows) {
        var personnelTbody = document.getElementById('addContractPersonnelBody');
        if (!personnelTbody) return;
        var rowsToCreate = participationRows && participationRows.length ? participationRows : [];
        var rowTemplate = '<tr><td style="border:1px solid #e2e8f0;padding:6px 8px;text-align:center;"><input type="checkbox" class="add-contract-row-cb"></td><td class="add-contract-role-cell" style="border:1px solid #e2e8f0;padding:6px 8px;background:#f8fafc;"></td><td style="border:1px solid #e2e8f0;padding:6px 8px;"><span class="add-contract-name-display"></span><input type="hidden" class="add-contract-personnel-id" value=""></td><td style="border:1px solid #e2e8f0;padding:6px 8px;background:#fff7ed;"><input type="text" class="add-contract-rate" placeholder="%" style="width:60px;padding:6px 8px;border:1px solid #cbd5e0;border-radius:4px;text-align:center;box-sizing:border-box;"></td><td style="border:1px solid #e2e8f0;padding:6px 8px;background:#fff7ed;"><input type="text" class="add-contract-period" placeholder="기간" style="width:100%;padding:6px 8px;border:1px solid #cbd5e0;border-radius:4px;box-sizing:border-box;"></td><td class="add-contract-cost-cell" style="border:1px solid #e2e8f0;padding:6px 8px;text-align:right;background:#f8fafc;"></td><td class="add-contract-cumulative-cell" style="border:1px solid #e2e8f0;padding:6px 8px;text-align:center;background:#f8fafc;"></td><td class="add-contract-rest-cell" style="border:1px solid #e2e8f0;padding:6px 8px;text-align:center;background:#f8fafc;"></td></tr>';
        personnelTbody.innerHTML = rowsToCreate.map(function () { return rowTemplate; }).join('');
        personnelTbody.querySelectorAll('tr').forEach(function (tr, i) {
            var pr = rowsToCreate[i];
            if (pr) {
                setAddContractRowPersonnel(tr, pr.personnel_id != null ? pr.personnel_id : '');
                var rateInp = tr.querySelector('.add-contract-rate');
                if (rateInp) rateInp.value = (pr.rate != null && pr.rate !== '') ? String(pr.rate) : '';
                var periodInp = tr.querySelector('.add-contract-period');
                if (periodInp) periodInp.value = (pr.period != null && pr.period !== '') ? String(pr.period) : '';
            }
        });
        personnelTbody.querySelectorAll('tr').forEach(function (tr) { bindAddContractRowEvents(tr); });
        personnelTbody.querySelectorAll('tr').forEach(function (tr) { onAddContractNameChange(tr); calcAddContractRowCost(tr); });
        updateAddContractSubtotal();
        updateAddContractFinancialTable();
    }
    function fillContractForm(contract) {
        if (!contract) return;
        var numTagEl = document.getElementById('addContractNumTag');
        var companyEl = document.getElementById('addContractCompanyName');
        var brandEl = document.getElementById('addContractBrandName');
        var corpEl = document.getElementById('addContractCompanyType');
        var yearsEl = document.getElementById('addContractYears');
        var totalEl = document.getElementById('addContractTotalAmount');
        if (numTagEl) numTagEl.value = contract.num_tag || '';
        if (companyEl) companyEl.value = contract.company_name || '';
        if (brandEl) brandEl.value = contract.brand_name || '';
        var corpVal = (contract.corp_size || '').trim();
        if (corpEl) corpEl.value = CORP_LABEL_TO_KEY[corpVal] || 'mid';
        var yearsVal = (contract.years || '').trim();
        if (yearsEl) yearsEl.value = YEARS_LABEL_TO_KEY[yearsVal] || 'over_7y';
        var budget = Number(contract.total_budget) || 0;
        if (totalEl) totalEl.value = budget ? budget.toLocaleString('ko-KR') : '';
        var statusEl = document.getElementById('addContractStatus');
        if (statusEl) statusEl.value = (contract.status || '신청').trim() || '신청';
        var refNoEl = document.getElementById('addContractRefNo');
        if (refNoEl) refNoEl.value = (contract.ref_no != null && contract.ref_no !== '') ? String(contract.ref_no).trim() : getRefNoDefault();
        var assigneeEl = document.getElementById('addContractAssignee');
        if (assigneeEl) assigneeEl.value = (contract.assignee_id != null && contract.assignee_id !== '') ? String(contract.assignee_id) : '';
        toggleAddContractRefNo();
        updateAddContractFinancialTable();
    }
    var promises = [
        _supabase.from('personnel_master').select('id, position, name, total_rate, rest_rate').eq('target_table', projectKey),
        _supabase.from('salary_config').select('corp_size, max_support_amount, salary_senior, salary_researcher, salary_assistant, cash_under_3y, kind_under_3y, cash_year_3, kind_year_3, cash_year_5, kind_year_5, cash_over_7y, kind_over_7y').eq('target_table', projectKey),
        fetchId ? _supabase.from('page3_participation').select('personnel_id, rate').eq('contract_id', fetchId) : Promise.resolve({ data: [] }),
        fetchId ? _supabase.from('contract_registry').select('*').eq('id', fetchId).single() : Promise.resolve({ data: null })
    ];
    Promise.all(promises).then(function (results) {
        var personnelRes = results[0];
        var salaryRes = results[1];
        var partRes = results[2];
        var contractRes = results[3];
        if (personnelRes && personnelRes.error) console.warn('personnel_master 조회 오류:', personnelRes.error);
        addContractPersonnelList = (personnelRes && !personnelRes.error && personnelRes.data) ? personnelRes.data : [];
        var assigneeSel = document.getElementById('addContractAssignee');
        if (assigneeSel) {
            assigneeSel.innerHTML = '<option value="">미정</option>' + (addContractPersonnelList || []).map(function (p) {
                var label = (p.name || '').trim() || '(이름 없음)';
                var safe = (label + '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                return '<option value="' + (p.id != null ? p.id : '') + '">' + safe + '</option>';
            }).join('');
        }
        addContractSalaryByCorpKey = {};
        var salaryRows = salaryRes && !salaryRes.error && salaryRes.data ? salaryRes.data : [];
        var enToKor = { small: '소기업', mid: '중기업', midlarge: '중견기업', large: '대기업' };
        var korToKey = { '소기업': 'small', '중기업': 'mid', '중견기업': 'midlarge', '대기업': 'large' };
        salaryRows.forEach(function (r) {
            var k = r.corp_size;
            if (!k) return;
            var rowData = { salary_senior: Number(r.salary_senior) || 0, salary_researcher: Number(r.salary_researcher) || 0, salary_assistant: Number(r.salary_assistant) || 0, cash_under_3y: Number(r.cash_under_3y) || 0, kind_under_3y: Number(r.kind_under_3y) || 0, cash_year_3: Number(r.cash_year_3) || 0, kind_year_3: Number(r.kind_year_3) || 0, cash_year_5: Number(r.cash_year_5) || 0, kind_year_5: Number(r.kind_year_5) || 0, cash_over_7y: Number(r.cash_over_7y) || 0, kind_over_7y: Number(r.kind_over_7y) || 0 };
            addContractSalaryByCorpKey[k] = rowData;
            if (enToKor[k]) addContractSalaryByCorpKey[enToKor[k]] = rowData;
            if (korToKey[k]) addContractSalaryByCorpKey[korToKey[k]] = rowData;
        });
        var maxSupportFromRows = salaryRows.map(function (r) { return parseInt(String(r.max_support_amount || '0').replace(/,/g, ''), 10) || 0; });
        addContractMaxGovSupport = maxSupportFromRows.length ? Math.max.apply(null, maxSupportFromRows) : 0;
        var partRows = (partRes && partRes.data) ? partRes.data : [];
        var contract = (contractRes && contractRes.data) ? contractRes.data : null;
        var prArray = contract && Array.isArray(contract.participation_rate) ? contract.participation_rate : [];
        if (partRows.length && prArray.length) {
            partRows = partRows.map(function (pr, i) {
                var prItem = prArray[i];
                var period = (prItem && (prItem.period != null || prItem.기간 != null)) ? (prItem.period || prItem.기간 || '') : '';
                return { personnel_id: pr.personnel_id, rate: pr.rate, period: period };
            });
        } else if (partRows.length) {
            partRows = partRows.map(function (pr) { return { personnel_id: pr.personnel_id, rate: pr.rate, period: '' }; });
        }
        function doApplyAndFill() {
            applyPersonnelAndSalary(partRows.length ? partRows : null);
            fillContractForm(contract);
            var inKindTbody = document.getElementById('addContractInKindPersonnelBody');
            if (inKindTbody) {
                inKindTbody.innerHTML = '';
                if (contract && Array.isArray(contract.in_kind_personnel) && contract.in_kind_personnel.length > 0) {
                    contract.in_kind_personnel.forEach(function (row) {
                        var tr = document.createElement('tr');
                        tr.innerHTML = buildAddContractInKindRowHtml().replace(/^<tr>|<\/tr>$/g, '');
                        inKindTbody.appendChild(tr);
                        var roleSel = tr.querySelector('.add-contract-inkind-role');
                        var nameInp = tr.querySelector('.add-contract-inkind-name');
                        var rateInp = tr.querySelector('.add-contract-inkind-rate');
                        var periodInp = tr.querySelector('.add-contract-inkind-period');
                        if (roleSel && (row.position || row.구분)) roleSel.value = (row.position || row.구분 || '').trim() || roleSel.value;
                        if (nameInp) nameInp.value = (row.name || row.이름 || '').trim();
                        if (rateInp) rateInp.value = (row.rate != null || row.참여율 != null) ? String(row.rate != null ? row.rate : row.참여율) : '';
                        if (periodInp) periodInp.value = (row.period || row.기간 || '').trim();
                        bindAddContractInKindRowEvents(tr);
                        calcAddContractInKindRowCost(tr);
                    });
                } else {
                    addAddContractInKindRow();
                    var firstTr = inKindTbody.querySelector('tr');
                    if (firstTr) {
                        var roleSel = firstTr.querySelector('.add-contract-inkind-role');
                        if (roleSel) roleSel.value = '연구보조원';
                    }
                }
                updateAddContractInKindSubtotal();
            }
        }
        if (contract && (contract.target_table || '').trim() && partRows.length > 0) {
            var contractTable = (contract.target_table || '').trim();
            _supabase.from('personnel_master').select('id, position, name, total_rate, rest_rate').eq('target_table', contractTable).then(function (r) {
                var list = (r && !r.error && r.data) ? r.data : [];
                addContractLoadedPersonnelById = {};
                list.forEach(function (p) {
                    if (p.id != null) {
                        addContractLoadedPersonnelById[p.id] = p;
                        addContractLoadedPersonnelById[String(p.id)] = p;
                    }
                });
                doApplyAndFill();
            }).catch(function () {
                doApplyAndFill();
            });
        } else {
            doApplyAndFill();
        }
    }).catch(function (err) {
        console.error('협약 추가 모달 로드 실패:', err);
    });
}
function setAddContractRowPersonnel(tr, personnelId) {
    var idInput = tr && tr.querySelector('.add-contract-personnel-id');
    var nameSpan = tr && tr.querySelector('.add-contract-name-display');
    if (idInput) idInput.value = personnelId != null ? String(personnelId) : '';
    if (nameSpan) {
        if (!personnelId) { nameSpan.textContent = ''; nameSpan.innerHTML = ''; return; }
        var pFromCurrent = addContractPersonnelList.filter(function (x) { return String(x.id) === String(personnelId); })[0];
        var pFromLoaded = addContractLoadedPersonnelById[personnelId] || addContractLoadedPersonnelById[String(personnelId)];
        var p = pFromCurrent || pFromLoaded;
        var inCurrent = !!pFromCurrent;
        if (!inCurrent && pFromLoaded) {
            var wantPos = String(pFromLoaded.position || '').trim();
            var wantName = String(pFromLoaded.name || '').trim();
            var sameNamePosition = addContractPersonnelList.filter(function (x) {
                return String(x.position || '').trim() === wantPos && String(x.name || '').trim() === wantName;
            })[0];
            if (sameNamePosition) {
                if (idInput) idInput.value = String(sameNamePosition.id);
                p = sameNamePosition;
                inCurrent = true;
            }
        }
        var name = p ? (p.name || '').trim() : '';
        if (!name) {
            nameSpan.textContent = '';
            nameSpan.innerHTML = '';
            return;
        }
        if (inCurrent) {
            nameSpan.textContent = name;
            nameSpan.removeAttribute('title');
            if (tr) tr.removeAttribute('data-not-current-personnel');
        } else {
            nameSpan.innerHTML = '<span style="text-decoration: line-through;">' + name.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') + '</span>';
            nameSpan.title = '현재 키워드에 등록되지 않은 인력입니다.';
            if (tr) tr.setAttribute('data-not-current-personnel', '1');
        }
    }
}

function getAddContractSelectedPersonnelIds() {
    var tbody = document.getElementById('addContractPersonnelBody');
    if (!tbody) return [];
    var ids = [];
    tbody.querySelectorAll('.add-contract-personnel-id').forEach(function (inp) {
        var v = (inp.value || '').trim();
        if (v) ids.push(v);
    });
    return ids;
}

function buildAddContractRowHtml() {
    return '<tr><td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center;"><input type="checkbox" class="add-contract-row-cb"></td><td class="add-contract-role-cell" style="border: 1px solid #e2e8f0; padding: 6px 8px; background: #f8fafc;"></td><td style="border: 1px solid #e2e8f0; padding: 6px 8px;"><span class="add-contract-name-display"></span><input type="hidden" class="add-contract-personnel-id" value=""></td><td style="border: 1px solid #e2e8f0; padding: 6px 8px; background: #fff7ed;"><input type="text" class="add-contract-rate" placeholder="%" style="width: 60px; padding: 6px 8px; border: 1px solid #cbd5e0; border-radius: 4px; text-align: center; box-sizing: border-box;"></td><td style="border: 1px solid #e2e8f0; padding: 6px 8px; background: #fff7ed;"><input type="text" class="add-contract-period" placeholder="기간" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;"></td><td class="add-contract-cost-cell" style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: right; background: #f8fafc;"></td><td class="add-contract-cumulative-cell" style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center; background: #f8fafc;"></td><td class="add-contract-rest-cell" style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center; background: #f8fafc;"></td></tr>';
}
function bindAddContractRowEvents(tr) {
    if (tr.getAttribute('data-add-contract-bound') === '1') return;
    tr.setAttribute('data-add-contract-bound', '1');
    var rateInp = tr.querySelector('.add-contract-rate');
    var periodInp = tr.querySelector('.add-contract-period');
    function onUpdate() {
        onAddContractNameChange(tr);
        calcAddContractRowCost(tr);
        updateAddContractSubtotal();
        updateAddContractFinancialTable();
    }
    if (rateInp) { rateInp.addEventListener('input', onUpdate); rateInp.addEventListener('change', onUpdate); }
    if (periodInp) { periodInp.addEventListener('input', onUpdate); periodInp.addEventListener('change', onUpdate); }
}
function onAddContractNameChange(tr) {
    var idInput = tr.querySelector('.add-contract-personnel-id');
    var roleCell = tr.querySelector('.add-contract-role-cell');
    var cumCell = tr.querySelector('.add-contract-cumulative-cell');
    var restCell = tr.querySelector('.add-contract-rest-cell');
    var id = idInput && idInput.value ? idInput.value : '';
    var p = addContractPersonnelList.filter(function (x) { return String(x.id) === String(id); })[0] || addContractLoadedPersonnelById[id] || addContractLoadedPersonnelById[String(id)];
    if (!roleCell) return;
    if (!p) {
        roleCell.textContent = '';
        if (cumCell) cumCell.textContent = '';
        if (restCell) restCell.textContent = '';
        return;
    }
    roleCell.textContent = p.position || '';
    if (cumCell) cumCell.textContent = (p.total_rate != null && p.total_rate !== '') ? (Math.round(Number(p.total_rate) * 1000) / 1000 + '%') : '—';
    if (restCell) restCell.textContent = (p.rest_rate != null && p.rest_rate !== '') ? (Number(p.rest_rate) + '%') : '—';
}
function getAddContractSalaryForRole(role) {
    var corpEl = document.getElementById('addContractCompanyType');
    var rawVal = corpEl && corpEl.value ? corpEl.value : 'mid';
    var corpKey = CORP_LABEL_TO_KEY[rawVal] || rawVal;
    var row = addContractSalaryByCorpKey[corpKey];
    if (!row) return 0;
    var key = ROLE_SALARY_KEYS[role];
    return key ? (row[key] || 0) : 0;
}
function calcAddContractRowCost(tr) {
    var roleCell = tr.querySelector('.add-contract-role-cell');
    var rateInp = tr.querySelector('.add-contract-rate');
    var periodInp = tr.querySelector('.add-contract-period');
    var costCell = tr.querySelector('.add-contract-cost-cell');
    if (!costCell) return 0;
    var role = roleCell ? roleCell.textContent.trim() : '';
    var salary = getAddContractSalaryForRole(role);
    var rate = parseFloat(rateInp && rateInp.value ? rateInp.value.replace(/,/g, '').replace(/%/g, '') : 0) || 0;
    var period = parseFloat(periodInp && periodInp.value ? periodInp.value.replace(/,/g, '') : 0) || 0;
    var cost = Math.round(salary * (rate / 100) * period);
    costCell.textContent = cost ? cost.toLocaleString('ko-KR') : '';
    return cost;
}
function updateAddContractSubtotal() {
    var tbody = document.getElementById('addContractPersonnelBody');
    var subtotalEl = document.getElementById('addContractSubtotal');
    if (!tbody || !subtotalEl) return;
    var sum = 0;
    tbody.querySelectorAll('.add-contract-cost-cell').forEach(function (td) {
        var t = (td.textContent || '').replace(/,/g, '').replace(/\s/g, '');
        var n = parseInt(t, 10);
        if (!isNaN(n)) sum += n;
    });
    subtotalEl.value = sum ? sum.toLocaleString('ko-KR') : '';
    if (typeof updateAddContractFinancialTable === 'function') updateAddContractFinancialTable();
}
function updateAddContractFinancialTable() {
    var totalAmountEl = document.getElementById('addContractTotalAmount');
    var subtotalEl = document.getElementById('addContractSubtotal');
    var corpEl = document.getElementById('addContractCompanyType');
    var yearsEl = document.getElementById('addContractYears');
    var totalAmount = parseAddContractNumber(totalAmountEl && totalAmountEl.value ? totalAmountEl.value : 0);
    var personnelSum = parseAddContractNumber(subtotalEl && subtotalEl.value ? subtotalEl.value : 0);
    var corpKey = corpEl && corpEl.value ? (CORP_LABEL_TO_KEY[corpEl.value] || corpEl.value) : 'mid';
    var yearsVal = yearsEl && yearsEl.value ? yearsEl.value : 'over_7y';
    var keys = YEARS_VALUE_TO_KEYS[yearsVal] || YEARS_VALUE_TO_KEYS.over_7y;
    var row = addContractSalaryByCorpKey[corpKey] || (corpEl && corpEl.value ? addContractSalaryByCorpKey[corpEl.value] : null);
    var cashVal = (row && keys && row[keys.cash] != null) ? (Number(row[keys.cash]) || 0) : 0;
    var kindVal = (row && keys && row[keys.kind] != null) ? (Number(row[keys.kind]) || 0) : 0;
    var cashRatioPct = (cashVal > 0 && cashVal <= 1) ? cashVal * 100 : cashVal;
    var kindRatioPct = (kindVal > 0 && kindVal <= 1) ? kindVal * 100 : kindVal;
    var kindAmount = Math.floor(totalAmount * (kindRatioPct / 100));
    var cashAmount = Math.floor(totalAmount * (cashRatioPct / 100));
    var govSupport = totalAmount - kindAmount - cashAmount;
    var projectExpense = totalAmount - kindAmount;
    var vat = Math.round(projectExpense / 11);
    var totalCost = projectExpense - vat;
    var generalAdmin = totalCost - personnelSum;
    var adminRatioEl = document.getElementById('addContractAdminRatioDisplay');
    var adminRatio = personnelSum > 0 ? (generalAdmin / personnelSum) * 100 : 0;
    if (adminRatioEl) {
        adminRatioEl.textContent = personnelSum > 0 ? (adminRatio.toFixed(1) + '%') : '';
        adminRatioEl.style.color = adminRatio > 6 ? '#c53030' : '';
        adminRatioEl.style.fontWeight = adminRatio > 6 ? 'bold' : '';
    }
    setAddContractDisplay('addContractGeneralAdminDisplay', generalAdmin);
    setAddContractDisplay('addContractTotalCostDisplay', totalCost);
    setAddContractDisplay('addContractVatDisplay', vat);
    setAddContractDisplay('addContractProjectExpenseDisplay', projectExpense);
    setAddContractDisplay('addContractGovSupportDisplay', govSupport);
    var govSupportEl = document.getElementById('addContractGovSupportDisplay');
    if (govSupportEl) {
        if (addContractMaxGovSupport > 0 && govSupport > addContractMaxGovSupport) {
            govSupportEl.style.color = '#c53030';
            govSupportEl.style.fontWeight = 'bold';
        } else {
            govSupportEl.style.color = '';
            govSupportEl.style.fontWeight = '';
        }
    }
    setAddContractDisplay('addContractCompanyInKindDisplay', kindAmount);
    setAddContractDisplay('addContractCompanyCashDisplay', cashAmount);
}
function formatAddContractTotalAmountInput() {
    var el = document.getElementById('addContractTotalAmount');
    if (!el) return;
    var n = parseAddContractNumber(el.value);
    el.value = n ? n.toLocaleString('ko-KR') : '';
}

function setAddContractTotalToMaxGovSupport() {
    if (!addContractMaxGovSupport || addContractMaxGovSupport <= 0) {
        alert('최대 정부지원금이 설정되지 않았습니다. 기준 급여 및 비율에서 최대 정부지원금을 먼저 설정하세요.');
        return;
    }
    var corpEl = document.getElementById('addContractCompanyType');
    var yearsEl = document.getElementById('addContractYears');
    var corpKey = corpEl && corpEl.value ? (CORP_LABEL_TO_KEY[corpEl.value] || corpEl.value) : 'mid';
    var yearsVal = yearsEl && yearsEl.value ? yearsEl.value : 'over_7y';
    var keys = YEARS_VALUE_TO_KEYS[yearsVal] || YEARS_VALUE_TO_KEYS.over_7y;
    var row = addContractSalaryByCorpKey[corpKey] || (corpEl && corpEl.value ? addContractSalaryByCorpKey[corpEl.value] : null);
    var cashVal = (row && keys && row[keys.cash] != null) ? (Number(row[keys.cash]) || 0) : 0;
    var kindVal = (row && keys && row[keys.kind] != null) ? (Number(row[keys.kind]) || 0) : 0;
    var cashRatioPct = (cashVal > 0 && cashVal <= 1) ? cashVal * 100 : cashVal;
    var kindRatioPct = (kindVal > 0 && kindVal <= 1) ? kindVal * 100 : kindVal;
    var govRatio = 1 - (kindRatioPct / 100) - (cashRatioPct / 100);
    if (govRatio <= 0) {
        alert('현재 기업 규모·연차 비율로는 정부지원금 비율을 계산할 수 없습니다.');
        return;
    }
    var totalAmount = Math.round(addContractMaxGovSupport / govRatio);
    function derivedGovSupport(t) {
        var kindAmt = Math.floor(t * (kindRatioPct / 100));
        var cashAmt = Math.floor(t * (cashRatioPct / 100));
        return t - kindAmt - cashAmt;
    }
    while (totalAmount > 0 && derivedGovSupport(totalAmount) > addContractMaxGovSupport) {
        totalAmount -= 1;
    }
    var totalAmountEl = document.getElementById('addContractTotalAmount');
    if (totalAmountEl) {
        totalAmountEl.value = totalAmount ? totalAmount.toLocaleString('ko-KR') : '';
        updateAddContractFinancialTable();
    }
}
function parseAddContractNumber(v) {
    if (typeof v === 'number' && !isNaN(v)) return v;
    var s = String(v || '').replace(/,/g, '').replace(/\s/g, '');
    var n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
}
function parseAddContractRate(v) {
    if (typeof v === 'number' && !isNaN(v)) return v;
    var s = String(v || '').replace(/,/g, '').replace(/\s/g, '').replace(/%/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}
function setAddContractDisplay(id, num) {
    var el = document.getElementById(id);
    if (el) el.textContent = (num != null && num !== '') ? (num === 0 ? '0' : num.toLocaleString('ko-KR')) : '';
}
function recalcAddContractCosts() {
    var tbody = document.getElementById('addContractPersonnelBody');
    if (tbody) tbody.querySelectorAll('tr').forEach(function (tr) { calcAddContractRowCost(tr); });
    updateAddContractSubtotal();
    var inKindTbody = document.getElementById('addContractInKindPersonnelBody');
    if (inKindTbody) inKindTbody.querySelectorAll('tr').forEach(function (tr) { calcAddContractInKindRowCost(tr); });
    updateAddContractInKindSubtotal();
    if (typeof updateAddContractFinancialTable === 'function') updateAddContractFinancialTable();
}

function buildAddContractInKindRowHtml() {
    var opts = PERSONNEL_DETAIL_ROLES.map(function (r) {
        return '<option value="' + r.replace(/"/g, '&quot;') + '">' + r + '</option>';
    }).join('');
    return '<tr><td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center;"><button type="button" class="btn-select add-contract-inkind-delete" style="padding: 4px 8px; font-size: 11px; border-color: #feb2b2; color: #c53030;">-</button></td><td style="border: 1px solid #e2e8f0; padding: 6px 8px; background: #f8fafc;"><select class="add-contract-inkind-role" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e0; border-radius: 4px; background: white; font-size: 13px; box-sizing: border-box;">' + opts + '</select></td><td style="border: 1px solid #e2e8f0; padding: 6px 8px;"><input type="text" class="add-contract-inkind-name" placeholder="이름" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;"></td><td style="border: 1px solid #e2e8f0; padding: 6px 8px; background: #fff7ed;"><input type="text" class="add-contract-inkind-rate" placeholder="%" style="width: 60px; padding: 6px 8px; border: 1px solid #cbd5e0; border-radius: 4px; text-align: center; box-sizing: border-box;"></td><td style="border: 1px solid #e2e8f0; padding: 6px 8px; background: #fff7ed;"><input type="text" class="add-contract-inkind-period" placeholder="기간" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;"></td><td class="add-contract-inkind-cost-cell" style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: right; background: #f8fafc;"></td><td class="add-contract-inkind-remark-cell" style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; background: #f8fafc; width: 80px;"><div style="display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap;"><button type="button" class="btn-select add-contract-inkind-calc-btn" style="padding: 4px 10px; font-size: 12px; flex-shrink: 0;">계산</button><span class="add-contract-inkind-remark-warn" style="font-size: 12px; color: #c53030;"></span></div></td></tr>';
}

function addAddContractInKindRow() {
    var tbody = document.getElementById('addContractInKindPersonnelBody');
    if (!tbody) return;
    var tr = document.createElement('tr');
    tr.innerHTML = buildAddContractInKindRowHtml().replace(/^<tr>|<\/tr>$/g, '');
    tbody.appendChild(tr);
    bindAddContractInKindRowEvents(tr);
}

function removeAddContractInKindRow(tr) {
    if (!tr || !tr.parentNode) return;
    tr.remove();
    updateAddContractInKindSubtotal();
    updateAddContractInKindWarnings();
}

function bindAddContractInKindRowEvents(tr) {
    if (tr.getAttribute('data-inkind-bound') === '1') return;
    tr.setAttribute('data-inkind-bound', '1');
    var roleSel = tr.querySelector('.add-contract-inkind-role');
    var rateInp = tr.querySelector('.add-contract-inkind-rate');
    var periodInp = tr.querySelector('.add-contract-inkind-period');
    var nameInp = tr.querySelector('.add-contract-inkind-name');
    function onUpdate() {
        calcAddContractInKindRowCost(tr);
        updateAddContractInKindSubtotal();
        updateAddContractInKindWarnings();
    }
    if (roleSel) roleSel.addEventListener('change', onUpdate);
    if (rateInp) { rateInp.addEventListener('input', onUpdate); rateInp.addEventListener('change', onUpdate); }
    if (periodInp) { periodInp.addEventListener('input', onUpdate); periodInp.addEventListener('change', onUpdate); }
    if (nameInp) { nameInp.addEventListener('input', updateAddContractInKindWarnings); nameInp.addEventListener('change', updateAddContractInKindWarnings); }
    var delBtn = tr.querySelector('.add-contract-inkind-delete');
    if (delBtn) delBtn.addEventListener('click', function () { removeAddContractInKindRow(tr); });
    var calcBtn = tr.querySelector('.add-contract-inkind-calc-btn');
    if (calcBtn) calcBtn.addEventListener('click', function () { calcInKindRateFromCompanyCash(tr); });
}

function calcAddContractInKindRowCost(tr) {
    var roleSel = tr.querySelector('.add-contract-inkind-role');
    var rateInp = tr.querySelector('.add-contract-inkind-rate');
    var periodInp = tr.querySelector('.add-contract-inkind-period');
    var costCell = tr.querySelector('.add-contract-inkind-cost-cell');
    if (!costCell) return 0;
    var role = roleSel && roleSel.value ? roleSel.value.trim() : '';
    var salary = getAddContractSalaryForRole(role);
    var rate = parseFloat(rateInp && rateInp.value ? rateInp.value.replace(/,/g, '').replace(/%/g, '') : 0) || 0;
    var period = parseFloat(periodInp && periodInp.value ? periodInp.value.replace(/,/g, '') : 0) || 0;
    var cost = Math.round(salary * (rate / 100) * period);
    costCell.textContent = cost ? cost.toLocaleString('ko-KR') : '';
    return cost;
}

function updateAddContractInKindSubtotal() {
    var tbody = document.getElementById('addContractInKindPersonnelBody');
    var displayEl = document.getElementById('addContractInKindSubtotalDisplay');
    if (!tbody || !displayEl) return;
    var sum = 0;
    tbody.querySelectorAll('.add-contract-inkind-cost-cell').forEach(function (td) {
        var t = (td.textContent || '').replace(/,/g, '').replace(/\s/g, '');
        var n = parseInt(t, 10);
        if (!isNaN(n)) sum += n;
    });
    displayEl.value = sum ? sum.toLocaleString('ko-KR') : '';
}

function calcInKindRateFromCompanyCash(tr) {
    var roleSel = tr.querySelector('.add-contract-inkind-role');
    var periodInp = tr.querySelector('.add-contract-inkind-period');
    var rateInp = tr.querySelector('.add-contract-inkind-rate');
    if (!rateInp) return;
    var role = roleSel && roleSel.value ? roleSel.value.trim() : '';
    var period = parseFloat(periodInp && periodInp.value ? periodInp.value.replace(/,/g, '') : 0) || 0;
    var kindEl = document.getElementById('addContractCompanyInKindDisplay');
    var companyKind = parseAddContractNumber(kindEl && kindEl.textContent ? kindEl.textContent : 0);
    var salary = getAddContractSalaryForRole(role);
    if (!salary || !period || period <= 0) {
        return;
    }
    var rate = (companyKind * 100) / (salary * period);
    if (!isFinite(rate) || rate < 0) return;
    rate = Math.ceil(rate * 1000) / 1000;
    rateInp.value = rate.toFixed(3);
    calcAddContractInKindRowCost(tr);
    updateAddContractInKindSubtotal();
    updateAddContractInKindWarnings();
}

function updateAddContractInKindWarnings() {
    var tbody = document.getElementById('addContractInKindPersonnelBody');
    if (!tbody) return;
    var companyName = (document.getElementById('addContractCompanyName') && document.getElementById('addContractCompanyName').value || '').trim();
    var byKey = {};
    tbody.querySelectorAll('tr').forEach(function (row) {
        var nameInp = row.querySelector('.add-contract-inkind-name');
        var rateInp = row.querySelector('.add-contract-inkind-rate');
        var name = (nameInp && nameInp.value ? nameInp.value : '').trim();
        var rate = parseFloat(rateInp && rateInp.value ? rateInp.value.replace(/,/g, '').replace(/%/g, '') : 0) || 0;
        var key = companyName + '\t' + name;
        if (!byKey[key]) byKey[key] = [];
        byKey[key].push({ row: row, rate: rate });
    });
    var over100 = {};
    Object.keys(byKey).forEach(function (key) {
        var items = byKey[key];
        var sum = items.reduce(function (a, b) { return a + b.rate; }, 0);
        if (sum > 100) items.forEach(function (x) { over100[x.row] = true; });
    });
    tbody.querySelectorAll('tr').forEach(function (row) {
        var warnEl = row.querySelector('.add-contract-inkind-remark-warn');
        if (!warnEl) return;
        warnEl.textContent = over100[row] ? '⚠ 동일 기업·이름 참여율 합 100% 초과' : '';
    });
}

function closeAddContractModal() {
    _addContractEditingId = null;
    var titleEl = document.getElementById('addContractModalTitle');
    if (titleEl) titleEl.textContent = '협약 추가';
    var deleteBtn = document.getElementById('addContractDeleteBtn');
    if (deleteBtn) deleteBtn.style.display = 'none';
    closeLoadContractPopup();
    document.getElementById('addContractModal').style.display = 'none';
}
function deleteAddContract() {
    if (!_addContractEditingId) return;
    if (!confirm('이 협약을 삭제하시겠습니까?')) return;
    if (!_supabase) return;
    var projectKey = getProjectKey();
    var editingId = _addContractEditingId;
    _supabase.from('page3_participation').select('personnel_id').eq('contract_id', editingId).then(function (oldRes) {
        var oldIds = (oldRes && oldRes.data) ? oldRes.data.map(function (x) { return x.personnel_id; }) : [];
        _supabase.from('page3_participation').delete().eq('contract_id', editingId).then(function () {
            _supabase.from('contract_registry').delete().eq('id', editingId).then(function (res) {
                if (res.error) {
                    alert('삭제 실패: ' + (res.error.message || ''));
                    return;
                }
                if (oldIds.length) {
                    updatePersonnelMasterRates(projectKey, oldIds).then(done).catch(done);
                } else {
                    done();
                }
            });
        });
    });
    function done() {
        _loadContractFullList = [];
        personnelDetailListCache = [];
        closeAddContractModal();
        loadStatusSummary();
        loadPersonnelTable();
        if (typeof loadContractDetailApplicationTable === 'function') loadContractDetailApplicationTable();
        if (typeof loadContractDetailAmountTable === 'function') loadContractDetailAmountTable();
        if (typeof loadContractDetailList === 'function') loadContractDetailList();
        var personnelModal = document.getElementById('personnelDetailModal');
        if (personnelModal && personnelModal.style.display === 'flex') {
            loadPersonnelDetailTable();
        }
    }
}
var addContractSelectPersonnelListCache = [];

var _addContractSelectPersonnelRowClickBound;
function openAddContractSelectPersonnelModal() {
    var modal = document.getElementById('addContractSelectPersonnelModal');
    if (!modal) return;
    if (!_addContractSelectPersonnelRowClickBound) {
        _addContractSelectPersonnelRowClickBound = true;
        var tbody = document.getElementById('addContractSelectPersonnelTableBody');
        if (tbody && tbody.parentNode) {
            tbody.parentNode.addEventListener('click', function (e) {
                var tr = e.target.closest('tbody tr[data-personnel-id]');
                if (!tr) return;
                if (e.target.closest('input.add-contract-select-personnel-cb')) return;
                var cb = tr.querySelector('.add-contract-select-personnel-cb');
                if (cb) cb.checked = !cb.checked;
            });
        }
    }
    modal.style.display = 'flex';
    var searchInp = document.getElementById('addContractSelectPersonnelSearch');
    if (searchInp) searchInp.value = '';
    loadAddContractSelectPersonnelTable();
}

function closeAddContractSelectPersonnelModal() {
    var modal = document.getElementById('addContractSelectPersonnelModal');
    if (modal) modal.style.display = 'none';
}

function loadAddContractSelectPersonnelTable() {
    var tbody = document.getElementById('addContractSelectPersonnelTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8;">데이터를 불러오는 중...</td></tr>';
    var projectKey = getProjectKey();
    var alreadySelected = getAddContractSelectedPersonnelIds();
    Promise.all([
        _supabase.from('personnel_master').select('id, position, name, total_rate, rest_rate, join_contract').eq('target_table', projectKey),
        _supabase.from('page3_participation').select('personnel_id, contract_id, rate'),
        _supabase.from('contract_registry').select('id, status').eq('target_table', projectKey)
    ]).then(function (results) {
        var personnelRes = results[0];
        var partRes = results[1];
        var contractsRes = results[2];
        var list = (personnelRes && personnelRes.data) ? personnelRes.data : [];
        list = sortPersonnelByRoleThenName(list);
        list = list.filter(function (p) { return alreadySelected.indexOf(String(p.id)) === -1; });
        var partList = (partRes && partRes.data) ? partRes.data : [];
        var contracts = (contractsRes && contractsRes.data) ? contractsRes.data : [];
        var partMap = {};
        partList.forEach(function (p) { partMap[p.personnel_id + '_' + p.contract_id] = Number(p.rate) || 0; });
        list.forEach(function (p) {
            var cum = 0;
            contracts.forEach(function (c) {
                if (c.status === '신청' || c.status === '선정') cum += partMap[p.id + '_' + c.id] || 0;
            });
            cum = Math.round(cum * 1000) / 1000;
            p._cumulative = (p.total_rate != null && p.total_rate !== '') ? (Math.round(Number(p.total_rate) * 1000) / 1000) : cum;
            p._rest = (p.rest_rate != null && p.rest_rate !== '') ? Number(p.rest_rate) : null;
        });
        var listForSelect = list.filter(function (p) { return (p.position || '').trim() !== '예비'; });
        addContractSelectPersonnelListCache = listForSelect;
        renderAddContractSelectPersonnelTable(listForSelect);
    }).catch(function () {
        addContractSelectPersonnelListCache = [];
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #e53e3e;">로드 실패.</td></tr>';
    });
}

function renderAddContractSelectPersonnelTable(list) {
    var tbody = document.getElementById('addContractSelectPersonnelTableBody');
    var q = (document.getElementById('addContractSelectPersonnelSearch') || {}).value.trim().toLowerCase();
    if (q) list = list.filter(function (p) {
        var nameMatch = (p.position || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q);
        var joinMatch = joinContractSearchText(p.join_contract).toLowerCase().includes(q);
        return nameMatch || joinMatch;
    });
    if (!tbody) return;
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8;">선택 가능한 인력이 없습니다.</td></tr>';
        return;
    }
    var html = list.map(function (p) {
        var cumStr = (p._cumulative != null) ? (Math.round(Number(p._cumulative) * 1000) / 1000 + '%') : '—';
        var restStr = (p._rest != null) ? (Number(p._rest) + '%') : '—';
        var tags = formatJoinContractTags(p.join_contract, q) || '—';
        var tooltipRaw = joinContractTooltipText(p.join_contract, q);
        var tooltipAttr = tooltipRaw ? tooltipRaw.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
        var posSafe = (p.position || '').replace(/</g, '&lt;');
        var nameSafe = (p.name || '').replace(/</g, '&lt;');
        return '<tr data-personnel-id="' + (p.id != null ? p.id : '') + '"><td style="border:1px solid #e2e8f0;padding:6px 8px;text-align:center;width:36px;"><input type="checkbox" class="add-contract-select-personnel-cb"></td><td style="border:1px solid #e2e8f0;padding:6px 8px;width:72px;">' + posSafe + '</td><td style="border:1px solid #e2e8f0;padding:6px 8px;width:72px;">' + nameSafe + '</td><td style="border:1px solid #e2e8f0;padding:6px 8px;width:48px;">' + cumStr + '</td><td style="border:1px solid #e2e8f0;padding:6px 8px;width:48px;">' + restStr + '</td><td class="col-join" style="border:1px solid #e2e8f0;padding:6px 8px;"' + (tooltipAttr ? ' data-join-tooltip="' + tooltipAttr + '"' : '') + '>' + tags + '</td></tr>';
    }).join('');
    tbody.innerHTML = html;
}

function filterAddContractSelectPersonnelTable() {
    renderAddContractSelectPersonnelTable(addContractSelectPersonnelListCache);
}

function confirmAddContractSelectPersonnel() {
    var tbody = document.getElementById('addContractSelectPersonnelTableBody');
    var addTbody = document.getElementById('addContractPersonnelBody');
    if (!tbody || !addTbody) return;
    var ids = [];
    tbody.querySelectorAll('tr').forEach(function (tr) {
        var cb = tr.querySelector('.add-contract-select-personnel-cb');
        if (cb && cb.checked) {
            var id = tr.getAttribute('data-personnel-id');
            if (id) ids.push(id);
        }
    });
    ids.forEach(function (personnelId) {
        var tr = document.createElement('tr');
        var rowHtml = buildAddContractRowHtml();
        tr.innerHTML = rowHtml.replace(/^<tr>/, '').replace(/<\/tr>$/, '');
        addTbody.appendChild(tr);
        setAddContractRowPersonnel(tr, personnelId);
        bindAddContractRowEvents(tr);
        onAddContractNameChange(tr);
    });
    closeAddContractSelectPersonnelModal();
    updateAddContractSubtotal();
    if (typeof updateAddContractFinancialTable === 'function') updateAddContractFinancialTable();
}

function addContractPersonnelRow() {
    var tbody = document.getElementById('addContractPersonnelBody');
    if (!tbody) return;
    var tr = document.createElement('tr');
    var rowHtml = buildAddContractRowHtml();
    tr.innerHTML = rowHtml.replace(/^<tr>/, '').replace(/<\/tr>$/, '');
    tbody.appendChild(tr);
    bindAddContractRowEvents(tr);
    updateAddContractSubtotal();
    if (typeof updateAddContractFinancialTable === 'function') updateAddContractFinancialTable();
}
function deleteContractPersonnelRows() {
    var tbody = document.getElementById('addContractPersonnelBody');
    if (!tbody) return;
    var rows = tbody.querySelectorAll('tr');
    var toRemove = [];
    rows.forEach(function (tr) {
        if (tr.querySelector('.add-contract-row-cb:checked')) toRemove.push(tr);
    });
    toRemove.forEach(function (tr) { tr.remove(); });
    updateAddContractSubtotal();
    if (typeof updateAddContractFinancialTable === 'function') updateAddContractFinancialTable();
}
function saveAddContract() {
    if (!_supabase) {
        alert('Supabase 연결을 확인하세요.');
        return;
    }
    var projectKey = getProjectKey();
    if (!projectKey) {
        alert('저장 실패: 프로젝트(target_table)를 선택한 뒤 다시 시도하세요.');
        return;
    }
    var tbodyCheck = document.getElementById('addContractPersonnelBody');
    if (tbodyCheck && tbodyCheck.querySelector('tr[data-not-current-personnel="1"]')) {
        alert('현재 키워드에 등록되지 않은 인력(취소선)이 포함되어 있습니다. 해당 인력을 제거하거나, 현재 프로젝트에 동일한 이름·구분으로 등록한 뒤 저장하세요.');
        return;
    }
    updateAddContractFinancialTable();

    var numTag = (document.getElementById('addContractNumTag') && document.getElementById('addContractNumTag').value || '').trim();
    var statusEl = document.getElementById('addContractStatus');
    var statusVal = (statusEl && statusEl.value ? statusEl.value : '신청').trim() || '신청';
    var refNoEl = document.getElementById('addContractRefNo');
    var refNoVal = (statusVal === '선정' && refNoEl) ? (refNoEl.value || '').trim() : '';
    var assigneeEl = document.getElementById('addContractAssignee');
    var assigneeIdVal = (statusVal === '선정' && assigneeEl && assigneeEl.value) ? (assigneeEl.value.trim() || null) : null;
    if (assigneeIdVal === '') assigneeIdVal = null;
    var companyName = (document.getElementById('addContractCompanyName') && document.getElementById('addContractCompanyName').value || '').trim();
    var brandName = (document.getElementById('addContractBrandName') && document.getElementById('addContractBrandName').value || '').trim();
    var corpSizeEl = document.getElementById('addContractCompanyType');
    var corpSizeVal = corpSizeEl && corpSizeEl.value ? corpSizeEl.value : 'mid';
    var yearsEl = document.getElementById('addContractYears');
    var yearsVal = yearsEl && yearsEl.value ? yearsEl.value : 'over_7y';

    var CORP_KEY_TO_LABEL = { small: '소기업', mid: '중기업', midlarge: '중견기업', large: '대기업' };
    var YEARS_KEY_TO_LABEL = { under_3y: '3년미만', year_3: '3년차', year_5: '5년차', over_7y: '7년 이상' };
    var corpSizeLabel = CORP_KEY_TO_LABEL[corpSizeVal] || '중기업';
    var yearsLabel = YEARS_KEY_TO_LABEL[yearsVal] || '7년 이상';

    var totalBudget = parseAddContractNumber((document.getElementById('addContractTotalAmount') && document.getElementById('addContractTotalAmount').value) || 0);
    var totalCost = parseAddContractNumber((document.getElementById('addContractTotalCostDisplay') && document.getElementById('addContractTotalCostDisplay').textContent) || 0);
    var vat = parseAddContractNumber((document.getElementById('addContractVatDisplay') && document.getElementById('addContractVatDisplay').textContent) || 0);
    var projectExpense = parseAddContractNumber((document.getElementById('addContractProjectExpenseDisplay') && document.getElementById('addContractProjectExpenseDisplay').textContent) || 0);
    var govSupport = parseAddContractNumber((document.getElementById('addContractGovSupportDisplay') && document.getElementById('addContractGovSupportDisplay').textContent) || 0);
    var corpKind = parseAddContractNumber((document.getElementById('addContractCompanyInKindDisplay') && document.getElementById('addContractCompanyInKindDisplay').textContent) || 0);
    var corpCash = parseAddContractNumber((document.getElementById('addContractCompanyCashDisplay') && document.getElementById('addContractCompanyCashDisplay').textContent) || 0);

    var tbody = document.getElementById('addContractPersonnelBody');
    var participationRate = [];
    var participationRows = [];
    if (tbody) {
        tbody.querySelectorAll('tr').forEach(function (tr) {
            var idInput = tr.querySelector('.add-contract-personnel-id');
            var rateInp = tr.querySelector('.add-contract-rate');
            var periodInp = tr.querySelector('.add-contract-period');
            var pid = idInput && idInput.value ? idInput.value : '';
            var rate = parseAddContractRate(rateInp && rateInp.value ? rateInp.value : 0);
            var period = (periodInp && periodInp.value ? periodInp.value : '').trim();
            if (!pid) return;
            var p = addContractPersonnelList.filter(function (x) { return String(x.id) === String(pid); })[0];
            var name = p ? (p.name || '').trim() : '';
            participationRate.push({ name: name, rate: rate, period: period });
            participationRows.push({ personnel_id: parseInt(pid, 10), rate: rate });
        });
    }

    var inKindPersonnel = [];
    var inKindTbody = document.getElementById('addContractInKindPersonnelBody');
    if (inKindTbody) {
        inKindTbody.querySelectorAll('tr').forEach(function (tr) {
            var roleSel = tr.querySelector('.add-contract-inkind-role');
            var nameInp = tr.querySelector('.add-contract-inkind-name');
            var rateInp = tr.querySelector('.add-contract-inkind-rate');
            var periodInp = tr.querySelector('.add-contract-inkind-period');
            var position = (roleSel && roleSel.value ? roleSel.value : '').trim();
            var name = (nameInp && nameInp.value ? nameInp.value : '').trim();
            var rate = parseAddContractRate(rateInp && rateInp.value ? rateInp.value : 0);
            var period = (periodInp && periodInp.value ? periodInp.value : '').trim();
            inKindPersonnel.push({ position: position, name: name, rate: rate, period: period });
        });
    }

    var row = {
        target_table: projectKey,
        company_name: companyName,
        brand_name: brandName,
        num_tag: numTag,
        status: statusVal,
        ref_no: statusVal === '선정' ? (refNoVal || null) : null,
        assignee_id: statusVal === '선정' ? assigneeIdVal : null,
        years: yearsLabel,
        corp_size: corpSizeLabel,
        total_budget: totalBudget,
        total_cash: totalCost,
        vat: vat,
        sum_p: projectExpense,
        gov_contribution: govSupport,
        corp_kind: corpKind,
        corp_cash: corpCash,
        participation_rate: participationRate.length ? participationRate : null,
        in_kind_personnel: inKindPersonnel.length ? inKindPersonnel : null
    };
    if (totalBudget > 0) {
        row.cash_ratio = corpCash / totalBudget;
        row.kind_ratio = corpKind / totalBudget;
    }

    function onSaveDone() {
        closeAddContractModal();
        loadStatusSummary();
        loadPersonnelTable();
        if (typeof loadContractDetailApplicationTable === 'function') loadContractDetailApplicationTable();
        if (typeof loadContractDetailAmountTable === 'function') loadContractDetailAmountTable();
        if (typeof loadContractDetailList === 'function') loadContractDetailList();
        if (typeof loadAgreementList === 'function') loadAgreementList();
    }
    var editingId = _addContractEditingId;

    if (editingId) {
        var updateRow = Object.assign({}, row);
        _supabase.from('page3_participation').select('personnel_id').eq('contract_id', editingId).then(function (oldRes) {
            var oldIds = (oldRes && oldRes.data) ? oldRes.data.map(function (x) { return x.personnel_id; }) : [];
            _supabase.from('contract_registry').update(updateRow).eq('id', editingId).then(function (res) {
                if (res.error) {
                    alert('수정 실패: ' + (res.error.message || ''));
                    return;
                }
                _supabase.from('page3_participation').delete().eq('contract_id', editingId).then(function () {
                    var newIds = participationRows.map(function (r) { return r.personnel_id; });
                    var affectedIds = oldIds.concat(newIds).filter(function (id, i, arr) { return arr.indexOf(id) === i; });
                    if (participationRows.length > 0) {
                        var toInsert = participationRows.map(function (r) { return { contract_id: editingId, personnel_id: r.personnel_id, rate: r.rate }; });
                        _supabase.from('page3_participation').insert(toInsert).then(function (partRes) {
                            if (partRes.error) alert('참여율 저장 일부 실패: ' + (partRes.error.message || ''));
                            updatePersonnelMasterRates(projectKey, affectedIds).then(onSaveDone).catch(onSaveDone);
                        });
                    } else {
                        updatePersonnelMasterRates(projectKey, affectedIds).then(onSaveDone).catch(onSaveDone);
                    }
                });
            }).catch(function (err) {
                alert('수정 실패: ' + (err && err.message ? err.message : String(err)));
            });
        });
        return;
    }

    _supabase.from('contract_registry').insert(row).select('id').single().then(function (res) {
        if (res.error) {
            alert('저장 실패: ' + (res.error.message || ''));
            return;
        }
        var newId = res.data && res.data.id;
        if (!newId) {
            onSaveDone();
            return;
        }
        if (participationRows.length > 0) {
            var toInsert = participationRows.map(function (r) { return { contract_id: newId, personnel_id: r.personnel_id, rate: r.rate }; });
            _supabase.from('page3_participation').insert(toInsert).then(function (partRes) {
                if (partRes.error) alert('참여율 저장 일부 실패: ' + (partRes.error.message || ''));
                var affectedIds = participationRows.map(function (r) { return r.personnel_id; }).filter(function (id, i, arr) { return arr.indexOf(id) === i; });
                updatePersonnelMasterRates(projectKey, affectedIds).then(onSaveDone).catch(onSaveDone);
            });
        } else {
            onSaveDone();
        }
    }).catch(function (err) {
        alert('저장 실패: ' + (err && err.message ? err.message : String(err)));
    });
}

function updatePersonnelMasterRates(projectKey, personnelIds) {
    if (!personnelIds || personnelIds.length === 0) return Promise.resolve();
    return Promise.all([
        _supabase.from('page3_participation').select('personnel_id, contract_id, rate').in('personnel_id', personnelIds),
        _supabase.from('contract_registry').select('id, company_name, brand_name, status').eq('target_table', projectKey)
    ]).then(function (results) {
        var partList = (results[0] && results[0].data) ? results[0].data : [];
        var contracts = (results[1] && results[1].data) ? results[1].data : [];
        var contractById = {};
        contracts.forEach(function (c) { contractById[c.id] = c; });
        var byPersonnel = {};
        partList.forEach(function (p) {
            var c = contractById[p.contract_id];
            if (!c || (c.status !== '신청' && c.status !== '선정')) return;
            if (!byPersonnel[p.personnel_id]) byPersonnel[p.personnel_id] = { total: 0, join: [] };
            byPersonnel[p.personnel_id].total += Number(p.rate) || 0;
            byPersonnel[p.personnel_id].join.push([c.company_name || '', c.brand_name || '', Number(p.rate) || 0]);
        });
        var updates = [];
        personnelIds.forEach(function (pid) {
            var id = parseInt(pid, 10);
            if (isNaN(id)) return;
            var o = byPersonnel[pid];
            var total = o ? o.total : 0;
            total = Math.round(total * 1000) / 1000;
            var join = o && o.join && o.join.length ? o.join : null;
            updates.push(_supabase.from('personnel_master').update({ total_rate: total, join_contract: join }).eq('id', id).eq('target_table', projectKey));
        });
        return updates.length > 0 ? Promise.all(updates) : Promise.resolve();
    });
}

function filterPersonnelDetailTable() {
    renderPersonnelDetailRows(personnelDetailListCache, personnelDetailEditMode);
}

var CORP_SIZES = [{ key: 'small', label: '소기업' }, { key: 'mid', label: '중기업' }, { key: 'midlarge', label: '중견기업' }, { key: 'large', label: '대기업' }];
var CASH_KIND_KEYS = ['cash_under_3y', 'kind_under_3y', 'cash_year_3', 'kind_year_3', 'cash_year_5', 'kind_year_5', 'cash_over_7y', 'kind_over_7y'];

function formatSalaryDisplay(n) {
    var num = parseInt(n, 10);
    if (isNaN(num) || num === 0) return '';
    return num.toLocaleString('ko-KR');
}
function parseSalaryInput(str) {
    if (typeof str !== 'string') return 0;
    var cleaned = str.replace(/,/g, '').replace(/\s/g, '');
    var num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
}
function bindSalaryFormatBlur() {
    document.querySelectorAll('.salary-format-input').forEach(function (el) {
        el.removeEventListener('blur', _salaryFormatBlur);
        el.addEventListener('blur', _salaryFormatBlur);
    });
}
function _salaryFormatBlur() {
    var v = parseSalaryInput(this.value);
    this.value = v ? formatSalaryDisplay(v) : '';
}

function openRoleSalaryModal() {
    var targetTable = getProjectKey();
    var titleEl = document.getElementById('salary_modal_title');
    var maxSupportInput = document.getElementById('salary_modal_max_support_amount');
    var seniorInput = document.getElementById('salary_modal_senior');
    var researcherInput = document.getElementById('salary_modal_researcher');
    var assistantInput = document.getElementById('salary_modal_assistant');
    if (titleEl) titleEl.textContent = (typeof window.projectKeyName !== 'undefined' && window.projectKeyName) ? window.projectKeyName : (targetTable || '—');
    _supabase.from('gateways').select('keyword, target_table').eq('target_page', 'page3').then(function (res) {
        var row = (res.data || []).find(function (r) { return (r.target_table || '') === targetTable; });
        if (titleEl && row && (row.keyword || '').trim()) titleEl.textContent = row.keyword.trim();
    });
    if (maxSupportInput) maxSupportInput.value = '';
    if (seniorInput) seniorInput.value = formatSalaryDisplay(ROLE_SALARY_DEFAULTS['책임연구원'] || 0);
    if (researcherInput) researcherInput.value = formatSalaryDisplay(ROLE_SALARY_DEFAULTS['연구원'] || 0);
    if (assistantInput) assistantInput.value = formatSalaryDisplay(ROLE_SALARY_DEFAULTS['보조연구원'] || 0);
    bindSalaryFormatBlur();
    CORP_SIZES.forEach(function (c) {
        CASH_KIND_KEYS.forEach(function (k) {
            var el = document.getElementById(k + '_' + c.key);
            if (el) el.value = 0;
        });
    });
    var dropWrap = document.getElementById('salary_load_dropdown_wrap');
    if (dropWrap) dropWrap.style.display = 'none';
    var sel = document.getElementById('salary_load_keyword_select');
    if (sel) sel.value = '';
    fillSalaryModalFromConfig(targetTable);
    document.getElementById('roleSalaryModal').style.display = 'flex';
}

function fillSalaryModalFromConfig(targetTable) {
    var maxSupportInput = document.getElementById('salary_modal_max_support_amount');
    var seniorInput = document.getElementById('salary_modal_senior');
    var researcherInput = document.getElementById('salary_modal_researcher');
    var assistantInput = document.getElementById('salary_modal_assistant');
    _supabase.from('salary_config').select('corp_size, max_support_amount, salary_senior, salary_researcher, salary_assistant, cash_under_3y, kind_under_3y, cash_year_3, kind_year_3, cash_year_5, kind_year_5, cash_over_7y, kind_over_7y').eq('target_table', targetTable).then(function (res) {
        var rows = (res.data || []);
        if (rows.length > 0) {
            var first = rows[0];
            if (maxSupportInput) maxSupportInput.value = formatSalaryDisplay(Number(first.max_support_amount) || 0);
            if (seniorInput) seniorInput.value = formatSalaryDisplay(Number(first.salary_senior) || 0);
            if (researcherInput) researcherInput.value = formatSalaryDisplay(Number(first.salary_researcher) || 0);
            if (assistantInput) assistantInput.value = formatSalaryDisplay(Number(first.salary_assistant) || 0);
        }
        rows.forEach(function (r) {
            var c = r.corp_size;
            CASH_KIND_KEYS.forEach(function (k) {
                var el = document.getElementById(k + '_' + c);
                if (el && r[k] != null) el.value = Number(r[k]) || 0;
            });
        });
    });
}

function toggleSalaryLoadDropdown() {
    var wrap = document.getElementById('salary_load_dropdown_wrap');
    var sel = document.getElementById('salary_load_keyword_select');
    if (!wrap || !sel) return;
    if (wrap.style.display === 'none' || !wrap.style.display) {
        if (sel.options.length <= 1) {
            _supabase.from('gateways').select('id, keyword, target_table').eq('target_page', 'page3').order('keyword').then(function (res) {
                var list = (res.data || []).filter(function (r) { return (r.keyword || '').trim() !== '보호원'; });
                sel.innerHTML = '<option value="">키워드 선택</option>' + list.map(function (r) {
                    var kw = (r.keyword || r.target_table || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return '<option value="' + (r.target_table || '').replace(/"/g, '&quot;') + '">' + kw + '</option>';
                }).join('');
                wrap.style.display = 'inline-block';
            });
        } else {
            wrap.style.display = 'inline-block';
        }
    } else {
        wrap.style.display = 'none';
    }
}

function onSalaryLoadKeywordSelect() {
    var sel = document.getElementById('salary_load_keyword_select');
    var wrap = document.getElementById('salary_load_dropdown_wrap');
    var targetTable = (sel && sel.value) ? sel.value.trim() : '';
    if (!targetTable) return;
    fillSalaryModalFromConfig(targetTable);
    if (wrap) wrap.style.display = 'none';
    if (sel) sel.value = '';
}

function closeRoleSalaryModal() {
    document.getElementById('roleSalaryModal').style.display = 'none';
}

function saveRoleSalary() {
    var targetTable = getProjectKey();
    var maxSupport = parseSalaryInput(document.getElementById('salary_modal_max_support_amount').value);
    var salarySenior = parseSalaryInput(document.getElementById('salary_modal_senior').value);
    var salaryResearcher = parseSalaryInput(document.getElementById('salary_modal_researcher').value);
    var salaryAssistant = parseSalaryInput(document.getElementById('salary_modal_assistant').value);
    var rows = CORP_SIZES.map(function (c) {
        var row = {
            target_table: targetTable,
            corp_size: c.key,
            max_support_amount: maxSupport,
            salary_senior: salarySenior,
            salary_researcher: salaryResearcher,
            salary_assistant: salaryAssistant
        };
        CASH_KIND_KEYS.forEach(function (k) {
            var el = document.getElementById(k + '_' + c.key);
            row[k] = el ? (parseInt(el.value, 10) || 0) : 0;
        });
        return row;
    });
    _supabase.from('salary_config').delete().eq('target_table', targetTable).then(function (delRes) {
        _supabase.from('salary_config').insert(rows).then(function (res) {
            if (res.error) { alert('저장 실패: ' + (res.error.message || '')); return; }
            alert('저장되었습니다. (동일 target_table 기존 4행 덮어쓰기)');
            closeRoleSalaryModal();
            loadStatusSummary();
            loadPersonnelTable();
        });
    });
}

window.onload = function () {
    if (window.page3Ready) window.page3Ready();
    var titleEl = document.getElementById('projectTitle');
    if (titleEl) titleEl.innerText = (window.projectKeyName || window.tableName || '').trim() || '—';
    var keyDisplay = document.getElementById('currentKeyDisplay');
    if (keyDisplay) keyDisplay.textContent = (window.projectKeyName || window.tableName || '').trim() || '-';
    loadPage3Keywords();
    loadStatusSummary();
    loadPersonnelTable();
    loadContractDetailApplicationTable();
    loadContractDetailAmountTable();
    loadContractDetailList();
    bindJoinContractCellTooltip();
};

function bindJoinContractCellTooltip() {
    var tooltip = document.getElementById('joinContractFullTooltip');
    if (!tooltip) return;
    var activeCell = null;
    var offsetX = 14;
    var offsetY = 8;

    function showTooltip(cell, x, y) {
        var raw = cell.getAttribute('data-join-tooltip');
        var fullText = raw ? raw.replace(/\|\|/g, '\n') : '';
        if (!fullText || fullText === '—') return;
        tooltip.textContent = fullText;
        tooltip.classList.add('is-visible');
        positionTooltip(x, y);
        activeCell = cell;
    }

    function positionTooltip(x, y) {
        var w = tooltip.offsetWidth || 200;
        var h = tooltip.offsetHeight || 100;
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var left = x + offsetX;
        var top = y + offsetY;
        if (left + w > vw) left = x - w - offsetX;
        if (top + h > vh) top = vh - h - 8;
        if (left < 8) left = 8;
        if (top < 8) top = 8;
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    function hideTooltip() {
        tooltip.classList.remove('is-visible');
        tooltip.textContent = '';
        activeCell = null;
    }

    document.addEventListener('mouseover', function (e) {
        var cell = e.target.closest('.col-join');
        if (!cell) return;
        if (!cell.closest('#personnelDetailModal') && !cell.closest('#addContractSelectPersonnelModal')) return;
        showTooltip(cell, e.clientX, e.clientY);
    });

    document.addEventListener('mouseout', function (e) {
        var cell = e.target.closest('.col-join');
        var to = e.relatedTarget;
        if (cell && (!to || !cell.contains(to))) {
            if (activeCell === cell) hideTooltip();
        }
    });

    document.addEventListener('mousemove', function (e) {
        if (!activeCell || !tooltip.classList.contains('is-visible')) return;
        positionTooltip(e.clientX, e.clientY);
    });
}

var PAGE3_SECTION_IDS = ['feature1', 'feature2', 'settings'];
var PAGE3_SECTION_STORAGE_KEY = 'page3_last_section';


function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(function (el) { el.classList.remove('active'); });
    document.querySelectorAll('.menu-item').forEach(function (el) { el.classList.remove('active'); });
    var section = document.getElementById(sectionId);
    if (section) section.classList.add('active');
    var menuItem = document.querySelector('.menu-item[onclick*="' + sectionId + '"]');
    if (menuItem) menuItem.classList.add('active');
    try {
        var key = PAGE3_SECTION_STORAGE_KEY + (getProjectKey() ? '_' + getProjectKey() : '');
        if (sectionId && PAGE3_SECTION_IDS.indexOf(sectionId) !== -1) sessionStorage.setItem(key, sectionId);
    } catch (e) {}
    if (sectionId === 'settings') {
        loadPage3Keywords();
    }
    if (sectionId === 'feature1') {
        loadStatusSummary();
        loadPersonnelTable();
        loadContractDetailApplicationTable();
        loadContractDetailAmountTable();
        loadContractDetailList();
    }
    if (sectionId === 'feature2') loadAgreementList();
}

function goToGateway() {
    if (confirm('로그아웃하시겠습니까?')) window.location.replace('index.html');
}

function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    document.querySelector('.toggle-btn').innerText = sidebar.classList.contains('collapsed') ? '▶' : '◀';
}

function loadPage3Keywords() {
    var tbody = document.getElementById('keywordTableBody');
    if (!tbody) return;
    if (!_supabase) {
        tbody.innerHTML = '<tr><td colspan="2" style="padding: 24px; text-align: center; color: #e53e3e;">Supabase 연결 불가. config.js API 키를 확인하세요.</td></tr>';
        return;
    }
    tbody.innerHTML = '<tr><td colspan="4" style="padding: 24px; text-align: center; color: #94a3b8;">불러오는 중...</td></tr>';
    _supabase.from('gateways').select('id, keyword, target_table, created_at').eq('target_page', 'page3').order('id', { ascending: false }).then(function (res) {
        if (res.error) {
            tbody.innerHTML = '<tr><td colspan="2" style="padding: 24px; text-align: center; color: #e53e3e;">로드 실패: ' + (res.error.message || '') + '</td></tr>';
            return;
        }
        var raw = res.data || [];
        page3KeywordList = raw.filter(function (row) { return (row.keyword || '').trim() !== '보호원'; });
        page3KeywordListFiltered = page3KeywordList.slice();
        renderKeywordTable();
    });
}

function renderKeywordTable() {
    var tbody = document.getElementById('keywordTableBody');
    var list = page3KeywordListFiltered;
    if (!tbody) return;
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="padding: 24px; text-align: center; color: #94a3b8;">등록된 키워드가 없습니다.</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(function (row) {
        var kw = (row.keyword || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return '<tr><td style="padding: 10px;"><input type="checkbox" class="keyword-row-cb" data-id="' + row.id + '"></td><td style="padding: 10px; text-align: left;">' + kw + '</td></tr>';
    }).join('');
    var cbAll = document.getElementById('keywordSelectAll');
    if (cbAll) cbAll.checked = false;
}

function filterKeywordTable() {
    var q = (document.getElementById('keywordSearchInput') || {}).value.trim().toLowerCase();
    if (!q) {
        page3KeywordListFiltered = page3KeywordList.slice();
    } else {
        page3KeywordListFiltered = page3KeywordList.filter(function (row) {
            return (row.keyword || '').toLowerCase().includes(q) || (row.target_table || '').toLowerCase().includes(q);
        });
    }
    renderKeywordTable();
}

function toggleKeywordSelectAll(checkbox) {
    document.querySelectorAll('.keyword-row-cb').forEach(function (cb) { cb.checked = checkbox.checked; });
}

function openAddKeywordModal() {
    document.getElementById('newKeywordInput').value = '';
    document.getElementById('newTargetTableInput').value = '';
    document.getElementById('addKeywordModal').style.display = 'flex';
}

function closeAddKeywordModal() {
    document.getElementById('addKeywordModal').style.display = 'none';
}

function saveAddKeyword() {
    var keyword = (document.getElementById('newKeywordInput').value || '').trim();
    var targetTable = (document.getElementById('newTargetTableInput').value || '').trim();
    if (!keyword || !targetTable) {
        alert('키워드와 영문 닉네임을 모두 입력하세요.');
        return;
    }
    var nicknameRegex = /^[a-zA-Z0-9_]+$/;
    if (!nicknameRegex.test(targetTable)) {
        alert('영문 닉네임은 영문, 숫자, _ 만 사용 가능합니다.');
        return;
    }
    _supabase.from('gateways').insert([{ keyword: keyword, target_table: targetTable, target_page: 'page3' }]).then(function (res) {
        if (res.error) {
            alert(res.error.code === '23505' ? '이미 존재하는 키워드입니다.' : '저장 실패: ' + (res.error.message || ''));
            return;
        }
        alert('키워드가 추가되었습니다.');
        closeAddKeywordModal();
        loadPage3Keywords();
    });
}

function deleteSelectedKeywords() {
    var checked = document.querySelectorAll('.keyword-row-cb:checked');
    if (!checked.length) {
        alert('삭제할 항목을 선택하세요.');
        return;
    }
    window._keywordIdsToDelete = Array.from(checked).map(function (c) { return c.getAttribute('data-id'); });
    document.getElementById('deletePasswordInput').value = '';
    document.getElementById('deleteKeywordModal').style.display = 'flex';
}

function closeDeleteKeywordModal() {
    window._keywordIdsToDelete = null;
    document.getElementById('deleteKeywordModal').style.display = 'none';
}

function confirmDeleteKeywords() {
    var ids = window._keywordIdsToDelete;
    var pw = (document.getElementById('deletePasswordInput').value || '').trim();
    if (!ids || !ids.length) { closeDeleteKeywordModal(); return; }
    if (!pw) {
        alert('관리자 비밀번호를 입력하세요.');
        return;
    }
    _supabase.from('system_settings').select('value').eq('key', 'admin_password').single().then(function (res) {
        if (res.error || !res.data || res.data.value !== pw) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }
        _supabase.from('gateways').delete().in('id', ids).then(function (delRes) {
            if (delRes.error) {
                alert('삭제 실패: ' + (delRes.error.message || ''));
                return;
            }
            alert('삭제되었습니다.');
            closeDeleteKeywordModal();
            loadPage3Keywords();
        });
    });
}
