// gateway-logic.js

// 1. 키워드 체크 및 접속 로직
async function checkKeyword() {
    const keywordInput = document.getElementById('keywordInput');
    const message = document.getElementById('message');
    const createBtn = document.getElementById('create-btn');
    const loginBtn = document.getElementById('loginBtn');
    
    const keyword = keywordInput.value.trim();
    if (!keyword) return;

    loginBtn.disabled = true;

    try {
        // Supabase 'keywords' 테이블에서 일치하는 키워드 검색
        const { data, error } = await _supabase
            .from('keywords')
            .select('*')
            .eq('keyword', keyword)
            .single();

        if (!data) {
            // [실패] 키워드가 없을 때
            message.style.color = "#e74c3c";
            message.innerText = "등록되지 않은 키워드입니다.";
            loginBtn.disabled = false;
            if (createBtn) createBtn.style.display = "inline-block";
        } else {
            // [성공] 키워드가 있을 때
            if (createBtn) createBtn.style.display = "none";
            message.style.color = "#27ae60";
            message.innerText = "접속 성공! 이동합니다...";

            setTimeout(() => {
                // page1.html로 이동하며 테이블명 전달
                window.location.href = `page1.html?table=${encodeURIComponent(data.keyword)}`;
            }, 800);
        }
    } catch (err) {
        console.error("접속 오류:", err);
        loginBtn.disabled = false;
    }
}

// 2. 새 키워드 생성 모달 제어
function openCreateModal() {
    const keyword = document.getElementById('keywordInput').value.trim();
    document.getElementById('newKeyword').value = keyword; 
    document.getElementById('createModal').style.display = 'flex';
}

function closeCreateModal() {
    document.getElementById('createModal').style.display = 'none';
    document.getElementById('adminPw').value = '';
}

// 3. 실제 DB에 새 키워드 추가
async function processCreate() {
    const newK = document.getElementById('newKeyword').value.trim();
    const inputPw = document.getElementById('adminPw').value;

    if (!newK) return alert("생성할 키워드명을 입력하세요.");
    if (!inputPw) return alert("비밀번호를 입력하세요.");

    try {
        // 1. DB에서 관리자 비밀번호 가져오기
        const { data: settings, error: pwError } = await _supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'admin_password')
            .single();

        if (pwError || !settings) throw new Error("비밀번호 정보를 불러올 수 없습니다.");

        // 2. 입력한 비밀번호와 DB 비밀번호 비교
        if (inputPw !== settings.value) {
            return alert("비밀번호가 일치하지 않습니다.");
        }

        // 3. 비밀번호가 맞으면 키워드 생성 진행
        const { error: insertError } = await _supabase
            .from('keywords')
            .insert([{ keyword: newK }]);

        if (insertError) {
            if (insertError.code === '23505') throw new Error("이미 존재하는 키워드입니다.");
            throw insertError;
        }

        alert(`✨ '${newK}' 키워드가 생성되었습니다!`);
        closeCreateModal();
        checkKeyword(); 

    } catch (err) {
        alert("오류 발생: " + err.message);
    }
}