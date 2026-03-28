/**
 * YOUTUBE REMOTE EXTENSION - FULL UPDATE 2026
 * Chức năng: Điều khiển Video + Phản hồi trạng thái (Volume, Ads) về Flutter
 */

const socket = new WebSocket('ws://localhost:8080');

// 1. KẾT NỐI & GỬI TRẠNG THÁI ĐỊNH KỲ
socket.onopen = () => {
    console.log("🟢 [Extension] Đã kết nối với Trạm trung chuyển!");
    
    // Gửi trạng thái YouTube về App mỗi 500ms (0.5 giây)
    setInterval(() => {
        sendYouTubeState();
    }, 500);
};

// 2. HÀM QUÉT VÀ GỬI TRẠNG THÁI (VOLUME, ADS, SKIP)
function sendYouTubeState() {
    const video = document.querySelector('.video-stream.html5-main-video') || document.querySelector('video');
    const moviePlayer = document.querySelector('#movie_player');

    if (!video || socket.readyState !== WebSocket.OPEN) return;

    // Kiểm tra quảng cáo
    const isAdShowing = moviePlayer && moviePlayer.classList.contains('ad-showing');
    
    // Tìm nút Skip (nếu có)
    const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
    
    // Lấy text đếm ngược quảng cáo (ví dụ: "Video sẽ bắt đầu sau 5")
    const adText = document.querySelector('.ytp-ad-preview-text, .ytp-ad-text')?.innerText || "";

    const statusData = {
        type: 'YOUTUBE_STATE',
        volume: Math.round(video.volume * 100),
        isMuted: video.muted,
        isAdShowing: isAdShowing,
        adTimeLeft: adText,
        canSkipAd: !!(skipBtn && skipBtn.offsetParent !== null), // Nút tồn tại và đang hiển thị
        videoTitle: document.title.replace(" - YouTube", "")
    };

    // Gửi dữ liệu dưới dạng chuỗi JSON
    socket.send(JSON.stringify(statusData));
}

// 3. LẮNG NGHE LỆNH TỪ ĐIỆN THOẠI
socket.onmessage = (event) => {
    const command = event.data;
    const video = document.querySelector('.video-stream.html5-main-video') || document.querySelector('video');

    console.log("🤖 Nhận lệnh:", command);

    switch (command) {
        case 'SKIP_AD': {
            // Ưu tiên 1: Tua nhanh thời gian (Phá khóa mọi loại quảng cáo)
            const moviePlayer = document.querySelector('#movie_player');
            if (moviePlayer && moviePlayer.classList.contains('ad-showing') && video) {
                video.currentTime = video.duration || 9999;
                console.log("⏩ Đã ép tua nhanh quảng cáo!");
            }
            // Ưu tiên 2: Bấm nút Skip vật lý
            const btn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
            if (btn) btn.click();
            break;
        }

        case 'PLAY_PAUSE': {
            if (video) video.paused ? video.play() : video.pause();
            break;
        }

        case 'NEXT_VIDEO': {
            const nextBtn = document.querySelector('.ytp-next-button');
            if (nextBtn) nextBtn.click();
            break;
        }

        case 'RELOAD_YOUTUBE': {
            window.location.reload();
            break;
        }

        case 'VOLUME_UP': {
            if (video) {
                video.volume = Math.min(video.volume + 0.1, 1);
                if (video.muted) video.muted = false;
            }
            break;
        }

        case 'VOLUME_DOWN': {
            if (video) {
                video.volume = Math.max(video.volume - 0.1, 0);
            }
            break;
        }

        case 'MUTE_UNMUTE': {
            if (video) video.muted = !video.muted;
            break;
        }

        default:
            console.log("⚠️ Lệnh lạ:", command);
    }
};

socket.onclose = () => {
    console.log("🔴 [Extension] Mất kết nối WebSocket.");
};