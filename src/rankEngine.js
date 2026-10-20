/**
 * Rank & Matchmaking & Monthly Leaderboard Engine for Chess 3D
 */

export const RANK_TIERS = [
  {
    id: 'tan_thu',
    name: 'Tân Thủ',
    badge: '🌱',
    color: '#84cc16',
    gradient: 'linear-gradient(135deg, #a3e635, #65a30d)',
    aiLevel: 'easy',
    lossDeduction: 0 // New player protection
  },
  {
    id: 'tap_su',
    name: 'Tập Sự',
    badge: '⚔️',
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg, #38bdf8, #0284c7)',
    aiLevel: 'easy',
    lossDeduction: 6
  },
  {
    id: 'chien_binh',
    name: 'Chiến Binh',
    badge: '🛡️',
    color: '#a855f7',
    gradient: 'linear-gradient(135deg, #c084fc, #7e22ce)',
    aiLevel: 'medium',
    lossDeduction: 10
  },
  {
    id: 'tinh_anh',
    name: 'Tinh Anh',
    badge: '💎',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #22d3ee, #0891b2)',
    aiLevel: 'medium',
    lossDeduction: 12
  },
  {
    id: 'kien_tuong',
    name: 'Kiện Tướng',
    badge: '👑',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #fbbf24, #d97706)',
    aiLevel: 'hard',
    lossDeduction: 14
  },
  {
    id: 'chuyen_nghiep',
    name: 'Chuyên Nghiệp',
    badge: '🌟',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #f43f5e, #be123c, #fbbf24)',
    aiLevel: 'hard',
    lossDeduction: 15
  }
];

export const SUGGESTED_NAMES = [
  'Bạch Thủ Kỳ Vương', 'Kỳ Thánh 3D', 'Hiệp Sĩ Bàn Cờ', 'Chiến Binh Bất Bại',
  'Phụng Hoàng Lửa', 'Độc Cô Cầu Bại', 'Thần Cờ Thần Tốc', 'Thiên Lý Mã',
  'Bách Chiến Bách Thắng', 'Kỳ Ma Lộng Hành', 'Vua Tàn Cuộc', 'Chiến Thần Tốt Nhỏ',
  'Đại Tướng Bàn Cờ', 'Vô Địch Kỳ Hiệp', 'Long Vương Chiếu Bí', 'Hắc Mã Phi Thiên'
];

export class RankEngine {
  constructor() {
    this.storageKey = 'chess3d_rank_profile_v2';
    this.leaderboardKey = 'chess3d_monthly_leaderboard_v2';
    this.loadProfile();
    this.initLeaderboard();
  }

