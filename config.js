// config.js
const SUPABASE_URL = 'https://vszejvzjznhmlqddltwt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzemVqdnpqem5obWxxZGRsdHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MjUzMjQsImV4cCI6MjA4MjIwMTMyNH0.O0uFN0J3nMHvlMu1wS4fbumngFTRog6PkHruK6CWE7w'; // 본인의 키 입력
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// URL에서 테이블(키워드) 이름 가져오기
const urlParams = new URLSearchParams(window.location.search);
const tableName = urlParams.get('table') || 'default';
