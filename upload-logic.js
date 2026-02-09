// upload-logic.js
(function() {
    let selectedFile = null;

    /**
     * [1] 섹션 변경 감지 (page1.html 등에서 호출)
     */
    window.onSectionChange = function(sectionId) {
        console.log("📂 섹션 변경 감지:", sectionId);
        if (sectionId === 'upload') {
            // 업로드 섹션 진입 시 파일 목록 즉시 로드
            if (typeof window.listFiles === 'function') {
                window.listFiles(); 
            }
        }
    };

    /**
     * [2] 업로드된 파일 목록 불러오기
     */
    window.listFiles = async function() {
        const listEl = document.getElementById('fileList');
        if (!listEl) return;

        listEl.innerHTML = `<p style="text-align:center; padding:20px;">목록 로딩 중...</p>`;

        try {
            // [통합] window.tableName 우선 참조
            const folderName = window.tableName || new URLSearchParams(window.location.search).get('table') || 'default';
            
            const { data, error } = await _supabase.storage.from('excel-files').list(folderName + '/');
            
            if (error) throw error;

            // 불필요한 시스템 파일 제외
            const actualFiles = data.filter(file => 
                !['.emptyFolder', '.emptyFolderPlaceholder', 'product_assets'].includes(file.name)
            );

            if (!actualFiles || actualFiles.length === 0) {
                listEl.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: #a0aec0; background: white; border-radius: 12px; border: 1px solid #eee;">
                        <p style="font-size: 16px; margin: 0;">📁 업로드된 파일이 없습니다.</p>
                    </div>`;
                return;
            }

            let html = `
                <div style="padding: 12px; background: #f8f9fa; font-weight: bold; display: flex; border-bottom: 2px solid #dee2e6; font-size: 14px;">
                    <div style="flex: 2;">파일명</div>
                    <div style="flex: 1; text-align: center;">업로드 날짜</div>
                    <div style="flex: 1; text-align: center;">관리</div>
                </div>
            `;

            actualFiles.forEach(file => {
                let displayName = file.name;
                let displayDate = "-";
                
                try {
                    // 파일명 복호화 로직 (Hex -> UTF-8)
                    const lastDotIndex = file.name.lastIndexOf('.');
                    const nameWithoutExt = lastDotIndex > 0 ? file.name.substring(0, lastDotIndex) : file.name;
                    const ext = lastDotIndex > 0 ? file.name.substring(lastDotIndex) : '';
                    const dateMatch = nameWithoutExt.match(/^(.+?)--(\d{8})$/);

                    if (dateMatch) {
                        const hexName = dateMatch[1];
                        const rawDate = dateMatch[2];
                        if (hexName && /^[0-9a-f]+$/i.test(hexName)) {
                            const hexBytes = hexName.match(/.{1,2}/g);
                            const bytes = new Uint8Array(hexBytes.map(byte => parseInt(byte, 16)));
                            displayName = new TextDecoder('utf-8').decode(bytes) + ext;
                            displayDate = `${rawDate.substring(0,4)}-${rawDate.substring(4,6)}-${rawDate.substring(6,8)}`;
                        }
                    }
                } catch (e) { displayName = file.name; }

                // 공용 URL 생성
                const { data: urlData } = _supabase.storage.from('excel-files').getPublicUrl(`${folderName}/${file.name}`);

                html += `
                    <div class="file-row" style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; background: white;">
                        <div style="flex: 2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">📄 ${displayName}</div>
                        <div style="flex: 1; text-align: center; color: #718096; font-size: 13px;">${displayDate}</div>
                        <div style="flex: 1; text-align: center; display: flex; justify-content: center; gap: 10px;">
                            <button onclick="window.downloadFile('${urlData.publicUrl}', '${displayName}')" style="color:#3498db; background:none; border:none; cursor:pointer; font-weight:600;">다운로드</button>
                            <button onclick="window.deleteFile('${file.name}')" style="color:#e53e3e; background:none; border:none; cursor:pointer; font-weight:600;">삭제</button>
                        </div>
                    </div>
                `;
            });
            listEl.innerHTML = html;
        } catch (err) {
            listEl.innerHTML = `<p style="padding:20px; color:#e53e3e;">에러 발생: ${err.message}</p>`;
        }
    };

    /**
     * [3] 파일 업로드 실행
     */
    window.uploadFile = async function() {
        if (!selectedFile) return;
        const status = document.getElementById('uploadStatus');
        status.innerText = "🚀 서버로 전송 중...";

        const originalName = selectedFile.name;
        const lastDotIndex = originalName.lastIndexOf('.');
        const fileExt = lastDotIndex > 0 ? originalName.substring(lastDotIndex + 1) : '';
        const nameNoExt = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
        
        const now = new Date();
        const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        
        // 한글 파일명 깨짐 방지를 위한 Hex 인코딩
        const encoder = new TextEncoder();
        const hexName = Array.from(encoder.encode(nameNoExt)).map(b => b.toString(16).padStart(2, '0')).join('');
        const safeFileName = fileExt ? `${hexName}--${dateStr}.${fileExt}` : `${hexName}--${dateStr}`;
        const folderName = window.tableName || 'default';
        const filePath = `${folderName}/${safeFileName}`;

        try {
            const { error } = await _supabase.storage.from('excel-files').upload(filePath, selectedFile, { upsert: true });
            if (error) throw error;

            status.innerText = "✅ 업로드 성공!";
            selectedFile = null;
            document.getElementById('uploadBtn').style.display = 'none';
            document.getElementById('selectedFileName').innerText = "";
            document.getElementById('dropText').innerText = "📤 파일을 여기로 끌어다 놓으세요";
            
            // 목록 새로고침
            setTimeout(() => window.listFiles(), 500);
        } catch (error) { 
            status.innerText = `❌ 실패: ${error.message}`; 
        }
    };

    /**
     * [4] 다운로드 및 삭제
     */
    window.downloadFile = async function(url, fileName) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName; // 원래 파일명으로 다운로드
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) { alert('다운로드에 실패했습니다.'); }
    };

    window.deleteFile = async function(fileName) {
        if (!confirm("정말로 이 파일을 삭제하시겠습니까?")) return;
        try {
            const folderName = window.tableName || 'default';
            const { error } = await _supabase.storage.from('excel-files').remove([`${folderName}/${fileName}`]);
            if (error) throw error;
            window.listFiles();
        } catch (error) { alert("삭제 실패"); }
    };

    /**
     * [5] 드래그 앤 드롭 핸들러
     */
    window.handleDragOver = function(e) { 
        e.preventDefault(); 
        document.getElementById('dropZone').style.borderColor = "#3498db"; 
        document.getElementById('dropZone').style.background = "#ebf8ff";
    };
    window.handleDragLeave = function(e) { 
        e.preventDefault(); 
        document.getElementById('dropZone').style.borderColor = "#cbd5e0"; 
        document.getElementById('dropZone').style.background = "#f8fafc";
    };
    window.handleDrop = function(e) {
        e.preventDefault();
        window.handleDragLeave(e);
        if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
    };
    window.handleFileSelect = function(e) {
        if (e.target.files.length > 0) processFile(e.target.files[0]);
    };

    function processFile(file) {
        selectedFile = file;
        document.getElementById('selectedFileName').innerText = "📍 선택된 파일: " + file.name;
        document.getElementById('uploadBtn').style.display = 'block';
        document.getElementById('dropText').innerText = "파일 업로드 준비 완료!";
        document.getElementById('uploadStatus').innerText = "";
    }
})();