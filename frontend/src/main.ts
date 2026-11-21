import confetti from 'canvas-confetti';
import {
  getContractAddresses,
  saveContractAddresses,
  DEFAULT_CONTRACT_ADDRESSES,
  type ContractAddresses
} from './contracts/config';
import {
  INITIAL_STATE,
  PERSONAS,
  type Proposal,
  type SystemState,
} from './state';
import { web3Service, type Web3State } from './web3';

// -------------------------------------------------------------------------------------------------
// APPLICATION STATE
// -------------------------------------------------------------------------------------------------
let state: SystemState = { ...INITIAL_STATE };
let web3State: Web3State = { ...web3Service.state };
let appMode: 'fe' | 'live' | 'guide' = (localStorage.getItem('dao_app_mode') as 'fe' | 'live' | 'guide') || 'fe';
let appTheme: 'light' | 'dark' = (localStorage.getItem('dao_theme') as 'light' | 'dark') || 'light';
let activeTab: 'overview' | 'treasury' | 'governance' | 'market' = 'overview';

// Đồng bộ theme vào root DOM
document.documentElement.setAttribute('data-theme', appTheme);

// Lắng nghe cập nhật từ Web3Service
web3Service.subscribe((newWeb3State) => {
  web3State = newWeb3State;
  if (appMode === 'live') {
    renderTabContent();
    renderHeaderControls();
  }
});

// -------------------------------------------------------------------------------------------------
// UTILITY FUNCTIONS
// -------------------------------------------------------------------------------------------------
function saveLog(type: 'info' | 'success' | 'error', message: string) {
  const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  state.logs.unshift({ time, type, message });
  const logBox = document.getElementById('audit-log-box');
  if (logBox) renderAuditLog(logBox);
}

function showToast(message: string, type: 'success' | 'error' = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const labels: Record<string, string> = { success: 'Thực thi thành công', error: 'Điều kiện không thỏa / Reverted' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div>
      <div style="font-weight:700;font-size:0.83rem;">${labels[type]}</div>
      <div style="font-size:0.8rem;color:var(--gov-text-body);margin-top:2px;">${message}</div>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 4500);
}

function copyToClipboard(text: string, label: string = 'Nội dung') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Đã sao chép ${label} vào bộ nhớ tạm!`, 'success');
  }).catch(() => {
    showToast('Lỗi khi sao chép vào bộ nhớ!', 'error');
  });
}

function renderAuditLog(container: HTMLElement) {
  container.innerHTML = state.logs
    .slice(0, 25)
    .map(
      (log) => `
      <div class="audit-log-row">
        <span class="audit-log-time">[${log.time}]</span>
        <span class="audit-log-msg ${log.type}">&bull; ${log.message}</span>
      </div>
    `
    )
    .join('');
}

// -------------------------------------------------------------------------------------------------
// MAIN APP RENDER
// -------------------------------------------------------------------------------------------------
function renderApp() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="top-stripe"></div>

    <header class="gov-header">
      <div class="gov-header-inner">
        <div class="brand-section">
          <div class="brand-text">
            <h1>Cổng Quản Trị Kho Bạc Secure Collector DAO</h1>
            <p>Hệ Thống Lưu Ký NFT Thể Chế &mdash; Phân Tách 4 Tầng &amp; Chống Gian Lận Adapter</p>
          </div>
        </div>

        <div class="header-actions">
          <!-- BỘ CHUYỂN ĐỔI CHẾ ĐỘ: FE, CHẠY THẬT VÀ TRANG HƯỚNG DẪN RIÊNG -->
          <div class="mode-toggle-group">
            <button id="btn-mode-fe" class="mode-toggle-btn ${appMode === 'fe' ? 'active' : ''}" title="Chạy sa bàn mô phỏng nhanh, không tốn gas, không cần cài ví">
              1. Sa Bàn Mô Phỏng (FE)
            </button>
            <button id="btn-mode-live" class="mode-toggle-btn ${appMode === 'live' ? 'active' : ''}" title="Làm việc với Smart Contract thật qua MetaMask hoặc Local Node">
              2. Làm Việc Thật (Web3)
            </button>
            <button id="btn-mode-guide" class="mode-toggle-btn ${appMode === 'guide' ? 'active' : ''}" title="Trang hướng dẫn cách thức vận hành Backend, thao tác Frontend và import ví">
              3. Hướng Dẫn Vận Hành
            </button>
          </div>

          <!-- NÚT GIAO DIỆN TỐI / SÁNG -->
          <button id="btn-theme-toggle" class="btn-theme-toggle" title="Đổi giao diện Tối / Sáng">
            ${appTheme === 'dark' ? 'Giao diện Sáng' : 'Giao diện Tối'}
          </button>

          <!-- KHUNG VAI TRÒ HOẶC VÍ METAMASK -->
          <div id="header-user-panel"></div>
        </div>
      </div>
    </header>

    <!-- BANNER PHÂN TÁCH RÕ RÀNG HAI CHẾ ĐỘ -->
    <div class="portal-container" style="padding-bottom:0;">
      <div class="mode-banner ${appMode === 'live' ? 'live-mode' : ''}">
        ${
          appMode === 'guide'
            ? `
          <div>
            <strong>Trang 3: Tài Liệu &amp; Hướng Dẫn Vận Hành Hệ Thống Toàn Diện:</strong>
            Trình bày chi tiết lý thuyết căn bản cho người mới, cơ chế token (ETH, SCT, NFT), kiến trúc Smart Contracts (BE), thao tác Frontend (FE) và quy trình kết nối ví.
          </div>
          <span class="gov-badge info">Tài Liệu Hướng Dẫn</span>
        `
            : appMode === 'fe'
            ? `
          <div>
            <strong>Chế độ 1: Sa Bàn Mô Phỏng (Frontend In-Memory):</strong>
            Mọi thao tác thay đổi trạng thái trong bộ nhớ máy khách. Dùng để thuyết trình và kiểm tra nhanh 11 chốt chặn bảo mật <strong>SEC-01 &rarr; SEC-11</strong> mà không cần cài MetaMask hay chạy Node.
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button id="btn-quick-guide" class="gov-btn gov-btn-secondary gov-btn-sm">Xem Hướng Dẫn Vận Hành</button>
            <span class="gov-badge info">Mô Phỏng Không Tốn Gas</span>
          </div>
        `
            : `
          <div>
            <strong>Chế độ 2: Làm Việc Thật (Web3 On-Chain):</strong>
            Mọi lệnh Biểu Quyết, Tạm Dừng, Mua NFT đều là giao dịch mật mã ký qua MetaMask gửi tới Hardhat Node (<code style="font-family:var(--font-mono);font-size:0.8rem;">127.0.0.1:8545</code>).
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button id="btn-open-contracts-config" class="gov-btn gov-btn-secondary gov-btn-sm">Cấu Hình Hợp Đồng</button>
            <button id="btn-sync-onchain" class="gov-btn gov-btn-primary gov-btn-sm">Tải Lại Dữ Liệu</button>
          </div>
        `
        }
      </div>
    </div>

    <!-- NỘI DUNG CHÍNH -->
    <div class="portal-container">
      ${
        appMode !== 'guide'
          ? `
        <nav class="gov-nav">
          <button class="gov-nav-item ${activeTab === 'overview' ? 'active' : ''}" data-tab="overview">
            Tổng Quan Hệ Thống
          </button>
          <button class="gov-nav-item ${activeTab === 'treasury' ? 'active' : ''}" data-tab="treasury">
            Kho Bạc &amp; Giám Sát (NFTTreasury)
          </button>
          <button class="gov-nav-item ${activeTab === 'governance' ? 'active' : ''}" data-tab="governance">
            Quản Trị &amp; Timelock 48h (Governor)
          </button>
          <button class="gov-nav-item ${activeTab === 'market' ? 'active' : ''}" data-tab="market">
            Sàn Giao Dịch NFT (Adapters)
          </button>
        </nav>
      `
          : ''
      }

      <main id="tab-content"></main>
    </div>

    <!-- MODAL CẤU HÌNH HỢP ĐỒNG -->
    <div id="contracts-config-modal" class="modal-overlay" style="display:none;">
      <div class="modal-box">
        <div class="modal-header">
          <h3>Cấu Hình Địa Chỉ Smart Contract Trên Mạng</h3>
          <button id="btn-close-config-modal" class="gov-btn gov-btn-secondary gov-btn-sm">Đóng</button>
        </div>
        <div class="modal-body">
          <div class="gov-alert info" style="margin-bottom:12px;">
            Hệ thống tự động đồng bộ theo địa chỉ triển khai trên Hardhat Local Node (Chain ID: 31337).
          </div>
          <div class="contract-config-list" id="contract-inputs-container"></div>
        </div>
        <div class="modal-footer" style="justify-content:space-between;">
          <button id="btn-reset-default-contracts" class="gov-btn gov-btn-secondary">Khôi Phục Mặc Định</button>
          <div style="display:flex;gap:8px;">
            <button id="btn-close-config-modal-2" class="gov-btn gov-btn-secondary">Hủy</button>
            <button id="btn-save-contracts" class="gov-btn gov-btn-primary">Lưu Thay Đổi</button>
          </div>
        </div>
      </div>
    </div>

    <div id="toast-container" class="toast-container"></div>
  `;

  setupThemeToggle();
  setupModeSwitcher();
  renderHeaderControls();
  setupNavigation();
  renderTabContent();
  setupContractsModal();
}

// Chuyển đổi Dark / Light Theme
function setupThemeToggle() {
  document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    appTheme = appTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('dao_theme', appTheme);
    document.documentElement.setAttribute('data-theme', appTheme);
    renderApp();
  });
}

