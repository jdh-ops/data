// keyword-logic.js
function initKeywordView() {
    const params = new URLSearchParams(window.location.search);
    const displayKeyword = params.get('key'); // URL에서 key(키워드) 파라미터 가져오기
    
    const projectTitle = document.getElementById('projectTitle');
    const dashHeader = document.getElementById('dashHeader');
    
    // DB 이름 대신 키워드를 화면에 표시
    if (displayKeyword) {
        if (projectTitle) projectTitle.innerText = displayKeyword.toUpperCase();
        if (dashHeader) dashHeader.innerText = `${displayKeyword.toUpperCase()} 대시보드`;
    }
}

// 관문(index.html)으로 돌아가는 함수
function goToGateway() {
    if (confirm("관문 화면으로 돌아가시겠습니까?")) {
        window.location.href = 'index.html';
    }
}

document.addEventListener('DOMContentLoaded', initKeywordView);