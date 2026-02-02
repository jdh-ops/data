// config.js
const SUPABASE_URL = 'https://vszejvzjznhmlqddltwt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzemVqdnpqem5obWxxZGRsdHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MjUzMjQsImV4cCI6MjA4MjIwMTMyNH0.O0uFN0J3nMHvlMu1wS4fbumngFTRog6PkHruK6CWE7w';

// Supabase 클라이언트 초기화
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// config.js
const urlParams = new URLSearchParams(window.location.search);
window.tableName = urlParams.get('table') || 'default';

// key 파라미터가 있으면 한글로 변환, 없으면 tableName(영문)을 기본값으로 사용
const projectKeyName = urlParams.get('key') 
    ? decodeURIComponent(urlParams.get('key')) 
    : window.tableName;

console.log("프로젝트 키:", window.tableName);
console.log("표시 이름:", projectKeyName);