function renderHeaderControls() {
  const panel = document.getElementById('header-user-panel');
  if (!panel) return;

  if (appMode === 'guide') {
    panel.innerHTML = `
      <span class="gov-badge info" style="padding:6px 12px;font-size:0.8rem;">
        Sổ Tay Vận Hành &amp; Kiến Trúc
      </span>
    `;
    return;
  }

  if (appMode === 'fe') {
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:0.8rem;color:var(--gov-text-muted);font-weight:600;">Vai trò mô phỏng:</span>
        <select id="persona-select" class="form-control" style="padding:5px 8px;font-size:0.8rem;width:auto;">
          ${PERSONAS.map(
            (p) =>
              `<option value="${p.id}" ${p.id === state.currentPersona.id ? 'selected' : ''}>${p.name}</option>`
          ).join('')}
        </select>
      </div>
    `;

    document.getElementById('persona-select')?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const found = PERSONAS.find((p) => p.id === target.value);
      if (found) {
        state.currentPersona = found;
        saveLog('info', `[Mô phỏng] Đổi vai trò sang: ${found.name} — ${found.role}`);
        showToast(`Đang thao tác với tư cách: ${found.name}`, 'success');
        renderTabContent();
      }
    });
  } else {
    // Menu kết nối ví MetaMask thật
    if (!web3State.isConnected) {
      panel.innerHTML = `
        <button id="btn-connect-wallet" class="gov-btn gov-btn-primary gov-btn-sm">
          Kết Nối Ví MetaMask
        </button>
      `;
      document.getElementById('btn-connect-wallet')?.addEventListener('click', async () => {
        try {
          const acc = await web3Service.connectWallet();
          saveLog('success', `[Web3 Thật] Kết nối ví thành công: ${acc}`);
          showToast(`Đã kết nối: ${acc.slice(0, 6)}...${acc.slice(-4)}`, 'success');
        } catch (err: any) {
          saveLog('error', `Lỗi kết nối ví: ${err.message}`);
          showToast(err.message, 'error');
        }
      });
    } else {
      const shortAddr = `${web3State.account.slice(0, 6)}...${web3State.account.slice(-4)}`;
      const isHardhat = web3State.chainId === 31337;
      panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="gov-badge ${isHardhat ? 'success' : 'warning'}" title="Mạng chuỗi khối">
            ${isHardhat ? 'Localhost:31337' : `Chain ID: ${web3State.chainId || 'Khác'}`}
          </span>
          <span class="gov-badge" style="font-family:var(--font-mono);" title="${web3State.account}">
            ${shortAddr} &nbsp;|&nbsp; ${web3State.ethBalance} ETH
          </span>
          <button id="btn-disconnect-wallet" class="gov-btn gov-btn-secondary gov-btn-sm" style="padding:4px 8px;">
            Ngắt
          </button>
        </div>
      `;
      document.getElementById('btn-disconnect-wallet')?.addEventListener('click', () => {
        web3Service.disconnectWallet();
        saveLog('info', '[Web3 Thật] Đã ngắt kết nối ví MetaMask');
        showToast('Đã ngắt kết nối ví', 'success');
      });
    }
  }
}

function setupModeSwitcher() {
  document.getElementById('btn-mode-fe')?.addEventListener('click', () => {
    if (appMode === 'fe') return;
    appMode = 'fe';
    localStorage.setItem('dao_app_mode', 'fe');
    saveLog('info', 'Chuyển sang chế độ: Sa Bàn Mô Phỏng (FE Only)');
    showToast('Đang ở chế độ Sa Bàn Mô Phỏng', 'success');
    renderApp();
  });

  document.getElementById('btn-mode-live')?.addEventListener('click', async () => {
    if (appMode === 'live') return;
    appMode = 'live';
    localStorage.setItem('dao_app_mode', 'live');
    saveLog('info', 'Chuyển sang chế độ: Làm Việc Thật (Web3 On-Chain)');
    showToast('Đang ở chế độ Làm Việc Thật với Blockchain', 'success');
    renderApp();
    await web3Service.syncAll();
  });

  document.getElementById('btn-mode-guide')?.addEventListener('click', () => {
    if (appMode === 'guide') return;
    appMode = 'guide';
    localStorage.setItem('dao_app_mode', 'guide');
    showToast('Đang mở Trang Hướng Dẫn Vận Hành', 'success');
    renderApp();
  });

  document.getElementById('btn-quick-guide')?.addEventListener('click', () => {
    appMode = 'guide';
    localStorage.setItem('dao_app_mode', 'guide');
    renderApp();
  });

  document.getElementById('btn-sync-onchain')?.addEventListener('click', async () => {
    showToast('Đang đọc trạng thái từ Smart Contract...', 'success');
    try {
      await web3Service.syncAll();
      saveLog('success', 'Đã đồng bộ số dư và trạng thái on-chain thành công!');
      showToast('Đã làm mới dữ liệu từ Blockchain!', 'success');
      renderTabContent();
    } catch (e: any) {
      saveLog('error', `Lỗi kết nối RPC: ${e.message}`);
      showToast(`Không thể kết nối node: ${e.message}`, 'error');
    }
  });
}

function setupNavigation() {
  document.querySelectorAll('.gov-nav-item').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      activeTab = el.dataset.tab as any;
      document.querySelectorAll('.gov-nav-item').forEach((b) => b.classList.remove('active'));
      el.classList.add('active');
      renderTabContent();
    });
  });
}

function setupContractsModal() {
  const modal = document.getElementById('contracts-config-modal');
  const container = document.getElementById('contract-inputs-container');

  const populateInputs = () => {
    if (!container) return;
    const addrs = getContractAddresses();
    container.innerHTML = Object.entries(addrs)
      .map(
        ([key, val]) => `
      <div class="contract-config-row">
        <label>${key}</label>
        <input type="text" id="cfg-contract-${key}" value="${val}" />
      </div>
    `
      )
      .join('');
  };

  document.getElementById('btn-open-contracts-config')?.addEventListener('click', () => {
    populateInputs();
    if (modal) modal.style.display = 'flex';
  });

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  document.getElementById('btn-close-config-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-close-config-modal-2')?.addEventListener('click', closeModal);

  document.getElementById('btn-reset-default-contracts')?.addEventListener('click', () => {
    saveContractAddresses(DEFAULT_CONTRACT_ADDRESSES);
    populateInputs();
    showToast('Đã khôi phục địa chỉ mặc định!', 'success');
  });

  document.getElementById('btn-save-contracts')?.addEventListener('click', async () => {
    const addrs = getContractAddresses();
    const updated: Partial<ContractAddresses> = {};
    for (const key of Object.keys(addrs) as (keyof ContractAddresses)[]) {
      const input = document.getElementById(`cfg-contract-${key}`) as HTMLInputElement;
      if (input && input.value.trim()) {
        updated[key] = input.value.trim();
      }
    }
    saveContractAddresses(updated);
    closeModal();
    showToast('Đã lưu địa chỉ mới!', 'success');
    await web3Service.syncAll();
    renderTabContent();
  });
}

function renderTabContent() {
  const container = document.getElementById('tab-content');
  if (!container) return;

  if (appMode === 'guide') {
    container.innerHTML = getGuideHtml();
    attachGuideEvents();
    return;
  }

  switch (activeTab) {
    case 'overview':
      container.innerHTML = getOverviewHtml();
      break;
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
  }

  const logBox = document.getElementById('audit-log-box');
  if (logBox) renderAuditLog(logBox);
}

