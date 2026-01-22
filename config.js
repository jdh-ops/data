// config.js
const SUPABASE_URL = 'https://vszejvzjznhmlqddltwt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzemVqdnpqem5obWxxZGRsdHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MjUzMjQsImV4cCI6MjA4MjIwMTMyNH0.O0uFN0J3nMHvlMu1wS4fbumngFTRog6PkHruK6CWE7w';

// Supabase 클라이언트 초기화
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// config.js
const urlParams = new URLSearchParams(window.location.search);
const tableName = urlParams.get('table') || 'default';

// [추가] URL의 key 파라미터 값을 한글로 변환하여 가져오기
const projectKeyName = decodeURIComponent(urlParams.get('key') || tableName);

console.log(`🚀 현재 프로젝트명: ${projectKeyName}`);