// gateway-logic.js

// [전역 변수 캐싱] 보안 체크 결과를 한 번만 수행하도록 개선
let cachedUser = null;

async function getAuthUser() {
    if (cachedUser) return cachedUser;
    const { data: { user } } = await _supabase.auth.getUser();
    cachedUser = user;
    return user;
}

// 1. 모달 열기
function openCreateModal() {
    const attemptedKeyword = document.getElementById('keywordInput').value.trim();
    document.getElementById('newKeyword').value = attemptedKeyword;
    document.getElementById('englishNickname').value = "";
    document.getElementById('adminPw').value = "";
    const targetPageSelect = document.getElementById('targetPageSelect');
    if (targetPageSelect) {
        targetPageSelect.value = attemptedKeyword === '계약' ? 'contract' : 'page1';
    }
    document.getElementById('createModal').style.display = 'flex';
}

// 2. 실제 데이터 생성 진행
async function processCreate() {
    const user = await getAuthUser();
    if (!user || !user.email.endsWith('@wegofair.com')) {
        return alert("생성 권한이 없습니다.");
    }

    const keyword = document.getElementById('newKeyword').value.trim();
    const nickname = document.getElementById('englishNickname').value.trim();
    const inputPw = document.getElementById('adminPw').value;

    if (!keyword || !nickname || !inputPw) return alert("모든 항목을 입력해주세요.");

    const nicknameRegex = /^[a-zA-Z0-9_]+$/;
    if (!nicknameRegex.test(nickname)) return alert("영문 닉네임은 영문, 숫자, _만 가능합니다.");

    try {
        const { data: settings } = await _supabase.from('system_settings').select('value').eq('key', 'admin_password').single();
        if (!settings || inputPw !== settings.value) return alert("비밀번호가 일치하지 않습니다.");

        const targetPageSelect = document.getElementById('targetPageSelect');
        const targetPage = (targetPageSelect && targetPageSelect.value ? targetPageSelect.value : 'page1').trim().toLowerCase() || 'page1';

        const { error: insertError } = await _supabase.from('gateways').insert([{ keyword, target_table: nickname, target_page: targetPage }]);
        if (insertError) throw insertError;

        alert(`✨ '${keyword}' 생성 완료!`);
        closeCreateModal();
        checkKeyword(); 
    } catch (err) {
        alert("생성 오류: " + (err.code === '23505' ? "이미 존재하는 키워드입니다." : err.message));
    }
}

function closeCreateModal() {
    document.getElementById('createModal').style.display = 'none';
}

// 3. 키워드 체크 및 접속 로직
async function checkKeyword() {
    const user = await getAuthUser();
    const message = document.getElementById('message');
    const loginBtn = document.getElementById('loginBtn');
    
    if (!user || !user.email.endsWith('@wegofair.com')) {
        message.style.color = "#e74c3c";
        message.innerText = "먼저 Wegofair 계정으로 로그인해 주세요.";
        return;
    }

    const keyword = document.getElementById('keywordInput').value.trim();
    if (!keyword) {
        message.style.color = "#e74c3c";
        message.innerText = "키워드를 입력해 주세요.";
        return;
    }

    loginBtn.disabled = true;
    message.style.color = "#34495e";
    message.innerText = "데이터 확인 중...";

    try {
        const { data, error } = await _supabase.from('gateways').select('*').eq('keyword', keyword).maybeSingle();

        if (error || !data) {
            message.style.color = "#e74c3c";
            message.innerText = "등록되지 않은 키워드입니다.";
            document.getElementById('create-btn').style.display = "inline-block";
            loginBtn.disabled = false;
        } else {
            message.style.color = "#27ae60";
            message.innerText = "접속 성공! 잠시 후 이동합니다...";

            const target = data.target_table || data.keyword;
            const targetPage = (data.target_page || 'page1').toLowerCase();
            var basePath = window.location.pathname.replace(/[#?].*$/, '').replace(/[^/]+$/, '') || '/';
            var pageFile = 'page1.html';
            if (targetPage === 'page3') pageFile = 'page3.html';
            else if (targetPage === 'contract') pageFile = 'contract-page.html';
            setTimeout(() => {
                const url = new URL(window.location.origin + basePath + pageFile);
                url.searchParams.set('table', target);
                url.searchParams.set('key', keyword);
                window.location.href = url.toString();
            }, 500);
        }
    } catch (err) {
        console.error(err);
        loginBtn.disabled = false;
    }
}