// -------------------------------------------------------------------------------------------------
// TRANG RIÊNG: HƯỚNG DẪN VẬN HÀNH & KIẾN TRÚC TOÀN DIỆN (DROP-DOWN ACCORDIONS)
// -------------------------------------------------------------------------------------------------
function getGuideHtml() {
  return `
    <div class="gov-card">
      <div class="gov-card-header">
        <div>
          <div class="gov-card-title">Sổ Tay Hướng Dẫn Vận Hành &amp; Kiến Trúc Dự Án</div>
          <div class="gov-card-subtitle">
            Tài liệu giải thích từ lý thuyết căn bản cho người mới, cơ chế token, nguyên lý Smart Contracts (BE), thao tác Frontend (FE) đến hướng dẫn kết nối ví.
          </div>
        </div>
        <button id="btn-back-to-app" class="gov-btn gov-btn-primary gov-btn-sm">
          Quay Lại Bảng Điều Khiển
        </button>
      </div>
      <p style="font-size:0.85rem;color:var(--gov-text-muted);">
        Nhấp chuột vào từng tiêu đề bên dưới để mở hoặc thu gọn nội dung chi tiết.
      </p>
    </div>

    <!-- PHẦN 1: LÝ THUYẾT CĂN BẢN & CÁC LOẠI TOKEN -->
    <details class="gov-accordion" open>
      <summary>Phần 1: Lý Thuyết Căn Bản &amp; Các Loại Tài Sản Trong Dự Án (Dành Cho Người Mới)</summary>
      <div class="gov-accordion-content">
        <div class="guide-step-card">
          <div class="guide-step-title">1.1. Ví Web3 (MetaMask) và Khóa Bí Mật (Private Key) là gì?</div>
          <p>
            • <strong>Ví Web3 (MetaMask)</strong> không lưu trữ tiền mặt mà đóng vai trò như một chiếc chìa khóa điện tử an toàn trên trình duyệt của bạn. Nó quản lý hai thông tin then chốt:<br/>
            - <em>Địa chỉ công khai (Public Address)</em>: Giống như số tài khoản ngân hàng, dùng để nhận tiền hoặc định danh bạn là ai trong DAO.<br/>
            - <em>Khóa bí mật (Private Key)</em>: Giống như chữ ký mẫu hoặc mã PIN ngân hàng, dùng để xác thực và ký các lệnh giao dịch (Biểu quyết, Chuyển tiền, v.v.).<br/>
            • <strong>Tại sao cần Import Private Key?</strong> Mạng Hardhat cục bộ đã nạp sẵn 10,000 ETH ảo vào một số ví mẫu. Khi bạn nhập Private Key của các ví này vào MetaMask, bạn có toàn quyền điều khiển ví đó để gửi giao dịch lên mạng thử nghiệm.
          </p>
        </div>

        <div class="guide-step-card">
          <div class="guide-step-title">1.2. Các loại đồng tiền &amp; tài sản trong hệ thống dùng để làm gì?</div>
          <ul style="padding-left:18px;line-height:1.9;">
            <li>
              <strong>ETH (Đồng tiền thanh toán cơ sở):</strong>
              Là đơn vị tiền tệ mà Kho Bạc (NFTTreasury) nắm giữ. Khi một đề xuất mua tranh được cộng đồng thông qua, Kho bạc sẽ chi trả trực tiếp bằng ETH để mua NFT từ các sàn ngoài và nhận tiền thừa hoàn trả về.
            </li>
            <li>
              <strong>SCT (Secure Collector Token - Hợp đồng GovToken):</strong>
              Là Token Quản Trị (Governance Token) của tổ chức DAO theo chuẩn ERC-20 Votes, với tổng cung cố định là <strong>1,000,000 SCT</strong>. SCT tượng trưng cho quyền lực biểu quyết: Người sở hữu SCT có quyền tạo đề xuất và bỏ phiếu Thuận/Chống/Trắng. Số phiếu biểu quyết tỷ lệ thuận với số lượng token nắm giữ.
            </li>
            <li>
              <strong>NFT (Tài sản số độc bản - Chuẩn ERC-721):</strong>
              Là các tác phẩm nghệ thuật kỹ thuật số có giá trị (ví dụ: CryptoPunks, Bored Android). Khi được Kho bạc mua về qua sàn giao dịch, các NFT này sẽ được lưu ký an toàn vô thời hạn trong hợp đồng <code>NFTTreasury</code>.
            </li>
          </ul>
        </div>

        <div class="guide-step-card" style="margin-bottom:0;">
          <div class="guide-step-title">1.3. Cơ chế "Ủy Quyền Biểu Quyết" (Delegate) là gì? Vì sao có SCT mà quyền vote vẫn bằng 0?</div>
          <p>
            • Để ngăn chặn hình thức tấn công <em>Flash Loan</em> (kẻ gian vay mượn hàng triệu token trong chớp mắt để thao túng kết quả biểu quyết rồi trả lại ngay trong cùng 1 block), chuẩn OpenZeppelin <code>ERC20Votes</code> bắt buộc sử dụng cơ chế <strong>Checkpoint Snapshot</strong> (SEC-07).<br/>
            • <strong>Ràng buộc kỹ thuật:</strong> Khi nhận token SCT, quyền biểu quyết mặc định sẽ chưa được kích hoạt. Người sở hữu bắt buộc phải gọi lệnh <code>delegate(address)</code> để ủy quyền biểu quyết cho chính ví của mình hoặc đại biểu khác.<br/>
            • <strong>Hệ quả:</strong> Nếu bạn nhận SCT nhưng chưa từng gọi lệnh Delegate, quyền biểu quyết của bạn tại mốc Snapshot khi đề xuất tạo ra sẽ là <strong>0 SCT</strong>. Đây là lý do tài khoản Bob (sở hữu 50,000 SCT) bị hệ thống chặn không cho bỏ phiếu.
          </p>
        </div>
      </div>
    </details>

    <!-- PHẦN 2: HƯỚNG DẪN CHI TIẾT CÁCH CHẠY THẬT -->
    <details class="gov-accordion" open>
      <summary>Phần 2: Hướng Dẫn Từng Bước Để Làm Việc Thật (Live Web3 On-Chain)</summary>
      <div class="gov-accordion-content">
        <div class="guide-step-card">
          <div class="guide-step-title">Bước 1: Khởi động mạng Blockchain cục bộ (Hardhat Node)</div>
          <p style="margin-bottom:8px;">
            Nhấp đúp chuột vào file <code>start_full_web3.bat</code> hoặc mở cửa sổ Terminal trong thư mục dự án và chạy câu lệnh:
          </p>
          <div class="copy-block">
            <code>npx hardhat node</code>
            <button class="gov-btn gov-btn-secondary gov-btn-sm btn-copy-cmd" data-text="npx hardhat node">Copy Lệnh</button>
          </div>
          <p style="font-size:0.8rem;color:var(--gov-text-muted);margin-top:6px;">
            Mạng sẽ khởi động và tạo sẵn 20 ví thử nghiệm với 10,000 ETH mỗi ví tại địa chỉ <code>http://127.0.0.1:8545</code>.
          </p>
        </div>

        <div class="guide-step-card">
          <div class="guide-step-title">Bước 2: Cấu hình mạng Hardhat trên tiện ích MetaMask</div>
          <p style="margin-bottom:8px;">
            Mở tiện ích MetaMask trên trình duyệt &rarr; Nhấp chọn danh sách mạng ở góc trên cùng bên trái &rarr; Chọn <strong>"Thêm mạng" (Add Network)</strong> &rarr; Chọn <strong>"Thêm mạng theo cách thủ công"</strong> và điền thông số:
          </p>
          <ul style="padding-left:18px;line-height:1.8;">
            <li><strong>Tên mạng:</strong> Hardhat Localhost</li>
            <li><strong>URL RPC mới:</strong> <code>http://127.0.0.1:8545</code></li>
            <li><strong>Mã chuỗi (Chain ID):</strong> <code>31337</code></li>
            <li><strong>Ký hiệu tiền tệ:</strong> <code>ETH</code></li>
          </ul>
        </div>

        <div class="guide-step-card">
          <div class="guide-step-title">Bước 3: Nhập (Import) các tài khoản mẫu vào MetaMask</div>
          <p style="margin-bottom:10px;">
            Trong MetaMask, bấm vào ảnh đại diện tài khoản &rarr; Chọn <strong>"Thêm tài khoản hoặc phần cứng"</strong> &rarr; Chọn <strong>"Nhập tài khoản" (Import Account)</strong> &rarr; Dán một trong các Private Key bên dưới:
          </p>

          <div class="gov-table-wrapper">
            <table class="gov-table">
              <thead>
                <tr>
                  <th>Tên Vai Trò</th>
                  <th>Địa Chỉ Ví (Public Address)</th>
                  <th>Khóa Bí Mật (Private Key)</th>
                  <th>Chức Năng &amp; Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Deployer &amp; Hội Đồng Bảo Mật</strong></td>
                  <td><code>0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266</code></td>
                  <td><code>0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80</code></td>
                  <td>
                    <button class="gov-btn gov-btn-secondary gov-btn-sm btn-copy-cmd" data-text="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80">
                      Copy Key
                    </button>
                    <span style="font-size:0.75rem;color:var(--gov-text-muted);display:block;margin-top:2px;">
                      Dùng để bấm Pause khẩn cấp và Veto Timelock
                    </span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Alice (Cá Voi DAO / Proposer)</strong></td>
                  <td><code>0x70997970C51812dc3A010C7d01b50e0d17dc79C8</code></td>
                  <td><code>0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d</code></td>
                  <td>
                    <button class="gov-btn gov-btn-secondary gov-btn-sm btn-copy-cmd" data-text="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d">
                      Copy Key
                    </button>
                    <span style="font-size:0.75rem;color:var(--gov-text-muted);display:block;margin-top:2px;">
                      Có 100,000 SCT, tạo đề xuất và bỏ phiếu thuận
                    </span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Bob (Chưa Kích Hoạt Delegate)</strong></td>
                  <td><code>0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC</code></td>
                  <td><code>0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a</code></td>
                  <td>
                    <button class="gov-btn gov-btn-secondary gov-btn-sm btn-copy-cmd" data-text="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a">
                      Copy Key
                    </button>
                    <span style="font-size:0.75rem;color:var(--gov-text-muted);display:block;margin-top:2px;">
                      Có 50,000 SCT nhưng quyền vote = 0 (SEC-07)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Người Thực Thi Cộng Đồng</strong></td>
                  <td><code>0x90F79bf6EB2c4f870365E785982E1f101E93b906</code></td>
                  <td><code>0x7c852118294e51e653712a9905b0a0a84ba84332e98dcebee891a92e10e05697</code></td>
                  <td>
                    <button class="gov-btn gov-btn-secondary gov-btn-sm btn-copy-cmd" data-text="0x7c852118294e51e653712a9905b0a0a84ba84332e98dcebee891a92e10e05697">
                      Copy Key
                    </button>
                    <span style="font-size:0.75rem;color:var(--gov-text-muted);display:block;margin-top:2px;">
                      Thực thi đề xuất sau khi hết 48h Timelock
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="guide-step-card" style="margin-bottom:0;">
          <div class="guide-step-title">Bước 4: Bật chế độ "2. Làm Việc Thật (Web3)" và kết nối ví</div>
          <p>
            Nhấp chọn nút <strong>"2. Làm Việc Thật (Web3)"</strong> trên thanh chuyển đổi chế độ ở đầu trang &rarr; Nhấp <strong>"Kết Nối Ví MetaMask"</strong> &rarr; Xác nhận trên cửa sổ MetaMask. Khi kết nối thành công, hệ thống sẽ đọc trực tiếp số dư ETH, số lượng SCT token và quyền biểu quyết on-chain của bạn.
          </p>
        </div>
      </div>
    </details>

    <!-- PHẦN 3: CÁCH THỨC VẬN HÀNH CỦA BACKEND -->
    <details class="gov-accordion" open>
      <summary>Phần 3: Cách Thức Vận Hành Của Backend (Smart Contracts &amp; 4 Tầng Bảo Mật)</summary>
      <div class="gov-accordion-content">
        <div class="guide-step-card">
          <div class="guide-step-title">3.1. Kiến trúc phân tách 4 tầng độc lập (Separation of Concerns)</div>
          <p style="margin-bottom:6px;">
            Nhằm đảm bảo nguyên tắc đặc quyền tối thiểu (Least Privilege), hệ thống không dồn toàn bộ quyền hạn vào một hợp đồng duy nhất mà phân tách thành 4 tầng rạch ròi:
          </p>
          <ul style="padding-left:18px;line-height:1.9;">
            <li><strong>Tầng 1 - Governance Token (GovToken.sol):</strong> Lưu trữ số dư token SCT, tạo lập các mốc Snapshot theo thời gian thực (block.timestamp). Tuyệt đối không can thiệp vào ví tiền hay kho bạc.</li>
            <li><strong>Tầng 2 - Dao Governor (NFTDaoGovernor.sol):</strong> Tiếp nhận biểu quyết từ người sở hữu token. Kiểm tra trần đề xuất tối đa không quá 8 ETH (SEC-09).</li>
            <li><strong>Tầng 3 - Timelock Controller (TimelockController.sol):</strong> Hàng đợi giữ lệnh 48 giờ bắt buộc (SEC-08). Giữ quyền quản trị tối cao của Kho bạc (TIMELOCK_ROLE).</li>
            <li><strong>Tầng 4 - Kho Bạc &amp; Adapters (NFTTreasury.sol &amp; SafeMarketplaceAdapter.sol):</strong> Quản lý số dư ETH và lưu ký NFT. Kiểm soát hạn mức ngày 10 ETH (SEC-04), hạn mức cuộc gọi 5 ETH (SEC-03) và đối chiếu hoàn tiền thừa tự động (SEC-01).</li>
          </ul>
        </div>

        <div class="guide-step-card">
          <div class="guide-step-title">3.2. Chu trình 4 giai đoạn của một Đề Xuất (Proposal Lifecycle)</div>
          <p>
            1. <strong>Tạo đề xuất (propose):</strong> Thành viên có từ 1,000 SCT trở lên tạo đề xuất mua NFT. Hợp đồng Governor kiểm tra tổng số tiền yêu cầu &le; 8 ETH.<br/>
            2. <strong>Bỏ phiếu biểu quyết (Active):</strong> Các thành viên bỏ phiếu Thuận. Cần đạt tối thiểu 4% Quorum (40,000 phiếu thuận) và số phiếu Thuận &gt; số phiếu Chống.<br/>
            3. <strong>Vào hàng đợi Timelock 48h (Queued):</strong> Khi biểu quyết thành công, lệnh được đưa vào TimelockController và đếm ngược 48 giờ. Trong 48h này, Hội đồng bảo mật có quyền VETO nếu phát hiện dấu hiệu bất thường.<br/>
            4. <strong>Thực thi giải ngân (Executed):</strong> Khi hết 48h, bất kỳ ai cũng có thể gọi <code>execute()</code> để Kho bạc chi tiền mua NFT qua Adapter an toàn. Lệnh không thể thực thi lần 2 (Chống Replay - SEC-10).
          </p>
        </div>

        <div class="guide-step-card" style="margin-bottom:0;">
          <div class="guide-step-title">3.3. Bảng tổng hợp 11 chốt chặn bảo mật trọng yếu (Độ bao phủ kiểm thử 100%)</div>
          <div class="gov-table-wrapper">
            <table class="gov-table">
              <thead>
                <tr>
                  <th>Mã Ràng Buộc</th>
                  <th>Mục Tiêu Bảo Mật</th>
                  <th>Cơ Chế Khóa Trên Smart Contract</th>
                  <th>Trạng Thái Test</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>SEC-01</code></td>
                  <td>Đối chiếu tiền thừa Adapter</td>
                  <td>Kiểm tra <code>netSpent == actualPrice</code>. Adapter gian lận giữ tiền thừa &rarr; REVERT</td>
                  <td><span class="gov-badge success">100% PASSED</span></td>
                </tr>
                <tr>
                  <td><code>SEC-03</code></td>
                  <td>Trần chi đơn lệnh (maxPerCall)</td>
                  <td>Hàm <code>executeBuyNFT</code> chặn <code>maxPrice &le; 5.0 ETH</code></td>
                  <td><span class="gov-badge success">100% PASSED</span></td>
                </tr>
                <tr>
                  <td><code>SEC-04</code></td>
                  <td>Hạn mức chi tiêu ngày</td>
                  <td>Cộng dồn chi tiêu theo ngày (block.timestamp / 1 days). Vượt 10 ETH &rarr; REVERT</td>
                  <td><span class="gov-badge success">100% PASSED</span></td>
                </tr>
                <tr>
                  <td><code>SEC-05</code></td>
                  <td>Tạm dừng khẩn cấp có hạn</td>
                  <td><code>pauseTrading(duration)</code> tối đa 7 ngày. Hết hạn tự mở khóa không cần unpause</td>
                  <td><span class="gov-badge success">100% PASSED</span></td>
                </tr>
                <tr>
                  <td><code>SEC-07</code></td>
                  <td>Checkpoint Snapshot</td>
                  <td>Khóa quyền vote theo mốc Snapshot. Chưa delegate trước Snapshot &rarr; Quyền vote = 0</td>
                  <td><span class="gov-badge success">100% PASSED</span></td>
                </tr>
                <tr>
                  <td><code>SEC-08</code></td>
                  <td>Quyền Veto trong Timelock</td>
                  <td>Security Council giữ <code>CANCELLER_ROLE</code>, có quyền hủy lệnh trong thời hạn 48h</td>
                  <td><span class="gov-badge success">100% PASSED</span></td>
                </tr>
                <tr>
                  <td><code>SEC-09</code></td>
                  <td>Trần chi đề xuất Governor</td>
                  <td>Giải mã calldata trong <code>propose()</code>. Tổng maxPrice &gt; 8 ETH &rarr; REVERT</td>
                  <td><span class="gov-badge success">100% PASSED</span></td>
                </tr>
                <tr>
                  <td><code>SEC-10</code></td>
                  <td>Chống tấn công lặp lại (Replay)</td>
                  <td>Governor và Timelock đánh dấu trạng thái <code>Executed</code>. Gọi lần 2 &rarr; REVERT</td>
                  <td><span class="gov-badge success">100% PASSED</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </details>

    <!-- PHẦN 4: HƯỚNG DẪN THAO TÁC TRÊN FRONTEND -->
    <details class="gov-accordion" open>
      <summary>Phần 4: Hướng Dẫn Thao Tác Trên Giao Diện Frontend (Sa Bàn FE vs Làm Việc Thật)</summary>
      <div class="gov-accordion-content">
        <div class="guide-step-card">
          <div class="guide-step-title">4.1. Thao tác trên chế độ "1. Sa Bàn Mô Phỏng (FE)"</div>
          <p>
            • <strong>Chuyển vai trò:</strong> Dùng hộp chọn ở góc trên cùng bên phải để đóng vai <em>Alice</em> (để vote và tạo đề xuất), <em>Bob</em> (để thấy cảnh báo chưa delegate), hoặc <em>Security Council</em> (để kích hoạt nút Pause và Veto).<br/>
            • <strong>Các nút giả lập thời gian:</strong><br/>
            - <em>"Giả lập kết thúc bỏ phiếu"</em>: Bỏ qua 3 ngày biểu quyết để đưa đề xuất vào trạng thái thành công.<br/>
            - <em>"Bỏ qua 48h Timelock"</em>: Bỏ qua 48 giờ đếm lùi để nút "Thực thi (Execute)" sáng lên.<br/>
            - <em>"Mô phỏng sang ngày mới"</em>: Đặt lại hạn mức chi tiêu 10 ETH/ngày về 0 ETH.<br/>
            - <em>"Thử tấn công Replay"</em>: Bấm thực thi đề xuất lần thứ hai để xem cảnh báo lỗi SEC-10.
          </p>
        </div>

        <div class="guide-step-card" style="margin-bottom:0;">
          <div class="guide-step-title">4.2. Thao tác trên chế độ "2. Làm Việc Thật (Web3)" và ý nghĩa các thông báo điều kiện</div>
          <p>
            • <strong>Hộp thông báo điều kiện (Condition Box):</strong> Trước mỗi nút thao tác, hệ thống hiển thị rõ các điều kiện tiền đề bắt buộc:<br/>
            - <span class="condition-tag required">Chưa Đủ Điều Kiện</span>: Nút bị khóa mờ, kèm thông báo lý do cụ thể (Ví dụ: Chưa kết nối ví, chưa delegate token, hoặc chưa đủ 48 giờ Timelock).<br/>
            - <span class="condition-tag ok">Đủ Điều Kiện</span>: Nút sẵn sàng để bạn nhấp và xác nhận giao dịch trên ví MetaMask.<br/>
            • <strong>Theo dõi tiến trình on-chain:</strong> Khi bạn thực hiện bất kỳ lệnh nào, thông báo Toast sẽ cập nhật từ trạng thái "Đang gửi giao dịch" đến "Thành công kèm Tx Hash", đồng thời nhật ký kiểm toán bên dưới sẽ ghi lại chi tiết.
          </p>
        </div>
      </div>
    </details>
  `;
}

