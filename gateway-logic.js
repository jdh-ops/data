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
            .from('keywords')
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