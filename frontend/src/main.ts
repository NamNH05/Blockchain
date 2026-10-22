import confetti from 'canvas-confetti';
import {
  INITIAL_STATE,
  PERSONAS,
  type Proposal,
  type SystemState,
} from './state';

let state: SystemState = { ...INITIAL_STATE };
let activeTab: 'treasury' | 'governance' | 'market' | 'attacks' | 'invariants' = 'treasury';

function saveLog(type: 'info' | 'success' | 'error', message: string) {
  const time = new Date().toLocaleTimeString();
  state.logs.unshift({ time, type, message });
  renderLogs();
}

function showToast(message: string, type: 'success' | 'error' = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span style="font-size: 20px;">${type === 'success' ? '✅' : '🛑'}</span>
    <div>
      <div style="font-weight: 700; font-size: 0.9rem;">${type === 'success' ? 'Thành công' : 'Giao dịch Bị Chặn (Revert)'}</div>
      <div style="font-size: 0.82rem; color: var(--text-muted);">${message}</div>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function renderApp() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="app-container">
      <!-- Header -->
      <header class="header">
        <div class="brand">
          <div class="brand-icon">🏛️</div>
          <div>
            <div style="display: flex; align-items: center;">
              <h1>Secure Collector DAO</h1>
              <span class="badge">Hardhat Cancun 31337</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 2px;">
              Quản Trị Kho Bạc NFT & Bảo Mật Đối Kháng Cao Cấp
            </div>
          </div>
        </div>

        <div class="header-right">
          <div class="persona-picker">
            <span class="persona-label">Vai trò:</span>
            <select id="persona-select" class="persona-select">
              ${PERSONAS.map(
                (p) =>
                  `<option value="${p.id}" ${p.id === state.currentPersona.id ? 'selected' : ''}>
                    ${p.name}
                  </option>`
              ).join('')}
            </select>
          </div>
        </div>
      </header>

      <!-- Navigation Tabs -->
      <nav class="nav-tabs">
        <button class="nav-tab ${activeTab === 'treasury' ? 'active' : ''}" data-tab="treasury">
          🏦 Kho Bạc (Treasury)
        </button>
        <button class="nav-tab ${activeTab === 'governance' ? 'active' : ''}" data-tab="governance">
          🗳️ Quản Trị & Timelock
        </button>
        <button class="nav-tab ${activeTab === 'market' ? 'active' : ''}" data-tab="market">
          🛍️ Sàn Giao Dịch
        </button>
        <button class="nav-tab ${activeTab === 'attacks' ? 'active' : ''}" data-tab="attacks">
          🛡️ Phòng Thí Nghiệm Đối Kháng
        </button>
        <button class="nav-tab ${activeTab === 'invariants' ? 'active' : ''}" data-tab="invariants">
          📜 Bảng 11 Bất Biến (SEC-01..11)
        </button>
      </nav>

      <!-- Main Content Area -->
      <main id="tab-content"></main>
    </div>

    <!-- Toast Notification Container -->
    <div id="toast-container" class="toast-container"></div>
  `;

  // Attach Persona Switcher
  const select = document.getElementById('persona-select') as HTMLSelectElement;
  select?.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    const found = PERSONAS.find((p) => p.id === target.value);
    if (found) {
      state.currentPersona = found;
      saveLog('info', `Đã chuyển sang tài khoản: ${found.name} (${found.role})`);
      showToast(`Đã đóng vai: ${found.name}`, 'success');
      renderTabContent();
    }
  });

  // Attach Navigation Listeners
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      activeTab = target.dataset.tab as any;
      document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
      target.classList.add('active');
      renderTabContent();
    });
  });

  renderTabContent();
}

function renderTabContent() {
  const container = document.getElementById('tab-content');
  if (!container) return;

  switch (activeTab) {
    case 'treasury':
      container.innerHTML = getTreasuryHtml();
      attachTreasuryEvents();
      break;
    case 'governance':
      container.innerHTML = getGovernanceHtml();
      attachGovernanceEvents();
      break;
    case 'market':
      container.innerHTML = getMarketHtml();
      attachMarketEvents();
      break;
    case 'attacks':
      container.innerHTML = getAttacksHtml();
      attachAttacksEvents();
      break;
    case 'invariants':
      container.innerHTML = getInvariantsHtml();
      break;
  }
}

// -------------------------------------------------------------------------------------------------
// 1. TREASURY VIEW
// -------------------------------------------------------------------------------------------------
function getTreasuryHtml() {
  const dailyPercent = Math.min(100, (state.dailySpent / state.dailySpendingLimit) * 100);
  const isSecurityCouncil = state.currentPersona.id === 'securityCouncil';

  return `
    <div class="grid-4" style="margin-bottom: 24px;">
      <!-- Card 1: Balance -->
      <div class="glass-card">
        <div class="card-header">
          <span class="card-title">💰 Số Dư Kho Bạc</span>
          <span class="status-pill online">ETH Vault</span>
        </div>
        <div class="card-value">${state.treasuryBalance.toFixed(2)} <span style="font-size: 1.1rem; color: var(--accent-cyan);">ETH</span></div>
        <div class="card-subtext">Được bảo vệ bởi TimelockController 48h</div>
      </div>

      <!-- Card 2: Daily Limit -->
      <div class="glass-card">
        <div class="card-header">
          <span class="card-title">⏳ Hạn Mức Chi Tiêu Ngày</span>
          <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-dim);">${state.dailySpent.toFixed(1)} / ${state.dailySpendingLimit.toFixed(1)} ETH</span>
        </div>
        <div class="card-value">${(state.dailySpendingLimit - state.dailySpent).toFixed(1)} <span style="font-size: 1.1rem; color: var(--accent-purple);">ETH còn lại</span></div>
        <div class="progress-container">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill ${dailyPercent > 80 ? 'warning' : ''}" style="width: ${dailyPercent}%;"></div>
          </div>
        </div>
      </div>

      <!-- Card 3: Call Limit -->
      <div class="glass-card">
        <div class="card-header">
          <span class="card-title">🛡️ Trần Đơn Lệnh (Call)</span>
          <span class="status-pill online">Max Per Call</span>
        </div>
        <div class="card-value">${state.maxPerCallLimit.toFixed(1)} <span style="font-size: 1.1rem; color: var(--accent-emerald);">ETH</span></div>
        <div class="card-subtext">Lệnh mua đơn lẻ tối đa cho 1 NFT</div>
      </div>

      <!-- Card 4: Emergency Status -->
      <div class="glass-card">
        <div class="card-header">
          <span class="card-title">🚨 Trạng Thái Giao Dịch</span>
          <span class="status-pill ${state.isPaused ? 'paused' : 'online'}">
            <span class="status-dot"></span>
            ${state.isPaused ? 'Đang Tạm Dừng' : 'Hoạt Động Bình Thường'}
          </span>
        </div>
        <div class="card-value" style="font-size: 1.4rem;">
          ${state.isPaused ? '⚠️ Emergency Paused' : '✅ Operational'}
        </div>
        <div class="card-subtext">
          ${state.isPaused ? `Tự động mở khóa sau: ${state.pausedUntil}s` : 'Không có cảnh báo bất thường'}
        </div>
      </div>
    </div>

    <!-- Security Council Controls & Vault Whitelists -->
    <div class="grid-2" style="margin-bottom: 28px;">
      <div class="glass-card">
        <div class="card-header">
          <span class="card-title">⚡ Bảng Điều Khiển Security Council</span>
          <span style="font-size: 0.8rem; color: var(--accent-amber);">Quyền Hạn Khẩn Cấp (Tối đa 7 ngày)</span>
        </div>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 16px;">
          Security Council có quyền kích hoạt Pause khẩn cấp để ngăn chặn tấn công. Sau thời hạn đặt trước, hệ thống tự động mở lại mà không cần gửi transaction unpause.
        </p>

        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          ${
            !state.isPaused
              ? `
              <button id="btn-pause-1h" class="btn btn-secondary btn-sm" ${!isSecurityCouncil ? 'title="Chỉ Security Council mới có quyền"' : ''}>
                ⏸️ Pause 1 Giờ
              </button>
              <button id="btn-pause-24h" class="btn btn-secondary btn-sm" ${!isSecurityCouncil ? 'title="Chỉ Security Council mới có quyền"' : ''}>
                ⏸️ Pause 24 Giờ
              </button>
              <button id="btn-pause-7d" class="btn btn-danger btn-sm" ${!isSecurityCouncil ? 'title="Chỉ Security Council mới có quyền"' : ''}>
                🚨 Pause Khẩn Cấp 7 Ngày
              </button>
            `
              : `
              <button id="btn-resume-auto" class="btn btn-primary btn-sm">
                ⏩ Giả lập Hết Thời Hạn (Tự Mở Lại)
              </button>
            `
          }
          <button id="btn-reset-day" class="btn btn-secondary btn-sm">
            🌅 Mô phỏng Qua Ngày Mới (Reset Hạn Mức 24h)
          </button>
        </div>
        ${
          !isSecurityCouncil
            ? `<div style="font-size: 0.78rem; color: var(--accent-amber); margin-top: 10px;">
                💡 Bạn đang đăng nhập là <strong>${state.currentPersona.name}</strong>. Hãy chuyển sang vai <em>Security Council</em> để kích hoạt nút Pause.
              </div>`
            : ''
        }
      </div>

      <div class="glass-card">
        <div class="card-header">
          <span class="card-title">📋 Danh Sách Trắng (Whitelists)</span>
          <span class="status-pill online">Chỉ Timelock Sửa Được</span>
        </div>
        <div style="font-size: 0.88rem;">
          <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-subtle);">
            <div>
              <div style="font-weight: 700;">SafeMarketplaceAdapter</div>
              <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-dim);">0x5FC8d32690cc91D4c39d9d3abcBD16989F875707</div>
            </div>
            <span class="status-pill online">Whitelisted</span>
          </div>

          <div style="display: flex; justify-content: space-between; padding: 10px 0;">
            <div>
              <div style="font-weight: 700;">CryptoArtifacts VIP Collection</div>
              <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-dim);">0x5FbDB2315678afecb367f032d93F642f64180aa3</div>
            </div>
            <span class="status-pill online">Whitelisted</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Vault NFT Gallery -->
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h2>🖼️ Bộ Sưu Tập Đang Lưu Ký Trong Treasury (${state.vaultNFTs.length} Tác phẩm)</h2>
        <span style="font-size: 0.85rem; color: var(--text-dim);">Toàn quyền sở hữu thuộc về Smart Contract NFTTreasury</span>
      </div>

      <div class="nft-grid">
        ${state.vaultNFTs
          .map(
            (nft) => `
            <div class="nft-card">
              <div class="nft-image-wrap">
                <img src="${nft.image}" alt="${nft.name}" />
                <span class="nft-badge-price">Trị giá: ${nft.price} ETH</span>
              </div>
              <div class="nft-info">
                <div>
                  <div class="nft-title">${nft.name}</div>
                  <div class="nft-collection">${nft.collection}</div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border-subtle); padding-top: 10px;">
                  <span>Lưu ký an toàn</span>
                  <span style="color: var(--accent-emerald);">● Safe Vault</span>
                </div>
              </div>
            </div>
          `
          )
          .join('')}
      </div>
    </div>
  `;
}

function attachTreasuryEvents() {
  document.getElementById('btn-pause-1h')?.addEventListener('click', () => {
    if (state.currentPersona.id !== 'securityCouncil') {
      showToast('Từ chối: Chỉ Security Council mới có quyền pauseTrading!', 'error');
      return;
    }
    state.isPaused = true;
    state.pausedUntil = 3600;
    saveLog('error', 'Security Council đã kích hoạt Pause khẩn cấp 1 giờ.');
    showToast('Đã tạm dừng giao dịch 1 giờ (SEC-05)', 'success');
    renderTabContent();
  });

  document.getElementById('btn-pause-24h')?.addEventListener('click', () => {
    if (state.currentPersona.id !== 'securityCouncil') {
      showToast('Từ chối: Chỉ Security Council mới có quyền pauseTrading!', 'error');
      return;
    }
    state.isPaused = true;
    state.pausedUntil = 86400;
    saveLog('error', 'Security Council đã kích hoạt Pause khẩn cấp 24 giờ.');
    showToast('Đã tạm dừng giao dịch 24 giờ (SEC-05)', 'success');
    renderTabContent();
  });

  document.getElementById('btn-pause-7d')?.addEventListener('click', () => {
    if (state.currentPersona.id !== 'securityCouncil') {
      showToast('Từ chối: Chỉ Security Council mới có quyền pauseTrading!', 'error');
      return;
    }
    state.isPaused = true;
    state.pausedUntil = 7 * 86400;
    saveLog('error', 'Security Council đã kích hoạt Pause khẩn cấp tối đa 7 ngày.');
    showToast('Đã tạm dừng giao dịch 7 ngày (SEC-05)', 'success');
    renderTabContent();
  });

  document.getElementById('btn-resume-auto')?.addEventListener('click', () => {
    state.isPaused = false;
    state.pausedUntil = 0;
    saveLog('success', 'Thời hạn Pause đã trôi qua. Treasury tự động mở khóa giao dịch.');
    showToast('Hệ thống đã tự động phục hồi giao dịch!', 'success');
    renderTabContent();
  });

  document.getElementById('btn-reset-day')?.addEventListener('click', () => {
    state.dailySpent = 0.0;
    saveLog('info', 'Chu kỳ 24h mới bắt đầu: Hạn mức chi tiêu ngày đã được làm mới về 10.0 ETH.');
    showToast('Đã làm mới hạn mức chi tiêu ngày 10 ETH (SEC-04)', 'success');
    renderTabContent();
  });
}

// -------------------------------------------------------------------------------------------------
// 2. GOVERNANCE & TIMELOCK VIEW
// -------------------------------------------------------------------------------------------------
function getGovernanceHtml() {
  const isSecurityCouncil = state.currentPersona.id === 'securityCouncil';

  return `
    <div class="card-header" style="margin-bottom: 20px;">
      <div>
        <h2>🗳️ Trung Tâm Quản Trị & Timelock 48h</h2>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-top: 4px;">
          Tất cả đề xuất chi tiền phải qua biểu quyết đạt Quorum 4%, sau đó nằm trong Timelock 48h trước khi được thực thi.
        </p>
      </div>
      <button id="btn-create-proposal-modal" class="btn btn-primary">
        ➕ Tạo Đề Xuất Mới (Có Quét Trần 8 ETH)
      </button>
    </div>

    <!-- Active Proposals List -->
    <div class="proposal-list">
      ${state.proposals
        .map((p) => {
          const quorumMet = p.forVotes >= p.quorum;
          const hasVoted = p.voters.has(state.currentPersona.id);

          return `
            <div class="proposal-card">
              <div class="proposal-top">
                <div>
                  <div class="proposal-id">${p.id} • Người tạo: ${p.proposer}</div>
                  <div class="proposal-desc">${p.title}</div>
                </div>
                <span class="state-badge state-${p.status.toLowerCase()}">${p.status}</span>
              </div>

              <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 14px;">
                ${p.description}
              </p>

              <!-- Progress & Vote counts -->
              <div style="background: rgba(0,0,0,0.3); padding: 14px; border-radius: var(--radius-sm); margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px;">
                  <span>Phiếu Thuận: <strong style="color: var(--accent-emerald);">${p.forVotes.toLocaleString()} SCT</strong></span>
                  <span>Túc số Quorum: <strong>${p.quorum.toLocaleString()} SCT</strong> (${quorumMet ? '✅ Đạt Quorum' : 'Chưa đạt'})</span>
                </div>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" style="width: ${Math.min(100, (p.forVotes / p.quorum) * 100)}%;"></div>
                </div>
              </div>

              <!-- Action Buttons based on status -->
              <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                ${
                  p.status === 'Active'
                    ? `
                    <button class="btn btn-primary btn-sm btn-vote" data-id="${p.id}" ${hasVoted ? 'disabled' : ''}>
                      👍 Bỏ Phiếu THUẬN (${state.currentPersona.votingPower})
                    </button>
                    <button class="btn btn-secondary btn-sm btn-fast-vote" data-id="${p.id}">
                      ⏩ Kết Thúc Bỏ Phiếu (Passed)
                    </button>
                  `
                    : ''
                }

                ${
                  p.status === 'Succeeded'
                    ? `
                    <button class="btn btn-primary btn-sm btn-queue" data-id="${p.id}">
                      ⏳ Đưa Vào Timelock (Bắt đầu đếm ngược 48h)
                    </button>
                  `
                    : ''
                }

                ${
                  p.status === 'Queued'
                    ? `
                    <span style="font-size: 0.85rem; font-family: var(--font-mono); color: var(--accent-cyan); background: var(--accent-cyan-dim); padding: 6px 12px; border-radius: var(--radius-sm);">
                      🕒 Cửa sổ quan sát Timelock 48h đang chạy...
                    </span>
                    <button class="btn btn-secondary btn-sm btn-fast-timelock" data-id="${p.id}">
                      ⏩ Bỏ qua 48h (Sẵn sàng Thực thi)
                    </button>
                    <button class="btn btn-danger btn-sm btn-veto" data-id="${p.id}" ${!isSecurityCouncil ? 'title="Chỉ Security Council mới có quyền Veto!"' : ''}>
                      🚫 Security Council VETO / Cancel
                    </button>
                    <button class="btn btn-primary btn-sm btn-execute" data-id="${p.id}">
                      ⚡ Thực Thi Lệnh (Execute)
                    </button>
                  `
                    : ''
                }

                ${
                  p.status === 'Executed'
                    ? `
                    <span style="font-size: 0.85rem; color: var(--accent-emerald); font-weight: 700;">
                      ✅ Đã thực thi thành công. NFT đã nằm trong Kho bạc.
                    </span>
                    <button class="btn btn-secondary btn-sm btn-test-replay" data-id="${p.id}">
                      🧪 Thử Tấn Công Replay (Execute Lần 2 - SEC-10)
                    </button>
                  `
                    : ''
                }

                ${
                  p.status === 'Canceled'
                    ? `
                    <span style="font-size: 0.85rem; color: var(--accent-rose); font-weight: 700;">
                      🚫 Đã bị hủy bỏ bởi Security Council (Veto thành công).
                    </span>
                  `
                    : ''
                }
              </div>
            </div>
          `;
        })
        .join('')}
    </div>

    <!-- Modal Create Proposal -->
    <div id="proposal-modal" class="modal-backdrop" style="display: none;">
      <div class="modal-content">
        <h3 style="margin-bottom: 8px;">Tạo Đề Xuất Mua NFT (Multi-Call)</h3>
        <p style="font-size: 0.82rem; color: var(--text-dim); margin-bottom: 20px;">
          Hệ thống có cơ chế kiểm tra tự động: Tổng giá trần $\\sum maxPrice \\le 8.0$ ETH. Nếu vượt trần, Governor sẽ từ chối tạo ngay lập tức (SEC-09).
        </p>

        <div class="form-group">
          <label class="form-label">Tiêu đề đề xuất</label>
          <input id="prop-title" class="form-input" placeholder="VD: Mua Bored Android #1337 cho bộ sưu tập VIP" />
        </div>

        <div class="form-group">
          <label class="form-label">Chọn NFT muốn mua</label>
          <select id="prop-nft-select" class="form-input">
            ${state.marketNFTs
              .map(
                (n) => `
              <option value="${n.id}" data-price="${n.price}">
                ${n.name} (Giá niêm yết: ${n.price} ETH)
              </option>
            `
              )
              .join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Giá trần tối đa cho phép chi (maxPrice trong calldata - ETH)</label>
          <input id="prop-maxprice" class="form-input" type="number" step="0.5" value="3.5" />
        </div>

        <div id="prop-warning" style="display: none; padding: 12px; border-radius: var(--radius-sm); background: var(--accent-rose-dim); border: 1px solid var(--accent-rose); color: var(--accent-rose); font-size: 0.85rem; margin-bottom: 16px;">
          ⚠️ CẢNH BÁO: Giá trần chi tiêu vượt quá giới hạn 8.0 ETH của Governor! Giao dịch propose() sẽ bị Revert (SEC-09).
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="btn-close-modal" class="btn btn-secondary">Đóng</button>
          <button id="btn-submit-proposal" class="btn btn-primary">Gửi Đề Xuất (propose)</button>
        </div>
      </div>
    </div>
  `;
}

function attachGovernanceEvents() {
  // Modal handlers
  const modal = document.getElementById('proposal-modal');
  document.getElementById('btn-create-proposal-modal')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'flex';
  });
  document.getElementById('btn-close-modal')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });

  const maxPriceInput = document.getElementById('prop-maxprice') as HTMLInputElement;
  const warning = document.getElementById('prop-warning');
  maxPriceInput?.addEventListener('input', () => {
    const val = parseFloat(maxPriceInput.value);
    if (warning) {
      warning.style.display = val > state.maxPerProposalLimit ? 'block' : 'none';
    }
  });

  document.getElementById('btn-submit-proposal')?.addEventListener('click', () => {
    const title = (document.getElementById('prop-title') as HTMLInputElement).value;
    const maxPrice = parseFloat(maxPriceInput.value);

    if (!title) {
      showToast('Vui lòng nhập tiêu đề đề xuất!', 'error');
      return;
    }

    // Check SEC-09 Rule!
    if (maxPrice > state.maxPerProposalLimit) {
      saveLog(
        'error',
        `Governor từ chối hàm propose(): Tổng maxPrice (${maxPrice} ETH) vượt quá trần ${state.maxPerProposalLimit} ETH (SEC-09).`
      );
      showToast(`Governor: Total maxPrice exceeds proposal spending limit! (SEC-09)`, 'error');
      return;
    }

    const newProp: Proposal = {
      id: `PROP-0${state.proposals.length + 1}`,
      title,
      proposer: `${state.currentPersona.address.slice(0, 6)}... (${state.currentPersona.name})`,
      targets: ['NFTTreasury'],
      values: ['0 ETH'],
      calldatas: [`executeBuyNFT(SafeAdapter, ..., maxPrice: ${maxPrice} ETH)`],
      maxPriceSum: maxPrice,
      description: `Đề xuất mua NFT với ngân sách tối đa ${maxPrice} ETH.`,
      status: 'Active',
      forVotes: 0,
      againstVotes: 0,
      abstainVotes: 0,
      quorum: 40000,
      eta: 0,
      voters: new Set(),
    };

    state.proposals.unshift(newProp);
    if (modal) modal.style.display = 'none';
    saveLog('success', `Đã tạo đề xuất ${newProp.id} thành công trên Governor.`);
    showToast(`Đã tạo đề xuất ${newProp.id} thành công!`, 'success');
    renderTabContent();
  });

  // Vote button
  document.querySelectorAll('.btn-vote').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      const prop = state.proposals.find((p) => p.id === id);
      if (!prop) return;

      // Check SEC-07: Bob has 0 voting power because he didn't delegate!
      if (!state.currentPersona.isDelegated) {
        saveLog(
          'error',
          `${state.currentPersona.name} không thể vote: Chưa delegate trước Snapshot, voting power = 0 (SEC-07).`
        );
        showToast('Từ chối: Bạn chưa ủy quyền (Delegate) trước Snapshot! Điểm Vote = 0 (SEC-07)', 'error');
        return;
      }

      prop.forVotes += 100000;
      prop.voters.add(state.currentPersona.id);
      saveLog('success', `${state.currentPersona.name} đã bỏ 100,000 phiếu THUẬN cho ${prop.id}.`);
      showToast(`Đã bỏ phiếu Thuận thành công cho ${prop.id}!`, 'success');
      renderTabContent();
    });
  });

  // Fast forward vote
  document.querySelectorAll('.btn-fast-vote').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      const prop = state.proposals.find((p) => p.id === id);
      if (prop) {
        prop.status = 'Succeeded';
        saveLog('info', `Hết thời gian bỏ phiếu (3 ngày trôi qua). ${prop.id} đạt túc số và CHẤP THUẬN.`);
        showToast(`${prop.id} đã vượt qua giai đoạn Bỏ Phiếu!`, 'success');
        renderTabContent();
      }
    });
  });

  // Queue into Timelock
  document.querySelectorAll('.btn-queue').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      const prop = state.proposals.find((p) => p.id === id);
      if (prop) {
        prop.status = 'Queued';
        prop.eta = Date.now() + 48 * 3600 * 1000;
        saveLog('info', `Governor đã đưa ${prop.id} vào hàng đợi TimelockController (Cửa sổ 48h bắt đầu).`);
        showToast(`Đã đưa ${prop.id} vào Timelock 48h!`, 'success');
        renderTabContent();
      }
    });
  });

  // Fast forward Timelock
  document.querySelectorAll('.btn-fast-timelock').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      const prop = state.proposals.find((p) => p.id === id);
      if (prop) {
        prop.eta = Date.now() - 1000; // ready
        saveLog('info', `Mô phỏng thời gian: 48 giờ Timelock đã kết thúc. ${prop.id} sẵn sàng thực thi.`);
        showToast(`Đã qua 48h quan sát! Đề xuất đã sẵn sàng thực thi.`, 'success');
        renderTabContent();
      }
    });
  });

  // Security Council Veto
  document.querySelectorAll('.btn-veto').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      const prop = state.proposals.find((p) => p.id === id);
      if (!prop) return;

      if (state.currentPersona.id !== 'securityCouncil') {
        saveLog('error', `Tài khoản ${state.currentPersona.name} không có quyền CANCELLER_ROLE để Veto proposal.`);
        showToast('Từ chối: Chỉ Security Council mới có quyền Veto/Cancel đề xuất trong Timelock!', 'error');
        return;
      }

      prop.status = 'Canceled';
      saveLog('error', `Security Council đã VETO và HỦY BỎ đề xuất ${prop.id} trong Timelock.`);
      showToast(`Đã Veto thành công đề xuất ${prop.id}!`, 'success');
      renderTabContent();
    });
  });

  // Execute
  document.querySelectorAll('.btn-execute').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      const prop = state.proposals.find((p) => p.id === id);
      if (!prop) return;

      if (state.isPaused) {
        showToast('Từ chối: Kho bạc đang bị Tạm Dừng (Trading Paused)! Không thể thực thi (SEC-05)', 'error');
        return;
      }

      // Check if timelock delay passed
      if (prop.eta > Date.now()) {
        showToast('Từ chối: Chưa hết 48 giờ chờ trong Timelock!', 'error');
        return;
      }

      // Execute buy
      const actualPrice = 2.0;
      if (state.dailySpent + actualPrice > state.dailySpendingLimit) {
        showToast('Từ chối: Tổng chi tiêu ngày vượt quá 10.0 ETH (SEC-04)!', 'error');
        return;
      }

      state.treasuryBalance -= actualPrice;
      state.dailySpent += actualPrice;
      prop.status = 'Executed';

      // Move Punk #777 to vault
      const item = state.marketNFTs.find((n) => n.id === 777n);
      if (item) {
        state.vaultNFTs.push({ ...item, acquiredAt: 'Thực thi qua Timelock' });
        state.marketNFTs = state.marketNFTs.filter((n) => n.id !== 777n);
      }

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      saveLog(
        'success',
        `Thực thi thành công ${prop.id}. Kho bạc đã chi 2.0 ETH và lưu ký thành công NFT.`
      );
      showToast(`Thực thi thành công ${prop.id}! NFT đã được chuyển vào Kho bạc.`, 'success');
      renderTabContent();
    });
  });

  // Replay Attack test
  document.querySelectorAll('.btn-test-replay').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      saveLog(
        'error',
        `Thử tấn công Replay trên ${id}: Timelock/Governor từ chối do trạng thái đề xuất đã Executed (SEC-10).`
      );
      showToast(`GovernorUnexpectedProposalState: Không thể thực thi 2 lần trên cùng 1 đề xuất! (SEC-10)`, 'error');
    });
  });
}

// -------------------------------------------------------------------------------------------------
// 3. MARKETPLACE VIEW
// -------------------------------------------------------------------------------------------------
function getMarketHtml() {
  return `
    <div class="card-header" style="margin-bottom: 20px;">
      <div>
        <h2>🛍️ Sàn Giao Dịch Giả Lập & Mua Qua Safe Adapter</h2>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-top: 4px;">
          Khi Kho bạc mua NFT, toàn bộ tiền thừa (excess = maxPrice - actualPrice) bắt buộc phải được Adapter hoàn trả về Kho bạc trong cùng transaction (SEC-01).
        </p>
      </div>
    </div>

    <div class="nft-grid">
      ${state.marketNFTs
        .map(
          (nft) => `
          <div class="nft-card">
            <div class="nft-image-wrap">
              <img src="${nft.image}" alt="${nft.name}" />
              <span class="nft-badge-price">Giá: ${nft.price} ETH</span>
            </div>
            <div class="nft-info">
              <div>
                <div class="nft-title">${nft.name}</div>
                <div class="nft-collection">${nft.collection}</div>
                <div style="font-size: 0.78rem; color: var(--text-dim); margin-bottom: 12px;">${nft.owner}</div>
              </div>

              <div style="border-top: 1px solid var(--border-subtle); padding-top: 14px;">
                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-primary btn-sm btn-quick-buy" style="flex: 1;" data-id="${nft.id}" data-price="${nft.price}" data-name="${nft.name}">
                    ⚡ Mua (Gửi 5 ETH trần)
                  </button>
                </div>
                <div style="font-size: 0.75rem; color: var(--accent-cyan); margin-top: 6px;">
                  Gửi trần 5.0 ETH ➜ Hoàn trả ${(5.0 - parseFloat(nft.price)).toFixed(1)} ETH thừa
                </div>
              </div>
            </div>
          </div>
        `
        )
        .join('')}
    </div>
  `;
}

function attachMarketEvents() {
  document.querySelectorAll('.btn-quick-buy').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const id = BigInt(target.dataset.id!);
      const price = parseFloat(target.dataset.price!);
      const name = target.dataset.name!;

      if (state.isPaused) {
        showToast('Từ chối: Treasury đang ở trạng thái Tạm Dừng (Trading Paused - SEC-05)!', 'error');
        return;
      }

      if (state.dailySpent + price > state.dailySpendingLimit) {
        saveLog('error', `Từ chối mua ${name}: Tổng chi tiêu ngày sẽ vượt quá 10.0 ETH (SEC-04).`);
        showToast('Treasury: Daily spending limit exceeded! (SEC-04)', 'error');
        return;
      }

      const maxPrice = 5.0; // max call limit
      const excessRefund = maxPrice - price;

      // State updates
      state.treasuryBalance -= price;
      state.dailySpent += price;

      // Transfer NFT from market to vault
      const item = state.marketNFTs.find((n) => n.id === id);
      if (item) {
        state.vaultNFTs.push({ ...item, acquiredAt: new Date().toLocaleTimeString() });
        state.marketNFTs = state.marketNFTs.filter((n) => n.id !== id);
      }

      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      saveLog(
        'success',
        `Khớp lệnh mua ${name}: Giá thực tế ${price} ETH. SafeAdapter đã hoàn trả ${excessRefund.toFixed(1)} ETH thừa về Kho bạc an toàn (SEC-01).`
      );
      showToast(`Mua thành công ${name}! Đã nhận lại ${excessRefund.toFixed(1)} ETH tiền thừa.`, 'success');
      renderTabContent();
    });
  });
}

// -------------------------------------------------------------------------------------------------
// 4. ADVERSARIAL ATTACK LABORATORY
// -------------------------------------------------------------------------------------------------
function getAttacksHtml() {
  return `
    <div class="card-header" style="margin-bottom: 20px;">
      <div>
        <h2>🛡️ Phòng Thí Nghiệm Đối Kháng (Adversarial Testing Lab)</h2>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-top: 4px;">
          Thực nghiệm trực tiếp các kỹ thuật tấn công phổ biến vào Smart Contract Treasury và kiểm chứng cơ chế phòng thủ tự động.
        </p>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom: 24px;">
      <!-- Attack Controls -->
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div class="glass-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="color: var(--accent-rose);">Tấn công 1: Ăn Chặn Tiền Thừa (SEC-01)</strong>
            <span class="inv-badge">SEC-01</span>
          </div>
          <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 12px;">
            Kẻ tấn công sử dụng MaliciousAdapter: Mua NFT giá 2 ETH nhưng giữ lại 1 ETH thừa thay vì hoàn trả về cho Treasury.
          </p>
          <button id="btn-attack-sec01" class="btn btn-danger btn-sm">
            💥 Giả Lập Tấn Công Ăn Chặn Tiền Thừa
          </button>
        </div>

        <div class="glass-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="color: var(--accent-rose);">Tấn công 2: Giao Sai NFT Token ID (SEC-02)</strong>
            <span class="inv-badge">SEC-02</span>
          </div>
          <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 12px;">
            Adapter gửi một token rác/token giả mạo về Kho bạc thay vì đúng NFT Punk đã được phê duyệt mua.
          </p>
          <button id="btn-attack-sec02" class="btn btn-danger btn-sm">
            💥 Giả Lập Gửi Sai Token ID
          </button>
        </div>

        <div class="glass-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="color: var(--accent-rose);">Tấn công 3: Tấn Công Reentrancy (SEC-03)</strong>
            <span class="inv-badge">SEC-03</span>
          </div>
          <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 12px;">
            Adapter gọi đệ quy ngược lại hàm executeBuyNFT của Treasury nhằm rút cạn số dư trước khi trạng thái được chốt.
          </p>
          <button id="btn-attack-sec03" class="btn btn-danger btn-sm">
            💥 Giả Lập Reentrancy Attack
          </button>
        </div>

        <div class="glass-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="color: var(--accent-rose);">Tấn công 4: Gian Lận Báo Cáo Giá (SEC-11)</strong>
            <span class="inv-badge">SEC-11</span>
          </div>
          <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 12px;">
            Adapter thực chi 3 ETH nhưng báo cáo láo actualPrice = 1 ETH để qua mặt hạn mức kiểm toán.
          </p>
          <button id="btn-attack-sec11" class="btn btn-danger btn-sm">
            💥 Giả Lập Gian Lận Báo Cáo Giá
          </button>
        </div>
      </div>

      <!-- Live Terminal Console -->
      <div class="terminal-card">
        <div class="terminal-header">
          <div class="terminal-dot dot-red"></div>
          <div class="terminal-dot dot-yellow"></div>
          <div class="terminal-dot dot-green"></div>
          <span style="font-size: 0.82rem; color: var(--text-dim); margin-left: 8px;">EVM Real-Time Inspection Terminal</span>
        </div>
        <div id="terminal-logs" class="terminal-logs"></div>
      </div>
    </div>
  `;
}

function attachAttacksEvents() {
  renderLogs();

  document.getElementById('btn-attack-sec01')?.addEventListener('click', () => {
    saveLog(
      'error',
      'TẤN CÔNG SEC-01: MaliciousAdapter giữ lại 1.0 ETH thừa ➔ Treasury kiểm tra netSpent != actualPrice ➔ REVERT: "Treasury: Revenue/Refund mismatch". Số dư Treasury nguyên vẹn.'
    );
    showToast('Treasury: Revenue/Refund mismatch! Toàn bộ giao dịch bị Rollback an toàn (SEC-01).', 'error');
  });

  document.getElementById('btn-attack-sec02')?.addEventListener('click', () => {
    saveLog(
      'error',
      'TẤN CÔNG SEC-02: MaliciousAdapter gửi Token #999999 ➔ Treasury kiểm tra ownerOf(tokenId) != address(this) ➔ REVERT: "Treasury: NFT not received".'
    );
    showToast('Treasury: NFT not received! Chặn đứng hành vi tráo token (SEC-02).', 'error');
  });

  document.getElementById('btn-attack-sec03')?.addEventListener('click', () => {
    saveLog(
      'error',
      'TẤN CÔNG SEC-03: Adapter gọi đệ quy ngược lại executeBuyNFT ➔ Khóa nonReentrant của OpenZeppelin kích hoạt ➔ REVERT: "ReentrancyGuardReentrantCall".'
    );
    showToast('ReentrancyGuardReentrantCall: Bị chặn đứng bởi ReentrancyGuard (SEC-03).', 'error');
  });

  document.getElementById('btn-attack-sec11')?.addEventListener('click', () => {
    saveLog(
      'error',
      'TẤN CÔNG SEC-11: Adapter báo cáo actualPrice = 1 ETH nhưng chi 2 ETH ➔ Đối chiếu số dư phát hiện netSpent (2 ETH) != actualPrice (1 ETH) ➔ REVERT.'
    );
    showToast('Treasury: Revenue/Refund mismatch! Bị phát hiện gian lận báo cáo giá (SEC-11).', 'error');
  });
}

function renderLogs() {
  const terminal = document.getElementById('terminal-logs');
  if (!terminal) return;

  terminal.innerHTML = state.logs
    .map(
      (log) => `
      <div class="log-entry">
        <span class="log-time">[${log.time}]</span>
        <span class="log-${log.type}">● ${log.message}</span>
      </div>
    `
    )
    .join('');
}

// -------------------------------------------------------------------------------------------------
// 5. INVARIANTS VIEW
// -------------------------------------------------------------------------------------------------
function getInvariantsHtml() {
  const invariants = [
    { id: 'SEC-01', title: 'Hoàn Tiền Thừa (Excess Refund)', desc: 'Treasury đối chiếu số dư: balanceBefore - balanceAfter == actualPrice. Mọi hành vi giữ lại tiền thừa đều bị revert.' },
    { id: 'SEC-02', title: 'Xác Thực Token Nhận (Ownership)', desc: 'Treasury hậu kiểm ownerOf(tokenId) == address(this). Nếu Adapter giao sai token, giao dịch lập tức bị rollback.' },
    { id: 'SEC-03', title: 'Chống Reentrancy', desc: 'Toàn bộ hàm di chuyển tài sản có modifier nonReentrant ngoài cùng, khóa mọi đợt gọi đệ quy từ hợp đồng bên ngoài.' },
    { id: 'SEC-04', title: 'Hạn Mức 24 Giờ (Daily Limit)', desc: 'Tổng chi tiêu mua NFT được cộng dồn theo chu kỳ block.timestamp / 1 days. Không thể vượt trần 10 ETH/ngày.' },
    { id: 'SEC-05', title: 'Tạm Dừng Có Thời Hạn (Pause Auto-expiry)', desc: 'Security Council tạm dừng tối đa 7 ngày qua pausedUntil. EVM tự mở lại khi qua timestamp mà không cần ai gửi lệnh unpause.' },
    { id: 'SEC-06', title: 'Hạn Chót Thực Thi (Deadline Check)', desc: 'Yêu cầu block.timestamp <= deadline. Ngăn ngừa việc kích hoạt đề xuất cũ trong Timelock khi giá thị trường đã giảm sâu.' },
    { id: 'SEC-07', title: 'Ủy Quyền Bỏ Phiếu (Checkpoint Snapshots)', desc: 'ERC20Votes chốt điểm tại thời điểm Snapshot. Thành viên không delegate trước Snapshot có voting power = 0.' },
    { id: 'SEC-08', title: 'Khôi Phục Trạng Thái (Atomicity Rollback)', desc: 'Mọi sự cố kỹ thuật trong lệnh hoàn tiền đều khiến toàn bộ transaction rollback, bảo toàn nguyên vẹn số dư.' },
    { id: 'SEC-09', title: 'Quét Trần Đề Xuất (Multi-Call Inspection)', desc: 'Governor.propose() giải mã toàn bộ calldatas nhắm đến Treasury và cộng dồn sum(maxPrice) <= 8 ETH.' },
    { id: 'SEC-10', title: 'Chống Replay Thực Thi', desc: 'TimelockController và Governor lưu trạng thái đề xuất, chặn đứng việc gọi hàm execute() lần thứ 2 trên cùng một proposal.' },
    { id: 'SEC-11', title: 'Chống Gian Lận Báo Cáo Giá', desc: 'Hệ thống không tin tưởng actualPrice trả về từ Adapter mà đối chiếu chéo với lượng ETH thực tế rời khỏi Kho bạc.' },
  ];

  return `
    <div class="card-header" style="margin-bottom: 20px;">
      <div>
        <h2>📜 Ma Trận 11 Bất Biến Bảo Mật Toàn Diện (SEC-01 Đến SEC-11)</h2>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-top: 4px;">
          Các bất biến toán học và bảo mật được mã hóa trực tiếp trong Smart Contract và đạt độ bao phủ kiểm thử 100%.
        </p>
      </div>
      <span class="status-pill online">11 / 11 Đã Kiểm Định</span>
    </div>

    <div class="invariant-grid">
      ${invariants
        .map(
          (inv) => `
          <div class="invariant-card">
            <span class="inv-badge">${inv.id}</span>
            <div class="inv-info">
              <h4>${inv.title}</h4>
              <p>${inv.desc}</p>
            </div>
          </div>
        `
        )
        .join('')}
    </div>
  `;
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  renderApp();
});