  loadProfile() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        this.profile = JSON.parse(saved);
        if (!this.profile.avatar) this.profile.avatar = '👑';
        this.profile.tierIndex = Number(this.profile.tierIndex != null ? this.profile.tierIndex : 0);
        this.profile.subTier = Number(this.profile.subTier != null ? this.profile.subTier : 1);
        this.profile.rp = Number(this.profile.rp != null ? this.profile.rp : 0);
      } catch (e) {
        this.resetProfile();
      }
    } else {
      this.resetProfile();
    }
  }

  resetProfile() {
    this.profile = {
      name: 'Tân Thủ Cờ Vua',
      avatar: '👑',
      hasCustomName: false,
      tierIndex: 0, // 0 = Tân Thủ, up to 5 = Chuyên Nghiệp
      subTier: 1,   // 1 to 5
      rp: 0,        // 0 to 99 RP
      wins: 0,
      losses: 0,
      draws: 0,
      winStreak: 0,
      topDefeated: [], // List of top IDs defeated (1, 2, 3)
      titles: ['Tân Binh Gia Nhập']
    };
    this.saveProfile();
  }

  isFirstTimeUser() {
    return !this.profile.hasCustomName && !localStorage.getItem('chess3d_user_named');
  }

  setName(name, avatar = null) {
    if (name && name.trim()) {
      this.profile.name = name.trim().substring(0, 24);
    }
    if (avatar) {
      this.profile.avatar = avatar;
    }
    this.profile.hasCustomName = true;
    localStorage.setItem('chess3d_user_named', 'true');
    this.saveProfile();
    this.updatePlayerInLeaderboard();
  }

  saveProfile() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
    } catch (e) {}
  }

  getCurrentTier() {
    return RANK_TIERS[this.profile.tierIndex] || RANK_TIERS[0];
  }

  getRankDisplay(tierIndex = this.profile.tierIndex, subTier = this.profile.subTier) {
    const tier = RANK_TIERS[tierIndex] || RANK_TIERS[0];
    return `${tier.name} ${subTier}`;
  }

  getRankScore(tierIndex = this.profile.tierIndex, subTier = this.profile.subTier, rp = this.profile.rp) {
    return (tierIndex * 500) + ((subTier - 1) * 100) + rp;
  }

  // Record ranked match result
  recordMatchResult({ outcome, isTopChallenge = false, topId = null, opponentRank = null }) {
    const prevTierIndex = this.profile.tierIndex;
    const prevSubTier = this.profile.subTier;
    const prevRp = this.profile.rp;

    let rpChange = 0;
    let rankUp = false;
    let rankDown = false;
    let specialReward = null;

    if (outcome === 'win') {
      this.profile.wins++;
      this.profile.winStreak++;
      const streakBonus = this.profile.winStreak >= 3 ? 5 : 0;
      rpChange = 25 + streakBonus;

      // Special handling for Top Leaderboard Challenge
      if (isTopChallenge && topId) {
        rpChange += 25; // Bonus RP for taking down a Top boss
        if (!this.profile.topDefeated.includes(topId)) {
          this.profile.topDefeated.push(topId);
        }
        const topTitle = `🏆 Thắng Top ${topId} BXH`;
        if (!this.profile.titles.includes(topTitle)) {
          this.profile.titles.push(topTitle);
        }
        if (!this.profile.titles.includes('Huyền Thoại Diệt Top BXH')) {
          this.profile.titles.push('Huyền Thoại Diệt Top BXH');
        }
        specialReward = {
          title: topTitle,
          bonusRp: 50,
          desc: `Bạn đã xuất sắc đánh bại Top ${topId} Bảng Xếp Hạng Tháng!`
        };
      }

      this.profile.rp += rpChange;

      // Handle Rank Up
      if (this.profile.rp >= 100) {
        if (this.profile.subTier < 5) {
          this.profile.subTier++;
          this.profile.rp -= 100;
          rankUp = true;
        } else if (this.profile.tierIndex < RANK_TIERS.length - 1) {
          this.profile.tierIndex++;
          this.profile.subTier = 1;
          this.profile.rp -= 100;
          rankUp = true;
        } else {
          // Max rank (Chuyên Nghiệp 5): RP continues to accumulate for leaderboard ranking
          this.profile.rp = Math.min(999, this.profile.rp);
        }
      }
    } else if (outcome === 'loss') {
      this.profile.losses++;
      this.profile.winStreak = 0;

      // RULE: If challenger loses a Top Challenge, they LOSE NOTHING!
      if (isTopChallenge) {
        rpChange = 0;
      } else {
        const tier = this.getCurrentTier();
        rpChange = -tier.lossDeduction;
        this.profile.rp += rpChange;

        // Handle Demotion
        if (this.profile.rp < 0) {
          if (this.profile.subTier > 1) {
            this.profile.subTier--;
            this.profile.rp = 75;
            rankDown = true;
          } else if (this.profile.tierIndex > 0) {
            this.profile.tierIndex--;
            this.profile.subTier = 5;
            this.profile.rp = 75;
            rankDown = true;
          } else {
            this.profile.rp = 0; // Tân thủ 1 cannot drop below 0
          }
        }
      }
    } else {
      // Draw
      this.profile.draws++;
      rpChange = 5;
      this.profile.rp += rpChange;
      if (this.profile.rp >= 100 && (this.profile.subTier < 5 || this.profile.tierIndex < RANK_TIERS.length - 1)) {
        if (this.profile.subTier < 5) {
          this.profile.subTier++;
        } else {
          this.profile.tierIndex++;
          this.profile.subTier = 1;
        }
        this.profile.rp -= 100;
        rankUp = true;
      }
    }

    this.saveProfile();
    this.updatePlayerInLeaderboard();

    return {
      outcome,
      rpChange,
      rankUp,
      rankDown,
      specialReward,
      prevRank: this.getRankDisplay(prevTierIndex, prevSubTier),
      prevRp,
      newRank: this.getRankDisplay(),
      newRp: this.profile.rp,
      tier: this.getCurrentTier()
    };
  }

  // Find random match with a close rank (±1 sub-rank)
  findMatch() {
    const currentScore = this.getRankScore();
    const currentTierIdx = this.profile.tierIndex;
    const currentSubTier = this.profile.subTier;

    // Pick opponent sub-rank close to player: delta -1, 0, or +1
    let delta = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
    let targetSub = currentSubTier + delta;
    let targetTierIdx = currentTierIdx;

    if (targetSub < 1) {
      if (targetTierIdx > 0) {
        targetTierIdx--;
        targetSub = 5;
      } else {
        targetSub = 1;
      }
    } else if (targetSub > 5) {
      if (targetTierIdx < RANK_TIERS.length - 1) {
        targetTierIdx++;
        targetSub = 1;
      } else {
        targetSub = 5;
      }
    }

    const opponentTier = RANK_TIERS[targetTierIdx];
    const opponentName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const opponentRp = Math.floor(Math.random() * 85) + 10;
    const opponentWinrate = Math.floor(Math.random() * 25) + 48; // 48% - 73%

    return {
      name: opponentName,
      tierIndex: targetTierIdx,
      subTier: targetSub,
      tier: opponentTier,
      rankName: `${opponentTier.name} ${targetSub}`,
      badge: opponentTier.badge,
      rp: opponentRp,
      winrate: opponentWinrate,
      aiLevel: opponentTier.aiLevel
    };
  }

  // --- Monthly Leaderboard System ---
  initLeaderboard() {
    const now = new Date();
    this.currentMonthStr = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;

    const saved = localStorage.getItem(this.leaderboardKey);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.monthStr === this.currentMonthStr && Array.isArray(data.list)) {
          this.leaderboard = data.list;
          this.updatePlayerInLeaderboard();
          return;
        }
      } catch (e) {}
    }

    // Generate fresh seeded monthly leaderboard
    this.leaderboard = this.generateMonthlyLeaderboard();
    this.updatePlayerInLeaderboard();
  }

  generateMonthlyLeaderboard() {
    const topMasters = [
      {
        id: 'top-1',
        rankPosition: 1,
        name: 'Nguyễn Thành An',
        tierIndex: 5,
        subTier: 5,
        rp: 340,
        score: 5 * 500 + 4 * 100 + 340,
        avatar: '👑',
        monthlyTitle: 'Quán Quân Tháng - Vua Cờ 3D',
        wins: 148,
        losses: 12,
        winrate: 92,
        isHuman: false
      },
      {
        id: 'top-2',
        rankPosition: 2,
        name: 'Magnus_VN (Trần Long)',
        tierIndex: 5,
        subTier: 5,
        rp: 275,
        score: 5 * 500 + 4 * 100 + 275,
        avatar: '🥈',
        monthlyTitle: 'Á Quân Tháng - Bậc Thầy Chiến Thuật',
        wins: 135,
        losses: 19,
        winrate: 88,
        isHuman: false
      },
      {
        id: 'top-3',
        rankPosition: 3,
        name: 'Đặng Minh Khoa',
        tierIndex: 5,
        subTier: 4,
        rp: 230,
        score: 5 * 500 + 3 * 100 + 230,
        avatar: '🥉',
        monthlyTitle: 'Quý Quân Tháng - Kỳ Thủ Thần Tốc',
        wins: 122,
        losses: 24,
        winrate: 84,
        isHuman: false
      }
    ];

    // Seed ranks 4 through 15
    const otherRankers = [
      { name: 'Vũ Quốc Huy', tierIndex: 5, subTier: 2, rp: 65, wins: 98, winrate: 78 },
      { name: 'Lê Hoàng Nam', tierIndex: 4, subTier: 5, rp: 90, wins: 89, winrate: 74 },
      { name: 'Phạm Bảo Hưng', tierIndex: 4, subTier: 4, rp: 70, wins: 82, winrate: 71 },
      { name: 'Bùi Đức Anh', tierIndex: 4, subTier: 2, rp: 45, wins: 76, winrate: 68 },
      { name: 'Trần Gia Bảo', tierIndex: 3, subTier: 5, rp: 80, wins: 68, winrate: 65 },
      { name: 'Dương Tuấn Kiệt', tierIndex: 3, subTier: 3, rp: 50, wins: 60, winrate: 62 },
      { name: 'Đỗ Hữu Phước', tierIndex: 2, subTier: 5, rp: 85, wins: 54, winrate: 59 },
      { name: 'Ngô Kiến Huy', tierIndex: 2, subTier: 3, rp: 40, wins: 48, winrate: 56 },
      { name: 'Hoàng Kim Long', tierIndex: 1, subTier: 4, rp: 60, wins: 38, winrate: 53 }
    ];

    const list = [...topMasters];
    let pos = 4;
    for (const r of otherRankers) {
      list.push({
        id: `ranker-${pos}`,
        rankPosition: pos,
        name: r.name,
        tierIndex: r.tierIndex,
        subTier: r.subTier,
        rp: r.rp,
        score: this.getRankScore(r.tierIndex, r.subTier, r.rp),
        avatar: '♟️',
        monthlyTitle: `Top ${pos} Cao Thủ Tháng`,
        wins: r.wins,
        losses: Math.round(r.wins * ((100 - r.winrate) / r.winrate)),
        winrate: r.winrate,
        isHuman: false
      });
      pos++;
    }

    return list;
  }

  updatePlayerInLeaderboard() {
    if (!this.leaderboard) return;

    // Remove old player entry if present
    this.leaderboard = this.leaderboard.filter(item => !item.isPlayer);

    const playerScore = this.getRankScore();
    const totalMatches = this.profile.wins + this.profile.losses;
    const winrate = totalMatches > 0 ? Math.round((this.profile.wins / totalMatches) * 100) : 0;

    const playerEntry = {
      id: 'player-me',
      isPlayer: true,
      name: `${this.profile.name} (Bạn)`,
      tierIndex: this.profile.tierIndex,
      subTier: this.profile.subTier,
      rp: this.profile.rp,
      score: playerScore,
      avatar: '😎',
      monthlyTitle: this.profile.titles[this.profile.titles.length - 1] || 'Kỳ Thủ Tiềm Năng',
      wins: this.profile.wins,
      losses: this.profile.losses,
      winrate: winrate,
      isHuman: true
    };

    this.leaderboard.push(playerEntry);

    // Sort by score descending
    this.leaderboard.sort((a, b) => b.score - a.score);

    // Update positions
    this.leaderboard.forEach((item, idx) => {
      item.rankPosition = idx + 1;
    });

    try {
      localStorage.setItem(this.leaderboardKey, JSON.stringify({
        monthStr: this.currentMonthStr,
        list: this.leaderboard
      }));
    } catch (e) {}
  }

  getTop3() {
    return this.leaderboard.slice(0, 3);
  }

  getPlayerLeaderboardPosition() {
    const found = this.leaderboard.find(item => item.isPlayer);
    return found ? found.rankPosition : 99;
  }

  // --- Top Challenge System ---
  getTopCandidate(topRank) {
    return this.leaderboard[topRank - 1];
  }

  // Decision logic for top player accepting challenge
  evaluateChallenge(topRank) {
    const topPlayer = this.getTopCandidate(topRank);
    if (!topPlayer) return { accepted: false, reason: 'Không tìm thấy cao thủ!' };

    // Top player has ~82% chance to accept challenge
    const accepted = Math.random() < 0.82;
    if (accepted) {
      const quotes = [
        `"Rất có khí phách! Ta - ${topPlayer.name} nhận lời khiêu chiến của ngươi. Hãy xem kỳ nghệ ngươi tới đâu!"`,
        `"Hảo kỳ thủ! Bàn cờ không phân biệt xuất thân, ta chấp nhận lời thách đấu của ngươi!"`,
        `"Một đối thủ dũng cảm! Ta sẽ đem 100% bản lĩnh ra tiếp chiêu cùng ngươi!"`
      ];
      return {
        accepted: true,
        quote: quotes[Math.floor(Math.random() * quotes.length)],
        topPlayer
      };
    } else {
      const declineReasons = [
        `"${topPlayer.name} hiện đang bận nghiên cứu thế cờ chuẩn bị cho giải vô địch tháng. Hãy thử khiêu chiến lại sau ít phút!"`,
        `"Cao thủ đang tạm thời thiền định và nghiên cứu khai cuộc. Vui lòng thử lại sau!"`,
        `"${topPlayer.name} vừa hoàn thành loạt trận căng thẳng và xin phép nghỉ ngơi. Hãy thách đấu lại sau!"`
      ];
      return {
        accepted: false,
        quote: declineReasons[Math.floor(Math.random() * declineReasons.length)],
        topPlayer
      };
    }
  }
}
