// upload-logic.js
(function() {
    let selectedFile = null;

    // [핵심 수정] 전역에서 접근 가능하도록 window에 연결
    window.onSectionChange = function(sectionId) {
        console.log("Section changed to:", sectionId);
        if (sectionId === 'dashboard') {
            if (typeof window.fetchImages === 'function') window.fetchImages();
        } else if (sectionId === 'upload') {
            window.listFiles(); // 파일 업로드 섹션 진입 시 목록 로드
        }
    };

    // 업로드된 파일 목록 불러오기
    window.listFiles = async function() {
        const listEl = document.getElementById('fileList');
        if (!listEl) return;

        try {
            // tableName이 정의되어 있는지 확인
            const folderName = typeof tableName !== 'undefined' ? tableName : 'default';
            const { data, error } = await _supabase.storage.from('excel-files').list(folderName + '/');
            
            if (error) throw error;

            const actualFiles = data.filter(file => 
                file.name !== '.emptyFolder' && 
                file.name !== '.emptyFolderPlaceholder' &&
                file.name !== 'product_assets'
            );

            if (!actualFiles || actualFiles.length === 0) {
                listEl.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: #a0aec0; background: white; border-radius: 12px;">
                        <p style="font-size: 16px; margin: 0;">📁 업로드된 파일이 없습니다.</p>
                    </div>`;
                return;
            }

            let html = `
                <div style="padding: 10px; background: #f8f9fa; font-weight: bold; display: flex; border-bottom: 2px solid #dee2e6;">
                    <div style="flex: 2;">파일명</div>
                    <div style="flex: 1; text-align: center;">업로드 날짜</div>
                    <div style="flex: 1; text-align: center;">관리</div>
                </div>
            `;

            actualFiles.forEach(file => {
                let displayName = file.name;
                let displayDate = "-";
                try {
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
                            displayDate = `${rawDate.substring(0,4)}. ${rawDate.substring(4,6)}. ${rawDate.substring(6,8)}.`;
                        }
                    }
                } catch (e) { displayName = file.name; }

                const { data: urlData } = _supabase.storage.from('excel-files').getPublicUrl(`${folderName}/${file.name}`);

                html += `
                    <div class="file-row" style="display: flex; align-items: center; padding: 12px 10px; border-bottom: 1px solid #eee; font-size: 14px;">
                        <div style="flex: 2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📄 ${displayName}</div>
                        <div style="flex: 1; text-align: center; color: #666; font-size: 12px;">${displayDate}</div>
                        <div style="flex: 1; text-align: center; display: flex; justify-content: center; gap: 8px;">
                            <button onclick="downloadFile('${urlData.publicUrl}', '${displayName}')" style="color:#3498db; background:none; border:none; cursor:pointer; font-weight:bold; padding:0 5px;">다운로드</button>
                            <button onclick="deleteFile('${file.name}')" style="color:#e74c3c; background:none; border:none; cursor:pointer; font-weight:bold; padding:0 5px;">삭제</button>
                        </div>
                    </div>
                `;
            });
            listEl.innerHTML = html;
        } catch (err) {
            listEl.innerHTML = `<p style="padding:20px; color:red;">에러: ${err.message}</p>`;
        }
    };

    // 파일 업로드 실행
    window.uploadFile = async function() {
        if (!selectedFile) return;
        const status = document.getElementById('uploadStatus');
        status.innerText = "서버로 전송 중...";

        const originalName = selectedFile.name;
        const lastDotIndex = originalName.lastIndexOf('.');
        const fileExt = lastDotIndex > 0 ? originalName.substring(lastDotIndex + 1) : '';
        const nameNoExt = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
        
        const now = new Date();
        const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        
        const encoder = new TextEncoder();
        const hexName = Array.from(encoder.encode(nameNoExt)).map(b => b.toString(16).padStart(2, '0')).join('');
        const safeFileName = fileExt ? `${hexName}--${dateStr}.${fileExt}` : `${hexName}--${dateStr}`;
        const folderName = typeof tableName !== 'undefined' ? tableName : 'default';
        const filePath = `${folderName}/${safeFileName}`;

        try {
            const { error } = await _supabase.storage.from('excel-files').upload(filePath, selectedFile, { upsert: true });
            if (error) throw error;
            status.innerText = "✅ 업로드 성공!";
            selectedFile = null;
            document.getElementById('uploadBtn').style.display = 'none';
            document.getElementById('selectedFileName').innerText = "";
            document.getElementById('dropText').innerText = "📤 파일을 여기로 끌어다 놓으세요";
            setTimeout(() => window.listFiles(), 500);
        } catch (error) { 
            status.innerText = `❌ 실패: ${error.message}`; 
        }
    };

    // 파일 다운로드 및 삭제 함수
    window.downloadFile = async function(url, fileName) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const cleanFileName = fileName.replace(/--\d{8}(?=\.[^.]+)?$/, '');
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = cleanFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) { alert('다운로드 실패'); }
    };

    window.deleteFile = async function(fileName) {
        if (!confirm("정말로 이 파일을 삭제하시겠습니까?")) return;
        try {
            const folderName = typeof tableName !== 'undefined' ? tableName : 'default';
            const { error } = await _supabase.storage.from('excel-files').remove([`${folderName}/${fileName}`]);
            if (error) throw error;
            window.listFiles();
        } catch (error) { alert("삭제 실패"); }
    };

    // --- 드래그 앤 드롭 핸들러 ---
    window.handleDragOver = function(e) { e.preventDefault(); document.getElementById('dropZone').style.borderColor = "#3498db"; };
    window.handleDragLeave = function(e) { e.preventDefault(); document.getElementById('dropZone').style.borderColor = "#cbd5e0"; };
    window.handleDrop = function(e) {
        e.preventDefault();
        document.getElementById('dropZone').style.borderColor = "#cbd5e0";
        if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
    };
    window.handleFileSelect = function(e) {
        if (e.target.files.length > 0) processFile(e.target.files[0]);
    };

    function processFile(file) {
        selectedFile = file;
        document.getElementById('selectedFileName').innerText = "선택된 파일: " + file.name;
        document.getElementById('uploadBtn').style.display = 'block';
        document.getElementById('dropText').innerText = "파일 준비 완료!";
    }
})();