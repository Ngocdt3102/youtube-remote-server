const WebSocket = require('ws');

// Khởi tạo server chạy ở cổng 8080
const port = 8080;
const wss = new WebSocket.Server({ port: port });

console.log(`🚀 [Server] Trạm trung chuyển đang chạy tại cổng ${port}...`);
console.log(`👉 Đang chờ Extension và App Flutter kết nối...`);

wss.on('connection', function connection(ws, req) {
    // Lấy IP của thiết bị kết nối để dễ quản lý
    const ip = req.socket.remoteAddress;
    console.log(`🟢 [Kết nối] Thiết bị mới từ: ${ip}`);

    ws.on('message', function incoming(message) {
        // Chuyển dữ liệu từ Buffer sang String
        const rawData = message.toString();
        
        // Log để bạn dễ debug trên terminal của máy tính
        try {
            // Kiểm tra xem dữ liệu nhận được là JSON (Trạng thái) hay String (Lệnh)
            const parsed = JSON.parse(rawData);
            if (parsed.type === 'YOUTUBE_STATE') {
                console.log(`📊 [State] Đang cập nhật Volume: ${parsed.volume}% | Ads: ${parsed.isAdShowing}`);
            }
        } catch (e) {
            // Nếu không phải JSON thì là lệnh điều khiển bình thường
            console.log(`📩 [Lệnh] Nhận được: ${rawData}`);
        }

        // BROADCAST: Gửi dữ liệu này tới TẤT CẢ các thiết bị đang kết nối
        // Chúng ta gửi cho cả chính thiết bị gửi để đảm bảo tính đồng bộ (optional)
        // Hoặc giữ nguyên client !== ws nếu bạn muốn tiết kiệm băng thông
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                // Ở phiên bản này, mình bỏ điều kiện 'client !== ws' 
                // để App Flutter cũng có thể nhận xác nhận ngay lập tức nếu cần
                client.send(rawData);
            }
        });
    });

    ws.on('close', () => {
        console.log("🔴 [Ngắt kết nối] Một thiết bị đã rời khỏi mạng.");
    });

    ws.on('error', (error) => {
        console.error("⚠️ [Lỗi Server]:", error.message);
    });
});