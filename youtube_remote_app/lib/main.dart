import 'dart:convert'; // Quan trọng: Để dùng jsonDecode

import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'YouTube Remote Pro',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF121212),
        useMaterial3: true,
      ),
      home: const RemoteControlScreen(),
    );
  }
}

class RemoteControlScreen extends StatefulWidget {
  const RemoteControlScreen({super.key});

  @override
  State<RemoteControlScreen> createState() => _RemoteControlScreenState();
}

class _RemoteControlScreenState extends State<RemoteControlScreen> {
  final String serverUrl = 'ws://192.168.1.12:8080';
  late WebSocketChannel channel;

  // --- CÁC BIẾN TRẠNG THÁI NHẬN TỪ YOUTUBE ---
  int _volume = 0;
  bool _isAdShowing = false;
  String _adText = "";
  bool _canSkip = false;
  bool _isMuted = false;
  String _videoTitle = "Đang chờ kết nối...";

  @override
  void initState() {
    super.initState();
    _connectWebSocket();
  }

  void _connectWebSocket() {
    channel = WebSocketChannel.connect(Uri.parse(serverUrl));

    // Lắng nghe dữ liệu phản hồi từ Extension
    channel.stream.listen(
      (message) {
        try {
          final data = jsonDecode(message.toString());
          if (data['type'] == 'YOUTUBE_STATE') {
            setState(() {
              _volume = data['volume'];
              _isAdShowing = data['isAdShowing'];
              _adText = data['adTimeLeft'];
              _canSkip = data['canSkipAd'];
              _isMuted = data['isMuted'];
              _videoTitle = data['videoTitle'];
            });
          }
        } catch (e) {
          // Nếu không phải JSON (là lệnh text) thì bỏ qua
        }
      },
      onDone: () {
        debugPrint("Mất kết nối Server");
      },
      onError: (err) {
        debugPrint("Lỗi: $err");
      },
    );
  }

  void sendCommand(String command) {
    channel.sink.add(command);
    // Hiệu ứng rung nhẹ hoặc feedback ở đây nếu muốn
  }

  @override
  void dispose() {
    channel.sink.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'YT REMOTE PRO',
          style: TextStyle(
            letterSpacing: 2,
            fontWeight: FontWeight.w900,
            fontSize: 18,
          ),
        ),
        backgroundColor: Colors.transparent,
        centerTitle: true,
        actions: [
          IconButton(
            icon: Icon(
              Icons.circle,
              color: _volume > 0 ? Colors.green : Colors.red,
              size: 12,
            ),
            onPressed: () => _connectWebSocket(), // Bấm để thử kết nối lại
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Column(
            children: [
              // 1. DASHBOARD THÔNG TIN
              _buildDashboard(),

              const Spacer(),

              // 2. CẢNH BÁO QUẢNG CÁO (CHỈ HIỆN KHI CÓ AD)
              _buildAdAlert(),

              const Spacer(),

              // 3. NÚT SKIP AD CHÍNH
              _buildHeroSkipButton(),

              const SizedBox(height: 40),

              // 4. CỤM ĐIỀU KHIỂN MEDIA
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _buildRemoteButton(
                    icon: Icons.refresh,
                    command: 'RELOAD_YOUTUBE',
                    bgColor: Colors.white10,
                  ),
                  const SizedBox(width: 30),
                  _buildRemoteButton(
                    icon: Icons.play_arrow_rounded,
                    command: 'PLAY_PAUSE',
                    bgColor: Colors.redAccent.shade700,
                    iconSize: 50,
                    padding: 25,
                    hasGlow: true,
                  ),
                  const SizedBox(width: 30),
                  _buildRemoteButton(
                    icon: Icons.skip_next,
                    command: 'NEXT_VIDEO',
                    bgColor: Colors.white10,
                  ),
                ],
              ),

              const SizedBox(height: 40),

              // 5. CỤM ÂM LƯỢNG
              _buildVolumePad(),

              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDashboard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(25),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        children: [
          Text(
            _videoTitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Colors.white70, fontSize: 14),
          ),
          const SizedBox(height: 15),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _infoItem(
                Icons.volume_up,
                "$_volume%",
                "VOLUME",
                Colors.blueAccent,
              ),
              _infoItem(
                _isAdShowing
                    ? Icons.warning_amber_rounded
                    : Icons.check_circle_outline,
                _isAdShowing ? "YES" : "NO",
                "AD DETECTED",
                _isAdShowing ? Colors.orangeAccent : Colors.greenAccent,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _infoItem(IconData icon, String value, String label, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 28),
        Text(
          value,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
        ),
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: Colors.white38),
        ),
      ],
    );
  }

  Widget _buildAdAlert() {
    if (!_isAdShowing) return const SizedBox(height: 50);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _canSkip
            ? Colors.green.withOpacity(0.2)
            : Colors.orange.withOpacity(0.1),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(
          color: _canSkip ? Colors.green : Colors.orange.withOpacity(0.5),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: _canSkip ? Colors.green : Colors.orange,
            ),
          ),
          const SizedBox(width: 15),
          Text(
            _canSkip ? "CÓ THỂ BẤM SKIP NGAY!" : "ĐANG CHỜ AD: $_adText",
            style: TextStyle(
              color: _canSkip ? Colors.green : Colors.orange,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeroSkipButton() {
    return ElevatedButton.icon(
      onPressed: () => sendCommand('SKIP_AD'),
      icon: const Icon(
        Icons.fast_forward_rounded,
        size: 36,
        color: Colors.black,
      ),
      label: const Text(
        'SKIP AD',
        style: TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.w900,
          color: Colors.black,
        ),
      ),
      style: ElevatedButton.styleFrom(
        backgroundColor: _isAdShowing ? Colors.amberAccent : Colors.grey[800],
        padding: const EdgeInsets.symmetric(horizontal: 50, vertical: 20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        elevation: _isAdShowing ? 12 : 0,
      ),
    );
  }

  Widget _buildVolumePad() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(35),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _buildRemoteButton(
            icon: Icons.volume_down,
            command: 'VOLUME_DOWN',
            bgColor: Colors.transparent,
            iconSize: 30,
          ),
          _buildRemoteButton(
            icon: _isMuted ? Icons.volume_off : Icons.volume_up,
            command: 'MUTE_UNMUTE',
            bgColor: Colors.white.withOpacity(0.05),
            iconSize: 25,
          ),
          _buildRemoteButton(
            icon: Icons.volume_up,
            command: 'VOLUME_UP',
            bgColor: Colors.transparent,
            iconSize: 30,
          ),
        ],
      ),
    );
  }

  Widget _buildRemoteButton({
    required IconData icon,
    required String command,
    required Color bgColor,
    double iconSize = 35,
    double padding = 20,
    bool hasGlow = false,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => sendCommand(command),
        borderRadius: BorderRadius.circular(50),
        child: Ink(
          padding: EdgeInsets.all(padding),
          decoration: BoxDecoration(
            color: bgColor,
            shape: BoxShape.circle,
            boxShadow: hasGlow
                ? [
                    BoxShadow(
                      color: bgColor.withOpacity(0.5),
                      blurRadius: 20,
                      spreadRadius: 2,
                    ),
                  ]
                : null,
          ),
          child: Icon(icon, size: iconSize, color: Colors.white),
        ),
      ),
    );
  }
}
