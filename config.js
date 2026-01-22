// config.js
const SUPABASE_URL = 'https://vszejvzjznhmlqddltwt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzemVqdnpqem5obWxxZGRsdHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MjUzMjQsImV4cCI6MjA4MjIwMTMyNH0.O0uFN0J3nMHvlMu1wS4fbumngFTRog6PkHruK6CWE7w';

// Supabase 클라이언트 초기화
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// URL에서 프로젝트 키(예: ?table=test_data)를 가져오고 없으면 'default' 사용
const urlParams = new URLSearchParams(window.location.search);
const tableName = urlParams.get('table') || 'default';

console.log(`🚀 현재 접속 프로젝트: ${tableName}`);