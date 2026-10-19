import confetti from 'canvas-confetti';
import { ChessGame, ChessAI, WHITE, BLACK } from './chessLogic.js';
import { Chess3D } from './chess3D.js';
import { sound } from './soundEngine.js';
import { NetworkEngine } from './networkEngine.js';

/**
 * Main Controller for Chess 3D
 */
class ChessApp {
  constructor() {
    this.game = new ChessGame();
    this.ai = new ChessAI('medium');
    this.network = new NetworkEngine();

    this.mode = 'pve'; // 'pve' (Player vs AI), 'pvp' (Pass & Play), or 'multiplayer' (Online room)
    this.playerColor = WHITE; // Player's side
    this.autoFlip = false;
    this.timeLimit = 600; // 10 minutes default (in seconds), 0 = untimed
    this.timers = { [WHITE]: 600, [BLACK]: 600 };
    this.timerInterval = null;

    this.selectedSquare = null; // { r, c }
    this.legalMovesForSelected = [];
    this.isAiThinking = false;
    this.pendingPromotionMove = null;

    this.dom = {};
    this.cacheDom();
    this.init3D();
    this.initNetwork();
    this.bindEvents();
    this.startNewGame();
    this.checkUrlParams();
  }

  cacheDom() {
    this.dom.container = document.getElementById('canvas-container');
    this.dom.whiteCard = document.getElementById('white-player-card');
    this.dom.blackCard = document.getElementById('black-player-card');
    this.dom.whiteTimer = document.getElementById('white-timer');
    this.dom.blackTimer = document.getElementById('black-timer');
    this.dom.whiteCaptured = document.getElementById('white-captured');
    this.dom.blackCaptured = document.getElementById('black-captured');
    this.dom.turnLabel = document.getElementById('turn-label');
    this.dom.turnDot = document.querySelector('.turn-dot');
    this.dom.advantagePill = document.getElementById('advantage-pill');
    this.dom.movesContainer = document.getElementById('moves-container');
    this.dom.moveCounter = document.getElementById('move-counter');
    this.dom.historyPanel = document.getElementById('history-panel');
    this.dom.btnHistoryToggle = document.getElementById('btn-history-toggle');
    this.dom.btnSound = document.getElementById('btn-sound');
    this.dom.btnThemeToggle = document.getElementById('btn-theme-toggle');
    this.dom.btnSettings = document.getElementById('btn-settings');
    this.dom.btnUndo = document.getElementById('btn-undo');
    this.dom.btnHint = document.getElementById('btn-hint');
    this.dom.btnFlip = document.getElementById('btn-flip');
    this.dom.btnRestart = document.getElementById('btn-restart');

    // Quick Difficulty & Online status
    this.dom.quickDiffGroup = document.getElementById('quick-diff-group');
    this.dom.diffPills = document.querySelectorAll('.diff-pill');
    this.dom.btnPlayFriend = document.getElementById('btn-play-friend');
    this.dom.onlineRoomBanner = document.getElementById('online-room-banner');
    this.dom.roomCodeBadge = document.getElementById('room-code-badge');
    this.dom.myColorBadge = document.getElementById('my-color-badge');
    this.dom.btnCopyRoomLink = document.getElementById('btn-copy-room-link');
    this.dom.btnLeaveRoom = document.getElementById('btn-leave-room');

    // Multiplayer Modal
    this.dom.multiplayerModal = document.getElementById('multiplayer-modal');
    this.dom.btnCloseMultiplayer = document.getElementById('btn-close-multiplayer');
    this.dom.tabCreateRoom = document.getElementById('tab-create-room');
    this.dom.tabJoinRoom = document.getElementById('tab-join-room');
    this.dom.panelCreateRoom = document.getElementById('panel-create-room');
    this.dom.panelJoinRoom = document.getElementById('panel-join-room');
    this.dom.displayRoomCode = document.getElementById('display-room-code');
    this.dom.btnCopyCode = document.getElementById('btn-copy-code');
    this.dom.radioCards = document.querySelectorAll('.radio-card');
    this.dom.hostWaitingStatus = document.getElementById('host-waiting-status');
    this.dom.btnStartHosting = document.getElementById('btn-start-hosting');
    this.dom.joinCodeInput = document.getElementById('join-code-input');
    this.dom.btnSubmitJoin = document.getElementById('btn-submit-join');
    this.dom.joinStatusMsg = document.getElementById('join-status-msg');

    // Settings Modal
    this.dom.promotionModal = document.getElementById('promotion-modal');
    this.dom.settingsModal = document.getElementById('settings-modal');
    this.dom.gameoverModal = document.getElementById('gameover-modal');
    this.dom.btnCloseSettings = document.getElementById('btn-close-settings');
    this.dom.btnApplySettings = document.getElementById('btn-apply-settings');
    this.dom.btnPlayAgain = document.getElementById('btn-play-again');
    this.dom.modeSelect = document.getElementById('mode-select');
    this.dom.aiDifficulty = document.getElementById('ai-difficulty');
    this.dom.timerSelect = document.getElementById('timer-select');
    this.dom.themeSelect = document.getElementById('theme-select');
    this.dom.autoFlipCheck = document.getElementById('auto-flip-check');
    this.dom.difficultyRow = document.getElementById('difficulty-row');
    this.dom.toast = document.getElementById('toast-message');

    // Labels
    this.dom.whiteNameLabel = document.getElementById('white-name-label');
    this.dom.blackNameLabel = document.getElementById('black-name-label');
  }

