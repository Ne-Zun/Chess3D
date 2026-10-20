import PeerModule from 'peerjs';
const Peer = PeerModule?.Peer || PeerModule?.default || PeerModule;

/**
 * Multiplayer Network Engine for Chess 3D
 * Supports WebRTC (PeerJS) for cross-device/internet play
 * with BroadcastChannel and LocalStorage Event Bus for 100% reliable local multi-tab play.
 */
export class NetworkEngine {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.broadcastChannel = null;
    this.storageListener = null;
    this.roomCode = null;
    this.role = null; // 'host' or 'guest'
    this.myColor = 'w';
    this.timeLimit = 600;
    this.isConnected = false;
    this.processedMessageIds = new Set();
    this.handshakeInterval = null;
    this.connectionTimeout = null;

    // Callbacks
    this.onConnected = null;
    this.onDisconnected = null;
    this.onRemoteMove = null;
    this.onRemoteRematch = null;
    this.onRemoteResign = null;
    this.onRemotePlayerLeft = null;
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
    this.timeLimit = timeLimit;
    const peerId = this.getPeerIdForRoom(this.roomCode);

    // 1. Setup Local Inter-Tab Transport (BroadcastChannel + LocalStorage fallback)
    this.setupLocalTransport();

    // 2. Setup PeerJS WebRTC
    try {
      this.peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        console.log('[Multiplayer] Host room created with peer ID:', id);
        // Announce room ready on local bus
        this.sendMessage({
          type: 'ROOM_READY',
          roomCode: this.roomCode,
          hostColor: this.myColor,
          timeLimit: this.timeLimit
        });
      });

      this.peer.on('connection', (connection) => {
        console.log('[Multiplayer] Incoming connection from guest!');
        this.conn = connection;
        this.setupConnectionHandlers();

        const sendWelcome = () => {
          this.sendMessage({
            type: 'WELCOME',
            hostColor: this.myColor,
            timeLimit: this.timeLimit
          });
          this.handleConnected('Khách');
        };

        if (this.conn.open) {
          sendWelcome();
        } else {
          this.conn.on('open', () => {
            sendWelcome();
          });
        }
      });

      this.peer.on('error', (err) => {
        console.warn('[Multiplayer] Peer host error:', err);
        if (err.type === 'unavailable-id') {
          // If the ID was recently used, retry with an altered ID or warn
          if (this.onError) {
            this.onError('Mã phòng này vừa được sử dụng hoặc đang mở. Hãy đổi mã mới!');
          }
        } else if (err.type === 'network' || err.type === 'server-error') {
          console.warn('[Multiplayer] Cloud signaling error, running on local channels');
        }
      });
    } catch (e) {
      console.warn('[Multiplayer] Failed to init PeerJS, falling back to Local Channels', e);
    }
  }

  // Join Room as Guest
  joinRoom(roomCode) {
    this.cleanup();
    this.roomCode = roomCode.trim().toUpperCase();
    this.role = 'guest';
    const hostPeerId = this.getPeerIdForRoom(this.roomCode);

    // 1. Setup Local Inter-Tab Transport
    this.setupLocalTransport();

    // Start 12s timeout for connection
    this.connectionTimeout = setTimeout(() => {
      if (!this.isConnected) {
        if (this.onError) {
          this.onError(`Không tìm thấy phòng "${this.roomCode}". Vui lòng kiểm tra lại mã và đảm bảo chủ phòng đã bấm "Mở Phòng"!`);
        }
      }
    }, 12000);

    // Immediately send HELLO on local channels
    const sendInitialHello = () => {
      this.sendMessage({
        type: 'HELLO',
        from: 'guest',
        roomCode: this.roomCode
      });
    };
    sendInitialHello();
    setTimeout(sendInitialHello, 250);
    setTimeout(sendInitialHello, 600);

    // 2. Setup PeerJS connection to Host
    try {
      this.peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', () => {
        console.log('[Multiplayer] Guest peer open, connecting to host:', hostPeerId);
        this.conn = this.peer.connect(hostPeerId, { reliable: true });
        this.setupConnectionHandlers();
      });

      this.peer.on('error', (err) => {
        console.warn('[Multiplayer] Peer join error:', err);
        // Only trigger error if local transport hasn't connected either
        if (!this.isConnected && err.type === 'peer-unavailable') {
          if (this.onError) {
            this.onError(`Phòng "${this.roomCode}" không tồn tại hoặc chủ phòng chưa online!`);
          }
        }
      });
    } catch (e) {
      console.warn('[Multiplayer] Failed to join via PeerJS, fallback to local', e);
    }
  }

  setupLocalTransport() {
    // 1. BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(`chess3d-bc-${this.roomCode}`);
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingData(event.data);
        };
      } catch (e) {
        console.warn('[Multiplayer] BroadcastChannel error:', e);
      }
    }

    // 2. LocalStorage Event Bus (Works across all tabs/windows of the same browser)
    const storageKey = `chess3d_msg_${this.roomCode}`;
    this.storageListener = (e) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          this.handleIncomingData(parsed);
        } catch (err) {}
      }
    };
    window.addEventListener('storage', this.storageListener);
  }

  setupConnectionHandlers() {
    if (!this.conn) return;

    this.conn.on('open', () => {
      console.log('[Multiplayer] WebRTC Data channel connected!');
      if (this.role === 'guest') {
        // Send initial HELLO and start retry loop until WELCOME is received
        this.sendMessage({ type: 'HELLO', from: 'guest', roomCode: this.roomCode });
        let attempts = 0;
        this.handshakeInterval = setInterval(() => {
          if (this.isConnected || attempts >= 8) {
            clearInterval(this.handshakeInterval);
            this.handshakeInterval = null;
            return;
          }
          attempts++;
          this.sendMessage({ type: 'HELLO', from: 'guest', roomCode: this.roomCode });
        }, 500);
      } else if (this.role === 'host') {
        this.sendMessage({
          type: 'WELCOME',
          hostColor: this.myColor,
          timeLimit: this.timeLimit
        });
        this.handleConnected('Khách');
      }
    });

    this.conn.on('data', (data) => {
      this.handleIncomingData(data);
    });

    this.conn.on('close', () => {
      this.handleDisconnected();
    });

    this.conn.on('error', (err) => {
      console.warn('[Multiplayer] WebRTC Connection error:', err);
    });
  }

  sendMessage(payload) {
    const msgId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const wrapped = { ...payload, _msgId: msgId, _sender: this.role, _room: this.roomCode };
    this.processedMessageIds.add(msgId);

    // 1. Send via WebRTC if open
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(wrapped);
      } catch (e) {
        console.warn('[Multiplayer] Error sending via WebRTC:', e);
      }
    }

    // 2. Send via BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(wrapped);
      } catch (e) {
        console.warn('[Multiplayer] Error sending via BroadcastChannel:', e);
      }
    }

    // 3. Send via LocalStorage bus
    try {
      localStorage.setItem(`chess3d_msg_${this.roomCode}`, JSON.stringify(wrapped));
    } catch (e) {}
  }

  handleIncomingData(data) {
    if (!data || typeof data !== 'object') return;
    if (data._sender === this.role) return; // Ignore own messages
    if (data._room && data._room !== this.roomCode) return; // Ignore wrong room
    if (data._msgId && this.processedMessageIds.has(data._msgId)) return; // Deduplicate
    if (data._msgId) this.processedMessageIds.add(data._msgId);

    console.log('[Multiplayer] Received message:', data.type, data);

    switch (data.type) {
      case 'ROOM_READY':
        if (this.role === 'guest') {
          // Send HELLO back immediately
          this.sendMessage({ type: 'HELLO', from: 'guest', roomCode: this.roomCode });
        }
        break;

      case 'HELLO':
      case 'HELLO_BROADCAST':
        if (this.role === 'host') {
          this.sendMessage({
            type: 'WELCOME',
            hostColor: this.myColor,
            timeLimit: this.timeLimit
          });
          this.handleConnected('Khách');
        }
        break;

      case 'WELCOME':
        if (this.role === 'guest') {
          if (this.handshakeInterval) {
            clearInterval(this.handshakeInterval);
            this.handshakeInterval = null;
          }
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          // Guest is opposite of host's color
          this.myColor = data.hostColor === 'w' ? 'b' : 'w';
          if (data.timeLimit !== undefined) {
            this.timeLimit = data.timeLimit;
          }
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
          this.onRemoteRematch(data);
        }
        break;

      case 'RESIGN':
        if (this.onRemoteResign) {
          this.onRemoteResign();
        }
        break;

      case 'PLAYER_LEFT':
        if (this.onRemotePlayerLeft) {
          this.onRemotePlayerLeft(data);
        }
        break;
    }
  }

  handleConnected(opponentName) {
    if (this.isConnected) return;
    this.isConnected = true;
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    if (this.handshakeInterval) {
      clearInterval(this.handshakeInterval);
      this.handshakeInterval = null;
    }
    if (this.onConnected) {
      this.onConnected({
        role: this.role,
        myColor: this.myColor,
        timeLimit: this.timeLimit,
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

  sendRematch(initiatorNewColor = null) {
    this.sendMessage({ type: 'REMATCH', initiatorNewColor });
  }

  sendResign() {
    this.sendMessage({ type: 'RESIGN' });
  }

  sendPlayerLeft() {
    this.sendMessage({ type: 'PLAYER_LEFT' });
  }

  // --- Real-Player Ranked PvP Matchmaking ---
  startRankedMatchmaking({ playerInfo, directInviteRoomCode = null, onMatchFound, onStatusUpdate, onError }) {
    this.cancelRankedMatchmaking();
    this.isRankedQueuing = true;
    this.rankedOnMatchFound = onMatchFound;
    this.rankedOnStatusUpdate = onStatusUpdate;
    this.rankedOnError = onError;
    this.rankedPlayerInfo = playerInfo;
    this.directInviteRoomCode = directInviteRoomCode;

    this.myTicketId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.generatedMatchRoomCode = directInviteRoomCode || NetworkEngine.generateRoomCode();

    // 1. Setup Local Inter-Tab Matchmaking Channel & Storage listener
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.rankedChannel = new BroadcastChannel('chess3d-ranked-matchmaking');
        this.rankedChannel.onmessage = (e) => this.handleRankedMatchmakingData(e.data);
      } catch (e) {}
    }

    this.rankedStorageListener = (e) => {
      if (e.key === 'chess3d_ranked_lobby_bus' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          this.handleRankedMatchmakingData(parsed);
        } catch (err) {}
      }
    };
    window.addEventListener('storage', this.rankedStorageListener);

    // Broadcast ticket immediately and every 1000ms
    const broadcastTicket = () => {
      if (!this.isRankedQueuing) return;
      const ticket = {
        type: 'RANKED_QUEUE_TICKET',
        ticketId: this.myTicketId,
        suggestedRoomCode: this.generatedMatchRoomCode,
        directInviteRoomCode: this.directInviteRoomCode,
        player: this.rankedPlayerInfo,
        timestamp: Date.now()
      };
      this.broadcastRankedMessage(ticket);
    };

    broadcastTicket();
    this.rankedBroadcastInterval = setInterval(broadcastTicket, 1000);

    // 2. PeerJS Internet Queue Tier Bucket Matching
    const tierBucketId = `chess3d-rnk-queue-t${playerInfo.tierIndex}`;
    try {
      this.rankedPeer = new Peer({
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.rankedPeer.on('open', (id) => {
        // Try connecting to existing tier bucket host
        const conn = this.rankedPeer.connect(tierBucketId, { reliable: true });
        conn.on('open', () => {
          conn.send({
            type: 'RANKED_QUEUE_TICKET',
            ticketId: this.myTicketId,
            suggestedRoomCode: this.generatedMatchRoomCode,
            player: this.rankedPlayerInfo,
            timestamp: Date.now()
          });
        });

        conn.on('data', (data) => {
          this.handleRankedMatchmakingData(data);
        });

        conn.on('error', () => {});
      });

      this.rankedPeer.on('connection', (conn) => {
        conn.on('data', (data) => {
          this.handleRankedMatchmakingData(data);
        });
      });
    } catch (e) {}
  }

  broadcastRankedMessage(payload) {
    const wrapped = { ...payload, _senderTicketId: this.myTicketId };
    if (this.rankedChannel) {
      try { this.rankedChannel.postMessage(wrapped); } catch (e) {}
    }
    try {
      localStorage.setItem('chess3d_ranked_lobby_bus', JSON.stringify({ ...wrapped, _ts: Date.now() }));
    } catch (e) {}
  }

  handleRankedMatchmakingData(data) {
    if (!this.isRankedQueuing || !data || typeof data !== 'object') return;
    if (data._senderTicketId === this.myTicketId || data.ticketId === this.myTicketId) return;

    if (data.type === 'RANKED_QUEUE_TICKET' && data.player) {
      // Calculate rank proximity: difference within ±1 sub-rank
      const myLevel = this.rankedPlayerInfo.tierIndex * 5 + this.rankedPlayerInfo.subTier;
      const oppLevel = data.player.tierIndex * 5 + data.player.subTier;

      if (Math.abs(myLevel - oppLevel) <= 1 || data.directInviteRoomCode === this.generatedMatchRoomCode) {
        // Matched! Whichever ticketId is smaller initiates proposal to avoid race condition
        if (this.myTicketId < data.ticketId || data.directInviteRoomCode === this.generatedMatchRoomCode) {
          const roomCode = this.generatedMatchRoomCode || NetworkEngine.generateRoomCode();
          const hostColor = Math.random() < 0.5 ? 'w' : 'b';
          const proposal = {
            type: 'RANKED_MATCH_PROPOSAL',
            proposalId: `${this.myTicketId}_${data.ticketId}`,
            roomCode,
            initiatorTicketId: this.myTicketId,
            targetTicketId: data.ticketId,
            hostPlayer: this.rankedPlayerInfo,
            guestPlayer: data.player,
            hostColor
          };
          this.broadcastRankedMessage(proposal);
          setTimeout(() => this.broadcastRankedMessage(proposal), 80);
          setTimeout(() => this.broadcastRankedMessage(proposal), 160);
          this.acceptRankedMatch(proposal, true);
        }
      }
    } else if (data.type === 'RANKED_MATCH_PROPOSAL') {
      if (data.targetTicketId === this.myTicketId) {
        this.acceptRankedMatch(data, false);
      }
    }
  }

  acceptRankedMatch(proposal, isInitiator) {
    if (!this.isRankedQueuing) return;
    this.isRankedQueuing = false;

    // Stop queue interval immediately
    if (this.rankedBroadcastInterval) {
      clearInterval(this.rankedBroadcastInterval);
      this.rankedBroadcastInterval = null;
    }

    // Gracefully teardown queue channels after handshakes complete
    setTimeout(() => {
      this.cancelRankedMatchmaking();
    }, 1200);

    const opponent = isInitiator ? proposal.guestPlayer : proposal.hostPlayer;
    const myColor = isInitiator ? proposal.hostColor : (proposal.hostColor === 'w' ? 'b' : 'w');

    if (this.rankedOnMatchFound) {
      this.rankedOnMatchFound({
        opponent,
        roomCode: proposal.roomCode,
        myColor,
        isHost: isInitiator
      });
    }
  }

  cancelRankedMatchmaking() {
    this.isRankedQueuing = false;
    if (this.rankedBroadcastInterval) {
      clearInterval(this.rankedBroadcastInterval);
      this.rankedBroadcastInterval = null;
    }
    if (this.rankedChannel) {
      try { this.rankedChannel.close(); } catch (e) {}
      this.rankedChannel = null;
    }
    if (this.rankedStorageListener) {
      window.removeEventListener('storage', this.rankedStorageListener);
      this.rankedStorageListener = null;
    }
    if (this.rankedPeer) {
      try { this.rankedPeer.destroy(); } catch (e) {}
      this.rankedPeer = null;
    }
  }

  cleanup() {
    this.cancelRankedMatchmaking();
    this.isConnected = false;
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    if (this.handshakeInterval) {
      clearInterval(this.handshakeInterval);
      this.handshakeInterval = null;
    }
    if (this.storageListener) {
      window.removeEventListener('storage', this.storageListener);
      this.storageListener = null;
    }
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
