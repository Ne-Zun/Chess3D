import confetti from 'canvas-confetti';
import { ChessGame, ChessAI, WHITE, BLACK } from './chessLogic.js';
import { Chess3D } from './chess3D.js';
import { sound } from './soundEngine.js';
import { NetworkEngine } from './networkEngine.js';
import { RankEngine, RANK_TIERS, SUGGESTED_NAMES } from './rankEngine.js';

/**
 * Main Controller for Chess 3D Grandmaster Edition
 */
class ChessApp {
  constructor() {
    this.game = new ChessGame();
    this.ai = new ChessAI('medium');
    this.network = new NetworkEngine();
    this.rankEngine = new RankEngine();

    this.mode = 'pve'; // 'pve', 'pvp', 'multiplayer', 'ranked', 'challenge'
    this.playerColor = WHITE;
    this.autoFlip = false;
    this.timeLimit = 600; // 10 minutes rapid default
    this.timers = { [WHITE]: 600, [BLACK]: 600 };
    this.timerInterval = null;

    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.isAiThinking = false;
    this.pendingPromotionMove = null;

    // Ranked & Challenge state
    this.currentOpponent = null;
    this.currentChallengeTop = null;
    this.rankedRoomCode = null;
    this.queueSeconds = 0;
    this.queueTimerInterval = null;

    this.selectedFirstTimeAvatar = '👑';
    this.selectedProfileAvatar = '👑';
    this.multiplayerMatchCount = 1;

    this.dom = {};
    this.cacheDom();
    this.init3D();
    this.initNetwork();
    this.initRankUI();
    this.bindEvents();
    this.startNewGame();
    this.checkFirstTimeUser();
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
    this.dom.btnResign = document.getElementById('btn-resign');
    this.dom.btnRestart = document.getElementById('btn-restart');

    // Quick Difficulty & Banners
    this.dom.quickDiffGroup = document.getElementById('quick-diff-group');
    this.dom.diffPills = document.querySelectorAll('.diff-pill');
    this.dom.btnPlayFriend = document.getElementById('btn-play-friend');
    this.dom.onlineRoomBanner = document.getElementById('online-room-banner');
    this.dom.roomCodeBadge = document.getElementById('room-code-badge');
    this.dom.onlineMatchCountBadge = document.getElementById('online-match-count-badge');
    this.dom.myColorBadge = document.getElementById('my-color-badge');
    this.dom.btnCopyRoomLink = document.getElementById('btn-copy-room-link');
    this.dom.btnResignMultiplayer = document.getElementById('btn-resign-multiplayer');
    this.dom.btnLeaveRoom = document.getElementById('btn-leave-room');

    // Rank & Top Bar controls
    this.dom.userRankBadge = document.getElementById('user-rank-badge');
    this.dom.topRankIcon = document.getElementById('top-rank-icon');
    this.dom.topRankName = document.getElementById('top-rank-name');
    this.dom.topRankRp = document.getElementById('top-rank-rp');
    this.dom.btnPlayRanked = document.getElementById('btn-play-ranked');
    this.dom.btnLeaderboard = document.getElementById('btn-leaderboard');

    // Ranked Match Active Banner
    this.dom.rankedMatchBanner = document.getElementById('ranked-match-banner');
    this.dom.bannerModeTitle = document.getElementById('banner-mode-title');
    this.dom.bannerMatchDesc = document.getElementById('banner-match-desc');
    this.dom.bannerStakesText = document.getElementById('banner-stakes-text');
    this.dom.btnResignRanked = document.getElementById('btn-resign-ranked');
    this.dom.btnLeaveRanked = document.getElementById('btn-leave-ranked');

    // First Time Name Modal
    this.dom.firstTimeModal = document.getElementById('first-time-modal');
    this.dom.firstTimeNameInput = document.getElementById('first-time-name-input');
    this.dom.btnRandomName = document.getElementById('btn-random-name');
    this.dom.btnSubmitFirstTime = document.getElementById('btn-submit-first-time');
    this.dom.firstTimeAvatarOptions = document.querySelectorAll('#first-time-avatar-options .avatar-opt-btn');

    // Profile Edit Modal
    this.dom.profileModal = document.getElementById('profile-modal');
    this.dom.btnCloseProfile = document.getElementById('btn-close-profile');
    this.dom.profileAvatarDisplay = document.getElementById('profile-avatar-display');
    this.dom.profileTierBadge = document.getElementById('profile-tier-badge');
    this.dom.profileRpBadge = document.getElementById('profile-rp-badge');
    this.dom.profileNameInput = document.getElementById('profile-name-input');
    this.dom.btnProfileRandomName = document.getElementById('btn-profile-random-name');
    this.dom.btnSaveProfile = document.getElementById('btn-save-profile');
    this.dom.profileAvatarOptions = document.querySelectorAll('#profile-avatar-options .avatar-opt-btn');

    // Matchmaking Modal (PvP Online)
    this.dom.rankedMatchmakingModal = document.getElementById('ranked-matchmaking-modal');
    this.dom.btnCloseMatchmaking = document.getElementById('btn-close-matchmaking');
    this.dom.btnCancelMatchmaking = document.getElementById('btn-cancel-matchmaking');
    this.dom.btnCopyQueueLink = document.getElementById('btn-copy-queue-link');
    this.dom.queueTimerDisplay = document.getElementById('queue-timer-display');
    this.dom.matchmakingSearchingState = document.getElementById('matchmaking-searching-state');
    this.dom.matchmakingFoundState = document.getElementById('matchmaking-found-state');
    this.dom.searchMyBadge = document.getElementById('search-my-badge');
    this.dom.searchMyRank = document.getElementById('search-my-rank');
    this.dom.vsMyAvatar = document.getElementById('vs-my-avatar');
    this.dom.vsMyName = document.getElementById('vs-my-name');
    this.dom.vsMyRank = document.getElementById('vs-my-rank');
    this.dom.vsMyRp = document.getElementById('vs-my-rp');
    this.dom.vsMyColor = document.getElementById('vs-my-color');
    this.dom.vsOppAvatar = document.getElementById('vs-opp-avatar');
    this.dom.vsOppName = document.getElementById('vs-opp-name');
    this.dom.vsOppRank = document.getElementById('vs-opp-rank');
    this.dom.vsOppRp = document.getElementById('vs-opp-rp');
    this.dom.vsOppColor = document.getElementById('vs-opp-color');
    this.dom.matchCountdown = document.getElementById('match-countdown');

    // Leaderboard Modal
    this.dom.leaderboardModal = document.getElementById('leaderboard-modal');
    this.dom.btnCloseLeaderboard = document.getElementById('btn-close-leaderboard');
    this.dom.btnOpenHonoring = document.getElementById('btn-open-honoring');
    this.dom.lbMonthTitle = document.getElementById('lb-month-title');
    this.dom.lbTableBody = document.getElementById('lb-table-body');

    // Honoring Modal
    this.dom.honoringModal = document.getElementById('honoring-modal');
    this.dom.btnCloseHonoring = document.getElementById('btn-close-honoring');
    this.dom.honoringTrioContainer = document.getElementById('honoring-trio-container');
    this.dom.honoringDescText = document.getElementById('honoring-desc-text');

    // Challenge Top Modal
    this.dom.challengeModal = document.getElementById('challenge-modal');
    this.dom.btnCloseChallenge = document.getElementById('btn-close-challenge');
    this.dom.btnSendChallenge = document.getElementById('btn-send-challenge');
    this.dom.btnCancelChallenge = document.getElementById('btn-cancel-challenge');
    this.dom.chBossAvatar = document.getElementById('ch-boss-avatar');
    this.dom.chBossPos = document.getElementById('ch-boss-pos');
    this.dom.chBossName = document.getElementById('ch-boss-name');
    this.dom.chBossRank = document.getElementById('ch-boss-rank');
    this.dom.chBossQuote = document.getElementById('ch-boss-quote');
    this.dom.challengeDecisionStatus = document.getElementById('challenge-decision-status');
    this.dom.challengeStatusText = document.getElementById('challenge-status-text');
    this.dom.challengeActionsRow = document.getElementById('challenge-actions-row');

    // Ranked Result Modal
    this.dom.rankedResultModal = document.getElementById('ranked-result-modal');
    this.dom.btnCloseRankedResult = document.getElementById('btn-close-ranked-result');
    this.dom.resBadgeIcon = document.getElementById('res-badge-icon');
    this.dom.resResultTitle = document.getElementById('res-result-title');
    this.dom.resResultDesc = document.getElementById('res-result-desc');
    this.dom.resRpChange = document.getElementById('res-rp-change');
    this.dom.resTierName = document.getElementById('res-tier-name');
    this.dom.resRpCurrent = document.getElementById('res-rp-current');
    this.dom.resProgressFill = document.getElementById('res-progress-fill');
    this.dom.resRankupBanner = document.getElementById('res-rankup-banner');
    this.dom.resPromotedRank = document.getElementById('res-promoted-rank');
    this.dom.resTitleBanner = document.getElementById('res-title-banner');
    this.dom.resUnlockedTitle = document.getElementById('res-unlocked-title');

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

    // Settings Modal & Core
    this.dom.promotionModal = document.getElementById('promotion-modal');
    this.dom.settingsModal = document.getElementById('settings-modal');
    this.dom.gameoverModal = document.getElementById('gameover-modal');
    this.dom.gameoverNextRoundInfo = document.getElementById('gameover-next-round-info');
    this.dom.gameoverSwapText = document.getElementById('gameover-swap-text');
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
    this.network.onRemotePlayerLeft = this.handleRemotePlayerLeft.bind(this);
    this.network.onError = (err) => {
      this.showJoinError(err);
      this.showToast(err);
    };
  }