  init3D() {
    this.chess3D = new Chess3D(
      this.dom.container,
      this.onSquareClicked.bind(this),
      this.onHoverSquare.bind(this)
    );
  }

  initNetwork() {
    this.network.onConnected = this.handleNetworkConnected.bind(this);
    this.network.onDisconnected = this.handleNetworkDisconnected.bind(this);
    this.network.onRemoteMove = this.handleRemoteMove.bind(this);
    this.network.onRemoteRematch = this.handleRemoteRematch.bind(this);
    this.network.onRemoteResign = this.handleRemoteResign.bind(this);
    this.network.onError = (err) => {
      this.showJoinError(err);
      this.showToast(err);
    };
  }

  checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      this.openMultiplayerModal('join');
      this.dom.joinCodeInput.value = roomParam.trim().toUpperCase();
      this.showToast(`Phát hiện mã phòng từ link: ${roomParam}`);
    }
  }

  bindEvents() {
    // Quick Difficulty Pills (Easy, Medium, Hard)
    this.dom.diffPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const diff = pill.getAttribute('data-diff');
        this.setDifficulty(diff);
      });
    });

    // Multiplayer Button & Room actions
    this.dom.btnPlayFriend.addEventListener('click', () => {
      this.openMultiplayerModal('create');
    });

    this.dom.btnCloseMultiplayer.addEventListener('click', () => {
      this.closeModal(this.dom.multiplayerModal);
      this.dom.hostWaitingStatus.classList.add('hidden');
    });

    // Tabs inside Multiplayer Modal
    this.dom.tabCreateRoom.addEventListener('click', () => {
      this.switchMultiplayerTab('create');
    });
    this.dom.tabJoinRoom.addEventListener('click', () => {
      this.switchMultiplayerTab('join');
    });

    // Copy Room Code Button
    this.dom.btnCopyCode.addEventListener('click', () => {
      this.copyRoomCode();
    });

    // Color radio selection
    this.dom.radioCards.forEach(card => {
      card.addEventListener('click', () => {
        this.dom.radioCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const radio = card.querySelector('input');
        if (radio) radio.checked = true;
      });
    });

    // Start Hosting Button
    this.dom.btnStartHosting.addEventListener('click', () => {
      const code = this.dom.displayRoomCode.textContent;
      const selectedColorInput = document.querySelector('input[name="host-color"]:checked');
      const hostColor = selectedColorInput ? selectedColorInput.value : 'w';

      this.dom.hostWaitingStatus.classList.remove('hidden');
      this.network.createRoom(code, hostColor, this.timeLimit);
      this.showToast(`Đã mở phòng ${code}! Đang chờ bạn bè kết nối...`);
    });

    // Join Room Button
    this.dom.btnSubmitJoin.addEventListener('click', () => {
      const code = this.dom.joinCodeInput.value.trim().toUpperCase();
      if (!code || code.length < 4) {
        this.showJoinError('Vui lòng nhập mã phòng hợp lệ!');
        return;
      }
      this.hideJoinError();
      this.dom.btnSubmitJoin.textContent = 'Đang kết nối...';
      this.network.joinRoom(code);
    });

    this.dom.joinCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.dom.btnSubmitJoin.click();
      }
    });

    // Banner actions
    this.dom.btnCopyRoomLink.addEventListener('click', () => {
      this.copyRoomLink();
    });

    this.dom.btnLeaveRoom.addEventListener('click', () => {
      if (confirm('Bạn có chắc muốn rời phòng đấu online không?')) {
        this.leaveRoom();
      }
    });

    // Top bar actions
    this.dom.btnSound.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      this.dom.btnSound.querySelector('.icon').textContent = isMuted ? '🔇' : '🔊';
      this.showToast(isMuted ? 'Đã tắt âm thanh' : 'Đã bật âm thanh');
    });

    this.dom.btnHistoryToggle.addEventListener('click', () => {
      const isCollapsed = this.dom.historyPanel.classList.toggle('collapsed');
      this.showToast(isCollapsed ? 'Đã ẩn lịch sử nước đi' : 'Đã hiện lịch sử nước đi');
    });

    this.dom.btnThemeToggle.addEventListener('click', () => {
      const themes = ['classic', 'cyberpunk', 'royal'];
      const nextIdx = (themes.indexOf(this.chess3D.theme) + 1) % themes.length;
      const nextTheme = themes[nextIdx];
      this.setTheme(nextTheme);
      this.dom.themeSelect.value = nextTheme;
      const themeNames = {
        classic: 'Gỗ Cổ Điển & Cẩm Thạch',
        cyberpunk: 'Cyberpunk Neon & Hologram',
        royal: 'Hoàng Gia Vàng 24K & Bạch Kim'
      };
      this.showToast(`Đã đổi chủ đề: ${themeNames[nextTheme]}`);
    });

    this.dom.btnSettings.addEventListener('click', () => {
      this.openModal(this.dom.settingsModal);
    });

    this.dom.btnCloseSettings.addEventListener('click', () => {
      this.closeModal(this.dom.settingsModal);
    });

    this.dom.modeSelect.addEventListener('change', () => {
      if (this.dom.modeSelect.value === 'pve') {
        this.dom.difficultyRow.style.display = 'flex';
      } else {
        this.dom.difficultyRow.style.display = 'none';
      }
    });

    this.dom.btnApplySettings.addEventListener('click', () => {
      this.mode = this.dom.modeSelect.value;
      this.setDifficulty(this.dom.aiDifficulty.value);
      this.timeLimit = parseInt(this.dom.timerSelect.value, 10);
      this.autoFlip = this.dom.autoFlipCheck.checked;
      this.setTheme(this.dom.themeSelect.value);
      this.closeModal(this.dom.settingsModal);
      this.startNewGame();
      this.showToast('Đã áp dụng cài đặt!');
    });

    // Camera preset buttons
    document.querySelectorAll('.btn-pill[data-camera]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-pill[data-camera]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const preset = btn.getAttribute('data-camera');
        this.chess3D.setCameraPreset(preset);
      });
    });

    // Quick actions
    this.dom.btnUndo.addEventListener('click', () => this.handleUndo());
    this.dom.btnHint.addEventListener('click', () => this.handleHint());
    this.dom.btnFlip.addEventListener('click', () => this.handleFlip());
    this.dom.btnRestart.addEventListener('click', () => {
      if (confirm('Bạn có chắc muốn bắt đầu ván cờ mới không?')) {
        if (this.mode === 'multiplayer') {
          this.network.sendRematch();
        }
        this.startNewGame();
      }
    });

    this.dom.btnPlayAgain.addEventListener('click', () => {
      this.closeModal(this.dom.gameoverModal);
      if (this.mode === 'multiplayer') {
        this.network.sendRematch();
      }
      this.startNewGame();
    });

    // Promotion buttons
    document.querySelectorAll('.promo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const piece = btn.getAttribute('data-piece');
        this.closeModal(this.dom.promotionModal);
        if (this.pendingPromotionMove) {
          const move = this.pendingPromotionMove;
          this.pendingPromotionMove = null;
          this.executeMove(move, piece);
        }
      });
    });
  }

  // --- Difficulty Management ---
  setDifficulty(diff) {
    this.ai.setDifficulty(diff);
    this.dom.diffPills.forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-diff') === diff);
    });
    this.dom.aiDifficulty.value = diff;

    if (this.mode === 'pve') {
      const diffText = { easy: 'Dễ', medium: 'Vừa', hard: 'Khó' };
      this.dom.blackNameLabel.textContent = `AI Máy (${diffText[diff]})`;
    }

    const diffNames = { easy: 'Dễ (Easy)', medium: 'Vừa (Medium)', hard: 'Khó (Hard)' };
    this.showToast(`Đã đổi cấp độ AI: ${diffNames[diff]}`);
  }

  // --- Multiplayer Modal Management ---
  openMultiplayerModal(tab = 'create') {
    this.switchMultiplayerTab(tab);
    if (tab === 'create') {
      const newCode = NetworkEngine.generateRoomCode();
      this.dom.displayRoomCode.textContent = newCode;
    }
    this.dom.hostWaitingStatus.classList.add('hidden');
    this.hideJoinError();
    this.dom.btnSubmitJoin.textContent = 'Tham Gia Trận Đấu';
    this.openModal(this.dom.multiplayerModal);
  }

  switchMultiplayerTab(tab) {
    if (tab === 'create') {
      this.dom.tabCreateRoom.classList.add('active');
      this.dom.tabJoinRoom.classList.remove('active');
      this.dom.panelCreateRoom.classList.add('active');
      this.dom.panelJoinRoom.classList.remove('active');
    } else {
      this.dom.tabJoinRoom.classList.add('active');
      this.dom.tabCreateRoom.classList.remove('active');
      this.dom.panelJoinRoom.classList.add('active');
      this.dom.panelCreateRoom.classList.remove('active');
      setTimeout(() => this.dom.joinCodeInput.focus(), 100);
    }
  }

  copyRoomCode() {
    const code = this.dom.displayRoomCode.textContent;
    navigator.clipboard.writeText(code).then(() => {
      this.showToast(`Đã sao chép mã phòng: ${code}`);
    }).catch(() => {
      this.showToast(`Mã phòng: ${code}`);
    });
  }

  copyRoomLink() {
    const code = this.network.roomCode || this.dom.displayRoomCode.textContent;
    const url = `${window.location.origin}${window.location.pathname}?room=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      this.showToast('Đã sao chép link mời phòng!');
    }).catch(() => {
      this.showToast(`Link mời: ${url}`);
    });
  }

  showJoinError(msg) {
    this.dom.joinStatusMsg.textContent = msg;
    this.dom.joinStatusMsg.classList.remove('hidden');
    this.dom.btnSubmitJoin.textContent = 'Thử lại';
  }

  hideJoinError() {
    this.dom.joinStatusMsg.classList.add('hidden');
  }

  // --- Network Event Handlers ---
  handleNetworkConnected({ role, myColor, roomCode, opponentName }) {
    this.mode = 'multiplayer';
    this.playerColor = myColor;
    this.closeModal(this.dom.multiplayerModal);
    this.dom.hostWaitingStatus.classList.add('hidden');

    // Update UI Elements
    this.dom.roomCodeBadge.textContent = roomCode;
    this.dom.myColorBadge.textContent = myColor === WHITE ? 'Trắng (White)' : 'Đen (Black)';
    this.dom.onlineRoomBanner.classList.remove('hidden');
    this.dom.quickDiffGroup.style.display = 'none';

    // Set camera to player's perspective
    this.chess3D.setCameraPreset(myColor === WHITE ? 'white' : 'black');
    document.querySelectorAll('.btn-pill[data-camera]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-camera') === (myColor === WHITE ? 'white' : 'black'));
    });

    this.startNewGame();
    this.showToast(`Đã kết nối với bạn bè! Bạn là quân ${myColor === WHITE ? 'Trắng' : 'Đen'}`);
  }

  handleNetworkDisconnected() {
    this.showToast('Bạn bè đã ngắt kết nối!');
  }

  handleRemoteMove(data) {
    const { from, to, promotion } = data;
    const legalMoves = this.game.getLegalMoves(from.r, from.c);
    const move = legalMoves.find(m => m.to.r === to.r && m.to.c === to.c);
    if (move) {
      this.executeMove(move, promotion || 'q', true);
    }
  }

  handleRemoteRematch() {
    this.startNewGame();
    this.showToast('Đối thủ đã bắt đầu ván mới!');
  }

  handleRemoteResign() {
    const winner = this.playerColor === WHITE ? 'Trắng (Bạn)' : 'Đen (Bạn)';
    sound.playVictory();
    this.showGameOver('ĐỐI THỦ ĐẦU HÀNG!', `Quân ${winner} giành chiến thắng!`);
  }

  leaveRoom() {
    this.network.cleanup();
    this.mode = 'pve';
    this.playerColor = WHITE;
    this.dom.onlineRoomBanner.classList.add('hidden');
    this.dom.quickDiffGroup.style.display = 'flex';
    this.chess3D.setCameraPreset('white');
    this.startNewGame();
    this.showToast('Đã rời phòng online');
  }

  setTheme(themeName) {
    this.chess3D.setTheme(themeName);
    this.chess3D.syncBoardState(this.game.board);
  }

  startNewGame() {
    this.game.reset();
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.isAiThinking = false;
    this.pendingPromotionMove = null;

    // Reset Clocks
    this.timers[WHITE] = this.timeLimit;
    this.timers[BLACK] = this.timeLimit;
    this.startClocks();

    // Update UI Names
    if (this.mode === 'multiplayer') {
      if (this.playerColor === WHITE) {
        this.dom.whiteNameLabel.textContent = 'Bạn (Trắng)';
        this.dom.blackNameLabel.textContent = 'Bạn bè (Đen)';
      } else {
        this.dom.whiteNameLabel.textContent = 'Bạn bè (Trắng)';
        this.dom.blackNameLabel.textContent = 'Bạn (Đen)';
      }
    } else if (this.mode === 'pve') {
      this.dom.whiteNameLabel.textContent = 'Bạn (Trắng)';
      const diffText = { easy: 'Dễ', medium: 'Vừa', hard: 'Khó' };
      this.dom.blackNameLabel.textContent = `AI Máy (${diffText[this.ai.difficulty]})`;
    } else {
      this.dom.whiteNameLabel.textContent = 'Người chơi 1 (Trắng)';
      this.dom.blackNameLabel.textContent = 'Người chơi 2 (Đen)';
    }

    // Sync 3D Scene
    this.chess3D.syncBoardState(this.game.board);
    this.chess3D.board.setLastMove(null, null);
    this.chess3D.board.setCheckWarning(null, null);
    this.chess3D.board.clearLegalMoves();

    this.updateUI();
  }

  startClocks() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    if (this.timeLimit <= 0) {
      this.dom.whiteTimer.textContent = '∞';
      this.dom.blackTimer.textContent = '∞';
      return;
    }

    this.timerInterval = setInterval(() => {
      if (this.game.isCheckmate || this.game.isStalemate) return;

      const currentTurn = this.game.turn;
      this.timers[currentTurn]--;

      if (this.timers[currentTurn] <= 0) {
        this.timers[currentTurn] = 0;
        clearInterval(this.timerInterval);
        this.handleTimeOut(currentTurn);
      }

      this.updateTimerDisplay();
    }, 1000);

    this.updateTimerDisplay();
  }

  formatTime(seconds) {
    if (seconds <= 0 && this.timeLimit <= 0) return '∞';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  updateTimerDisplay() {
    if (this.timeLimit <= 0) return;
    this.dom.whiteTimer.textContent = this.formatTime(this.timers[WHITE]);
    this.dom.blackTimer.textContent = this.formatTime(this.timers[BLACK]);

    this.dom.whiteTimer.classList.toggle('low-time', this.timers[WHITE] < 30);
    this.dom.blackTimer.classList.toggle('low-time', this.timers[BLACK] < 30);
  }

  handleTimeOut(loserColor) {
    const winner = loserColor === WHITE ? 'Đen' : 'Trắng';
    sound.playVictory();
    this.showGameOver(`HẾT GIỜ!`, `Quân ${winner} chiến thắng do đối thủ hết thời gian.`);
  }

  onHoverSquare(square) {
    // Optional additional tooltip
  }

  onSquareClicked(r, c, pieceData, directMove = null) {
    // Block moves if it's not the player's turn
    if (this.mode === 'pve' && this.game.turn !== this.playerColor) {
      return;
    }
    if (this.mode === 'multiplayer' && this.game.turn !== this.playerColor) {
      return;
    }
    if (this.game.isCheckmate || this.game.isStalemate || this.isAiThinking) {
      return;
    }

    // Direct move clicked via legal destination marker
    if (directMove) {
      this.handlePlayerMove(directMove);
      return;
    }

    const clickedPiece = this.game.getPiece(r, c);

    // 1. If piece is currently selected:
    if (this.selectedSquare) {
      const matchingMove = this.legalMovesForSelected.find(
        m => m.to.r === r && m.to.c === c
      );

      if (matchingMove) {
        this.handlePlayerMove(matchingMove);
        return;
      }

      // If clicked another own piece: switch selection
      if (clickedPiece && clickedPiece.color === this.game.turn) {
        if (this.mode === 'multiplayer' && clickedPiece.color !== this.playerColor) return;
        this.selectSquare(r, c);
        return;
      }

      this.deselectSquare();
      return;
    }

    // 2. No piece selected yet:
    if (clickedPiece && clickedPiece.color === this.game.turn) {
      if (this.mode === 'multiplayer' && clickedPiece.color !== this.playerColor) return;
      this.selectSquare(r, c);
    }
  }

  selectSquare(r, c) {
    this.selectedSquare = { r, c };
    this.chess3D.board.setSelected(r, c);
    this.legalMovesForSelected = this.game.getLegalMoves(r, c);
    this.chess3D.board.showLegalMoves(this.legalMovesForSelected);
    sound.playSelect();
  }

  deselectSquare() {
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.chess3D.board.setSelected(null, null);
    this.chess3D.board.clearLegalMoves();
  }

  handlePlayerMove(move) {
    this.deselectSquare();

    // Check if move is a pawn promotion
    if (move.piece.type === 'p' && (move.to.r === 0 || move.to.r === 7)) {
      this.pendingPromotionMove = move;
      this.openModal(this.dom.promotionModal);
      return;
    }

    this.executeMove(move, 'q');
  }

  executeMove(move, promotionChoice = 'q', isRemote = false) {
    const isCapture = !!move.capture || move.isEnPassant;
    const isCastle = move.isCastle;

    // Send move over network if in multiplayer and locally initiated
    if (this.mode === 'multiplayer' && !isRemote) {
      this.network.sendMove(move, promotionChoice);
    }

    // Apply move in game logic
    const moveResult = this.game.makeMove(move, promotionChoice);

    // Play sound
    if (isCastle) {
      sound.playCastle();
    } else if (isCapture) {
      sound.playCapture();
    } else {
      sound.playMove();
    }

    // Highlight last move
    this.chess3D.board.setLastMove(move.from, move.to);

    // 3D Piece Animation
    this.chess3D.animateMove(move, () => {
      this.onMoveFinished(moveResult);
    });
  }

  onMoveFinished(moveResult) {
    if (moveResult.move.promotion) {
      this.chess3D.syncBoardState(this.game.board);
    }

    this.updateUI();

    // Check indicator
    if (this.game.isCheck) {
      const kingPos = this.game.findKing(this.game.turn);
      if (kingPos) {
        this.chess3D.board.setCheckWarning(kingPos.r, kingPos.col !== undefined ? kingPos.col : kingPos.c);
      }
      sound.playCheck();
      this.showToast('CHIẾU TƯỚNG!');
    } else {
      this.chess3D.board.setCheckWarning(null, null);
    }

    // Checkmate
    if (this.game.isCheckmate) {
      const winner = this.game.turn === WHITE ? 'Đen' : 'Trắng';
      sound.playVictory();
      this.triggerConfetti();
      this.showGameOver('CHIẾU BÍ!', `Quân ${winner} đã giành chiến thắng ngoạn mục!`);
      return;
    }

    // Stalemate
    if (this.game.isStalemate) {
      this.showGameOver('HÒA CỜ!', 'Ván cờ kết thúc hòa do hết nước đi hợp lệ (Stalemate).');
      return;
    }

    // Auto-flip camera in PvP mode if enabled
    if (this.mode === 'pvp' && this.autoFlip) {
      this.chess3D.setCameraPreset(this.game.turn === WHITE ? 'white' : 'black');
    }

    // Trigger AI move if it's AI's turn
    if (this.mode === 'pve' && this.game.turn === BLACK) {
      this.triggerAiTurn();
    }
  }

  triggerAiTurn() {
    this.isAiThinking = true;
    const diffNames = { easy: 'Dễ', medium: 'Vừa', hard: 'Khó' };
    this.dom.blackNameLabel.textContent = `AI (${diffNames[this.ai.difficulty]}) đang suy nghĩ...`;

    const thinkDelay = this.ai.difficulty === 'hard' ? 450 : this.ai.difficulty === 'medium' ? 300 : 180;

    setTimeout(() => {
      if (this.game.turn !== BLACK || this.game.isCheckmate || this.game.isStalemate) {
        this.isAiThinking = false;
        return;
      }

      const bestMove = this.ai.getBestMove(this.game);
      this.dom.blackNameLabel.textContent = `AI Máy (${diffNames[this.ai.difficulty]})`;
      this.isAiThinking = false;

      if (bestMove) {
        this.executeMove(bestMove, 'q');
      }
    }, thinkDelay);
  }

  handleUndo() {
    if (this.mode === 'multiplayer') {
      this.showToast('Không thể đi lại khi đang đấu online!');
      return;
    }
    if (this.game.history.length === 0 || this.isAiThinking) return;

    const stepsToUndo = (this.mode === 'pve' && this.game.history.length >= 2) ? 2 : 1;

    for (let i = 0; i < stepsToUndo; i++) {
      if (this.game.history.length === 0) break;
      this.game.history.pop();
    }

    this.game.reset();
    const historyBackup = [...this.game.history];
    const movesToReplay = [...historyBackup];
    this.game.history = [];

    for (const hist of movesToReplay) {
      this.game.makeMove(hist, hist.promotion || 'q');
    }

    this.deselectSquare();
    this.chess3D.syncBoardState(this.game.board);

    if (this.game.history.length > 0) {
      const last = this.game.history[this.game.history.length - 1];
      this.chess3D.board.setLastMove(last.from, last.to);
    } else {
      this.chess3D.board.setLastMove(null, null);
    }

    if (this.game.isCheck) {
      const kingPos = this.game.findKing(this.game.turn);
      this.chess3D.board.setCheckWarning(kingPos.r, kingPos.col !== undefined ? kingPos.col : kingPos.c);
    } else {
      this.chess3D.board.setCheckWarning(null, null);
    }

    this.updateUI();
    this.showToast('Đã đi lại nước cờ');
  }

  handleHint() {
    if (this.isAiThinking || this.game.isCheckmate || this.game.isStalemate) return;

    const hintMove = this.ai.getBestMove(this.game);
    if (!hintMove) {
      this.showToast('Không tìm thấy gợi ý!');
      return;
    }

    this.chess3D.board.setLastMove(hintMove.from, hintMove.to);
    sound.playSelect();
    const fromStr = this.game.posToAlgebraic(hintMove.from.r, hintMove.from.c);
    const toStr = this.game.posToAlgebraic(hintMove.to.r, hintMove.to.c);
    this.showToast(`Gợi ý: ${hintMove.piece.type.toUpperCase()} từ ${fromStr} đến ${toStr}`);
  }

  handleFlip() {
    const isWhiteView = this.chess3D.camera.position.z > 0;
    this.chess3D.setCameraPreset(isWhiteView ? 'black' : 'white');
    document.querySelectorAll('.btn-pill[data-camera]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-camera') === (isWhiteView ? 'black' : 'white'));
    });
  }

  updateUI() {
    const isWhiteTurn = this.game.turn === WHITE;
    this.dom.turnLabel.textContent = isWhiteTurn ? 'Lượt: Trắng' : 'Lượt: Đen';
    this.dom.turnDot.className = `turn-dot ${isWhiteTurn ? 'white-turn' : 'black-turn'}`;

    this.dom.whiteCard.classList.toggle('active', isWhiteTurn);
    this.dom.blackCard.classList.toggle('active', !isWhiteTurn);

    const matDiff = this.game.getMaterialDifference();
    if (matDiff > 0) {
      this.dom.advantagePill.textContent = `+${matDiff}`;
      this.dom.advantagePill.className = 'advantage-pill positive';
    } else if (matDiff < 0) {
      this.dom.advantagePill.textContent = `${matDiff}`;
      this.dom.advantagePill.className = 'advantage-pill negative';
    } else {
      this.dom.advantagePill.textContent = '+0';
      this.dom.advantagePill.className = 'advantage-pill';
    }

    const pieceIcons = {
      p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔'
    };
    
    const capturedByWhite = this.game.capturedPieces[WHITE]
      .map(p => pieceIcons[p.type] || '')
      .join(' ');
    this.dom.whiteCaptured.textContent = capturedByWhite;

    const capturedByBlack = this.game.capturedPieces[BLACK]
      .map(p => pieceIcons[p.type] || '')
      .join(' ');
    this.dom.blackCaptured.textContent = capturedByBlack;

    this.renderMoveHistory();
  }

  renderMoveHistory() {
    const history = this.game.history;
    this.dom.moveCounter.textContent = `${history.length} Nước`;

    if (history.length === 0) {
      this.dom.movesContainer.innerHTML = '<div class="empty-history">Chưa có nước đi nào</div>';
      return;
    }

    let html = '';
    for (let i = 0; i < history.length; i += 2) {
      const turnNum = Math.floor(i / 2) + 1;
      const whiteMove = history[i] ? history[i].notation : '';
      const blackMove = history[i + 1] ? history[i + 1].notation : '';

      html += `
        <div class="history-row">
          <span class="history-turn-num">${turnNum}.</span>
          <span class="history-move-val">${whiteMove}</span>
          <span class="history-move-val black">${blackMove}</span>
        </div>
      `;
    }

    this.dom.movesContainer.innerHTML = html;
    this.dom.movesContainer.scrollTop = this.dom.movesContainer.scrollHeight;
  }

  showToast(message) {
    this.dom.toast.textContent = message;
    this.dom.toast.classList.remove('hidden');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.dom.toast.classList.add('hidden');
    }, 2400);
  }

  showGameOver(title, desc) {
    document.getElementById('gameover-title').textContent = title;
    document.getElementById('gameover-desc').textContent = desc;
    document.getElementById('gameover-stats').innerHTML = `
      <span>Tổng số nước đi: <strong>${this.game.history.length}</strong></span>
    `;
    this.openModal(this.dom.gameoverModal);
  }

  triggerConfetti() {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 300);
    } catch (e) {
      // Confetti fallback
    }
  }

  openModal(modal) {
    modal.classList.remove('hidden');
  }

  closeModal(modal) {
    modal.classList.add('hidden');
  }
}

// Initialize application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.chessApp = new ChessApp();
});
