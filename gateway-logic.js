// gateway-logic.js

// 1. 모달 열기 (기존 입력한 키워드 자동 세팅)
function openCreateModal() {
    const attemptedKeyword = document.getElementById('keywordInput').value.trim();
    document.getElementById('newKeyword').value = attemptedKeyword; // 입력했던 값 그대로
    document.getElementById('englishNickname').value = ""; // 초기화
    document.getElementById('adminPw').value = ""; // 초기화
    document.getElementById('createModal').style.display = 'flex';
}

// 2. 실제 데이터 생성 진행
async function processCreate() {
    const keyword = document.getElementById('newKeyword').value.trim();
    const nickname = document.getElementById('englishNickname').value.trim();
    const inputPw = document.getElementById('adminPw').value;

    if (!keyword || !nickname || !inputPw) {
        return alert("모든 항목을 입력해주세요.");
    }

    // 닉네임 형식 체크 (영문/숫자/언더바만 허용)
    const nicknameRegex = /^[a-zA-Z0-9_]+$/;
    if (!nicknameRegex.test(nickname)) {
        return alert("영문 닉네임은 영문, 숫자, _(언더바)만 사용 가능합니다.");
    }

    try {
        // [1] DB에서 관리자 비밀번호 가져오기 (system_settings 테이블)
        const { data: settings, error: pwError } = await _supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'admin_password')
            .single();

        if (pwError || !settings) throw new Error("비밀번호 설정을 불러올 수 없습니다.");

        if (inputPw !== settings.value) {
            return alert("비밀번호가 일치하지 않습니다.");
        }

        // [2] 기존 keywords 테이블에 데이터 삽입
        // keyword: 접속시 치는 이름, target_table: 영문 닉네임
        const { error: insertError } = await _supabase
            .from('gateways')
            .insert([
                { 
                    keyword: keyword, 
                    target_table: nickname 
                }
            ]);

        if (insertError) {
            if (insertError.code === '23505') throw new Error("이미 존재하는 키워드입니다.");
            throw insertError;
        }

        alert(`✨ '${keyword}' 생성이 완료되었습니다!\n이제 해당 키워드로 접속 가능합니다.`);
        closeCreateModal();
        checkKeyword(); // 생성 직후 바로 접속 시도

    } catch (err) {
        alert("생성 중 오류 발생: " + err.message);
    }
}

function closeCreateModal() {
    document.getElementById('createModal').style.display = 'none';
}

/**
 * 3. 키워드 체크 및 접속 로직
 * 사용자가 입력한 키워드가 keywords 테이블에 있는지 확인하고 이동합니다.
 */
async function checkKeyword() {
    // HTML 요소 가져오기
    const keywordInput = document.getElementById('keywordInput');
    const message = document.getElementById('message');
    const createBtn = document.getElementById('create-btn');
    const loginBtn = document.getElementById('loginBtn');
    
    // 입력값 확인
    const keyword = keywordInput.value.trim();
    if (!keyword) {
        message.style.color = "#e74c3c";
        message.innerText = "키워드를 입력해 주세요.";
        return;
    }

    // 버튼 비활성화 및 상태 표시
    loginBtn.disabled = true;
    message.style.color = "#34495e";
    message.innerText = "데이터 확인 중...";

    try {
        // Supabase 'keywords' 테이블에서 입력한 키워드 조회
        const { data, error } = await _supabase
            .from('gateways')
            .select('*')
            .eq('keyword', keyword)
            .single();

        if (error || !data) {
            // [실패] 키워드가 DB에 없는 경우
            message.style.color = "#e74c3c";
            message.innerText = "등록되지 않은 키워드입니다.";
            
            // 키워드 생성 버튼 노출
            if (createBtn) createBtn.style.display = "inline-block";
            loginBtn.disabled = false;
        } else {
            // [성공] 키워드 존재 시
            if (createBtn) createBtn.style.display = "none";
            message.style.color = "#27ae60";
            message.innerText = "접속 성공! 잠시 후 이동합니다...";

            // 0.8초 후 페이지 이동 (기존 DB의 target_table 값 활용)
            setTimeout(() => {
                const targetPath = data.target_table || data.keyword;
                // gateway-logic.js 내 이동 코드 수정
                window.location.href = `page1.html?table=${encodeURIComponent(targetPath)}&key=${encodeURIComponent(keyword)}`;
            }, 800);
        }
    } catch (err) {
        console.error("접속 오류:", err);
        message.style.color = "#e74c3c";
        message.innerText = "시스템 오류가 발생했습니다.";
        loginBtn.disabled = false;
    }
}