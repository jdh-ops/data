var page3KeywordList = [];
var page3KeywordListFiltered = [];
var _supabase = window._supabase;

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
        tbody.innerHTML = '<tr><td colspan="5" style="border: 1px solid #e2e8f0; padding: 16px; text-align: center; color: #e53e3e;">연결 불가.</td></tr>';
        return;
    }
    var projectKey = getProjectKey();
    tbody.innerHTML = '<tr><td colspan="5" style="border: 1px solid #e2e8f0; padding: 16px; text-align: center; color: #94a3b8;">데이터를 불러오는 중...</td></tr>';
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
            tbody.innerHTML = '<tr><td style="border: 1px solid #e2e8f0; padding: 10px 12px;">—</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right;">—</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right;">—</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right;">—</td><td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right;">—</td></tr>';
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
            return '<tr><td style="border: 1px solid #e2e8f0; padding: 8px 6px;">' + tagEsc + '</td><td style="' + numCellStyle + '">' + fmt(g.total_budget) + '</td><td style="' + numCellStyle + '">' + fmt(g.gov_contribution) + '</td><td style="' + numCellStyle + '">' + fmt(g.corp_cash) + '</td><td style="' + numCellStyle + '">' + fmt(g.corp_kind) + '</td></tr>';
        }).join('') + '<tr style="background: #f8fafc; font-weight: 600;"><td style="border: 1px solid #e2e8f0; padding: 8px 6px;">합계</td><td style="' + numCellStyle + '">' + fmt(sumTotal) + '</td><td style="' + numCellStyle + '">' + fmt(sumGov) + '</td><td style="' + numCellStyle + '">' + fmt(sumCash) + '</td><td style="' + numCellStyle + '">' + fmt(sumKind) + '</td></tr>';
    }).catch(function () {
        tbody.innerHTML = '<tr><td colspan="5" style="border: 1px solid #e2e8f0; padding: 16px; text-align: center; color: #e53e3e;">로드 실패.</td></tr>';
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

var personnelDetailListCache = [];
var personnelDetailEditMode = false;
var personnelDetailOriginalIds = [];
var PERSONNEL_DETAIL_ROLES = ['책임연구원', '연구원', '연구보조원'];
var PERSONNEL_ROLE_ORDER = { '책임연구원': 0, '연구원': 1, '연구보조원': 2 };

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
        if (Array.isArray(item)) return [(item[0] != null) ? String(item[0]) : '', (item[1] != null) ? String(item[1]) : '', (item[2] != null) ? String(item[2]) : ''].join(' ');
        if (item && typeof item === 'object') return [item.company || item.회사명 || '', item.brand || item.브랜드명 || '', item.rate != null ? String(item.rate) : (item.참여율 != null ? String(item.참여율) : '')].join(' ');
        return '';
    }).filter(Boolean).join(' ');
}
function formatJoinContractTags(joinContract) {
    if (joinContract == null) return '';
    var arr = Array.isArray(joinContract) ? joinContract : [];
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
    return '<span style="display: flex; flex-wrap: wrap; align-items: center; gap: 4px;">' + spans.join('') + '</span>';
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
            p._cumulative = (p.total_rate != null && p.total_rate !== '') ? Number(p.total_rate) : cum;
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
                p._cumulative = cum;
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
            var cumStr = (p._cumulative != null) ? (Number(p._cumulative) + '%') : '—';
            var restStr = (p._rest != null) ? (Number(p._rest) + '%') : '—';
            var tags = formatJoinContractTags(p.join_contract) || '—';
            return '<tr data-id="' + (p.id != null ? p.id : '') + '" data-new="' + (p.id == null ? '1' : '0') + '"><td class="col-checkbox"><input type="checkbox" class="personnel-detail-row-cb"></td><td class="col-role"><select class="personnel-detail-position" style="border: 1px solid #cbd5e0; border-radius: 4px;">' + opts + '</select></td><td class="col-name"><input type="text" class="personnel-detail-name" value="' + nameVal + '" placeholder="이름" style="border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;"></td><td class="col-cumulative">' + cumStr + '</td><td class="col-rest">' + restStr + '</td><td class="col-join">' + tags + '</td></tr>';
        }).join('');
    } else {
        tbody.innerHTML = list.map(function (p) {
            var cumStr = (p._cumulative != null) ? (Number(p._cumulative) + '%') : '—';
            var restStr = (p._rest != null) ? (Number(p._rest) + '%') : '—';
            var tags = formatJoinContractTags(p.join_contract) || '—';
            return '<tr><td class="col-role">' + (p.position || '').replace(/</g, '&lt;') + '</td><td class="col-name">' + (p.name || '').replace(/</g, '&lt;') + '</td><td class="col-cumulative">' + cumStr + '</td><td class="col-rest">' + restStr + '</td><td class="col-join">' + tags + '</td></tr>';
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
            openAddContractModal(id);
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

function openAddContractModal(contractId) {
    var modal = document.getElementById('addContractModal');
    var titleEl = document.getElementById('addContractModalTitle');
    var tbody = document.getElementById('addContractPersonnelBody');
    if (!modal) return;
    modal.style.display = 'flex';
    _addContractEditingId = contractId || null;
    if (titleEl) titleEl.textContent = _addContractEditingId ? '협약 수정' : '협약 추가';
    var deleteBtn = document.getElementById('addContractDeleteBtn');
    if (deleteBtn) deleteBtn.style.display = _addContractEditingId ? 'inline-block' : 'none';
    var statusEl = document.getElementById('addContractStatus');
    if (statusEl && !_addContractEditingId) statusEl.value = '신청';
    var refNoEl = document.getElementById('addContractRefNo');
    if (refNoEl) refNoEl.value = getRefNoDefault();
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
        toggleAddContractRefNo();
        updateAddContractFinancialTable();
    }
    var promises = [
        _supabase.from('personnel_master').select('id, position, name, total_rate, rest_rate').eq('target_table', projectKey),
        _supabase.from('salary_config').select('corp_size, max_support_amount, salary_senior, salary_researcher, salary_assistant, cash_under_3y, kind_under_3y, cash_year_3, kind_year_3, cash_year_5, kind_year_5, cash_over_7y, kind_over_7y').eq('target_table', projectKey),
        _addContractEditingId ? _supabase.from('page3_participation').select('personnel_id, rate').eq('contract_id', _addContractEditingId) : Promise.resolve({ data: [] }),
        _addContractEditingId ? _supabase.from('contract_registry').select('*').eq('id', _addContractEditingId).single() : Promise.resolve({ data: null })
    ];
    Promise.all(promises).then(function (results) {
        var personnelRes = results[0];
        var salaryRes = results[1];
        var partRes = results[2];
        var contractRes = results[3];
        if (personnelRes && personnelRes.error) console.warn('personnel_master 조회 오류:', personnelRes.error);
        addContractPersonnelList = (personnelRes && !personnelRes.error && personnelRes.data) ? personnelRes.data : [];
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
        applyPersonnelAndSalary(partRows.length ? partRows : null);
        fillContractForm(contract);
    }).catch(function (err) {
        console.error('협약 추가 모달 로드 실패:', err);
    });
}
function setAddContractRowPersonnel(tr, personnelId) {
    var idInput = tr && tr.querySelector('.add-contract-personnel-id');
    var nameSpan = tr && tr.querySelector('.add-contract-name-display');
    if (idInput) idInput.value = personnelId != null ? String(personnelId) : '';
    if (nameSpan) {
        if (!personnelId) { nameSpan.textContent = ''; return; }
        var p = addContractPersonnelList.filter(function (x) { return String(x.id) === String(personnelId); })[0];
        nameSpan.textContent = p ? (p.name || '').trim() : '';
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
    var p = addContractPersonnelList.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!roleCell) return;
    if (!p) {
        roleCell.textContent = '';
        if (cumCell) cumCell.textContent = '';
        if (restCell) restCell.textContent = '';
        return;
    }
    roleCell.textContent = p.position || '';
    if (cumCell) cumCell.textContent = (p.total_rate != null && p.total_rate !== '') ? (Number(p.total_rate) + '%') : '—';
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
    var cost = Math.floor(salary * (rate / 100) * period);
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
    var vat = Math.floor(projectExpense / 11);
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
function setAddContractDisplay(id, num) {
    var el = document.getElementById(id);
    if (el) el.textContent = (num != null && num !== '') ? (num === 0 ? '0' : num.toLocaleString('ko-KR')) : '';
}
function recalcAddContractCosts() {
    var tbody = document.getElementById('addContractPersonnelBody');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(function (tr) { calcAddContractRowCost(tr); });
    updateAddContractSubtotal();
    if (typeof updateAddContractFinancialTable === 'function') updateAddContractFinancialTable();
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

function openAddContractSelectPersonnelModal() {
    var modal = document.getElementById('addContractSelectPersonnelModal');
    if (!modal) return;
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
            p._cumulative = (p.total_rate != null && p.total_rate !== '') ? Number(p.total_rate) : cum;
            p._rest = (p.rest_rate != null && p.rest_rate !== '') ? Number(p.rest_rate) : null;
        });
        addContractSelectPersonnelListCache = list;
        renderAddContractSelectPersonnelTable(list);
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
        var cumStr = (p._cumulative != null) ? (Number(p._cumulative) + '%') : '—';
        var restStr = (p._rest != null) ? (Number(p._rest) + '%') : '—';
        var tags = formatJoinContractTags(p.join_contract) || '—';
        var posSafe = (p.position || '').replace(/</g, '&lt;');
        var nameSafe = (p.name || '').replace(/</g, '&lt;');
        return '<tr data-personnel-id="' + (p.id != null ? p.id : '') + '"><td style="border:1px solid #e2e8f0;padding:6px 8px;text-align:center;width:36px;"><input type="checkbox" class="add-contract-select-personnel-cb"></td><td style="border:1px solid #e2e8f0;padding:6px 8px;width:72px;">' + posSafe + '</td><td style="border:1px solid #e2e8f0;padding:6px 8px;width:72px;">' + nameSafe + '</td><td style="border:1px solid #e2e8f0;padding:6px 8px;width:48px;">' + cumStr + '</td><td style="border:1px solid #e2e8f0;padding:6px 8px;width:48px;">' + restStr + '</td><td style="border:1px solid #e2e8f0;padding:6px 8px;">' + tags + '</td></tr>';
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
    updateAddContractFinancialTable();

    var numTag = (document.getElementById('addContractNumTag') && document.getElementById('addContractNumTag').value || '').trim();
    var statusEl = document.getElementById('addContractStatus');
    var statusVal = (statusEl && statusEl.value ? statusEl.value : '신청').trim() || '신청';
    var refNoEl = document.getElementById('addContractRefNo');
    var refNoVal = (statusVal === '선정' && refNoEl) ? (refNoEl.value || '').trim() : '';
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
            var rate = parseAddContractNumber(rateInp && rateInp.value ? rateInp.value : 0);
            var period = (periodInp && periodInp.value ? periodInp.value : '').trim();
            if (!pid) return;
            var p = addContractPersonnelList.filter(function (x) { return String(x.id) === String(pid); })[0];
            var name = p ? (p.name || '').trim() : '';
            participationRate.push({ name: name, rate: rate, period: period });
            participationRows.push({ personnel_id: parseInt(pid, 10), rate: rate });
        });
    }

    var row = {
        target_table: projectKey,
        company_name: companyName,
        brand_name: brandName,
        num_tag: numTag,
        status: statusVal,
        ref_no: statusVal === '선정' ? (refNoVal || null) : null,
        years: yearsLabel,
        corp_size: corpSizeLabel,
        total_budget: totalBudget,
        total_cash: totalCost,
        vat: vat,
        sum_p: projectExpense,
        gov_contribution: govSupport,
        corp_kind: corpKind,
        corp_cash: corpCash,
        participation_rate: participationRate.length ? participationRate : null
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
    var titleEl = document.getElementById('projectTitle');
    if (titleEl && typeof window.projectKeyName !== 'undefined') titleEl.innerText = window.projectKeyName;
    var keyDisplay = document.getElementById('currentKeyDisplay');
    if (keyDisplay) keyDisplay.textContent = window.projectKeyName || window.tableName || '-';
    loadPage3Keywords();
    loadStatusSummary();
    loadPersonnelTable();
    loadContractDetailApplicationTable();
    loadContractDetailAmountTable();
    loadContractDetailList();
};

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(function (el) { el.classList.remove('active'); });
    document.querySelectorAll('.menu-item').forEach(function (el) { el.classList.remove('active'); });
    var section = document.getElementById(sectionId);
    if (section) section.classList.add('active');
    var menuItem = document.querySelector('.menu-item[onclick*="' + sectionId + '"]');
    if (menuItem) menuItem.classList.add('active');
    if (sectionId === 'settings') loadPage3Keywords();
    if (sectionId === 'feature1') {
        loadStatusSummary();
        loadPersonnelTable();
        loadContractDetailApplicationTable();
        loadContractDetailAmountTable();
        loadContractDetailList();
    }
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
