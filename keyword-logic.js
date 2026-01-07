// keyword-logic.js
function initKeywordView() {
    const projectTitle = document.getElementById('projectTitle');
    const dashHeader = document.getElementById('dashHeader');
    
    if (projectTitle) projectTitle.innerText = tableName.toUpperCase();
    if (dashHeader) dashHeader.innerText = `${tableName.toUpperCase()} 대시보드`;
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', initKeywordView);
