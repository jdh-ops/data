// gateway-logic.js
async function checkKeyword() {
    const keywordInput = document.getElementById('keywordInput');
    const message = document.getElementById('message');
    const createBtn = document.getElementById('create-btn');
    const loginBtn = document.getElementById('loginBtn');
    
    const keyword = keywordInput.value.trim();
    if (!keyword) return;

    loginBtn.disabled = true;
    message.innerText = "확인 중...";

    try {
        const { data, error } = await _supabase
            .from('keywords')
            .select('*')
            .eq('keyword', keyword)
            .single();

        if (error || !data) {
            message.style.color = "#e74c3c";
            message.innerText = "등록되지 않은 키워드입니다.";
            createBtn.style.display = "inline-block";
            loginBtn.disabled = false;
        } else {
            createBtn.style.display = "none";
            message.style.color = "#27ae60";
            message.innerText = "접속 성공! 이동합니다...";
            setTimeout(() => {
                window.location.href = `page1.html?table=${encodeURIComponent(data.keyword)}`;
            }, 800);
        }
    } catch (err) {
        message.innerText = "오류가 발생했습니다.";
        loginBtn.disabled = false;
    }
}

async function processCreate() {
    const newK = document.getElementById('newKeyword').value.trim();
    const inputPw = document.getElementById('adminPw').value;

    try {
        // DB에서 비밀번호 가져오기
        const { data: settings } = await _supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'admin_password')
            .single();

        if (inputPw !== settings.value) return alert("비밀번호가 틀렸습니다.");

        const { error } = await _supabase.from('keywords').insert([{ keyword: newK }]);
        if (error) throw error;

        alert(`'${newK}' 생성 완료!`);
        closeCreateModal();
        checkKeyword(); 
    } catch (err) {
        alert("생성 실패: " + err.message);
    }
}

function openCreateModal() { document.getElementById('createModal').style.display = 'flex'; }
function closeCreateModal() { document.getElementById('createModal').style.display = 'none'; }