const http = require('http');
const WebSocket = require('ws');

const port = process.env.PORT || 8080;

// HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("🚀 WebSocket server is running");
});

// WebSocket attach vào HTTP
const wss = new WebSocket.Server({ server });

// Lưu rooms
const rooms = {};

server.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
});

// ==========================
// 🧠 UTILS
// ==========================

function generateRoomCode() {
    let code;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms[code]);
    return code;
}

function heartbeat() {
    this.isAlive = true;
}

setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

// ==========================
// 🔗 CONNECTION
// ==========================

wss.on('connection', (ws) => {
    console.log("🟢 Client connected");

    ws.isAlive = true;
    ws.on('pong', heartbeat);
    ws.roomCode = null;

    ws.on('message', (message) => {
        let data;
        const rawData = message.toString();

        try {
            data = JSON.parse(rawData);
        } catch {
            data = { type: rawData };
        }

        // ==========================
        // 🏠 CREATE ROOM (ĐÃ NÂNG CẤP AUTO-RECONNECT)
        // ==========================
        if (data.type === 'CREATE_ROOM') {
            if (ws.roomCode) {
                ws.send(JSON.stringify({ type: 'ALREADY_IN_ROOM' }));
                return;
            }

            let roomCode = data.code; // Lấy mã do Extension gửi lên (nếu có)

            // Nếu không có mã, hoặc mã bị trùng lặp phức tạp -> Tạo mới
            if (!roomCode) {
                roomCode = generateRoomCode();
                rooms[roomCode] = [ws];
                console.log(`🏠 Room created randomly: ${roomCode}`);
            } else {
                // Nếu Extension gửi mã cũ (Khi F5 Reload trang)
                if (!rooms[roomCode]) {
                    // Phòng cũ đã bị xóa, tạo lại phòng với đúng mã đó
                    rooms[roomCode] = [ws];
                    console.log(`🏠 Room recreated from session: ${roomCode}`);
                } else {
                    // Xóa các kết nối chết (Ghost) trước khi thêm vào
                    rooms[roomCode] = rooms[roomCode].filter(c => c.readyState === WebSocket.OPEN);
                    
                    rooms[roomCode].push(ws);
                    console.log(`🏠 Extension rejoined room: ${roomCode}`);
                }
            }

            ws.roomCode = roomCode;

            // Báo cho Extension biết mã phòng
            ws.send(JSON.stringify({
                type: 'ROOM_CREATED',
                code: roomCode
            }));

            // 🔥 QUAN TRỌNG: Nếu điện thoại vẫn đang đợi trong phòng này
            // Lập tức báo cho cả 2 thiết bị nối lại với nhau!
            if (rooms[roomCode].length >= 2) {
                rooms[roomCode].forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'PARTNER_CONNECTED' }));
                    }
                });
            }

            return;
        }

        // ==========================
        // 📱 JOIN ROOM (TỪ ĐIỆN THOẠI)
        // ==========================
        if (data.type === 'JOIN_ROOM') {
            if (ws.roomCode) {
                ws.send(JSON.stringify({ type: 'ALREADY_IN_ROOM' }));
                return;
            }

            const code = data.code;

            if (!rooms[code]) {
                ws.send(JSON.stringify({
                    type: 'JOIN_ERROR',
                    message: 'Mã phòng không tồn tại'
                }));
                return;
            }

            // 🛠 Lọc bỏ kết nối chết trước khi kiểm tra số lượng
            rooms[code] = rooms[code].filter(c => c.readyState === WebSocket.OPEN);

            if (rooms[code].length >= 2) {
                ws.send(JSON.stringify({ type: 'ROOM_FULL' }));
                return;
            }

            // 👉 Điện thoại tham gia phòng
            rooms[code].push(ws);
            ws.roomCode = code;

            // 👉 Xác nhận cho điện thoại
            ws.send(JSON.stringify({
                type: 'JOIN_SUCCESS',
                code: code
            }));

            console.log(`📱 Mobile joined room: ${code}`);

            // 👉 Báo cho Chrome Extension biết điện thoại đã vào
            rooms[code].forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'PARTNER_CONNECTED' }));
                }
            });

            return;
        }

        // ==========================
        // 🔁 RELAY MESSAGE (CHUYỂN TIẾP LỆNH)
        // ==========================
        if (ws.roomCode && rooms[ws.roomCode]) {
            rooms[ws.roomCode].forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(rawData);
                }
            });
        }
    });

    // ==========================
    // ❌ DISCONNECT
    // ==========================
    ws.on('close', () => {
        const room = ws.roomCode;

        if (room && rooms[room]) {
            rooms[room] = rooms[room].filter(c => c !== ws);
            console.log(`🔴 Client left room ${room}`);

            // 👉 Báo cho thiết bị còn lại biết partner đã mất kết nối
            rooms[room].forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'PARTNER_DISCONNECTED' }));
                }
            });

            // Chỉ xóa phòng nếu TRỐNG HOÀN TOÀN
            if (rooms[room].length === 0) {
                delete rooms[room];
                console.log(`🗑️ Room deleted: ${room}`);
            }
        }

        ws.roomCode = null;
    });

    ws.on('error', (err) => {
        console.error("⚠️ Error:", err.message);
    });
});