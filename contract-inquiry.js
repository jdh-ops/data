/* contract-inquiry.js — 문의 탭: 리드 목록·상세·활동 로그 (sales_leads / sales_lead_activities) */
(function () {
    /** 드롭다운 파이프라인 단계. 종료 단계는 DB 값 `보류/실패`를 쓰고 화면에는「문의 종료」로 표시 */
    var STAGES = ['문의접수', '검토중', '미팅/제안', '협상', '계약대기'];
    var STAGE_TERMINAL_CONTRACT = '계약전환';
    var STAGE_TERMINAL_END = '보류/실패';
    var STAGE_TERMINAL_END_LABEL = '문의 종료';
    var ACTIVITY_TYPES = [
        { value: 'call', label: '통화' },
        { value: 'email', label: '메일' },
        { value: 'meeting', label: '미팅' },
        { value: 'quote', label: '견적' },
        { value: 'other', label: '기타' }
    ];

    function getTargetTable() {
        return (window.tableName || new URLSearchParams(window.location.search).get('table') || '').trim() || 'default';
    }

    var state = {
        leads: [],
        selectedId: null,
        initialized: false
    };

    function el(id) {
        return document.getElementById(id);
    }

    function resetInquiryDialogLayout(ov) {
        if (!ov) return;
        ov.classList.remove('inquiry-dialog-near-pointer');
        ov.style.alignItems = '';
        ov.style.justifyContent = '';
        var box = ov.querySelector('.inquiry-dialog-box');
        if (box) {
            box.style.position = '';
            box.style.left = '';
            box.style.top = '';
            box.style.margin = '';
            box.style.transform = '';
            box.style.maxHeight = '';
            box.style.visibility = '';
        }
    }

    function hideInquiryDialog() {
        var ov = el('inquiryDialogOverlay');
        if (!ov) return;
        ov.classList.remove('inquiry-dialog-open');
        ov.style.display = 'none';
        resetInquiryDialogLayout(ov);
        var a = el('inquiryDialogActionsAlert');
        var c = el('inquiryDialogActionsConfirm');
        if (a) a.style.display = 'none';
        if (c) c.style.display = 'none';
        ov.onclick = null;
    }

    /** 버튼 근처(아래쪽 우선)에 고정. 추정 크기로 동기 배치 후 한 프레임에 실측으로만 보정해 좌상단 깜빡임 방지 */
    function positionInquiryDialogNearButton(box, buttonEl) {
        if (!box || !buttonEl || typeof buttonEl.getBoundingClientRect !== 'function') return;
        var rect = buttonEl.getBoundingClientRect();
        var pad = 8;
        var gap = 10;
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        box.style.position = 'fixed';
        box.style.margin = '0';
        box.style.transform = 'none';
        box.style.maxHeight = 'min(70vh, calc(100vh - ' + pad * 2 + 'px))';

        function placeWithSize(w, h) {
            w = Math.max(w || 0, 280);
            h = Math.max(h || 0, 100);
            var x = rect.left;
            var y = rect.bottom + gap;
            if (y + h > vh - pad && rect.top - gap - h > pad) {
                y = rect.top - gap - h;
            }
            if (x + w > vw - pad) x = Math.max(pad, vw - w - pad);
            if (x < pad) x = pad;
            if (y + h > vh - pad) y = Math.max(pad, vh - h - pad);
            if (y < pad) y = pad;
            box.style.left = x + 'px';
            box.style.top = y + 'px';
        }

        var wEst = Math.min(400, vw * 0.92);
        var hEst = 160;
        placeWithSize(wEst, hEst);

        requestAnimationFrame(function () {
            var w = box.offsetWidth;
            var h = box.offsetHeight;
            if (w && h) placeWithSize(w, h);
        });
    }

    function showInquiryDialogAlert(msg) {
        return new Promise(function (resolve) {
            var ov = el('inquiryDialogOverlay');
            if (!ov) {
                window.alert(msg);
                resolve();
                return;
            }
            resetInquiryDialogLayout(ov);
            el('inquiryDialogText').textContent = msg;
            el('inquiryDialogActionsAlert').style.display = 'flex';
            el('inquiryDialogActionsConfirm').style.display = 'none';
            ov.style.display = 'flex';
            ov.style.alignItems = 'center';
            ov.style.justifyContent = 'center';
            ov.classList.add('inquiry-dialog-open');
            function done() {
                hideInquiryDialog();
                resolve();
            }
            ov.onclick = function (e) {
                if (e.target === ov) done();
            };
            el('inquiryDialogBtnAlertOk').onclick = function () { done(); };
        });
    }

    /** @param {{ element: Element }=} anchor 버튼 등 DOM 요소 근처에 박스 표시 */
    function showInquiryDialogConfirm(msg, anchor) {
        return new Promise(function (resolve) {
            var ov = el('inquiryDialogOverlay');
            if (!ov) {
                resolve(window.confirm(msg));
                return;
            }
            resetInquiryDialogLayout(ov);
            el('inquiryDialogText').textContent = msg;
            el('inquiryDialogActionsAlert').style.display = 'none';
            el('inquiryDialogActionsConfirm').style.display = 'flex';
            ov.style.display = 'flex';
            ov.classList.add('inquiry-dialog-open');
            var box = ov.querySelector('.inquiry-dialog-box');
            if (anchor && anchor.element && anchor.element.nodeType === 1 && box) {
                ov.classList.add('inquiry-dialog-near-pointer');
                ov.style.alignItems = 'flex-start';
                ov.style.justifyContent = 'flex-start';
                positionInquiryDialogNearButton(box, anchor.element);
            } else {
                ov.style.alignItems = 'center';
                ov.style.justifyContent = 'center';
            }
            function finish(val) {
                hideInquiryDialog();
                resolve(val);
            }
            ov.onclick = function (e) {
                if (e.target === ov) finish(false);
            };
            el('inquiryDialogBtnConfirmNo').onclick = function () { finish(false); };
            el('inquiryDialogBtnConfirmYes').onclick = function () { finish(true); };
        });
    }

    function stageDisplayName(stage) {
        if (stage === STAGE_TERMINAL_END) return STAGE_TERMINAL_END_LABEL;
        return stage || '';
    }

    function stageListBadgeModifier(stage) {
        var s = stage || '';
        if (s === '문의접수') return 'inquiry-badge--s1';
        if (s === '검토중') return 'inquiry-badge--s2';
        if (s === '미팅/제안') return 'inquiry-badge--s3';
        if (s === '협상') return 'inquiry-badge--s4';
        if (s === '계약대기') return 'inquiry-badge--s5';
        if (s === STAGE_TERMINAL_CONTRACT) return 'inquiry-badge--s6';
        if (s === STAGE_TERMINAL_END) return 'inquiry-badge--s7';
        return 'inquiry-badge--s0';
    }

    function activityTypeLabel(value) {
        var row = ACTIVITY_TYPES.find(function (t) { return t.value === value; });
        return row ? row.label : value || '기타';
    }

    function escapeHtml(s) {
        if (s == null || s === '') return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDateTime(iso) {
        if (!iso) return '—';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '—';
            return d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
        } catch (e) {
            return '—';
        }
    }

    function formatDateOnly(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        } catch (e) {
            return '';
        }
    }

    function formatDateInputLocal(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            var pad = function (n) { return n < 10 ? '0' + n : String(n); };
            return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
        } catch (e) {
            return '';
        }
    }

    function parseDateInputLocal(localStr) {
        if (!localStr || !String(localStr).trim()) return null;
        var d = new Date(localStr);
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
    }

    function getContactEntriesFromRow(row) {
        var raw = row.contact_entries;
        if (raw != null && Array.isArray(raw) && raw.length > 0) {
            return raw.map(function (x) {
                return {
                    name: (x && x.name) ? String(x.name) : '',
                    phone: (x && x.phone) ? String(x.phone) : '',
                    email: (x && x.email) ? String(x.email) : ''
                };
            });
        }
        var has = (row.contact_name && String(row.contact_name).trim()) ||
            (row.phone && String(row.phone).trim()) ||
            (row.email && String(row.email).trim());
        if (has) {
            return [{
                name: row.contact_name ? String(row.contact_name) : '',
                phone: row.phone ? String(row.phone) : '',
                email: row.email ? String(row.email) : ''
            }];
        }
        return [{ name: '', phone: '', email: '' }];
    }

    function buildContactsSearch(entries) {
        if (!entries || !entries.length) return null;
        var parts = entries.map(function (e) {
            return [e.name, e.phone, e.email].filter(function (v) { return v && String(v).trim(); }).join(' ');
        }).filter(function (s) { return s; });
        var t = parts.join(' ').trim();
        return t || null;
    }

    function renderContactRows(entries) {
        var box = el('inquiryContactRowsContainer');
        if (!box) return;
        var list = entries && entries.length ? entries.slice() : [{ name: '', phone: '', email: '' }];
        box.innerHTML = list.map(function (e, idx) {
            return (
                '<div class="inquiry-contact-row" data-row-index="' + idx + '">' +
                '<div class="inquiry-field"><label>담당자</label><input type="text" class="inquiry-c-name" value="' + escapeHtml(e.name) + '"></div>' +
                '<div class="inquiry-field"><label>전화</label><input type="text" class="inquiry-c-phone" value="' + escapeHtml(e.phone) + '"></div>' +
                '<div class="inquiry-field"><label>이메일</label><input type="text" class="inquiry-c-email" value="' + escapeHtml(e.email) + '"></div>' +
                '<button type="button" class="btn-select inquiry-btn-remove-contact">제거</button>' +
                '</div>'
            );
        }).join('');
        box.querySelectorAll('.inquiry-btn-remove-contact').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var row = btn.closest('.inquiry-contact-row');
                var box2 = el('inquiryContactRowsContainer');
                if (!row || !box2) return;
                var all = box2.querySelectorAll('.inquiry-contact-row');
                if (all.length <= 1) {
                    row.querySelectorAll('input').forEach(function (inp) { inp.value = ''; });
                    return;
                }
                row.remove();
            });
        });
    }

    function collectContactEntriesFromDom() {
        var box = el('inquiryContactRowsContainer');
        if (!box) return [];
        var out = [];
        box.querySelectorAll('.inquiry-contact-row').forEach(function (row) {
            var n = row.querySelector('.inquiry-c-name');
            var p = row.querySelector('.inquiry-c-phone');
            var em = row.querySelector('.inquiry-c-email');
            out.push({
                name: n ? n.value.trim() : '',
                phone: p ? p.value.trim() : '',
                email: em ? em.value.trim() : ''
            });
        });
        return out.filter(function (r) { return r.name || r.phone || r.email; });
    }

    function addContactRow() {
        var box = el('inquiryContactRowsContainer');
        if (!box) return;
        var cur = collectContactEntriesFromDom();
        cur.push({ name: '', phone: '', email: '' });
        renderContactRows(cur);
    }

    function isTerminalLeadStage(stage) {
        var s = stage || '';
        return s === STAGE_TERMINAL_CONTRACT || s === STAGE_TERMINAL_END;
    }

    function isShowAllLeadsChecked() {
        var c = el('inquiryShowAllLeads');
        return !!(c && c.checked);
    }

    function getLeadsVisibleInListPanel() {
        if (isShowAllLeadsChecked()) return state.leads.slice();
        return state.leads.filter(function (r) {
            return !isTerminalLeadStage(r.stage);
        });
    }

    function onInquiryShowAllLeadsChange() {
        if (!isShowAllLeadsChecked() && state.selectedId) {
            var sel = state.leads.find(function (r) { return r.id === state.selectedId; });
            if (sel && isTerminalLeadStage(sel.stage)) {
                state.selectedId = null;
                clearDetailPanel();
                renderLeadList();
                return;
            }
        }
        renderLeadList();
        if (state.selectedId) {
            var row = state.leads.find(function (r) { return r.id === state.selectedId; });
            if (row) fillDetailForm(row);
        }
    }

    function onInquiryFilterStageChange() {
        var sel = el('inquiryFilterStage');
        var v = sel ? sel.value : '';
        if (v === STAGE_TERMINAL_CONTRACT || v === STAGE_TERMINAL_END) {
            var c = el('inquiryShowAllLeads');
            if (c) c.checked = true;
        }
        loadLeads();
    }

    async function loadLeads() {
        if (!_supabase) {
            await showInquiryDialogAlert('Supabase 클라이언트가 없습니다.');
            return;
        }
        var stageFilter = el('inquiryFilterStage') ? el('inquiryFilterStage').value : '';
        var sortVal = el('inquirySort') ? el('inquirySort').value : 'updated_at';
        var search = el('inquirySearch') ? el('inquirySearch').value.trim() : '';
        var tt = getTargetTable();

        var q = _supabase.from('sales_leads').select('*').eq('target_table', tt);
        if (stageFilter) q = q.eq('stage', stageFilter);
        if (search) {
            var pat = '%' + search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_') + '%';
            q = q.or(
                'company_name.ilike.' + pat +
                ',brand_name.ilike.' + pat +
                ',contact_name.ilike.' + pat +
                ',interest_notes.ilike.' + pat +
                ',contacts_search.ilike.' + pat
            );
        }
        if (sortVal === 'created_at') q = q.order('created_at', { ascending: false });
        else q = q.order('updated_at', { ascending: false });

        var res = await q;
        if (res.error) {
            await showInquiryDialogAlert('리드 목록을 불러오지 못했습니다.\n' + (res.error.message || '') + '\n\nSupabase에 sales_leads 테이블·RLS를 적용했는지 확인하세요.');
            state.leads = [];
            renderLeadList();
            return;
        }
        state.leads = res.data || [];
        if (state.selectedId && !state.leads.some(function (r) { return r.id === state.selectedId; })) {
            state.selectedId = null;
        }
        if (state.selectedId && !isShowAllLeadsChecked()) {
            var selRow = state.leads.find(function (r) { return r.id === state.selectedId; });
            if (selRow && isTerminalLeadStage(selRow.stage)) {
                state.selectedId = null;
            }
        }
        renderLeadList();
        if (state.selectedId) {
            var row = state.leads.find(function (r) { return r.id === state.selectedId; });
            if (row) fillDetailForm(row);
            else clearDetailPanel();
        } else {
            clearDetailPanel();
        }
    }

    function renderLeadList() {
        var container = el('inquiryLeadList');
        if (!container) return;
        if (!state.leads.length) {
            container.innerHTML = '<div class="inquiry-list-empty">등록된 문의가 없습니다.<br>「새 문의」로 추가해 보세요.</div>';
            return;
        }
        var visible = getLeadsVisibleInListPanel();
        if (!visible.length) {
            container.innerHTML =
                '<div class="inquiry-list-empty">표시할 문의가 없습니다.<br>계약 전환·문의 종료 단계는 「전체 표시」를 켜면 목록에 나타납니다.</div>';
            return;
        }
        var html = visible.map(function (r) {
            var active = r.id === state.selectedId ? ' inquiry-lead-item--active' : '';
            var meta = r.brand_name || r.contact_name || '';
            return (
                '<div class="inquiry-lead-item' + active + '" data-lead-id="' + r.id + '" role="button" tabindex="0">' +
                '<div class="inquiry-lead-item__title">' + escapeHtml(r.company_name || '(회사명 없음)') + '</div>' +
                '<div><span class="inquiry-badge ' + stageListBadgeModifier(r.stage) + '">' + escapeHtml(stageDisplayName(r.stage)) + '</span></div>' +
                '<div class="inquiry-lead-item__meta">' + escapeHtml(meta) +
                (r.updated_at ? ' · ' + formatDateTime(r.updated_at) : '') + '</div>' +
                '</div>'
            );
        }).join('');
        container.innerHTML = html;
        container.querySelectorAll('.inquiry-lead-item').forEach(function (node) {
            node.addEventListener('click', function () {
                var id = parseInt(node.getAttribute('data-lead-id'), 10);
                if (!isNaN(id)) selectLead(id);
            });
        });
    }

    function clearDetailPanel() {
        ['inquiryDetailCompany', 'inquiryDetailBrand', 'inquiryDetailChannel', 'inquiryDetailInterest'].forEach(function (id) {
            var n = el(id);
            if (!n) return;
            n.value = '';
        });
        var st = el('inquiryDetailStage');
        if (st) st.value = STAGES[0];
        renderContactRows([{ name: '', phone: '', email: '' }]);
        var hint = el('inquiryDetailEmpty');
        if (hint) hint.style.display = 'block';
        var form = el('inquiryDetailForm');
        if (form) form.style.display = 'none';
        var act = el('inquiryActivitySection');
        if (act) act.style.display = 'none';
        var timeline = el('inquiryTimeline');
        if (timeline) timeline.innerHTML = '';
    }

    function fillDetailForm(row) {
        var hint = el('inquiryDetailEmpty');
        if (hint) hint.style.display = 'none';
        var form = el('inquiryDetailForm');
        if (form) form.style.display = 'block';
        var act = el('inquiryActivitySection');
        if (act) act.style.display = 'block';

        el('inquiryDetailStage').value = row.stage || STAGES[0];
        el('inquiryDetailCompany').value = row.company_name || '';
        el('inquiryDetailBrand').value = row.brand_name || '';
        el('inquiryDetailChannel').value = row.channel || '';
        el('inquiryDetailInterest').value = row.interest_notes || '';
        renderContactRows(getContactEntriesFromRow(row));
    }

    async function selectLead(id) {
        state.selectedId = id;
        renderLeadList();
        var row = state.leads.find(function (r) { return r.id === id; });
        if (!row) return;
        fillDetailForm(row);
        await loadActivities(id);
    }

    async function loadActivities(leadId) {
        var timeline = el('inquiryTimeline');
        if (!timeline) return;
        timeline.innerHTML = '<div class="inquiry-muted">불러오는 중...</div>';
        var res = await _supabase
            .from('sales_lead_activities')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false });
        if (res.error) {
            timeline.innerHTML = '<div class="inquiry-error">활동 로그를 불러오지 못했습니다.</div>';
            return;
        }
        var rows = res.data || [];
        if (!rows.length) {
            timeline.innerHTML = '<div class="inquiry-muted">등록된 활동이 없습니다.</div>';
            return;
        }
        timeline.innerHTML = rows.map(function (a) {
            var aid = a.id;
            var datePart = formatDateOnly(a.created_at);
            var headMeta = '<strong>' + escapeHtml(activityTypeLabel(a.activity_type)) + '</strong>';
            if (datePart) headMeta += ' · ' + escapeHtml(datePart);
            if (a.created_by) headMeta += ' · ' + escapeHtml(a.created_by);
            return (
                '<div class="inquiry-timeline-item" data-activity-id="' + aid + '">' +
                '<div class="inquiry-timeline-item__row">' +
                '<div class="inquiry-timeline-item__main">' +
                '<div class="inquiry-timeline-item__head">' + headMeta + '</div>' +
                (a.summary ? '<div>' + escapeHtml(a.summary) + '</div>' : '') +
                (a.body ? '<div class="inquiry-timeline-body">' + escapeHtml(a.body) + '</div>' : '') +
                '</div>' +
                '<div class="inquiry-timeline-item__side">' +
                '<button type="button" class="btn-select inquiry-activity-edit" data-activity-id="' + aid + '">수정</button>' +
                '<button type="button" class="btn-select inquiry-activity-delete" data-activity-id="' + aid + '">삭제</button>' +
                '</div></div></div>'
            );
        }).join('');
    }

    async function persistLeadDetailFromForm(options) {
        options = options || {};
        var silent = !!options.silent;
        var stageOverride = options.stageOverride;
        if (!state.selectedId) return false;
        if (!_supabase) return false;
        var entries = collectContactEntriesFromDom();
        var contactsSearch = buildContactsSearch(entries);
        var first = entries[0] || { name: '', phone: '', email: '' };
        var stageVal =
            stageOverride != null && stageOverride !== ''
                ? stageOverride
                : (el('inquiryDetailStage').value || STAGES[0]);
        var payload = {
            company_name: el('inquiryDetailCompany').value.trim() || '',
            brand_name: el('inquiryDetailBrand').value.trim() || null,
            channel: el('inquiryDetailChannel').value.trim() || null,
            interest_notes: el('inquiryDetailInterest').value.trim() || null,
            stage: stageVal,
            contact_entries: entries,
            contacts_search: contactsSearch,
            contact_name: first.name || null,
            phone: first.phone || null,
            email: first.email || null,
            owner_email: null,
            next_action_at: null,
            next_action_note: null,
            lost_reason: null,
            linked_contract_id: null,
            updated_at: new Date().toISOString()
        };
        if (!payload.company_name) {
            await showInquiryDialogAlert('회사명은 필수입니다.');
            return false;
        }
        var res = await _supabase.from('sales_leads').update(payload).eq('id', state.selectedId).eq('target_table', getTargetTable()).select();
        if (res.error) {
            await showInquiryDialogAlert(
                '저장 실패: ' + (res.error.message || '') +
                '\n\nSupabase의 sales_leads 테이블에 brand_name, contact_entries, contacts_search 컬럼이 필요합니다.' +
                '\n저장소의 supabase/migrations/20260216120000_sales_leads_apply_missing_ui_columns.sql 내용을 SQL Editor에서 실행한 뒤, 잠시 후 다시 시도하세요.'
            );
            return false;
        }
        var saved = res.data && res.data[0];
        if (!saved) {
            await showInquiryDialogAlert('저장 후 데이터를 확인할 수 없습니다. 권한(RLS) 또는 조건을 확인하세요.');
            await loadLeads();
            return false;
        }
        state.selectedId = saved.id;
        await loadLeads();
        await selectLead(state.selectedId);
        if (!silent) await showInquiryDialogAlert('저장되었습니다.');
        return true;
    }

    async function saveLeadDetail() {
        await persistLeadDetailFromForm({ silent: false });
    }

    async function applyDetailStageAndSave(stageValue) {
        if (!state.selectedId || !_supabase) return;
        await persistLeadDetailFromForm({ silent: true, stageOverride: stageValue });
    }

    function openAddActivityModal() {
        if (!state.selectedId) return;
        el('addActivityType').value = 'call';
        el('addActivitySummary').value = '';
        el('addActivityBody').value = '';
        var m = el('addActivityModal');
        m.style.display = 'flex';
        m.style.alignItems = 'center';
        m.style.justifyContent = 'center';
    }

    function closeAddActivityModal() {
        var m = el('addActivityModal');
        if (m) m.style.display = 'none';
    }

    async function submitAddActivity() {
        if (!state.selectedId) return;
        if (!_supabase) return;
        var typeEl = el('addActivityType');
        var sumEl = el('addActivitySummary');
        var bodyEl = el('addActivityBody');
        var summary = sumEl ? sumEl.value.trim() : '';
        if (!summary) {
            await showInquiryDialogAlert('활동 요약을 입력해 주세요.');
            return;
        }
        var user = null;
        try {
            var u = await _supabase.auth.getUser();
            user = u.data && u.data.user;
        } catch (e) {}
        var email = (user && user.email) ? user.email : null;
        var row = {
            lead_id: state.selectedId,
            activity_type: typeEl ? typeEl.value : 'other',
            summary: summary,
            body: bodyEl && bodyEl.value.trim() ? bodyEl.value.trim() : null,
            created_by: email
        };
        var res = await _supabase.from('sales_lead_activities').insert([row]).select().single();
        if (res.error) {
            await showInquiryDialogAlert('활동 추가 실패: ' + (res.error.message || ''));
            return;
        }
        closeAddActivityModal();
        await _supabase.from('sales_leads').update({ updated_at: new Date().toISOString() }).eq('id', state.selectedId);
        await loadActivities(state.selectedId);
        await loadLeads();
        if (state.selectedId) selectLead(state.selectedId);
    }

    async function deleteActivity(activityId, anchorBtn) {
        if (!state.selectedId || !activityId) return;
        var anchor =
            anchorBtn && anchorBtn.nodeType === 1 ? { element: anchorBtn } : null;
        if (!(await showInquiryDialogConfirm('이 활동을 삭제할까요?', anchor))) return;
        var res = await _supabase
            .from('sales_lead_activities')
            .delete()
            .eq('id', activityId)
            .eq('lead_id', state.selectedId);
        if (res.error) {
            await showInquiryDialogAlert('삭제 실패: ' + (res.error.message || ''));
            return;
        }
        await _supabase.from('sales_leads').update({ updated_at: new Date().toISOString() }).eq('id', state.selectedId);
        await loadActivities(state.selectedId);
        await loadLeads();
        if (state.selectedId) selectLead(state.selectedId);
    }

    function openEditActivityModal(activityId) {
        if (!_supabase || !state.selectedId) return;
        _supabase
            .from('sales_lead_activities')
            .select('*')
            .eq('id', activityId)
            .eq('lead_id', state.selectedId)
            .maybeSingle()
            .then(async function (res) {
                if (res.error || !res.data) {
                    await showInquiryDialogAlert('활동을 불러오지 못했습니다.');
                    return;
                }
                var a = res.data;
                el('edActivityId').value = String(a.id);
                el('edActivityType').value = a.activity_type || 'other';
                el('edActivityCreatedAt').value = formatDateInputLocal(a.created_at);
                el('edActivitySummary').value = a.summary || '';
                el('edActivityBody').value = a.body || '';
                var m = el('editActivityModal');
                m.style.display = 'flex';
                m.style.alignItems = 'center';
                m.style.justifyContent = 'center';
            });
    }

    function closeEditActivityModal() {
        var m = el('editActivityModal');
        if (m) m.style.display = 'none';
    }

    async function saveEditActivity() {
        var id = parseInt(el('edActivityId').value, 10);
        if (!state.selectedId || isNaN(id)) {
            closeEditActivityModal();
            return;
        }
        var summary = el('edActivitySummary').value.trim();
        if (!summary) {
            await showInquiryDialogAlert('요약을 입력해 주세요.');
            return;
        }
        var createdAt = parseDateInputLocal(el('edActivityCreatedAt').value);
        if (!createdAt) {
            await showInquiryDialogAlert('날짜·시간을 선택해 주세요.');
            return;
        }
        var payload = {
            activity_type: el('edActivityType').value || 'other',
            summary: summary,
            body: el('edActivityBody').value.trim() || null,
            created_at: createdAt
        };
        var res = await _supabase
            .from('sales_lead_activities')
            .update(payload)
            .eq('id', id)
            .eq('lead_id', state.selectedId)
            .select();
        if (res.error) {
            await showInquiryDialogAlert('수정 실패: ' + (res.error.message || ''));
            return;
        }
        closeEditActivityModal();
        await _supabase.from('sales_leads').update({ updated_at: new Date().toISOString() }).eq('id', state.selectedId);
        await loadActivities(state.selectedId);
        await loadLeads();
        if (state.selectedId) selectLead(state.selectedId);
    }

    async function createNewLead() {
        var company = el('newLeadCompany') && el('newLeadCompany').value.trim();
        if (!company) {
            await showInquiryDialogAlert('회사명을 입력해 주세요.');
            return;
        }
        var user = null;
        try {
            var u = await _supabase.auth.getUser();
            user = u.data && u.data.user;
        } catch (e) {}
        var row = {
            target_table: getTargetTable(),
            company_name: company,
            brand_name: el('newLeadBrand') && el('newLeadBrand').value.trim() ? el('newLeadBrand').value.trim() : null,
            stage: el('newLeadStage').value || STAGES[0],
            interest_notes: el('newLeadMemo') && el('newLeadMemo').value.trim() ? el('newLeadMemo').value.trim() : null,
            contact_entries: [],
            contacts_search: null,
            contact_name: null,
            phone: null,
            email: null,
            owner_email: (user && user.email) ? user.email : null
        };
        var res = await _supabase.from('sales_leads').insert([row]).select().single();
        if (res.error) {
            await showInquiryDialogAlert(
                '생성 실패: ' + (res.error.message || '') +
                '\n\nSupabase sales_leads에 brand_name·contact_entries 등 컬럼이 없을 수 있습니다.' +
                '\nsupabase/migrations/20260216120000_sales_leads_apply_missing_ui_columns.sql 을 SQL Editor에서 실행하세요.'
            );
            return;
        }
        closeNewLeadModal();
        await loadLeads();
        if (res.data && res.data.id) selectLead(res.data.id);
    }

    async function deleteSelectedLead(ev) {
        if (!state.selectedId) return;
        var btn = ev && ev.currentTarget;
        var anchor = btn && btn.nodeType === 1 ? { element: btn } : null;
        if (!(await showInquiryDialogConfirm('이 문의와 모든 활동 로그를 삭제할까요?', anchor))) return;
        var res = await _supabase.from('sales_leads').delete().eq('id', state.selectedId).eq('target_table', getTargetTable());
        if (res.error) {
            await showInquiryDialogAlert('삭제 실패: ' + (res.error.message || ''));
            return;
        }
        state.selectedId = null;
        await loadLeads();
    }

    function openNewLeadModal() {
        el('newLeadCompany').value = '';
        if (el('newLeadBrand')) el('newLeadBrand').value = '';
        el('newLeadStage').value = STAGES[0];
        if (el('newLeadMemo')) el('newLeadMemo').value = '';
        el('newLeadModal').style.display = 'flex';
        el('newLeadModal').style.alignItems = 'center';
        el('newLeadModal').style.justifyContent = 'center';
    }

    function closeNewLeadModal() {
        el('newLeadModal').style.display = 'none';
    }

    function onActivitySectionClick(e) {
        var delBtn = e.target.closest('.inquiry-activity-delete');
        if (delBtn) {
            var did = delBtn.getAttribute('data-activity-id');
            if (did) deleteActivity(parseInt(did, 10), delBtn);
            return;
        }
        var edBtn = e.target.closest('.inquiry-activity-edit');
        if (edBtn) {
            var eid = edBtn.getAttribute('data-activity-id');
            if (eid) openEditActivityModal(parseInt(eid, 10));
        }
    }

    function wireEvents() {
        var search = el('inquirySearch');
        if (search && !search._bound) {
            search._bound = true;
            search.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') loadLeads();
            });
        }
        var btnSearch = el('inquiryBtnSearch');
        if (btnSearch && !btnSearch._bound) {
            btnSearch._bound = true;
            btnSearch.addEventListener('click', loadLeads);
        }
        var st = el('inquiryFilterStage');
        if (st && !st._bound) {
            st._bound = true;
            st.addEventListener('change', onInquiryFilterStageChange);
        }
        var chkShowAll = el('inquiryShowAllLeads');
        if (chkShowAll && !chkShowAll._bound) {
            chkShowAll._bound = true;
            chkShowAll.addEventListener('change', onInquiryShowAllLeadsChange);
        }
        var so = el('inquirySort');
        if (so && !so._bound) {
            so._bound = true;
            so.addEventListener('change', loadLeads);
        }
        var btnNew = el('inquiryBtnNew');
        if (btnNew && !btnNew._bound) {
            btnNew._bound = true;
            btnNew.addEventListener('click', openNewLeadModal);
        }
        var btnSave = el('inquiryBtnSave');
        if (btnSave && !btnSave._bound) {
            btnSave._bound = true;
            btnSave.addEventListener('click', saveLeadDetail);
        }
        var btnStageContract = el('inquiryBtnStageContract');
        if (btnStageContract && !btnStageContract._bound) {
            btnStageContract._bound = true;
            btnStageContract.addEventListener('click', function () {
                applyDetailStageAndSave(STAGE_TERMINAL_CONTRACT);
            });
        }
        var btnStageEnd = el('inquiryBtnStageEnd');
        if (btnStageEnd && !btnStageEnd._bound) {
            btnStageEnd._bound = true;
            btnStageEnd.addEventListener('click', function () {
                applyDetailStageAndSave(STAGE_TERMINAL_END);
            });
        }
        var btnDel = el('inquiryBtnDelete');
        if (btnDel && !btnDel._bound) {
            btnDel._bound = true;
            btnDel.addEventListener('click', deleteSelectedLead);
        }
        var btnAct = el('inquiryBtnAddActivity');
        if (btnAct && !btnAct._bound) {
            btnAct._bound = true;
            btnAct.addEventListener('click', openAddActivityModal);
        }
        var btnAddC = el('inquiryBtnAddContact');
        if (btnAddC && !btnAddC._bound) {
            btnAddC._bound = true;
            btnAddC.addEventListener('click', addContactRow);
        }
        var actSec = el('inquiryActivitySection');
        if (actSec && !actSec._delegate) {
            actSec._delegate = true;
            actSec.addEventListener('click', onActivitySectionClick);
        }
    }

    window.initContractInquiryTab = async function () {
        if (!_supabase) return;
        wireEvents();
        await loadLeads();
        state.initialized = true;
    };

    window.openNewLeadModal = openNewLeadModal;
    window.closeNewLeadModal = closeNewLeadModal;
    window.submitNewLead = createNewLead;
    window.closeEditActivityModal = closeEditActivityModal;
    window.saveEditActivity = saveEditActivity;
    window.closeAddActivityModal = closeAddActivityModal;
    window.submitAddActivity = submitAddActivity;
    window.showInquiryConfirm = showInquiryDialogConfirm;
    window.showInquiryAlert = showInquiryDialogAlert;
})();
