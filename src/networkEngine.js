import { Peer } from 'peerjs';

/**
 * Multiplayer Network Engine for Chess 3D
 * Supports both WebRTC (PeerJS) for cross-device/internet play
 * and BroadcastChannel for instant local multi-tab play.
 */
export class NetworkEngine {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.broadcastChannel = null;
    this.roomCode = null;
    this.role = null; // 'host' or 'guest'
    this.myColor = 'w';
    this.isConnected = false;
    this.processedMessageIds = new Set();

    // Callbacks
    this.onConnected = null;
    this.onDisconnected = null;
    this.onRemoteMove = null;
    this.onRemoteRematch = null;
    this.onRemoteResign = null;
    this.onError = null;
  }

  // Generate random 6-character room code (e.g., "K9X2P7")
  static generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  getPeerIdForRoom(code) {
    return `chess3d-rm-${code.trim().toLowerCase()}`;
  }

  // Create Room as Host
  createRoom(roomCode, hostColor = 'w', timeLimit = 600) {
    this.cleanup();
    this.roomCode = roomCode.trim().toUpperCase();
    this.role = 'host';
    this.myColor = hostColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : hostColor;
    const peerId = this.getPeerIdForRoom(this.roomCode);

    // 1. Setup BroadcastChannel fallback
    this.setupBroadcastChannel();

    // 2. Setup PeerJS
    try {
      this.peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        console.log('[Multiplayer] Host room created with peer ID:', id);
      });

      this.peer.on('connection', (connection) => {
        this.conn = connection;
        this.setupConnectionHandlers();
        // Send welcome payload with colors & configuration
        setTimeout(() => {
          this.sendMessage({
            type: 'WELCOME',
            hostColor: this.myColor,
            timeLimit
          });
          this.handleConnected('Khách');
        }, 300);
      });

      this.peer.on('error', (err) => {
        console.warn('[Multiplayer] Peer error:', err);
        if (err.type === 'unavailable-id') {
          if (this.onError) this.onError('Mã phòng này đang được sử dụng. Vui lòng thử tạo mã khác.');
        }
      });
    } catch (e) {
      console.warn('[Multiplayer] Failed to init PeerJS, falling back to BroadcastChannel', e);
    }
  }

  // Join Room as Guest
  joinRoom(roomCode) {
    this.cleanup();
    this.roomCode = roomCode.trim().toUpperCase();
    this.role = 'guest';
    const hostPeerId = this.getPeerIdForRoom(this.roomCode);

    // 1. Setup BroadcastChannel fallback
    this.setupBroadcastChannel();
    // Announce to broadcast channel in case host is in another tab
    setTimeout(() => {
      this.sendMessage({ type: 'HELLO_BROADCAST', from: 'guest' });
    }, 150);

    // 2. Setup PeerJS connection to Host
    try {
      this.peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', () => {
        this.conn = this.peer.connect(hostPeerId, { reliable: true });
        this.setupConnectionHandlers();
      });

      this.peer.on('error', (err) => {
        console.warn('[Multiplayer] Peer join error:', err);
        // If broadcast channel worked, ignore peer error
        if (!this.isConnected && this.onError) {
          this.onError('Không thể kết nối tới phòng. Vui lòng kiểm tra lại mã phòng!');
        }
      });
    } catch (e) {
      console.warn('[Multiplayer] Failed to join via PeerJS', e);
    }
  }

  setupBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel(`chess3d-bc-${this.roomCode}`);
      this.broadcastChannel.onmessage = (event) => {
        this.handleIncomingData(event.data);
      };
    }
  }

  setupConnectionHandlers() {
    if (!this.conn) return;

    this.conn.on('open', () => {
      console.log('[Multiplayer] WebRTC Data channel connected!');
      if (this.role === 'guest') {
        this.sendMessage({ type: 'HELLO' });
      }
    });

    this.conn.on('data', (data) => {
      this.handleIncomingData(data);
    });

    this.conn.on('close', () => {
      this.handleDisconnected();
    });

    this.conn.on('error', (err) => {
      console.warn('[Multiplayer] Connection error:', err);
    });
  }

  sendMessage(payload) {
    const msgId = `${Date.now()}-${Math.random()}`;
    const wrapped = { ...payload, _msgId: msgId, _sender: this.role };
    this.processedMessageIds.add(msgId);

    // 1. Send via PeerJS WebRTC if open
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(wrapped);
      } catch (e) {
        console.warn('[Multiplayer] Error sending via WebRTC:', e);
      }
    }

    // 2. Send via BroadcastChannel (for same browser / tabs)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(wrapped);
      } catch (e) {
        console.warn('[Multiplayer] Error sending via BroadcastChannel:', e);
      }
    }
  }

  handleIncomingData(data) {
    if (!data || typeof data !== 'object') return;
    if (data._sender === this.role) return; // Ignore own broadcast messages
    if (data._msgId && this.processedMessageIds.has(data._msgId)) return; // Deduplicate
    if (data._msgId) this.processedMessageIds.add(data._msgId);

    console.log('[Multiplayer] Received message:', data.type, data);

    switch (data.type) {
      case 'HELLO':
      case 'HELLO_BROADCAST':
        if (this.role === 'host') {
          this.sendMessage({
            type: 'WELCOME',
            hostColor: this.myColor
          });
          this.handleConnected('Khách');
        }
        break;

      case 'WELCOME':
        if (this.role === 'guest') {
          // Guest is opposite of host's color
          this.myColor = data.hostColor === 'w' ? 'b' : 'w';
          this.handleConnected('Chủ phòng');
        }
        break;

      case 'MOVE':
        if (this.onRemoteMove) {
          this.onRemoteMove(data);
        }
        break;

      case 'REMATCH':
        if (this.onRemoteRematch) {
          this.onRemoteRematch();
        }
        break;

      case 'RESIGN':
        if (this.onRemoteResign) {
          this.onRemoteResign();
        }
        break;
    }
  }

  handleConnected(opponentName) {
    if (this.isConnected) return;
    this.isConnected = true;
    if (this.onConnected) {
      this.onConnected({
        role: this.role,
        myColor: this.myColor,
        roomCode: this.roomCode,
        opponentName
      });
    }
  }

  handleDisconnected() {
    if (!this.isConnected) return;
    this.isConnected = false;
    if (this.onDisconnected) {
      this.onDisconnected();
    }
  }

  sendMove(move, promotionChoice = 'q') {
    this.sendMessage({
      type: 'MOVE',
      from: move.from,
      to: move.to,
      promotion: promotionChoice
    });
  }

  sendRematch() {
    this.sendMessage({ type: 'REMATCH' });
  }

  sendResign() {
    this.sendMessage({ type: 'RESIGN' });
  }

  cleanup() {
    this.isConnected = false;
    if (this.conn) {
      try { this.conn.close(); } catch (e) {}
      this.conn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    if (this.broadcastChannel) {
      try { this.broadcastChannel.close(); } catch (e) {}
      this.broadcastChannel = null;
    }
    this.processedMessageIds.clear();
  }
}
