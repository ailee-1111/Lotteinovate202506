const http = require('http');
const express = require('express');
const WebSocket = require('ws'); // ws 라이브러리
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server }); // 클라이언트가 이 서버에 연결
const KUBEVIRT_WS_BASE = 'wss://api.ocp.keco.or.kr:6443';
const NAMESPACE = 'test';
const VM_NAME = 'rhel8-black-skink-30';
const BEARER_TOKEN = 'sha256~ev0elaiRAY0kXLBikhTG6j1vWv6G-e4SjEkfh75xhKQ';
// **IMPORTANT: Use virtualmachineinstances for VNC console**
const kubevirtWSUrl = `${KUBEVIRT_WS_BASE}/apis/subresources.kubevirt.io/v1/namespaces/${NAMESPACE}/virtualmachineinstances/${VM_NAME}/vnc`;
wss.on('connection', (clientSocket, req) => {
  console.log("✅ 클라이언트 WebSocket 연결됨");
  console.log(`클라이언트 요청 경로: ${req.url}`);
  let targetSocket;
  try {
    targetSocket = new WebSocket(kubevirtWSUrl, {
      headers: {
        Authorization: `Bearer ${BEARER_TOKEN}`
      },
      // SSL 인증서 검증 비활성화 (개발/테스트용. 프로덕션에서는 CA 인증서 설정 필수!)
      rejectUnauthorized: false 
    });
  } catch (err) {
    console.error("❌ KubeVirt WebSocket 생성 오류:", err);
    clientSocket.close();
    return;
  }
  targetSocket.on('open', () => {
    console.log("🎯 KubeVirt VNC WebSocket 연결 완료");
    // 클라이언트 -> KubeVirt
    clientSocket.on('message', (msg) => {
      if (targetSocket.readyState === WebSocket.OPEN) {
        targetSocket.send(msg);
      } else {
        console.warn("KubeVirt WebSocket이 닫혀있어 클라이언트 메시지 전송 실패.");
      }
    });
    // KubeVirt -> 클라이언트
    targetSocket.on('message', (msg) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(msg);
      } else {
        console.warn("클라이언트 WebSocket이 닫혀있어 KubeVirt 메시지 전송 실패.");
      }
    });
    clientSocket.on('close', (code, reason) => {
      console.log(`❌ 클라이언트 WebSocket 연결 종료. 코드: ${code}, 이유: ${reason}`);
      if (targetSocket.readyState === WebSocket.OPEN) {
        targetSocket.close();
      }
    });
    targetSocket.on('close', (code, reason) => {
      console.log(`❌ KubeVirt VNC WebSocket 연결 종료. 코드: ${code}, 이유: ${reason}`);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close();
      }
    });
  });
  targetSocket.on('error', (err) => {
    console.error("❌ KubeVirt VNC WebSocket 에러:", err);
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close();
    }
  });
  clientSocket.on('error', (err) => {
    console.error("❌ 클라이언트 WebSocket 에러:", err);
    if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
      targetSocket.close();
    }
  });
});
app.use(express.static('public')); // noVNC HTML 경로
const PORT = 8081;
server.listen(PORT, () => {
  console.log(`🚀 프록시 서버가 http://localhost:${PORT} 에서 실행 중`);
  console.log(`🌐 noVNC 클라이언트로 접속: http://localhost:${PORT}/vnc.html`);
});