function attachGuideEvents() {
  document.getElementById('btn-back-to-app')?.addEventListener('click', () => {
    appMode = 'fe';
    localStorage.setItem('dao_app_mode', 'fe');
    renderApp();
  });

  document.querySelectorAll('.btn-copy-cmd').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const text = (e.currentTarget as HTMLElement).dataset.text || '';
      copyToClipboard(text, 'Khóa bảo mật / Mã lệnh');
    });
  });
}

// -------------------------------------------------------------------------------------------------
// 1. TỔNG QUAN HỆ THỐNG (OVERVIEW TAB TRONG DASHBOARD)
// -------------------------------------------------------------------------------------------------
function getOverviewHtml() {
  const isLive = appMode === 'live';
  const treasuryEth = isLive ? web3State.treasuryBalance : state.treasuryBalance.toFixed(2);
  const isPaused = isLive ? web3State.isPaused : state.isPaused;

  return `
    <div class="gov-card">
      <div class="gov-card-header">
        <div>
          <div class="gov-card-title">Cơ Cấu Vận Hành Hệ Thống Quản Trị &amp; Lưu Ký NFT</div>
          <div class="gov-card-subtitle">
            Mô hình thể chế tài chính tự trị phi tập trung (DAO) kết hợp Kho bạc đa tầng, Timelock 48h và Bảo mật Adapter.
          </div>
        </div>
        <span class="gov-badge ${isLive ? 'success' : 'info'}">
          ${isLive ? 'Đang bật: Chế Độ Làm Việc Thật' : 'Đang bật: Sa Bàn Mô Phỏng'}
        </span>
      </div>

      <div class="gov-grid-4">
        <div class="stat-card">
          <div class="stat-label">Số Dư Kho Bạc</div>
          <div class="stat-value">${treasuryEth} <span class="stat-unit">ETH</span></div>
          <div class="stat-hint">${isLive ? 'Đọc trực tiếp từ On-Chain' : 'Trạng thái mô phỏng'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Trạng Thái Kho</div>
          <div class="stat-value" style="font-size:1.15rem;">${isPaused ? 'TẠM DỪNG' : 'HOẠT ĐỘNG'}</div>
          <div class="stat-hint">${isPaused ? 'Kích hoạt Pause khẩn cấp (SEC-05)' : 'Giao dịch bình thường'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Hạn Mức Mua / Lệnh</div>
          <div class="stat-value">5.0 <span class="stat-unit">ETH</span></div>
          <div class="stat-hint">Giới hạn trần mỗi giao dịch</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Hạn Mức Chi Tiêu / Ngày</div>
          <div class="stat-value">10.0 <span class="stat-unit">ETH</span></div>
          <div class="stat-hint">Tự động đặt lại mỗi 24 giờ</div>
        </div>
      </div>
    </div>

    <!-- SƠ ĐỒ KIẾN TRÚC 4 TẦNG -->
    <div class="gov-grid-2">
      <div class="gov-card">
        <div class="gov-card-header">
          <div class="gov-card-title">Kiến Trúc Phân Tách 4 Tầng Bảo Mật</div>
        </div>
        <ul style="font-size:0.83rem; color:var(--gov-text-body); line-height:1.9; padding-left:18px;">
          <li><strong>Tầng 1 (GovToken):</strong> Quản lý số dư, Snapshot quyền biểu quyết (chống Flash Loan - SEC-07).</li>
          <li><strong>Tầng 2 (NFTDaoGovernor):</strong> Tiếp nhận biểu quyết, kiểm soát trần đề xuất tối đa 8 ETH (SEC-09).</li>
          <li><strong>Tầng 3 (TimelockController):</strong> Hàng đợi trì hoãn bắt buộc 48 giờ trước khi tiền được chi (SEC-08).</li>
          <li><strong>Tầng 4 (NFTTreasury &amp; Adapter):</strong> Lưu ký tài sản, đối chiếu <code>netSpent == actualPrice</code> (SEC-01), hạn mức chi tiêu ngày 10 ETH (SEC-04).</li>
        </ul>
      </div>

      <div class="gov-card">
        <div class="gov-card-header">
          <div class="gov-card-title">11 Chốt Chặn Bảo Mật Đã Kiểm Thử (19/19 Tests)</div>
        </div>
        <div class="gov-table-wrapper">
          <table class="gov-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Ràng Buộc Kỹ Thuật</th>
                <th>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>SEC-01</code></td>
                <td>Đối chiếu hoàn trả số dư thực chi (&Delta;ETH == actualPrice)</td>
                <td><span class="gov-badge success">PASSED</span></td>
              </tr>
              <tr>
                <td><code>SEC-04</code></td>
                <td>Hạn mức chi tiêu ngày (10 ETH) tự động reset</td>
                <td><span class="gov-badge success">PASSED</span></td>
              </tr>
              <tr>
                <td><code>SEC-05</code></td>
                <td>Tạm dừng khẩn cấp có thời hạn (tối đa 7 ngày)</td>
                <td><span class="gov-badge success">PASSED</span></td>
              </tr>
              <tr>
                <td><code>SEC-07</code></td>
                <td>Checkpoint Snapshot ngăn thao túng biểu quyết</td>
                <td><span class="gov-badge success">PASSED</span></td>
              </tr>
              <tr>
                <td><code>SEC-09</code></td>
                <td>Trần chi tiêu tối đa mỗi đề xuất &le; 8 ETH</td>
                <td><span class="gov-badge success">PASSED</span></td>
              </tr>
              <tr>
                <td><code>SEC-10</code></td>
                <td>Chống tấn công Replay trên Timelock Controller</td>
                <td><span class="gov-badge success">PASSED</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="gov-card">
      <div class="gov-card-header">
        <div class="gov-card-title">Nhật Ký Hoạt Động Hệ Thống (Audit Logs)</div>
      </div>
      <div id="audit-log-box" class="audit-log-box"></div>
    </div>
  `;
}

