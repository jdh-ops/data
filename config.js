// config.js
const SUPABASE_URL = 'https://vszejvzjznhmlqddltwt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzemVqdnpqem5obWxxZGRsdHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MjUzMjQsImV4cCI6MjA4MjIwMTMyNH0.O0uFN0J3nMHvlMu1wS4fbumngFTRog6PkHruK6CWE7w'; // (제공하신 키 유지)

// Supabase 클라이언트 초기화 (전역 사용을 위해 window에 명시적으로 할당)
// apikey를 global.headers에 명시하여 요청 시 항상 포함되도록 함
var _supabase = null;
if (typeof window.supabase !== 'undefined' && SUPABASE_URL && SUPABASE_KEY && SUPABASE_KEY.length > 20) {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        global: { headers: { apikey: SUPABASE_KEY } }
    });
} else {
    if (!SUPABASE_KEY || SUPABASE_KEY.length <= 20) {
        console.error('[config.js] SUPABASE_KEY가 비어 있거나 너무 짧습니다. Supabase 대시보드에서 anon public 키를 확인한 뒤 config.js에 넣어주세요.');
    }
}
window._supabase = _supabase;

// URL 파라미터 분석
const urlParams = new URLSearchParams(window.location.search);
window.tableName = urlParams.get('table') || 'default';

// key 파라미터를 전역 변수로 설정하여 어디서든 쓸 수 있게 함
window.projectKeyName = urlParams.get('key') 
    ? decodeURIComponent(urlParams.get('key')) 
    : window.tableName;

console.log("프로젝트 테이블(영문):", window.tableName);
console.log("프로젝트 표시명(한글):", window.projectKeyName);

// [보안] wegofair 유저 체크 함수
window.checkWegoFairUser = async function() {
    if (!_supabase || typeof _supabase.auth === 'undefined') {
        console.error('[config.js] Supabase 클라이언트가 없습니다. Supabase 스크립트가 config.js보다 먼저 로드되는지 확인하세요.');
        if (window.location.pathname && !window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
            window.location.replace('index.html');
        }
        return;
    }
    const { data: { user }, error } = await _supabase.auth.getUser();

    // 현재 페이지가 index.html(로그인 페이지)이면 체크 로직을 건너뜀 (무한 루프 방지)
    if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
        return;
    }

    if (user) {
        const email = user.email || "";
        // 도메인이 wegofair.com이 아니면 강제 로그아웃
        if (!email.endsWith("@wegofair.com")) {
            alert("접근 거부: @wegofair.com 계정만 사용할 수 있습니다.");
            await _supabase.auth.signOut();
            window.location.replace("index.html");
            return;
        }
        console.log("인증 완료: wegofair 멤버 (" + email + ")");
    } else {
        // 로그인 정보가 아예 없으면 로그인 페이지로 이동
        window.location.replace("index.html");
    }
};