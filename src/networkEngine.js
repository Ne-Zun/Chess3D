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

  // --- Real-Player Ranked PvP Matchmaking Engine ---
  static getPlayerLevel(player) {
    if (!player) return 0;
    const tier = Number(player.tierIndex != null ? player.tierIndex : 0);
    const sub = Number(player.subTier != null ? player.subTier : 1);
    return tier * 5 + sub;
  }

  getStoredActiveTickets() {
    try {
      const raw = localStorage.getItem('chess3d_active_ranked_tickets');
      if (!raw) return [];
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      const now = Date.now();
      // Keep only recent tickets active in the last 4 seconds
      return list.filter(t => t && t.ticketId && (now - t.timestamp < 4000));
    } catch (e) {
      return [];
    }
  }

  saveStoredActiveTickets(tickets) {
    try {
      localStorage.setItem('chess3d_active_ranked_tickets', JSON.stringify(tickets));
    } catch (e) {}
  }

  removeMyStoredTicket() {
    const list = this.getStoredActiveTickets().filter(t => t.ticketId !== this.myTicketId);
    this.saveStoredActiveTickets(list);
  }

  isTicketCompatible(otherTicket) {
    if (!otherTicket || !otherTicket.player) return false;
    if (otherTicket.ticketId === this.myTicketId) return false;

    // Direct room invite match
    if (this.directInviteRoomCode) {
      return (
        otherTicket.directInviteRoomCode === this.directInviteRoomCode ||
        otherTicket.suggestedRoomCode === this.directInviteRoomCode
      );
    }
    if (otherTicket.directInviteRoomCode && otherTicket.directInviteRoomCode === this.generatedMatchRoomCode) {
      return true;
    }

    const myLevel = NetworkEngine.getPlayerLevel(this.rankedPlayerInfo);
    const oppLevel = NetworkEngine.getPlayerLevel(otherTicket.player);
    const diff = Math.abs(myLevel - oppLevel);

    // Dynamic search expansion:
    // First 8s: strict ±1 sub-tier (same rank or immediately adjacent sub-tier)
    // 8s-15s: ±2 sub-tiers
    // >15s: ±3 sub-tiers
    const waitSeconds = (Date.now() - (this.queueStartTime || Date.now())) / 1000;
    const allowedDiff = waitSeconds > 15 ? 3 : (waitSeconds > 8 ? 2 : 1);

    return diff <= allowedDiff;
  }

  startRankedMatchmaking({ playerInfo, directInviteRoomCode = null, onMatchFound, onStatusUpdate, onError }) {
    this.cancelRankedMatchmaking();
    this.isRankedQueuing = true;
    this.rankedOnMatchFound = onMatchFound;
    this.rankedOnStatusUpdate = onStatusUpdate;
    this.rankedOnError = onError;

    this.rankedPlayerInfo = {
      name: playerInfo.name || 'Kỳ Thủ',
      avatar: playerInfo.avatar || '👑',
      tierIndex: Number(playerInfo.tierIndex != null ? playerInfo.tierIndex : 0),
      subTier: Number(playerInfo.subTier != null ? playerInfo.subTier : 1),
      rp: Number(playerInfo.rp != null ? playerInfo.rp : 0)
    };
    this.directInviteRoomCode = directInviteRoomCode ? directInviteRoomCode.trim().toUpperCase() : null;

    this.myTicketId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.generatedMatchRoomCode = this.directInviteRoomCode || NetworkEngine.generateRoomCode();
    this.queueStartTime = Date.now();
    this.matchedPairKey = null;

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
      } else if (e.key === 'chess3d_active_ranked_tickets') {
        if (this.isRankedQueuing) {
          const currentList = this.getStoredActiveTickets();
          const found = currentList.find(t => this.isTicketCompatible(t));
          if (found) {
            this.initiateMatchWith(found);
          }
        }
      }
    };
    window.addEventListener('storage', this.rankedStorageListener);

    // 2. Check if a compatible ticket is already active in localStorage
    const activeTickets = this.getStoredActiveTickets();
    const existingMatch = activeTickets.find(t => this.isTicketCompatible(t));
    if (existingMatch) {
      this.initiateMatchWith(existingMatch);
      return;
    }

    // Add myself to active tickets
    const myTicketObj = {
      ticketId: this.myTicketId,
      suggestedRoomCode: this.generatedMatchRoomCode,
      directInviteRoomCode: this.directInviteRoomCode,
      player: this.rankedPlayerInfo,
      timestamp: Date.now()
    };
    activeTickets.push(myTicketObj);
    this.saveStoredActiveTickets(activeTickets);

    // Heartbeat every 800ms
    const pulseQueue = () => {
      if (!this.isRankedQueuing) return;
      const currentList = this.getStoredActiveTickets();
      const found = currentList.find(t => this.isTicketCompatible(t));
      if (found) {
        this.initiateMatchWith(found);
        return;
      }

      // Upsert self with fresh timestamp
      const filtered = currentList.filter(t => t.ticketId !== this.myTicketId);
      filtered.push({
        ticketId: this.myTicketId,
        suggestedRoomCode: this.generatedMatchRoomCode,
        directInviteRoomCode: this.directInviteRoomCode,
        player: this.rankedPlayerInfo,
        timestamp: Date.now()
      });
      this.saveStoredActiveTickets(filtered);

      const ticketMsg = {
        type: 'RANKED_QUEUE_TICKET',
        ticketId: this.myTicketId,
        suggestedRoomCode: this.generatedMatchRoomCode,
        directInviteRoomCode: this.directInviteRoomCode,
        player: this.rankedPlayerInfo,
        timestamp: Date.now()
      };
      this.broadcastRankedMessage(ticketMsg);
    };

    pulseQueue();
    this.rankedBroadcastInterval = setInterval(pulseQueue, 800);

    // 3. PeerJS Cross-Browser & Cross-Device Tier Bucket Matching
    const tierBucketId = `c3d-rnk-v4-t${this.rankedPlayerInfo.tierIndex}`;
    this.isBucketHost = false;
    this.rankedPeerConns = new Set();

    try {
      this.rankedPeer = new Peer(tierBucketId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.rankedPeer.on('open', (id) => {
        this.isBucketHost = true;
      });

      this.rankedPeer.on('connection', (conn) => {
        this.rankedPeerConns.add(conn);
        conn.on('data', (data) => {
          this.handleRankedMatchmakingData(data, conn);
        });
        conn.on('close', () => {
          if (this.rankedPeerConns) this.rankedPeerConns.delete(conn);
        });

        const sendHostTicket = () => {
          try {
            conn.send({
              type: 'RANKED_QUEUE_TICKET',
              ticketId: this.myTicketId,
              suggestedRoomCode: this.generatedMatchRoomCode,
              directInviteRoomCode: this.directInviteRoomCode,
              player: this.rankedPlayerInfo,
              timestamp: Date.now()
            });
          } catch (e) {}
        };
        if (conn.open) sendHostTicket();
        else conn.on('open', sendHostTicket);
      });

      this.rankedPeer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          // A player is already waiting in this tier bucket! Connect as client
          try { this.rankedPeer.destroy(); } catch (e) {}
          this.isBucketHost = false;
          this.connectAsRankedClient(tierBucketId);
        }
      });
    } catch (e) {}
  }

  connectAsRankedClient(targetHostId) {
    if (!this.isRankedQueuing) return;
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
        const conn = this.rankedPeer.connect(targetHostId, { reliable: true });
        this.rankedClientConn = conn;

        conn.on('open', () => {
          try {
            conn.send({
              type: 'RANKED_QUEUE_TICKET',
              ticketId: this.myTicketId,
              suggestedRoomCode: this.generatedMatchRoomCode,
              directInviteRoomCode: this.directInviteRoomCode,
              player: this.rankedPlayerInfo,
              timestamp: Date.now()
            });
          } catch (e) {}
        });

        conn.on('data', (data) => {
          this.handleRankedMatchmakingData(data, conn);
        });

        conn.on('error', () => {});
      });

      this.rankedPeer.on('error', () => {});
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

  initiateMatchWith(oppTicket) {
    if (!this.isRankedQueuing) return;

    const pairKey = [this.myTicketId, oppTicket.ticketId].sort().join('__');
    if (this.matchedPairKey === pairKey) return;
    this.matchedPairKey = pairKey;

    const isHost = this.myTicketId < oppTicket.ticketId;
    const roomCode = isHost ? this.generatedMatchRoomCode : (oppTicket.suggestedRoomCode || this.generatedMatchRoomCode);

    // Deterministic 50/50 color assignment from pairKey
    const hash = pairKey.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hostColor = (hash % 2 === 0) ? 'w' : 'b';

    const matchPayload = {
      type: 'RANKED_MATCH_LOCKED',
      pairKey,
      roomCode,
      hostTicketId: isHost ? this.myTicketId : oppTicket.ticketId,
      guestTicketId: isHost ? oppTicket.ticketId : this.myTicketId,
      hostPlayer: isHost ? this.rankedPlayerInfo : oppTicket.player,
      guestPlayer: isHost ? oppTicket.player : this.rankedPlayerInfo,
      hostColor,
      timestamp: Date.now()
    };

    // Broadcast repeatedly to guarantee delivery across local bus
    this.broadcastRankedMessage(matchPayload);
    setTimeout(() => this.broadcastRankedMessage(matchPayload), 80);
    setTimeout(() => this.broadcastRankedMessage(matchPayload), 180);
    setTimeout(() => this.broadcastRankedMessage(matchPayload), 350);

    this.acceptRankedMatch(matchPayload, isHost);
  }

  handleRankedMatchmakingData(data, sourceConn = null) {
    if (!this.isRankedQueuing || !data || typeof data !== 'object') return;
    if (data._senderTicketId === this.myTicketId || data.ticketId === this.myTicketId) return;

    if (data.type === 'RANKED_QUEUE_TICKET' && data.player) {
      if (this.isTicketCompatible(data)) {
        this.initiateMatchWith(data);
      }
    } else if (data.type === 'RANKED_MATCH_LOCKED') {
      if (data.hostTicketId === this.myTicketId || data.guestTicketId === this.myTicketId) {
        const isHost = data.hostTicketId === this.myTicketId;
        this.acceptRankedMatch(data, isHost);
      }
    }
  }

  acceptRankedMatch(matchData, isHost) {
    if (!this.isRankedQueuing) return;
    this.isRankedQueuing = false;

    // Immediately stop queue heartbeat & clean storage
    if (this.rankedBroadcastInterval) {
      clearInterval(this.rankedBroadcastInterval);
      this.rankedBroadcastInterval = null;
    }
    this.removeMyStoredTicket();

    // Notify connected PeerJS client/host if any
    if (this.rankedClientConn && this.rankedClientConn.open) {
      try { this.rankedClientConn.send(matchData); } catch (e) {}
    }
    if (this.rankedPeerConns) {
      this.rankedPeerConns.forEach(conn => {
        if (conn && conn.open) {
          try { conn.send(matchData); } catch (e) {}
        }
      });
    }

    // Teardown queue peer & listeners after small delay to let messages flush
    setTimeout(() => {
      this.cancelRankedMatchmaking();
    }, 1500);

    const opponent = isHost ? matchData.guestPlayer : matchData.hostPlayer;
    const myColor = isHost ? matchData.hostColor : (matchData.hostColor === 'w' ? 'b' : 'w');

    if (this.rankedOnMatchFound) {
      this.rankedOnMatchFound({
        opponent,
        roomCode: matchData.roomCode,
        myColor,
        isHost
      });
    }
  }

  cancelRankedMatchmaking() {
    this.isRankedQueuing = false;
    this.matchedPairKey = null;
    if (this.rankedBroadcastInterval) {
      clearInterval(this.rankedBroadcastInterval);
      this.rankedBroadcastInterval = null;
    }
    this.removeMyStoredTicket();
    if (this.rankedChannel) {
      try { this.rankedChannel.close(); } catch (e) {}
      this.rankedChannel = null;
    }
    if (this.rankedStorageListener) {
      window.removeEventListener('storage', this.rankedStorageListener);
      this.rankedStorageListener = null;
    }
    if (this.rankedClientConn) {
      try { this.rankedClientConn.close(); } catch (e) {}
      this.rankedClientConn = null;
    }
    if (this.rankedPeerConns) {
      this.rankedPeerConns.forEach(c => { try { c.close(); } catch (e) {} });
      this.rankedPeerConns.clear();
      this.rankedPeerConns = null;
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