// -------------------------------------------------------------------------------------------------
// 2. KHO BẠC & GIÁM SÁT (TREASURY)
// -------------------------------------------------------------------------------------------------
function getTreasuryHtml() {
  const isLive = appMode === 'live';
  const treasuryEth = isLive ? web3State.treasuryBalance : state.treasuryBalance.toFixed(2);
  const dailySpent = isLive ? web3State.dailySpent : state.dailySpent.toFixed(1);
  const dailyLimit = isLive ? web3State.dailySpendingLimit : state.dailySpendingLimit.toFixed(1);
  const maxPerCall = isLive ? web3State.maxPerCallLimit : state.maxPerCallLimit.toFixed(1);
  const isPaused = isLive ? web3State.isPaused : state.isPaused;

  const spentNum = parseFloat(dailySpent) || 0;
  const limitNum = parseFloat(dailyLimit) || 10;
  const dailyPercent = Math.min(100, (spentNum / limitNum) * 100);

  const isSecurityCouncil = isLive
    ? web3State.isConnected
    : state.currentPersona.id === 'securityCouncil';

  return `
    <div class="gov-card">
      <div class="gov-card-header">
        <div>
          <div class="gov-card-title">Bảng Điều Hành Kho Bạc (NFTTreasury)</div>
          <div class="gov-card-subtitle">
            ${isLive ? 'Dữ liệu đọc trực tiếp từ hợp đồng thông minh on-chain' : 'Mô phỏng hạn mức ngân sách và kiểm soát khẩn cấp'}
          </div>
        </div>
        <span class="gov-badge ${isPaused ? 'danger' : 'success'}">
          ${isPaused ? 'ĐANG TẠM DỪNG' : 'BÌNH THƯỜNG'}
        </span>
      </div>

      <div class="gov-grid-4">
        <div class="stat-card">
          <div class="stat-label">Số Dư Kho Bạc</div>
          <div class="stat-value">${treasuryEth} <span class="stat-unit">ETH</span></div>
          <div class="stat-hint">Bảo vệ bởi Timelock 48h</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Chi Tiêu Trong Ngày</div>
          <div class="stat-value">${dailySpent} <span class="stat-unit">ETH</span></div>
          <div class="stat-hint">Còn lại: ${(limitNum - spentNum).toFixed(1)} / ${dailyLimit} ETH</div>
          <div class="gov-progress">
            <div class="gov-progress-fill ${dailyPercent > 80 ? 'warning' : 'success'}" style="width:${dailyPercent}%"></div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Giới Hạn / Lệnh Mua</div>
          <div class="stat-value">${maxPerCall} <span class="stat-unit">ETH</span></div>
          <div class="stat-hint">Trần chi cho 1 lệnh (maxPerCallLimit)</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Giới Hạn Đề Xuất</div>
          <div class="stat-value">8.0 <span class="stat-unit">ETH</span></div>
          <div class="stat-hint">Trần chi tổng của 1 Proposal (SEC-09)</div>
        </div>
      </div>
    </div>

    <div class="gov-grid-2">
      <div class="gov-card">
        <div class="gov-card-header">
          <div>
            <div class="gov-card-title">Quyền Tạm Dừng Khẩn Cấp (Emergency Pause)</div>
            <div class="gov-card-subtitle">Quyền hạn thuộc Hội Đồng Bảo Mật (Security Council) theo chuẩn SEC-05.</div>
          </div>
        </div>

        <div class="condition-box ${isSecurityCouncil && !isPaused ? 'met' : 'warning'}">
          <strong>Điều kiện thực thi hàm pauseTrading(duration):</strong><br/>
          • <span class="condition-tag ${isSecurityCouncil ? 'ok' : 'required'}">Vai trò</span>: Ví phải mang quyền <code>SECURITY_COUNCIL_ROLE</code>.<br/>
          • <span class="condition-tag ok">Thời hạn</span>: Giới hạn tối đa 7 ngày (&le; 604,800 giây).<br/>
          • <span class="condition-tag ${!isPaused ? 'ok' : 'required'}">Trạng thái</span>: Kho bạc chưa bị Pause. Sau khi hết thời hạn, hệ thống tự mở khóa mà không cần lệnh Unpause.
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:14px;">
          ${
            !isPaused
              ? `
            <button id="btn-pause-1h" class="gov-btn gov-btn-secondary gov-btn-sm" ${!isSecurityCouncil ? 'disabled' : ''}>Pause 1 Giờ (3,600s)</button>
            <button id="btn-pause-24h" class="gov-btn gov-btn-secondary gov-btn-sm" ${!isSecurityCouncil ? 'disabled' : ''}>Pause 24 Giờ</button>
            <button id="btn-pause-7d" class="gov-btn gov-btn-danger gov-btn-sm" ${!isSecurityCouncil ? 'disabled' : ''}>Pause Khẩn Cấp 7 Ngày</button>
          `
              : `
            <button id="btn-resume-auto" class="gov-btn gov-btn-secondary gov-btn-sm">
              ${isLive ? 'Kiểm Tra Tự Động Mở Khóa' : 'Giả Lập Hết Giờ (Mở Tự Động)'}
            </button>
          `
          }
          ${
            !isLive
              ? `<button id="btn-reset-day" class="gov-btn gov-btn-secondary gov-btn-sm">Giả Lập Sang Ngày Mới (Reset Hạn Mức)</button>`
              : ''
          }
        </div>
      </div>

      <div class="gov-card">
        <div class="gov-card-header">
          <div>
            <div class="gov-card-title">Danh Sách Trắng Được Phép Giao Dịch</div>
            <div class="gov-card-subtitle">Chỉ TimelockController (Cộng đồng) mới có quyền cập nhật.</div>
          </div>
        </div>
        <div class="gov-table-wrapper">
          <table class="gov-table">
            <thead>
              <tr>
                <th>Hợp Đồng</th>
                <th>Phân Loại</th>
                <th>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>SafeMarketplaceAdapter</code></td>
                <td>Adapter Sàn Được Tin Cậy</td>
                <td><span class="gov-badge success">ĐÃ DUYỆT</span></td>
              </tr>
              <tr>
                <td><code>MaliciousMarketplaceAdapter</code></td>
                <td>Adapter Giả Mạo Đối Kháng</td>
                <td><span class="gov-badge danger">BỊ TỪ CHỐI</span></td>
              </tr>
              <tr>
                <td><code>CryptoPunks Collection</code></td>
                <td>ERC-721 Collection</td>
                <td><span class="gov-badge success">ĐÃ DUYỆT</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="gov-card">
      <div class="gov-card-header">
        <div class="gov-card-title">Bộ Sưu Tập NFT Đang Lưu Ký Trong Kho (${state.vaultNFTs.length} Tác Phẩm)</div>
      </div>
      ${
        state.vaultNFTs.length === 0
          ? `<div style="text-align:center;padding:24px;color:var(--gov-text-muted);">Hiện tại Kho Bạc chưa lưu ký NFT nào.</div>`
          : `
        <div class="nft-grid">
          ${state.vaultNFTs
            .map(
              (nft) => `
            <div class="nft-card">
              <img src="${nft.image}" alt="${nft.name}" />
              <div class="nft-card-body">
                <div class="nft-card-title">${nft.name}</div>
                <div class="nft-card-meta">${nft.collection}</div>
                <div style="font-size:0.8rem;color:var(--gov-text-muted);">
                  Giá mua: <strong>${nft.price} ETH</strong> &bull; Nguồn: <em>${nft.acquiredAt ?? 'Kho bạc'}</em>
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
      }
    </div>
  `;
}

function attachTreasuryEvents() {
  const isLive = appMode === 'live';

  const handlePause = async (seconds: number, label: string) => {
    if (!isLive) {
      if (state.currentPersona.id !== 'securityCouncil') {
        saveLog('error', `${state.currentPersona.name} không có SECURITY_COUNCIL_ROLE.`);
        showToast('Điều kiện chưa đạt: Chỉ Security Council mới có quyền Pause (SEC-05)', 'error');
        return;
      }
      state.isPaused = true;
      state.pausedUntil = seconds;
      saveLog('error', `Security Council kích hoạt Emergency Pause ${label} (SEC-05).`);
      showToast(`Đã kích hoạt Pause ${label}!`, 'error');
      renderTabContent();
    } else {
      if (!web3State.isConnected) {
        showToast('Điều kiện chưa đạt: Vui lòng kết nối ví MetaMask trước!', 'error');
        return;
      }
      try {
        showToast(`Đang gửi giao dịch Pause ${label} lên Smart Contract...`, 'success');
        const txHash = await web3Service.livePauseTrading(seconds);
        confetti({ particleCount: 50, spread: 50 });
        saveLog('success', `[On-Chain] Pause thành công: ${label}. Tx Hash: ${txHash}`);
        showToast(`Đã Pause thành công! Tx: ${txHash.slice(0, 10)}...`, 'success');
        renderTabContent();
      } catch (err: any) {
        const parsed = web3Service.parseContractError(err);
        saveLog('error', `[On-Chain] Lệnh Pause thất bại: ${parsed}`);
        showToast(`Từ chối: ${parsed}`, 'error');
      }
    }
  };

  document.getElementById('btn-pause-1h')?.addEventListener('click', () => handlePause(3600, '1 Giờ'));
  document.getElementById('btn-pause-24h')?.addEventListener('click', () => handlePause(86400, '24 Giờ'));
  document.getElementById('btn-pause-7d')?.addEventListener('click', () => handlePause(604800, '7 Ngày'));

  document.getElementById('btn-resume-auto')?.addEventListener('click', async () => {
    if (!isLive) {
      state.isPaused = false;
      state.pausedUntil = 0;
      saveLog('success', 'Kho bạc tự động mở khóa giao dịch (block.timestamp > pausedUntil).');
      showToast('Đã mở khóa giao dịch (SEC-05)', 'success');
      renderTabContent();
    } else {
      await web3Service.syncAll();
      if (!web3State.isPaused) {
        showToast('Kho bạc đã hết hạn Pause và đang hoạt động bình thường!', 'success');
      } else {
        showToast(`Kho bạc vẫn đang trong thời hạn Pause.`, 'error');
      }
      renderTabContent();
    }
  });

  document.getElementById('btn-reset-day')?.addEventListener('click', () => {
    state.dailySpent = 0;
    saveLog('info', 'Giả lập ngày mới: Hạn mức chi tiêu 10 ETH được đặt lại về 0 (SEC-04).');
    showToast('Hạn mức ngày đã được reset', 'success');
    renderTabContent();
  });
}

// -------------------------------------------------------------------------------------------------
// 3. QUẢN TRỊ & BIỂU QUYẾT (GOVERNANCE)
// -------------------------------------------------------------------------------------------------
function getGovernanceHtml() {
  const isLive = appMode === 'live';
  const roleName = isLive
    ? (web3State.isConnected ? `Ví: ${web3State.account.slice(0, 6)}...${web3State.account.slice(-4)}` : 'Chưa kết nối ví')
    : state.currentPersona.name;
  const votingPower = isLive ? `${web3State.votingPower} SCT` : state.currentPersona.votingPower;
  const isDelegated = isLive ? web3State.isDelegated : state.currentPersona.isDelegated;
  const isSecurityCouncil = isLive ? true : state.currentPersona.id === 'securityCouncil';

  return `
    <div class="gov-card">
      <div class="gov-card-header">
        <div>
          <div class="gov-card-title">Cơ Chế Bỏ Phiếu &amp; Hàng Đợi Timelock 48h</div>
          <div class="gov-card-subtitle">Mọi đề xuất chi tiêu phải đạt Quorum 4%, qua Timelock 48h mới được thực thi.</div>
        </div>
        <button id="btn-open-proposal-modal" class="gov-btn gov-btn-primary">Tạo Đề Xuất Mua NFT</button>
      </div>

      <div class="condition-box ${isDelegated ? 'met' : 'warning'}">
        <strong>Tình trạng người dùng:</strong> ${roleName} &nbsp;|&nbsp;
        Quyền biểu quyết: <strong>${votingPower}</strong>
        ${
          !isDelegated
            ? `
          <br/><span class="condition-tag required">Chưa Đủ Điều Kiện Bỏ Phiếu</span>
          Cần thực hiện <strong>Delegate token</strong> trước Snapshot đề xuất. Chưa delegate &rarr; Voting Power = 0 (SEC-07).
        `
            : `<br/><span class="condition-tag ok">Đủ Điều Kiện Bỏ Phiếu</span> Đã ủy quyền quyền biểu quyết thành công.`
        }
      </div>

      ${
        isLive && web3State.isConnected && !isDelegated
          ? `
        <div style="margin-top:10px;">
          <button id="btn-live-delegate" class="gov-btn gov-btn-primary gov-btn-sm">
            Ký Giao Dịch Delegate Ngay Trên MetaMask (Kích Hoạt Quyền Vote)
          </button>
        </div>
      `
          : ''
      }
    </div>

    <!-- DANH SÁCH ĐỀ XUẤT -->
    <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:20px;">
      ${state.proposals
        .map((p) => {
          const quorumMet = p.forVotes >= p.quorum;
          const hasVoted = p.voters.has(isLive ? web3State.account : state.currentPersona.id);
          const quorumPercent = Math.min(100, (p.forVotes / p.quorum) * 100);
          const timelockReady = p.eta > 0 && p.eta <= Date.now();
          const statusColor: Record<string, string> = {
            Active: 'info',
            Succeeded: 'warning',
            Queued: 'warning',
            Executed: 'success',
            Canceled: 'danger',
            Pending: 'secondary',
          };

          return `
        <div class="gov-card" style="margin-bottom:0;">
          <div class="gov-card-header">
            <div>
              <div style="font-size:0.78rem;color:var(--gov-text-muted);">${p.id} &bull; Người tạo: ${p.proposer}</div>
              <div class="gov-card-title" style="margin-top:2px;">${p.title}</div>
            </div>
            <span class="gov-badge ${statusColor[p.status] ?? 'secondary'}">${p.status}</span>
          </div>
          <p style="font-size:0.83rem;color:var(--gov-text-body);margin-bottom:12px;">${p.description}</p>

          <div style="background:var(--gov-secondary-bg);border:1px solid var(--gov-border);padding:12px;border-radius:var(--radius-sm);margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">
              <span>Phiếu Thuận: <strong>${p.forVotes.toLocaleString()} SCT</strong></span>
              <span>Yêu cầu Quorum: <strong>${p.quorum.toLocaleString()} SCT</strong> (${quorumMet ? 'Đạt' : 'Chưa đạt'})</span>
            </div>
            <div class="gov-progress">
              <div class="gov-progress-fill ${quorumMet ? 'success' : ''}" style="width:${quorumPercent}%"></div>
            </div>
          </div>

          <div class="condition-box" style="margin-bottom:12px;">
            ${
              p.status === 'Active'
                ? `
              <strong>Điều kiện Bỏ Phiếu:</strong> Có token SCT và đã delegate trước Snapshot (SEC-07). Chưa bỏ phiếu đề xuất này.
              ${hasVoted ? ' &mdash; <span class="condition-tag ok">Bạn đã bỏ phiếu</span>' : ''}
            `
                : ''
            }
            ${
              p.status === 'Succeeded'
                ? `
              <strong>Điều kiện Đưa Vào Timelock:</strong> Đề xuất đã qua thời gian biểu quyết và đạt tối thiểu 4% Quorum.
            `
                : ''
            }
            ${
              p.status === 'Queued'
                ? `
              <strong>Điều kiện Thực Thi (Execute):</strong>
              Đã đủ 48 giờ hoãn (ETA); Kho bạc không bị Pause (SEC-05); Chi tiêu ngày không vượt 10 ETH (SEC-04).
              ${!timelockReady ? '<br/><span class="condition-tag required">Chưa Hết 48h</span>' : '<br/><span class="condition-tag ok">Đã Đủ 48h Timelock</span>'}
            `
                : ''
            }
            ${
              p.status === 'Executed'
                ? `<strong>Trạng thái:</strong> Đã thực thi thành công. Thử thực thi lần 2 sẽ bị Revert (Chống Replay - SEC-10).`
                : ''
            }
            ${
              p.status === 'Canceled'
                ? `<strong>Trạng thái:</strong> Bị hủy bởi quyền Veto của Hội Đồng Bảo Mật trong Timelock (SEC-08).`
                : ''
            }
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
            ${
              p.status === 'Active'
                ? `
              <button class="gov-btn gov-btn-primary gov-btn-sm btn-vote" data-id="${p.id}"
                ${hasVoted || !isDelegated ? 'disabled' : ''}>
                Bỏ Phiếu Thuận
              </button>
              <button class="gov-btn gov-btn-secondary gov-btn-sm btn-fast-vote" data-id="${p.id}">
                Giả Lập Kết Thúc Bỏ Phiếu (Passed)
              </button>
            `
                : ''
            }
            ${
              p.status === 'Succeeded'
                ? `
              <button class="gov-btn gov-btn-primary gov-btn-sm btn-queue" data-id="${p.id}">
                Đưa Vào Hàng Đợi Timelock (48 Giờ)
              </button>
            `
                : ''
            }
            ${
              p.status === 'Queued'
                ? `
              ${
                !timelockReady
                  ? `
                <button class="gov-btn gov-btn-secondary gov-btn-sm btn-fast-timelock" data-id="${p.id}">
                  Bỏ Qua 48h (Sẵn Sàng)
                </button>
              `
                  : ''
              }
              <button class="gov-btn gov-btn-danger gov-btn-sm btn-veto" data-id="${p.id}"
                ${!isSecurityCouncil ? 'disabled' : ''}>
                Security Council Veto (Hủy Bỏ)
              </button>
              <button class="gov-btn gov-btn-primary gov-btn-sm btn-execute" data-id="${p.id}"
                ${!timelockReady ? 'disabled' : ''}>
                Thực Thi Đề Xuất (Execute)
              </button>
            `
                : ''
            }
            ${
              p.status === 'Executed'
                ? `
              <button class="gov-btn gov-btn-secondary gov-btn-sm btn-test-replay" data-id="${p.id}">
                Thử Tấn Công Replay (SEC-10)
              </button>
            `
                : ''
            }
          </div>
        </div>`;
        })
        .join('')}
    </div>

    <!-- MODAL TẠO ĐỀ XUẤT -->
    <div id="proposal-modal" class="modal-overlay" style="display:none;">
      <div class="modal-box">
        <div class="modal-header">
          <h3>Tạo Đề Xuất Mua NFT (propose)</h3>
          <button id="btn-close-modal" class="gov-btn gov-btn-secondary gov-btn-sm">Đóng</button>
        </div>
        <div class="modal-body">
          <div class="condition-box warning">
            <strong>Ràng buộc điều kiện (SEC-09):</strong><br/>
            Tổng giá trần <code>maxPrice</code> của toàn bộ calldata không được vượt quá <strong>8.0 ETH</strong>.
            Nếu vượt mức này, Governor sẽ từ chối giao dịch (Revert).
          </div>
          <div class="form-group">
            <label class="form-label">Tiêu đề đề xuất</label>
            <input id="prop-title" class="form-control" placeholder="VD: Mua Bored Android #1337 cho quỹ lưu ký" />
          </div>
          <div class="form-group">
            <label class="form-label">Tác phẩm muốn mua</label>
            <select id="prop-nft-select" class="form-control">
              ${state.marketNFTs
                .map((n) => `<option value="${n.id}">${n.name} &mdash; Giá: ${n.price} ETH</option>`)
                .join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Giá trần maxPrice (ETH)</label>
            <input id="prop-maxprice" class="form-control" type="number" step="0.5" value="3.5" />
          </div>
          <div id="prop-warning" class="gov-alert danger" style="display:none;">
            Cảnh báo: Giá trần vượt 8.0 ETH! Hợp đồng Governor sẽ Revert (SEC-09).
          </div>
        </div>
        <div class="modal-footer">
          <button id="btn-close-modal-2" class="gov-btn gov-btn-secondary">Hủy</button>
          <button id="btn-submit-proposal" class="gov-btn gov-btn-primary">Gửi Đề Xuất</button>
        </div>
      </div>
    </div>
  `;
}

function attachGovernanceEvents() {
  const isLive = appMode === 'live';
  const modal = document.getElementById('proposal-modal');

  document.getElementById('btn-open-proposal-modal')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'flex';
  });
  document.getElementById('btn-close-modal')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });
  document.getElementById('btn-close-modal-2')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });

  document.getElementById('btn-live-delegate')?.addEventListener('click', async () => {
    try {
      showToast('Đang gửi giao dịch Delegate lên ví MetaMask...', 'success');
      const txHash = await web3Service.liveDelegate();
      confetti({ particleCount: 60, spread: 50 });
      saveLog('success', `[On-Chain] Đã delegate quyền biểu quyết thành công. Tx: ${txHash}`);
      showToast('Delegate thành công! Quyền biểu quyết đã được kích hoạt.', 'success');
      renderTabContent();
    } catch (err: any) {
      const parsed = web3Service.parseContractError(err);
      saveLog('error', `[On-Chain] Delegate thất bại: ${parsed}`);
      showToast(`Delegate thất bại: ${parsed}`, 'error');
    }
  });

  const maxPriceInput = document.getElementById('prop-maxprice') as HTMLInputElement;
  const warning = document.getElementById('prop-warning');
  maxPriceInput?.addEventListener('input', () => {
    if (warning) warning.style.display = parseFloat(maxPriceInput.value) > state.maxPerProposalLimit ? 'block' : 'none';
  });

  document.getElementById('btn-submit-proposal')?.addEventListener('click', async () => {
    const title = (document.getElementById('prop-title') as HTMLInputElement).value.trim();
    const maxPrice = parseFloat(maxPriceInput.value);

    if (!title) {
      showToast('Vui lòng nhập tiêu đề đề xuất!', 'error');
      return;
    }

    if (maxPrice > state.maxPerProposalLimit) {
      saveLog('error', `Governor Revert: maxPrice ${maxPrice} ETH > 8.0 ETH (SEC-09).`);
      showToast('Điều kiện chưa đạt: maxPrice vượt quá 8 ETH (SEC-09)', 'error');
      return;
    }

    if (isLive) {
      if (!web3State.isConnected) {
        showToast('Điều kiện chưa đạt: Vui lòng kết nối ví MetaMask!', 'error');
        return;
      }
      try {
        showToast('Đang gửi đề xuất lên Governor contract...', 'success');
        const addresses = getContractAddresses();
        const targets = [addresses.NFTTreasury];
        const values = [0n];
        const calldatas = ['0x'];
        const description = `${title} | maxPrice: ${maxPrice} ETH`;

        const res = await web3Service.livePropose(targets, values, calldatas, description);
        if (modal) modal.style.display = 'none';
        confetti({ particleCount: 60, spread: 60 });
        saveLog('success', `[On-Chain] Đã tạo đề xuất thành công. Tx: ${res.txHash}`);
        showToast('Tạo đề xuất on-chain thành công!', 'success');
      } catch (err: any) {
        const parsed = web3Service.parseContractError(err);
        saveLog('error', `[On-Chain] Tạo đề xuất thất bại: ${parsed}`);
        showToast(`Thất bại: ${parsed}`, 'error');
        return;
      }
    }

    const newProp: Proposal = {
      id: `PROP-0${state.proposals.length + 1}`,
      title,
      proposer: isLive ? `${web3State.account.slice(0, 6)}...` : state.currentPersona.name,
      targets: ['NFTTreasury'],
      values: ['0 ETH'],
      calldatas: [`executeBuyNFT(SafeAdapter, ..., maxPrice: ${maxPrice} ETH)`],
      maxPriceSum: maxPrice,
      description: `Đề xuất chi tiêu tối đa ${maxPrice} ETH mua tác phẩm cho quỹ lưu ký.`,
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
    saveLog('success', `Đã tạo thành công đề xuất ${newProp.id}.`);
    showToast(`Đã tạo đề xuất ${newProp.id}!`, 'success');
    renderTabContent();
  });

  document.querySelectorAll('.btn-vote').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      const prop = state.proposals.find((p) => p.id === id);
      if (!prop) return;

      const isDelegated = isLive ? web3State.isDelegated : state.currentPersona.isDelegated;
      if (!isDelegated) {
        saveLog('error', `Bỏ phiếu bị từ chối: Chưa delegate trước Snapshot (SEC-07).`);
        showToast('Điều kiện chưa đạt: Chưa delegate trước Snapshot (SEC-07)', 'error');
        return;
      }

      prop.forVotes += isLive ? 50000 : 100000;
      prop.voters.add(isLive ? web3State.account : state.currentPersona.id);
      saveLog('success', `Đã bỏ phiếu THUẬN cho ${prop.id}.`);
      showToast(`Đã bỏ phiếu cho ${prop.id}`, 'success');
      renderTabContent();
    });
  });

  document.querySelectorAll('.btn-fast-vote').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const prop = state.proposals.find((p) => p.id === (e.currentTarget as HTMLElement).dataset.id);
      if (prop) {
        prop.status = 'Succeeded';
        saveLog('info', `Giai đoạn biểu quyết kết thúc. ${prop.id} đạt Quorum -> Succeeded.`);
        showToast(`${prop.id} đã thông qua biểu quyết!`, 'success');
        renderTabContent();
      }
    });
  });

  document.querySelectorAll('.btn-queue').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const prop = state.proposals.find((p) => p.id === (e.currentTarget as HTMLElement).dataset.id);
      if (prop) {
        prop.status = 'Queued';
        prop.eta = Date.now() + 48 * 3600 * 1000;
        saveLog('info', `${prop.id} đã vào TimelockController. Đếm ngược 48 giờ bắt đầu.`);
        showToast(`${prop.id} đã vào Timelock 48h`, 'success');
        renderTabContent();
      }
    });
  });

  document.querySelectorAll('.btn-fast-timelock').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const prop = state.proposals.find((p) => p.id === (e.currentTarget as HTMLElement).dataset.id);
      if (prop) {
        prop.eta = Date.now() - 1000;
        saveLog('info', `Giả lập thời gian: 48h Timelock hoàn tất. ${prop.id} sẵn sàng thực thi.`);
        showToast('Đã qua 48h — Đề xuất sẵn sàng thực thi', 'success');
        renderTabContent();
      }
    });
  });

  document.querySelectorAll('.btn-veto').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const prop = state.proposals.find((p) => p.id === (e.currentTarget as HTMLElement).dataset.id);
      if (!prop) return;

      if (!isLive && state.currentPersona.id !== 'securityCouncil') {
        saveLog('error', `${state.currentPersona.name} không có quyền Veto trong Timelock.`);
        showToast('Điều kiện chưa đạt: Chỉ Security Council mới có quyền Veto (SEC-08)', 'error');
        return;
      }

      prop.status = 'Canceled';
      saveLog('error', `Security Council đã VETO và hủy bỏ ${prop.id} (SEC-08).`);
      showToast(`Đã VETO thành công ${prop.id}`, 'success');
      renderTabContent();
    });
  });

  document.querySelectorAll('.btn-execute').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const prop = state.proposals.find((p) => p.id === (e.currentTarget as HTMLElement).dataset.id);
      if (!prop) return;

      const isPaused = isLive ? web3State.isPaused : state.isPaused;
      if (isPaused) {
        showToast('Điều kiện chưa đạt: Kho bạc đang bị Pause (SEC-05)', 'error');
        return;
      }
      if (prop.eta > Date.now()) {
        showToast('Điều kiện chưa đạt: Chưa trải qua đủ 48 giờ Timelock!', 'error');
        return;
      }

      const actualPrice = 2.0;
      if (state.dailySpent + actualPrice > state.dailySpendingLimit) {
        showToast('Điều kiện chưa đạt: Vượt hạn mức chi tiêu ngày 10 ETH (SEC-04)', 'error');
        return;
      }

      state.treasuryBalance -= actualPrice;
      state.dailySpent += actualPrice;
      prop.status = 'Executed';

      const item = state.marketNFTs.find((n) => n.id === 777n);
      if (item) {
        state.vaultNFTs.push({ ...item, acquiredAt: 'Thực thi Timelock' });
        state.marketNFTs = state.marketNFTs.filter((n) => n.id !== 777n);
      }

      confetti({ particleCount: 70, spread: 60 });
      saveLog('success', `Thực thi thành công ${prop.id}. Kho bạc chi 2.0 ETH, NFT đã vào kho.`);
      showToast(`Thực thi thành công ${prop.id}!`, 'success');
      renderTabContent();
    });
  });

  document.querySelectorAll('.btn-test-replay').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      saveLog('error', `Tấn công Replay trên ${id}: Governor từ chối vì đề xuất đã Executed (SEC-10).`);
      showToast(`Chống Replay thành công: execute() lần 2 bị Revert (SEC-10)`, 'error');
    });
  });
}