  initRankUI() {
    this.updateRankBadgeUI();
  }

  updateRankBadgeUI() {
    const tier = this.rankEngine.getCurrentTier();
    const rankText = this.rankEngine.getRankDisplay();
    this.dom.topRankIcon.textContent = this.rankEngine.profile.avatar || tier.badge;
    this.dom.topRankName.textContent = `${this.rankEngine.profile.name} (${rankText})`;
    this.dom.topRankRp.textContent = `${this.rankEngine.profile.rp} RP`;
  }

  checkFirstTimeUser() {
    if (this.rankEngine.isFirstTimeUser()) {
      this.dom.firstTimeNameInput.value = '';
      this.selectedFirstTimeAvatar = '👑';
      this.openModal(this.dom.firstTimeModal);
      setTimeout(() => this.dom.firstTimeNameInput.focus(), 200);
    }
  }

  checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const isJoinRanked = params.get('join_ranked');

    if (isJoinRanked && roomParam) {
      const cleanCode = roomParam.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      this.showToast(`Phát hiện link mời Đấu Rank PvP vào phòng ${cleanCode}!`);
      this.openMatchmakingModal(cleanCode);
      return;
    }

    if (roomParam) {
      const cleanCode = roomParam.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      this.openMultiplayerModal('join');
      this.dom.joinCodeInput.value = cleanCode;
      this.showToast(`Phát hiện mã phòng: ${cleanCode}!`);
      setTimeout(() => {
        this.dom.btnSubmitJoin.click();
      }, 300);
    }
  }

  bindEvents() {
    // First-Time Setup Events
    this.dom.firstTimeAvatarOptions.forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.firstTimeAvatarOptions.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedFirstTimeAvatar = btn.getAttribute('data-avatar');
      });
    });

    this.dom.btnRandomName.addEventListener('click', () => {
      const rand = SUGGESTED_NAMES[Math.floor(Math.random() * SUGGESTED_NAMES.length)];
      this.dom.firstTimeNameInput.value = rand;
      this.dom.firstTimeNameInput.focus();
    });

    this.dom.btnSubmitFirstTime.addEventListener('click', () => {
      const name = this.dom.firstTimeNameInput.value.trim();
      if (!name) {
        this.showToast('Vui lòng nhập tên kỳ thủ của bạn!');
        this.dom.firstTimeNameInput.focus();
        return;
      }
      this.rankEngine.setName(name, this.selectedFirstTimeAvatar);
      this.updateRankBadgeUI();
      this.closeModal(this.dom.firstTimeModal);
      this.startNewGame();
      this.showToast(`Chào mừng ${name} đã gia nhập Đấu Trường Cờ Vua 3D!`);
      this.triggerConfetti();
    });

    this.dom.firstTimeNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.dom.btnSubmitFirstTime.click();
      }
    });

    // Profile Edit Modal Events
    this.dom.userRankBadge.addEventListener('click', () => {
      this.openProfileModal();
    });

    this.dom.btnCloseProfile.addEventListener('click', () => {
      this.closeModal(this.dom.profileModal);
    });

    this.dom.profileAvatarOptions.forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.profileAvatarOptions.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedProfileAvatar = btn.getAttribute('data-avatar');
      });
    });

    this.dom.btnProfileRandomName.addEventListener('click', () => {
      const rand = SUGGESTED_NAMES[Math.floor(Math.random() * SUGGESTED_NAMES.length)];
      this.dom.profileNameInput.value = rand;
      this.dom.profileNameInput.focus();
    });

    this.dom.btnSaveProfile.addEventListener('click', () => {
      const newName = this.dom.profileNameInput.value.trim();
      if (newName) {
        this.rankEngine.setName(newName, this.selectedProfileAvatar);
        this.updateRankBadgeUI();
        this.startNewGame();
        this.closeModal(this.dom.profileModal);
        this.showToast('Đã lưu thông tin kỳ thủ thành công!');
      }
    });

    // Quick Difficulty Pills (Easy, Medium, Hard in PvE)
    this.dom.diffPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const diff = pill.getAttribute('data-diff');
        this.setDifficulty(diff);
      });
    });

    // Ranked Matchmaking Button (PvP Online - KHÔNG ĐẤU VỚI AI)
    this.dom.btnPlayRanked.addEventListener('click', () => {
      this.openMatchmakingModal();
    });

    this.dom.btnCloseMatchmaking.addEventListener('click', () => {
      this.closeMatchmakingModal();
    });

    this.dom.btnCancelMatchmaking.addEventListener('click', () => {
      this.closeMatchmakingModal();
      this.showToast('Đã hủy tìm trận đấu rank');
    });

    this.dom.btnCopyQueueLink.addEventListener('click', () => {
      const p = this.rankEngine.profile;
      const roomCode = this.network.generatedMatchRoomCode || NetworkEngine.generateRoomCode();
      this.network.generatedMatchRoomCode = roomCode;
      const url = `${window.location.origin}${window.location.pathname}?join_ranked=1&room=${roomCode}&name=${encodeURIComponent(p.name)}&avatar=${encodeURIComponent(p.avatar || '👑')}&tier=${p.tierIndex}&subTier=${p.subTier}&rp=${p.rp}`;
      navigator.clipboard.writeText(url).then(() => {
        this.showToast('Đã sao chép link tìm đối thủ PvP đồng hạng!');
      }).catch(() => {
        this.showToast(`Link mời: ${url}`);
      });
    });

    // Leaderboard Modal
    this.dom.btnLeaderboard.addEventListener('click', () => {
      this.openLeaderboardModal();
    });

    this.dom.btnCloseLeaderboard.addEventListener('click', () => {
      this.closeModal(this.dom.leaderboardModal);
    });

    // Honoring Top 3 Modal
    this.dom.btnOpenHonoring.addEventListener('click', () => {
      this.openHonoringModal();
    });

    this.dom.btnCloseHonoring.addEventListener('click', () => {
      this.closeModal(this.dom.honoringModal);
    });

    // Challenge Top Modal
    this.dom.btnCloseChallenge.addEventListener('click', () => {
      this.closeModal(this.dom.challengeModal);
    });

    this.dom.btnCancelChallenge.addEventListener('click', () => {
      this.closeModal(this.dom.challengeModal);
    });

    this.dom.btnSendChallenge.addEventListener('click', () => {
      if (this.currentChallengeCandidate) {
        this.sendChallenge(this.currentChallengeCandidate.rankPosition);
      }
    });

    // Challenge Top buttons inside Leaderboard
    document.querySelectorAll('.btn-challenge-top').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const topNum = parseInt(e.currentTarget.getAttribute('data-top'), 10);
        this.openChallengeModal(topNum);
      });
    });

    // Unified Resign & Leave Room actions
    this.dom.btnResign?.addEventListener('click', () => this.handlePlayerResign());
    this.dom.btnResignRanked?.addEventListener('click', () => this.handlePlayerResign());
    this.dom.btnResignMultiplayer?.addEventListener('click', () => this.handlePlayerResign());
    this.dom.btnLeaveRanked?.addEventListener('click', () => this.handlePlayerLeaveRoom());
    this.dom.btnLeaveRoom?.addEventListener('click', () => this.handlePlayerLeaveRoom());

    // Ranked result modal close
    this.dom.btnCloseRankedResult.addEventListener('click', () => {
      this.closeModal(this.dom.rankedResultModal);
      this.exitRankedMode();
    });

    // Multiplayer Modal
    this.dom.btnPlayFriend.addEventListener('click', () => {
      this.openMultiplayerModal('create');
    });

    this.dom.btnCloseMultiplayer.addEventListener('click', () => {
      this.closeModal(this.dom.multiplayerModal);
      this.dom.hostWaitingStatus.classList.add('hidden');
    });

    this.dom.tabCreateRoom.addEventListener('click', () => {
      this.switchMultiplayerTab('create');
    });
    this.dom.tabJoinRoom.addEventListener('click', () => {
      this.switchMultiplayerTab('join');
    });

    this.dom.btnCopyCode.addEventListener('click', () => {
      this.copyRoomCode();
    });

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
      const code = this.dom.displayRoomCode.textContent.trim();
      const selectedColorInput = document.querySelector('input[name="host-color"]:checked');
      const hostColor = selectedColorInput ? selectedColorInput.value : 'w';

      this.dom.hostWaitingStatus.classList.remove('hidden');
      this.network.createRoom(code, hostColor, this.timeLimit);
      this.showToast(`Đã mở phòng ${code}! Đang chờ bạn bè kết nối...`);
    });

    // Join Room Button
    this.dom.btnSubmitJoin.addEventListener('click', () => {
      let raw = this.dom.joinCodeInput.value.trim().toUpperCase();
      if (raw.includes('ROOM=')) {
        raw = raw.split('ROOM=')[1].split('&')[0];
      }
      const code = raw.replace(/[^A-Z0-9]/g, '');

      if (!code || code.length < 4) {
        this.showJoinError('Vui lòng nhập mã phòng hợp lệ (VD: K9X2P7)!');
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

    this.dom.btnCopyRoomLink.addEventListener('click', () => {
      this.copyRoomLink();
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
      this.dom.difficultyRow.style.display = this.dom.modeSelect.value === 'pve' ? 'flex' : 'none';
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

    // Camera presets
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
      if (this.mode === 'ranked' || this.mode === 'challenge') {
        if (confirm('Bạn đang trong trận đấu Xếp Hạng. Thoát sẽ bị tính là đầu hàng! Bạn có chắc không?')) {
          this.handleRankedGameEnd(this.playerColor === WHITE ? BLACK : WHITE, 'Đầu hàng trận xếp hạng');
        }
        return;
      }
      if (this.mode === 'multiplayer') {
        if (confirm('Bắt đầu ván mới và đổi màu quân với bạn bè?')) {
          this.triggerMultiplayerRematch(true);
        }
        return;
      }
      if (confirm('Bạn có chắc muốn bắt đầu ván cờ mới không?')) {
        this.startNewGame();
      }
    });

    this.dom.btnPlayAgain.addEventListener('click', () => {
      this.closeModal(this.dom.gameoverModal);
      if (this.mode === 'multiplayer') {
        this.triggerMultiplayerRematch(true);
      } else {
        this.startNewGame();
      }
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

  // --- Profile Modal Flow ---
  openProfileModal() {
    this.dom.profileAvatarDisplay.textContent = this.rankEngine.profile.avatar || '👑';
    this.dom.profileTierBadge.textContent = this.rankEngine.getRankDisplay();
    this.dom.profileRpBadge.textContent = `${this.rankEngine.profile.rp} RP`;
    this.dom.profileNameInput.value = this.rankEngine.profile.name;
    this.selectedProfileAvatar = this.rankEngine.profile.avatar || '👑';

    this.dom.profileAvatarOptions.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-avatar') === this.selectedProfileAvatar);
    });

    this.openModal(this.dom.profileModal);
    setTimeout(() => this.dom.profileNameInput.focus(), 150);
  }

  // --- Real-Player Ranked PvP Matchmaking Flow (KHÔNG ĐẤU VỚI AI) ---
  openMatchmakingModal(directInviteRoom = null) {
    this.dom.matchmakingSearchingState.classList.remove('hidden');
    this.dom.matchmakingFoundState.classList.add('hidden');

    const tier = this.rankEngine.getCurrentTier();
    this.dom.searchMyBadge.textContent = this.rankEngine.profile.avatar || tier.badge;
    this.dom.searchMyRank.textContent = `Rank của bạn: ${this.rankEngine.getRankDisplay()} (${this.rankEngine.profile.rp} RP)`;

    this.openModal(this.dom.rankedMatchmakingModal);
    this.startRankedQueue(directInviteRoom);
  }

  closeMatchmakingModal() {
    if (this.queueTimerInterval) {
      clearInterval(this.queueTimerInterval);
      this.queueTimerInterval = null;
    }
    this.network.cancelRankedMatchmaking();
    this.closeModal(this.dom.rankedMatchmakingModal);
  }

  startRankedQueue(directInviteRoom = null) {
    this.queueSeconds = 0;
    this.dom.queueTimerDisplay.textContent = 'Thời gian chờ: 00:00';
    if (this.queueTimerInterval) clearInterval(this.queueTimerInterval);

    this.queueTimerInterval = setInterval(() => {
      this.queueSeconds++;
      const m = Math.floor(this.queueSeconds / 60).toString().padStart(2, '0');
      const s = (this.queueSeconds % 60).toString().padStart(2, '0');
      this.dom.queueTimerDisplay.textContent = `Thời gian chờ: ${m}:${s}`;
    }, 1000);

    // Call Real-Player Ranked PvP Queue
    this.network.startRankedMatchmaking({
      playerInfo: {
        name: this.rankEngine.profile.name,
        avatar: this.rankEngine.profile.avatar || '👑',
        tierIndex: Number(this.rankEngine.profile.tierIndex != null ? this.rankEngine.profile.tierIndex : 0),
        subTier: Number(this.rankEngine.profile.subTier != null ? this.rankEngine.profile.subTier : 1),
        rp: Number(this.rankEngine.profile.rp != null ? this.rankEngine.profile.rp : 0)
      },
      directInviteRoomCode: directInviteRoom,
      onMatchFound: ({ opponent, roomCode, myColor, isHost }) => {
        clearInterval(this.queueTimerInterval);
        this.queueTimerInterval = null;

        this.currentOpponent = opponent;
        this.playerColor = myColor;
        this.rankedRoomCode = roomCode;

        // Populate VS card
        this.dom.vsMyAvatar.textContent = this.rankEngine.profile.avatar || '👑';
        this.dom.vsMyName.textContent = `${this.rankEngine.profile.name} (Bạn)`;
        this.dom.vsMyRank.textContent = this.rankEngine.getRankDisplay();
        this.dom.vsMyRp.textContent = `${this.rankEngine.profile.rp} RP`;

        const oppTier = RANK_TIERS[opponent.tierIndex] || RANK_TIERS[0];
        this.dom.vsOppAvatar.textContent = opponent.avatar || '⚔️';
        this.dom.vsOppName.textContent = opponent.name;
        this.dom.vsOppRank.textContent = `${oppTier.name} ${opponent.subTier}`;
        this.dom.vsOppRp.textContent = `${opponent.rp} RP`;

        // Display Random Color Assignment
        if (this.dom.vsMyColor && this.dom.vsOppColor) {
          const myIsWhite = myColor === WHITE;
          this.dom.vsMyColor.textContent = myIsWhite ? '⚪ Quân Trắng (Đi trước)' : '⚫ Quân Đen (Đi sau)';
          this.dom.vsMyColor.style.background = myIsWhite ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.6)';
          this.dom.vsMyColor.style.color = myIsWhite ? '#f8fafc' : '#94a3b8';

          this.dom.vsOppColor.textContent = myIsWhite ? '⚫ Quân Đen (Đi sau)' : '⚪ Quân Trắng (Đi trước)';
          this.dom.vsOppColor.style.background = myIsWhite ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.18)';
          this.dom.vsOppColor.style.color = myIsWhite ? '#94a3b8' : '#f8fafc';
        }

        this.dom.matchmakingSearchingState.classList.add('hidden');
        this.dom.matchmakingFoundState.classList.remove('hidden');
        sound.playSelect();

        let count = 3;
        this.dom.matchCountdown.textContent = count;
        const cd = setInterval(() => {
          count--;
          if (count <= 0) {
            clearInterval(cd);
            this.closeModal(this.dom.rankedMatchmakingModal);
            this.startLiveRankedGame({ opponent, roomCode, myColor, isHost });
          } else {
            this.dom.matchCountdown.textContent = count;
          }
        }, 900);
      },
      onError: (err) => {
        this.showToast(err);
      }
    });
  }

  startLiveRankedGame({ opponent, roomCode, myColor, isHost }) {
    this.mode = 'ranked';
    this.playerColor = myColor;
    this.currentOpponent = opponent;
    this.timeLimit = 600; // 10 minutes rapid

    // Connect both real players in room
    if (isHost) {
      this.network.createRoom(roomCode, myColor, this.timeLimit);
    } else {
      this.network.joinRoom(roomCode);
    }

    // Set camera to player's perspective
    this.chess3D.setCameraPreset(myColor === WHITE ? 'white' : 'black');
    document.querySelectorAll('.btn-pill[data-camera]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-camera') === (myColor === WHITE ? 'white' : 'black'));
    });

    // Update Banner
    const oppTier = RANK_TIERS[opponent.tierIndex] || RANK_TIERS[0];
    this.dom.rankedMatchBanner.classList.remove('hidden');
    this.dom.bannerModeTitle.textContent = `ĐẤU RANK PVP (${myColor === WHITE ? 'QUÂN TRẮNG ⚪' : 'QUÂN ĐEN ⚫'}):`;
    this.dom.bannerMatchDesc.textContent = `${this.rankEngine.profile.name} vs ${opponent.name} (${oppTier.name} ${opponent.subTier})`;
    this.dom.bannerStakesText.textContent = `Thắng: +25 RP | Thua: -${this.rankEngine.getCurrentTier().lossDeduction} RP`;

    this.dom.quickDiffGroup.style.display = 'none';
    this.dom.onlineRoomBanner.classList.add('hidden');

    this.startNewGame();
    const colorDesc = myColor === WHITE ? 'Trắng ⚪ (Đi trước)' : 'Đen ⚫ (Đi sau)';
    this.showToast(`🎲 Ghép trận thành công! Bạn được random quân ${colorDesc}`);
  }

  exitRankedMode() {
    this.mode = 'pve';
    this.currentOpponent = null;
    this.currentChallengeTop = null;
    this.network.cleanup();
    this.dom.rankedMatchBanner.classList.add('hidden');
    this.dom.quickDiffGroup.style.display = 'flex';
    this.chess3D.setCameraPreset('white');
    this.startNewGame();
  }

  // --- Monthly Leaderboard Modal Flow ---
  openLeaderboardModal() {
    this.dom.lbMonthTitle.textContent = `BẢNG XẾP HẠNG ${this.rankEngine.currentMonthStr.toUpperCase()}`;
    this.renderLeaderboard();
    this.openModal(this.dom.leaderboardModal);
  }

  renderLeaderboard() {
    const list = this.rankEngine.leaderboard;
    const top3 = this.rankEngine.getTop3();

    if (top3[0]) {
      document.getElementById('podium-name-1').textContent = top3[0].name;
      document.getElementById('podium-rank-1').textContent = this.rankEngine.getRankDisplay(top3[0].tierIndex, top3[0].subTier);
      document.getElementById('podium-rp-1').textContent = `${top3[0].rp} RP`;
      document.getElementById('podium-title-1').textContent = top3[0].monthlyTitle;
    }

    if (top3[1]) {
      document.getElementById('podium-name-2').textContent = top3[1].name;
      document.getElementById('podium-rank-2').textContent = this.rankEngine.getRankDisplay(top3[1].tierIndex, top3[1].subTier);
      document.getElementById('podium-rp-2').textContent = `${top3[1].rp} RP`;
      document.getElementById('podium-title-2').textContent = top3[1].monthlyTitle;
    }

    if (top3[2]) {
      document.getElementById('podium-name-3').textContent = top3[2].name;
      document.getElementById('podium-rank-3').textContent = this.rankEngine.getRankDisplay(top3[2].tierIndex, top3[2].subTier);
      document.getElementById('podium-rp-3').textContent = `${top3[2].rp} RP`;
      document.getElementById('podium-title-3').textContent = top3[2].monthlyTitle;
    }

    // Ranks 4+ Table
    let tableHtml = '';
    const otherRankers = list.slice(3);
    for (const item of otherRankers) {
      const rankTier = RANK_TIERS[item.tierIndex] || RANK_TIERS[0];
      const isMe = item.isPlayer;

      tableHtml += `
        <tr class="${isMe ? 'lb-row-me' : ''}">
          <td class="lb-rank-num">#${item.rankPosition}</td>
          <td>
            <div class="lb-player-cell">
              <span>${item.avatar}</span>
              <strong>${item.name}</strong>
            </div>
          </td>
          <td>
            <span class="lb-badge" style="color: ${rankTier.color}; border: 1px solid ${rankTier.color}40">
              ${rankTier.badge} ${rankTier.name} ${item.subTier}
            </span>
          </td>
          <td><strong>${item.rp}</strong> RP</td>
          <td>${item.winrate}% (${item.wins}T - ${item.losses || 0}B)</td>
          <td><em>${item.monthlyTitle}</em></td>
        </tr>
      `;
    }

    this.dom.lbTableBody.innerHTML = tableHtml;
  }

  // --- Monthly Top 3 Honoring Modal Flow ---
  openHonoringModal() {
    const top3 = this.rankEngine.getTop3();
    let cardsHtml = '';
    const medals = ['🥇', '🥈', '🥉'];
    const titles = ['QUÁN QUÂN THÁNG', 'Á QUÂN THÁNG', 'QUÝ QUÂN THÁNG'];
    const classes = ['top1', 'top2', 'top3'];

    top3.forEach((item, idx) => {
      const rankTier = RANK_TIERS[item.tierIndex] || RANK_TIERS[5];
      cardsHtml += `
        <div class="honoring-card ${classes[idx]}">
          <div class="honoring-badge-pos">${medals[idx]} ${titles[idx]}</div>
          <div style="font-size: 38px; margin: 6px 0;">${item.avatar}</div>
          <div class="honoring-player-name">${item.name}</div>
          <div class="honoring-player-rank">${rankTier.badge} ${rankTier.name} ${item.subTier} (${item.rp} RP)</div>
          <div style="font-size: 11px; color: #4ade80; font-weight: 700; margin-bottom: 4px;">Tỉ Lệ Thắng: ${item.winrate}% (${item.wins} Thắng)</div>
          <div class="honoring-player-title">"${item.monthlyTitle}"</div>
        </div>
      `;
    });

    this.dom.honoringTrioContainer.innerHTML = cardsHtml;
    this.dom.honoringDescText.textContent = `Hội Đồng Cờ Vua 3D trân trọng vinh danh 3 kỳ thủ xuất sắc nhất ${this.rankEngine.currentMonthStr}!`;
    this.openModal(this.dom.honoringModal);
    this.triggerConfetti();
  }

  // --- Top 1-3 Challenge Flow ---
  openChallengeModal(topRank) {
    const candidate = this.rankEngine.getTopCandidate(topRank);
    if (!candidate) return;

    this.currentChallengeCandidate = candidate;
    this.dom.chBossAvatar.textContent = candidate.avatar;
    this.dom.chBossPos.textContent = `TOP ${topRank} BẢNG XẾP HẠNG THÁNG`;
    this.dom.chBossName.textContent = candidate.name;
    this.dom.chBossRank.textContent = `${this.rankEngine.getRankDisplay(candidate.tierIndex, candidate.subTier)} • ${candidate.rp} RP`;

    const quotes = {
      1: '"Ta là Quán Quân giữ đỉnh bảng tháng này. Ngươi có đủ bản lĩnh để lật đổ ngôi vương?"',
      2: '"Kỳ nghệ của ta được rèn giũa qua hàng trăm trận chiến. Ngươi dám thách thức vị trí Á Quân?"',
      3: '"Tốc độ và sự sắc bén là vũ khí của ta. Hãy chứng minh ngươi xứng đáng đứng vào Top 3!"'
    };
    this.dom.chBossQuote.textContent = quotes[topRank] || quotes[1];

    this.dom.challengeDecisionStatus.classList.add('hidden');
    this.dom.challengeActionsRow.classList.remove('hidden');
    this.dom.btnSendChallenge.textContent = 'Gửi Lời Khiêu Chiến Ngay';
    this.dom.btnSendChallenge.disabled = false;

    this.openModal(this.dom.challengeModal);
  }

  sendChallenge(topRank) {
    this.dom.challengeActionsRow.classList.add('hidden');
    this.dom.challengeDecisionStatus.classList.remove('hidden');
    this.dom.challengeStatusText.textContent = `Đang gửi thư khiêu chiến tới Top ${topRank} BXH...`;

    setTimeout(() => {
      const decision = this.rankEngine.evaluateChallenge(topRank);
      if (decision.accepted) {
        this.dom.challengeStatusText.innerHTML = `<span style="color: #4ade80;">✓ ĐÃ CHẤP NHẬN:</span> ${decision.quote}`;
        sound.playVictory();
        this.triggerConfetti();

        setTimeout(() => {
          this.closeModal(this.dom.challengeModal);
          this.closeModal(this.dom.leaderboardModal);
          this.startChallengeGame(decision.topPlayer);
        }, 1800);
      } else {
        this.dom.challengeStatusText.innerHTML = `<span style="color: #f87171;">✕ TỪ CHỐI THÁCH ĐẤU:</span> ${decision.quote}`;
        setTimeout(() => {
          this.dom.challengeActionsRow.classList.remove('hidden');
          this.dom.btnSendChallenge.textContent = 'Thử Gửi Lại Sau';
          this.dom.btnSendChallenge.disabled = false;
        }, 1500);
      }
    }, 1200);
  }

  startChallengeGame(topPlayer) {
    this.mode = 'challenge';
    this.currentChallengeTop = topPlayer.rankPosition;
    this.playerColor = WHITE;
    this.timeLimit = 600;

    // Boss plays at Master Hard AI
    this.ai.setDifficulty('hard');

    // Update Subbar Banner
    this.dom.rankedMatchBanner.classList.remove('hidden');
    this.dom.bannerModeTitle.textContent = `THÁCH ĐẤU TOP ${topPlayer.rankPosition} BXH:`;
    this.dom.bannerMatchDesc.textContent = `Bạn vs ${topPlayer.name} (${this.rankEngine.getRankDisplay(topPlayer.tierIndex, topPlayer.subTier)})`;
    this.dom.bannerStakesText.innerHTML = `<span style="color: #4ade80;">THẮNG: Nhận Danh Hiệu Top BXH + 50 RP | THUA: Không mất điểm!</span>`;

    this.dom.quickDiffGroup.style.display = 'none';
    this.dom.onlineRoomBanner.classList.add('hidden');

    this.startNewGame();
    this.showToast(`BẮT ĐẦU TRẬN ĐẠI CHIẾN THÁCH ĐẤU TOP ${topPlayer.rankPosition} BXH!`);
  }

  handleRankedGameEnd(winnerColor, reason = '') {
    const isWin = winnerColor === this.playerColor;
    const isLoss = winnerColor !== null && winnerColor !== this.playerColor;
    const outcome = isWin ? 'win' : isLoss ? 'loss' : 'draw';

    const isChallenge = this.mode === 'challenge';
    const result = this.rankEngine.recordMatchResult({
      outcome,
      isTopChallenge: isChallenge,
      topId: this.currentChallengeTop,
      opponentRank: this.currentOpponent?.name
    });

    this.updateRankBadgeUI();

    // Show Ranked Result Modal
    this.dom.resResultTitle.textContent = isWin ? 'CHIẾN THẮNG TRẬN RANK!' : isLoss ? 'THẤT BẠI TRẬN RANK!' : 'HÒA CỜ TRẬN RANK!';
    this.dom.resResultDesc.textContent = reason || (isWin ? 'Bạn đã đánh bại đối thủ và tích lũy thêm điểm xếp hạng!' : isLoss ? 'Bạn đã thua trận đấu này.' : 'Ván cờ kết thúc hòa.');

    if (result.rpChange > 0) {
      this.dom.resRpChange.textContent = `+${result.rpChange} RP`;
      this.dom.resRpChange.className = 'rp-diff';
    } else if (result.rpChange < 0) {
      this.dom.resRpChange.textContent = `${result.rpChange} RP`;
      this.dom.resRpChange.className = 'rp-diff negative';
    } else {
      this.dom.resRpChange.textContent = `+0 RP (Bảo Vệ Điểm)`;
      this.dom.resRpChange.className = 'rp-diff';
    }

    this.dom.resTierName.textContent = result.newRank;
    this.dom.resRpCurrent.textContent = `${result.newRp} / 100 RP`;
    this.dom.resProgressFill.style.width = `${Math.min(100, Math.max(5, result.newRp))}%`;

    // Rank-up banner
    if (result.rankUp) {
      this.dom.resRankupBanner.classList.remove('hidden');
      this.dom.resPromotedRank.textContent = result.newRank;
      this.triggerConfetti();
    } else {
      this.dom.resRankupBanner.classList.add('hidden');
    }

    // Title Reward banner
    if (result.specialReward) {
      this.dom.resTitleBanner.classList.remove('hidden');
      this.dom.resUnlockedTitle.textContent = `"${result.specialReward.title}"`;
      this.triggerConfetti();
    } else {
      this.dom.resTitleBanner.classList.add('hidden');
    }

    this.openModal(this.dom.rankedResultModal);
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
      const selectedColorInput = document.querySelector('input[name="host-color"]:checked');
      const hostColor = selectedColorInput ? selectedColorInput.value : 'w';
      this.network.createRoom(newCode, hostColor, this.timeLimit);
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
  handleNetworkConnected({ role, myColor, timeLimit, roomCode, opponentName }) {
    this.closeModal(this.dom.multiplayerModal);
    this.dom.hostWaitingStatus.classList.add('hidden');
    this.dom.quickDiffGroup.style.display = 'none';

    if (this.mode !== 'ranked') {
      this.mode = 'multiplayer';
      this.playerColor = myColor;
      if (timeLimit) this.timeLimit = timeLimit;

      // Update UI Elements
      this.dom.roomCodeBadge.textContent = roomCode;
      this.dom.myColorBadge.textContent = myColor === WHITE ? 'Trắng (White)' : 'Đen (Black)';
      this.multiplayerMatchCount = 1;
      if (this.dom.onlineMatchCountBadge) {
        this.dom.onlineMatchCountBadge.textContent = 'Ván 1';
      }

      this.dom.onlineRoomBanner.classList.remove('hidden');

      // Set camera to player's perspective
      this.chess3D.setCameraPreset(myColor === WHITE ? 'white' : 'black');
      document.querySelectorAll('.btn-pill[data-camera]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-camera') === (myColor === WHITE ? 'white' : 'black'));
      });

      this.startNewGame();
      this.showToast(`Đã kết nối với đối thủ! Bạn là quân ${myColor === WHITE ? 'Trắng ⚪ (Đi trước)' : 'Đen ⚫ (Đi sau)'}`);
    } else {
      // In Ranked PvP, banner and board are already initialized with correct perspective
      this.showToast(`Đã kết nối PvP thời gian thực với ${this.currentOpponent?.name || 'đối thủ'}!`);
    }
  }

  handleNetworkDisconnected() {
    if (this.mode === 'ranked') {
      sound.playVictory();
      this.handleRankedGameEnd(this.playerColor, 'Đối thủ đã ngắt kết nối! Bạn giành chiến thắng.');
    } else {
      this.showToast('Đối thủ đã ngắt kết nối!');
    }
  }

  handleRemoteMove(data) {
    const { from, to, promotion } = data;
    const legalMoves = this.game.getLegalMoves(from.r, from.c);
    const move = legalMoves.find(m => m.to.r === to.r && m.to.c === to.c);
    if (move) {
      this.executeMove(move, promotion || 'q', true);
    }
  }

  handleRemoteRematch(data) {
    if (this.mode === 'multiplayer') {
      this.triggerMultiplayerRematch(false, data);
    } else {
      this.startNewGame();
      this.showToast('Đối thủ đã bắt đầu ván mới!');
    }
  }

  triggerMultiplayerRematch(isInitiator, data = null) {
    let nextColor;
    if (isInitiator) {
      nextColor = this.playerColor === WHITE ? BLACK : WHITE;
      this.playerColor = nextColor;
      this.network.myColor = nextColor;
      this.network.sendRematch(nextColor);
    } else {
      if (data && data.initiatorNewColor) {
        nextColor = data.initiatorNewColor === WHITE ? BLACK : WHITE;
      } else {
        nextColor = this.playerColor === WHITE ? BLACK : WHITE;
      }
      this.playerColor = nextColor;
      this.network.myColor = nextColor;
    }

    this.multiplayerMatchCount = (this.multiplayerMatchCount || 1) + 1;

    // Update banner & badge
    this.dom.myColorBadge.textContent = this.playerColor === WHITE ? 'Trắng' : 'Đen';
    if (this.dom.onlineMatchCountBadge) {
      this.dom.onlineMatchCountBadge.textContent = `Ván ${this.multiplayerMatchCount}`;
    }

    // Set camera to new perspective
    this.chess3D.setCameraPreset(this.playerColor === WHITE ? 'white' : 'black');
    document.querySelectorAll('.btn-pill[data-camera]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-camera') === (this.playerColor === WHITE ? 'white' : 'black'));
    });

    this.closeModal(this.dom.gameoverModal);
    this.startNewGame();

    const colorName = this.playerColor === WHITE ? 'Trắng ⚪ (Đi trước)' : 'Đen ⚫ (Đi sau)';
    this.showToast(`🔄 ĐÃ ĐỔI QUÂN VÁN ${this.multiplayerMatchCount}: Bạn chuyển sang cầm quân ${colorName}!`);
  }

  handlePlayerResign() {
    if (this.game.isCheckmate || this.game.isStalemate || this.game.isThreefoldRepetition || this.game.isFiftyMoveDraw) {
      this.showToast('Ván cờ này đã kết thúc!');
      return;
    }

    if (this.mode === 'ranked') {
      if (confirm('Bạn có chắc muốn ĐẦU HÀNG trận đấu Xếp Hạng này không?\nBạn sẽ bị xử thua và trừ điểm RP.')) {
        this.network.sendResign();
        this.handleRankedGameEnd(this.playerColor === WHITE ? BLACK : WHITE, 'Bạn đã đầu hàng ván đấu xếp hạng.');
      }
    } else if (this.mode === 'multiplayer') {
      if (confirm('Bạn có chắc muốn ĐẦU HÀNG ván cờ này với bạn bè không?')) {
        this.network.sendResign();
        const opponentColor = this.playerColor === WHITE ? BLACK : WHITE;
        const opponentName = opponentColor === WHITE ? 'Trắng (Bạn bè)' : 'Đen (Bạn bè)';
        sound.playVictory();
        this.showGameOver('BẠN ĐÃ ĐẦU HÀNG!', `Quân ${opponentName} giành chiến thắng ván này.`);
      }
    } else if (this.mode === 'challenge') {
      if (confirm('Bạn có chắc muốn đầu hàng ván khiêu chiến này không?\n(Bạn được bảo lưu điểm, không bị trừ RP)')) {
        this.handleRankedGameEnd(BLACK, 'Bạn đã đầu hàng ván khiêu chiến.');
      }
    } else if (this.mode === 'pve') {
      if (confirm('Bạn có chắc muốn đầu hàng máy AI không?')) {
        sound.playVictory();
        this.showGameOver('BẠN ĐÃ ĐẦU HÀNG!', 'AI máy giành chiến thắng ván này.');
      }
    } else {
      // Local PvP
      const currentTurnName = this.game.turn === WHITE ? 'Trắng' : 'Đen';
      const winnerName = this.game.turn === WHITE ? 'Đen' : 'Trắng';
      if (confirm(`Quân ${currentTurnName} có chắc muốn đầu hàng không?`)) {
        sound.playVictory();
        this.showGameOver('ĐẦU HÀNG!', `Quân ${winnerName} giành chiến thắng do đối thủ đầu hàng.`);
      }
    }
  }

  handlePlayerLeaveRoom() {
    if (this.mode === 'ranked') {
      const matchActive = !this.game.isCheckmate && !this.game.isStalemate && !this.game.isThreefoldRepetition && this.game.history.length > 0;
      const msg = matchActive 
        ? 'Bạn đang trong trận Đấu Rank!\nRời phòng bây giờ sẽ bị xử thua trận và trừ điểm RP.\nBạn có chắc chắn muốn rời phòng không?'
        : 'Bạn có chắc muốn rời phòng Đấu Rank và trở về sảnh chính không?';
      if (confirm(msg)) {
        if (matchActive) {
          this.network.sendResign();
          this.rankEngine.recordMatchResult({
            outcome: 'loss',
            isTopChallenge: false,
            opponentRank: this.currentOpponent?.name
          });
          this.updateRankBadgeUI();
        }
        this.network.sendPlayerLeft();
        this.exitRankedMode();
        this.showToast('Đã rời khỏi phòng Đấu Rank');
      }
    } else if (this.mode === 'multiplayer') {
      if (confirm('Bạn có chắc muốn rời khỏi phòng đấu online với bạn bè không?')) {
        this.network.sendPlayerLeft();
        this.leaveRoom();
        this.showToast('Đã rời khỏi phòng đấu online');
      }
    } else if (this.mode === 'challenge') {
      if (confirm('Bạn có chắc muốn rời khỏi ván khiêu chiến không?')) {
        this.exitRankedMode();
        this.showToast('Đã rời khỏi ván khiêu chiến');
      }
    } else {
      this.showToast('Bạn đang ở chế độ chơi bình thường');
    }
  }

  handleRemoteResign() {
    sound.playVictory();
    if (this.mode === 'ranked') {
      this.handleRankedGameEnd(this.playerColor, 'Đối thủ đã đầu hàng! Bạn giành chiến thắng!');
    } else {
      const winner = this.playerColor === WHITE ? 'Trắng (Bạn)' : 'Đen (Bạn)';
      this.showGameOver('ĐỐI THỦ ĐẦU HÀNG!', `Quân ${winner} giành chiến thắng!`);
    }
  }

  handleRemotePlayerLeft() {
    sound.playVictory();
    if (this.mode === 'ranked') {
      this.handleRankedGameEnd(this.playerColor, 'Đối thủ đã rời khỏi phòng đấu! Bạn giành chiến thắng.');
    } else if (this.mode === 'multiplayer') {
      this.showGameOver('ĐỐI THỦ ĐÃ RỜI PHÒNG!', 'Bạn bè của bạn đã rời khỏi phòng đấu online.');
      this.showToast('Đối thủ đã rời phòng đấu online');
    }
  }

  leaveRoom() {
    this.network.cleanup();
    this.mode = 'pve';
    this.playerColor = WHITE;
    this.multiplayerMatchCount = 1;
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

    const playerName = this.rankEngine.profile.name || 'Bạn';

    // Update UI Names
    if (this.mode === 'multiplayer') {
      if (this.playerColor === WHITE) {
        this.dom.whiteNameLabel.textContent = `${playerName} (Trắng)`;
        this.dom.blackNameLabel.textContent = 'Bạn bè (Đen)';
      } else {
        this.dom.whiteNameLabel.textContent = 'Bạn bè (Trắng)';
        this.dom.blackNameLabel.textContent = `${playerName} (Đen)`;
      }
    } else if (this.mode === 'ranked') {
      const oppName = this.currentOpponent?.name || 'Đối thủ PvP';
      if (this.playerColor === WHITE) {
        this.dom.whiteNameLabel.textContent = `${playerName} (Bạn - Trắng)`;
        this.dom.blackNameLabel.textContent = `${oppName} (Đen)`;
      } else {
        this.dom.whiteNameLabel.textContent = `${oppName} (Trắng)`;
        this.dom.blackNameLabel.textContent = `${playerName} (Bạn - Đen)`;
      }
    } else if (this.mode === 'challenge') {
      this.dom.whiteNameLabel.textContent = `${playerName} (Bạn - Trắng)`;
      const boss = this.rankEngine.getTopCandidate(this.currentChallengeTop || 1);
      this.dom.blackNameLabel.textContent = `👑 Top ${this.currentChallengeTop || 1}: ${boss ? boss.name : 'Cao Thủ'}`;
    } else if (this.mode === 'pve') {
      this.dom.whiteNameLabel.textContent = `${playerName} (Trắng)`;
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
      if (this.game.isCheckmate || this.game.isStalemate || this.game.isThreefoldRepetition || this.game.isFiftyMoveDraw || this.game.isInsufficientMaterial) return;

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
    const winner = loserColor === WHITE ? BLACK : WHITE;
    const winnerName = winner === WHITE ? 'Trắng' : 'Đen';
    sound.playVictory();

    if (this.mode === 'ranked' || this.mode === 'challenge') {
      this.handleRankedGameEnd(winner, `Đối thủ hết thời gian! Quân ${winnerName} chiến thắng!`);
    } else {
      this.showGameOver(`HẾT GIỜ!`, `Quân ${winnerName} chiến thắng do đối thủ hết thời gian.`);
    }
  }

  onHoverSquare(square) {
    // Tooltip
  }

  onSquareClicked(r, c, pieceData, directMove = null) {
    // Block moves if it's not the player's turn in PvE, Ranked PvP, or Challenge
    if ((this.mode === 'pve' || this.mode === 'ranked' || this.mode === 'challenge' || this.mode === 'multiplayer') && this.game.turn !== this.playerColor) {
      return;
    }
    if (this.game.isCheckmate || this.game.isStalemate || this.game.isThreefoldRepetition || this.game.isFiftyMoveDraw || this.isAiThinking) {
      return;
    }

    if (directMove) {
      this.handlePlayerMove(directMove);
      return;
    }

    const clickedPiece = this.game.getPiece(r, c);

    if (this.selectedSquare) {
      const matchingMove = this.legalMovesForSelected.find(
        m => m.to.r === r && m.to.c === c
      );

      if (matchingMove) {
        this.handlePlayerMove(matchingMove);
        return;
      }

      if (clickedPiece && clickedPiece.color === this.game.turn) {
        if ((this.mode === 'multiplayer' || this.mode === 'ranked') && clickedPiece.color !== this.playerColor) return;
        this.selectSquare(r, c);
        return;
      }

      this.deselectSquare();
      return;
    }

    if (clickedPiece && clickedPiece.color === this.game.turn) {
      if ((this.mode === 'multiplayer' || this.mode === 'ranked') && clickedPiece.color !== this.playerColor) return;
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

    // Send move over network in both Multiplayer room and Ranked PvP
    if ((this.mode === 'multiplayer' || this.mode === 'ranked') && !isRemote) {
      this.network.sendMove(move, promotionChoice);
    }

    const moveResult = this.game.makeMove(move, promotionChoice);

    if (isCastle) {
      sound.playCastle();
    } else if (isCapture) {
      sound.playCapture();
    } else {
      sound.playMove();
    }

    this.chess3D.board.setLastMove(move.from, move.to);

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
      const winner = this.game.turn === WHITE ? BLACK : WHITE;
      const winnerName = winner === WHITE ? 'Trắng' : 'Đen';
      sound.playVictory();
      this.triggerConfetti();

      if (this.mode === 'ranked' || this.mode === 'challenge') {
        this.handleRankedGameEnd(winner, `Chiếu bí ngoạn mục! Quân ${winnerName} chiến thắng!`);
      } else {
        this.showGameOver('CHIẾU BÍ!', `Quân ${winnerName} đã giành chiến thắng ngoạn mục!`);
      }
      return;
    }

    // Threefold Repetition Draw
    if (moveResult.isThreefoldRepetition) {
      if (this.mode === 'ranked' || this.mode === 'challenge') {
        this.handleRankedGameEnd(null, 'Hòa cờ do thế cờ lặp lại 3 lần (Threefold Repetition).');
      } else {
        this.showGameOver('HÒA CỜ - LẶP NƯỚC 3 LẦN!', 'Ván cờ kết thúc hòa do lặp lại một thế cờ 3 lần (Threefold Repetition).');
      }
      return;
    }

    // 50-move rule Draw
    if (moveResult.isFiftyMoveDraw) {
      if (this.mode === 'ranked' || this.mode === 'challenge') {
        this.handleRankedGameEnd(null, 'Hòa cờ theo luật 50 nước không ăn quân.');
      } else {
        this.showGameOver('HÒA CỜ - LUẬT 50 NƯỚC!', '50 nước đi liên tiếp không có tốt di chuyển hoặc quân bị ăn.');
      }
      return;
    }

    // Insufficient Material Draw
    if (moveResult.isInsufficientMaterial) {
      if (this.mode === 'ranked' || this.mode === 'challenge') {
        this.handleRankedGameEnd(null, 'Hòa cờ do cả hai bên không đủ lực lượng chiếu bí.');
      } else {
        this.showGameOver('HÒA CỜ - THIẾU LỰC LƯỢNG!', 'Cả hai bên không còn đủ quân để chiếu bí đối phương.');
      }
      return;
    }

    // Stalemate
    if (this.game.isStalemate) {
      if (this.mode === 'ranked' || this.mode === 'challenge') {
        this.handleRankedGameEnd(null, 'Hòa cờ do hết nước đi hợp lệ (Stalemate).');
      } else {
        this.showGameOver('HÒA CỜ!', 'Ván cờ kết thúc hòa do hết nước đi hợp lệ (Stalemate).');
      }
      return;
    }

    // Auto-flip in local PvP
    if (this.mode === 'pvp' && this.autoFlip) {
      this.chess3D.setCameraPreset(this.game.turn === WHITE ? 'white' : 'black');
    }

    // Trigger AI move ONLY for PvE and Challenge mode (Ranked is 100% human PvP!)
    if ((this.mode === 'pve' || this.mode === 'challenge') && this.game.turn === BLACK) {
      this.triggerAiTurn();
    }
  }

  triggerAiTurn() {
    this.isAiThinking = true;
    const diffNames = { easy: 'Dễ', medium: 'Vừa', hard: 'Khó' };
    
    if (this.mode === 'challenge') {
      this.dom.blackNameLabel.textContent = `👑 Top BXH đang tính toán...`;
    } else {
      this.dom.blackNameLabel.textContent = `AI (${diffNames[this.ai.difficulty]}) đang suy nghĩ...`;
    }

    const thinkDelay = this.ai.difficulty === 'hard' ? 420 : this.ai.difficulty === 'medium' ? 280 : 160;

    setTimeout(() => {
      if (this.game.turn !== BLACK || this.game.isCheckmate || this.game.isStalemate || this.game.isThreefoldRepetition) {
        this.isAiThinking = false;
        return;
      }

      const bestMove = this.ai.getBestMove(this.game);

      if (this.mode === 'challenge') {
        const boss = this.rankEngine.getTopCandidate(this.currentChallengeTop || 1);
        this.dom.blackNameLabel.textContent = `👑 Top ${this.currentChallengeTop}: ${boss ? boss.name : 'Cao Thủ'}`;
      } else {
        this.dom.blackNameLabel.textContent = `AI Máy (${diffNames[this.ai.difficulty]})`;
      }

      this.isAiThinking = false;

      if (bestMove) {
        this.executeMove(bestMove, 'q');
      }
    }, thinkDelay);
  }

  handleUndo() {
    if (this.mode === 'multiplayer' || this.mode === 'ranked' || this.mode === 'challenge') {
      this.showToast('Không thể đi lại khi đang thi đấu Rank hoặc Online!');
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
    if (this.mode === 'ranked' || this.mode === 'multiplayer') {
      this.showToast('Không thể xem gợi ý trong trận đấu trực tuyến!');
      return;
    }
    if (this.isAiThinking || this.game.isCheckmate || this.game.isStalemate || this.game.isThreefoldRepetition) return;

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

    const pieceIcons = { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' };
    
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
    }, 2500);
  }

  showGameOver(title, desc) {
    document.getElementById('gameover-title').textContent = title;
    document.getElementById('gameover-desc').textContent = desc;
    document.getElementById('gameover-stats').innerHTML = `
      <span>Tổng số nước đi: <strong>${this.game.history.length}</strong></span>
    `;

    if (this.mode === 'multiplayer') {
      const nextColorName = this.playerColor === WHITE ? 'Đen ⚫ (Đi sau)' : 'Trắng ⚪ (Đi trước)';
      if (this.dom.gameoverNextRoundInfo && this.dom.gameoverSwapText) {
        this.dom.gameoverSwapText.textContent = `🔄 Ván sau sẽ tự động đổi quân: Bạn sẽ chuyển sang cầm quân ${nextColorName}!`;
        this.dom.gameoverNextRoundInfo.classList.remove('hidden');
      }
      this.dom.btnPlayAgain.textContent = '🔄 Đổi Quân & Chơi Ván Mới';
    } else {
      if (this.dom.gameoverNextRoundInfo) {
        this.dom.gameoverNextRoundInfo.classList.add('hidden');
      }
      this.dom.btnPlayAgain.textContent = 'Chơi Ván Mới';
    }

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
    } catch (e) {}
  }

  openModal(modal) {
    if (modal) modal.classList.remove('hidden');
  }

  closeModal(modal) {
    if (modal) modal.classList.add('hidden');
  }
}

// Initialize application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.chessApp = new ChessApp();
});
