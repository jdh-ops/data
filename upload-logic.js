// upload-logic.js
let selectedFile = null;

// 섹션 전환 함수 (필요 시 호출)
window.showSection = function(sectionId) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    if(sectionId === 'upload') listFiles();
};

async function listFiles() {
        const listEl = document.getElementById('fileList');
        try {
            const { data, error } = await _supabase.storage.from('excel-files').list(tableName + '/');
            if (error) throw error;

            // [중요] 시스템 파일(.emptyFolder 등)을 제외한 실제 파일만 필터링
            const actualFiles = data.filter(file => 
                file.name !== '.emptyFolder' && 
                file.name !== '.emptyFolderPlaceholder'
            );

            // 실제 파일이 하나도 없을 경우의 처리
            if (!actualFiles || actualFiles.length === 0) {
                listEl.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: #a0aec0; background: white; border-radius: 12px;">
                        <p style="font-size: 16px; margin: 0;">📁 업로드된 파일이 없습니다.</p>
                    </div>`;
                return;
            }

            listEl.innerHTML = `
                <div style="padding: 10px; background: #f8f9fa; font-weight: bold; display: flex; border-bottom: 2px solid #dee2e6;">
                    <div style="flex: 2;">파일명</div>
                    <div style="flex: 1; text-align: center;">업로드 날짜</div>
                    <div style="flex: 1; text-align: center;">관리</div>
                </div>
            ` + data.filter(file => file.name !== '.emptyFolder').map(file => {
                let displayName = file.name;
                let displayDate = "-";
                try {
                    // 파일명 형식: hex(파일명)--YYYYMMDD.확장자
                    const lastDotIndex = file.name.lastIndexOf('.');
                    const nameWithoutExt = lastDotIndex > 0 ? file.name.substring(0, lastDotIndex) : file.name;
                    const ext = lastDotIndex > 0 ? file.name.substring(lastDotIndex) : '';
                    
                    // --YYYYMMDD 패턴으로 날짜 부분 분리
                    const dateMatch = nameWithoutExt.match(/^(.+?)--(\d{8})$/);
                    if (dateMatch) {
                        const hexName = dateMatch[1]; // hex로 인코딩된 파일명 부분
                        const rawDate = dateMatch[2]; // 날짜 부분 (YYYYMMDD)
                        
                        // hex 문자열을 디코딩하여 원본 파일명 복원
                        if (hexName && /^[0-9a-f]+$/i.test(hexName) && hexName.length % 2 === 0) {
                            const hexBytes = hexName.match(/.{1,2}/g);
                            if (hexBytes && hexBytes.length > 0) {
                                const bytes = new Uint8Array(hexBytes.map(byte => parseInt(byte, 16)));
                                const decoded = new TextDecoder('utf-8').decode(bytes);
                                displayName = decoded + ext;
                                
                                // 날짜 포맷: YYYY. MM. DD.
                                displayDate = `${rawDate.substring(0,4)}. ${rawDate.substring(4,6)}. ${rawDate.substring(6,8)}.`;
                            }
                        }
                    } else {
                        // 형식이 맞지 않으면 원본 파일명 사용
                        displayName = file.name;
                    }
                } catch (e) { 
                    console.error('파일명 디코딩 에러:', e, file.name);
                    displayName = file.name; 
                }

                const { data: urlData } = _supabase.storage.from('excel-files').getPublicUrl(`${tableName}/${file.name}`);

                return `
                    <div class="file-row" style="display: flex; align-items: center; padding: 12px 10px; border-bottom: 1px solid #eee; font-size: 14px;">
                        <div style="flex: 2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📄 ${displayName}</div>
                        <div style="flex: 1; text-align: center; color: #666; font-size: 12px;">${displayDate}</div>
                        <div style="flex: 1; text-align: center; display: flex; justify-content: center; gap: 8px;">
                            <button onclick="downloadFile('${urlData.publicUrl}', '${displayName}')" style="color:#3498db; background:none; border:none; cursor:pointer; font-weight:bold;">다운로드</button>
                            <button onclick="deleteFile('${file.name}')" style="color:#e74c3c; background:none; border:none; cursor:pointer; font-weight:bold;">삭제</button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            listEl.innerHTML = `<p style="padding:20px; color:red;">에러: ${err.message}</p>`;
        }
    }

async function uploadFile() {
        if (!selectedFile) return;
        const status = document.getElementById('uploadStatus');
        status.innerText = "서버로 전송 중...";
        const originalName = selectedFile.name;
        const lastDotIndex = originalName.lastIndexOf('.');
        const fileExt = lastDotIndex > 0 ? originalName.substring(lastDotIndex + 1) : '';
        const nameNoExt = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
        
        // 현재 날짜를 YYYYMMDD 형식으로 생성
        const now = new Date();
        const year = String(now.getFullYear());
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = year + month + day;
        
        // 파일명만 hex로 인코딩 (날짜는 제외)
        const encoder = new TextEncoder();
        const encoded = encoder.encode(nameNoExt);
        const hexName = Array.from(encoded).map(b => b.toString(16).padStart(2, '0')).join('');
        
        // hex(파일명)--YYYYMMDD.확장자 형식으로 저장
        const safeFileName = fileExt ? `${hexName}--${dateStr}.${fileExt}` : `${hexName}--${dateStr}`;
        const filePath = `${tableName}/${safeFileName}`;

        try {
            const { data, error } = await _supabase.storage.from('excel-files').upload(filePath, selectedFile, { upsert: true });
            if (error) throw error;
            status.innerText = "✅ 업로드 성공!";
            selectedFile = null;
            document.getElementById('uploadBtn').style.display = 'none';
            document.getElementById('selectedFileName').innerText = "";
            setTimeout(() => listFiles(), 500);
        } catch (error) { 
            status.innerText = `❌ 실패: ${error.message}`; 
        }
    }

    async function downloadFile(url, fileName) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            
            // 파일명에서 날짜 부분(--YYYYMMDD)을 제거합니다.
            // 예: "보고서--20251230.xlsx" -> "보고서.xlsx"
            const cleanFileName = fileName.replace(/--\d{8}(?=\.[^.]+)?$/, '');

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = cleanFileName; // 날짜가 제거된 이름 설정
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('다운로드 중 오류 발생:', error);
            alert('파일을 다운로드할 수 없습니다.');
        }
    }

async function deleteFile(fileName) {
        if (!confirm("정말로 이 파일을 삭제하시겠습니까?")) return;
        try {
            const { error } = await _supabase.storage.from('excel-files').remove([`${tableName}/${fileName}`]);
            if (error) throw error;
            alert("삭제되었습니다.");
            listFiles();
        } catch (error) { alert("삭제 실패: " + error.message); }
    }
// deleteFile, downloadFile 함수들도 여기에 포함
