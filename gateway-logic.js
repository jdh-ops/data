// gateway-logic.js

// 1. 키워드 체크 (기존 키워드로 접속 시 실행)
async function checkKeyword() {
    const keywordInput = document.getElementById('keywordInput');
    const message = document.getElementById('message');
    const createBtn = document.getElementById('create-btn');
    const loginBtn = document.getElementById('loginBtn');
    
    const keyword = keywordInput.value.trim();
    if (!keyword) return;

    loginBtn.disabled = true;
    message.innerText = "키워드 확인 중...";

    try {
        const { data, error } = await _supabase
            .from('keywords')
            .select('*')
            .eq('keyword', keyword)
            .single();

        if (error || !data) {
            message.style.color = "#e74c3c";
            message.innerText = "등록되지 않은 키워드입니다.";
            if (createBtn) createBtn.style.display = "inline-block";
            loginBtn.disabled = false;
        } else {
            message.style.color = "#27ae60";
            message.innerText = "접속 성공! 이동합니다...";
            setTimeout(() => {
                window.location.href = `page1.html?table=${encodeURIComponent(data.keyword)}`;
            }, 800);
        }
    } catch (err) {
        message.innerText = "접속 오류가 발생했습니다.";
        loginBtn.disabled = false;
    }
}

// 2. 키워드 생성 (비밀번호 확인이 필요한 경우 실행)
async function processCreate() {
    const newK = document.getElementById('newKeyword').value.trim();
    const inputPw = document.getElementById('adminPw').value;

    try {
        // DB에서 비밀번호 설정 불러오기
        const { data: settings, error: pwError } = await _supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'admin_password')
            .single();

        // 테이블이 없거나 설정이 없을 경우 대비
        if (pwError || !settings) {
            return alert("DB에 관리자 비밀번호 설정이 없습니다. (system_settings 테이블 확인)");
        }

        if (inputPw !== settings.value) {
            return alert("비밀번호가 틀렸습니다.");
        }

        const { error } = await _supabase.from('keywords').insert([{ keyword: newK }]);
        if (error) throw error;

        alert(`'${newK}' 키워드가 생성되었습니다.`);
        closeCreateModal();
        checkKeyword(); // 생성 후 자동 접속
    } catch (err) {
        alert("생성 실패: " + err.message);
    }
}

function openCreateModal() { document.getElementById('createModal').style.display = 'flex'; }
function closeCreateModal() { document.getElementById('createModal').style.display = 'none'; }