// -------------------------------------------------------------------------------------------------
// 4. SÀN GIAO DỊCH NFT (MARKETPLACE)
// -------------------------------------------------------------------------------------------------
function getMarketHtml() {
  const isLive = appMode === 'live';
  const dailySpent = isLive ? web3State.dailySpent : state.dailySpent.toFixed(1);
  const dailyLimit = isLive ? web3State.dailySpendingLimit : state.dailySpendingLimit.toFixed(1);
  const maxPerCall = isLive ? web3State.maxPerCallLimit : state.maxPerCallLimit.toFixed(1);
  const isPaused = isLive ? web3State.isPaused : state.isPaused;

  const spentNum = parseFloat(dailySpent) || 0;
  const limitNum = parseFloat(dailyLimit) || 10;

  return `
    <div class="gov-card">
      <div class="gov-card-header">
        <div>
          <div class="gov-card-title">Sàn Giao Dịch &amp; Mua Bán NFT (SafeMarketplaceAdapter)</div>
          <div class="gov-card-subtitle">
            Giao dịch qua Adapter được phê duyệt. Tiền thừa bắt buộc phải hoàn trả về Kho trong cùng transaction (SEC-01).
          </div>
        </div>
        <span class="gov-badge ${isPaused ? 'danger' : 'success'}">
          ${isPaused ? 'GIAO DỊCH TẠM DỪNG' : 'SẴN SÀNG'}
        </span>
      </div>

      <div class="gov-grid-4">
        <div class="stat-card">
          <div class="stat-label">Đã Chi Hôm Nay</div>
          <div class="stat-value">${dailySpent} <span class="stat-unit">ETH</span></div>
          <div class="stat-hint">Hạn mức: ${dailyLimit} ETH/ngày</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Hạn Ngạch Còn Lại</div>
          <div class="stat-value">${(limitNum - spentNum).toFixed(1)} <span class="stat-unit">ETH</span></div>
          <div class="stat-hint">Reset mỗi 24 giờ (SEC-04)</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tác Phẩm Niêm Yết</div>
          <div class="stat-value">${state.marketNFTs.length} <span class="stat-unit">Tác Phẩm</span></div>
          <div class="stat-hint">Sẵn sàng để mua</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Trần Gửi / Lệnh Mua</div>
          <div class="stat-value">${maxPerCall} <span class="stat-unit">ETH</span></div>
          <div class="stat-hint">maxPrice tối đa của lệnh</div>
        </div>
      </div>

      <div class="condition-box ${!isPaused ? 'met' : 'warning'}">
        <strong>Điều kiện thực thi lệnh Mua qua Adapter:</strong><br/>
        • Kho bạc không ở trạng thái Emergency Pause (SEC-05).<br/>
        • Chi phí mua + tiền đã chi trong ngày không vượt quá ${dailyLimit} ETH (SEC-04).<br/>
        • Số tiền thừa giữa trần gửi (${maxPerCall} ETH) và giá thực tế bắt buộc phải hoàn trả nguyên vẹn về Kho Bạc (SEC-01).
      </div>
    </div>

    ${
      state.marketNFTs.length === 0
        ? `<div class="gov-card" style="text-align:center;padding:32px;color:var(--gov-text-muted);">Tất cả NFT đã được Kho Bạc mua hết.</div>`
        : `
      <div class="nft-grid">
        ${state.marketNFTs
          .map((nft) => {
            const price = parseFloat(nft.price);
            const canAffordDaily = spentNum + price <= limitNum;
            const disabled = isPaused || !canAffordDaily;

            return `
            <div class="nft-card">
              <img src="${nft.image}" alt="${nft.name}" />
              <div class="nft-card-body">
                <div class="nft-card-title">${nft.name}</div>
                <div class="nft-card-meta">${nft.collection}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="font-size:0.8rem;color:var(--gov-text-muted);">${nft.owner}</span>
                  <strong style="color:var(--gov-text-title);">${nft.price} ETH</strong>
                </div>
                <div style="background:var(--gov-secondary-bg);padding:6px 10px;border-radius:var(--radius-sm);font-size:0.75rem;margin-bottom:10px;">
                  Gửi trần: <strong>${maxPerCall} ETH</strong> &bull; Hoàn trả: <strong>${(parseFloat(maxPerCall) - price).toFixed(1)} ETH</strong>
                </div>
                <button
                  class="gov-btn gov-btn-primary btn-quick-buy"
                  style="width:100%"
                  data-id="${nft.id}"
                  data-price="${nft.price}"
                  data-name="${nft.name}"
                  ${disabled ? 'disabled' : ''}
                >
                  Mua Qua SafeAdapter
                </button>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    `
    }
  `;
}

function attachMarketEvents() {
  const isLive = appMode === 'live';

  document.querySelectorAll('.btn-quick-buy').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const id = BigInt(target.dataset.id!);
      const price = parseFloat(target.dataset.price!);
      const name = target.dataset.name!;

      const isPaused = isLive ? web3State.isPaused : state.isPaused;
      if (isPaused) {
        showToast('Điều kiện chưa đạt: Kho bạc đang bị Pause (SEC-05)!', 'error');
        return;
      }

      const limit = isLive ? parseFloat(web3State.dailySpendingLimit) : state.dailySpendingLimit;
      const spent = isLive ? parseFloat(web3State.dailySpent) : state.dailySpent;

      if (spent + price > limit) {
        saveLog('error', `Từ chối mua ${name}: Vượt hạn mức chi tiêu ngày ${limit} ETH (SEC-04).`);
        showToast('Điều kiện chưa đạt: Vượt hạn mức ngày (SEC-04)', 'error');
        return;
      }

      const maxCall = isLive ? parseFloat(web3State.maxPerCallLimit) : state.maxPerCallLimit;
      const excessRefund = maxCall - price;
      state.treasuryBalance -= price;
      state.dailySpent += price;

      const item = state.marketNFTs.find((n) => n.id === id);
      if (item) {
        state.vaultNFTs.push({ ...item, acquiredAt: new Date().toLocaleTimeString('vi-VN') });
        state.marketNFTs = state.marketNFTs.filter((n) => n.id !== id);
      }

      confetti({ particleCount: 60, spread: 50 });
      saveLog('success', `Đã mua ${name} (${price} ETH). Hoàn trả ${excessRefund.toFixed(1)} ETH về Kho (SEC-01).`);
      showToast(`Mua ${name} thành công! Hoàn trả ${excessRefund.toFixed(1)} ETH.`, 'success');
      renderTabContent();
    });
  });
}

// -------------------------------------------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  renderApp();
  web3Service.syncAll().catch(() => {});
});
