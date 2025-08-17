// Purchase Management System - Enhanced JavaScript


const db = firebase.firestore();

const storage = firebase.storage();

// Google sign-in setup
const provider = new firebase.auth.GoogleAuthProvider();
const allowedEmail = "umiyabuilder111@gmail.com"; // <-- replace with your Gmail

// UI elements
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userEmailEl = document.getElementById("user-email");
const appContent = document.getElementById("app-content");

// Login action
if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    firebase.auth().signInWithPopup(provider).catch(err => {
      console.error("Login failed:", err);
      alert("Login failed: " + err.message);
    });
  });
}

// Logout action
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    firebase.auth().signOut();
  });
}

// Auth state listener
firebase.auth().onAuthStateChanged(user => {
  if (user && user.email) {
    if (user.email.toLowerCase() === allowedEmail.toLowerCase()) {
      // ✅ Authorized user
      console.log("Authorized user:", user.email);

      if (loginBtn) loginBtn.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "inline-block";
      if (userEmailEl) {
        userEmailEl.style.display = "inline-block";
        userEmailEl.textContent = user.email;
      }
      if (appContent) appContent.style.display = "block";

      // Load Firestore data now
      loadPurchases();
      loadPayments();
      updateDashboard();

    } else {
      // ❌ Wrong account
      alert("Access denied. Please log in with your authorized account.");
      firebase.auth().signOut();
    }
  } else {
    // ❌ Not signed in
    console.log("Not signed in");
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (userEmailEl) userEmailEl.style.display = "none";
    if (appContent) appContent.style.display = "none";

    // Clear local state + UI
    appState.purchases = [];
    appState.payments = [];
    renderAllTables();
    updateDashboard();
  }
});


// Application State
let appState = {
    suppliers: [],
    purchases: [],
    payments: [],
    currentSort: { field: null, direction: 'asc' },
    paymentSort: { field: null, direction: 'asc' },
    filters: {
        search: '',
        status: '',
        supplier: ''
    },
    paymentFilters: {
        search: '',
        dateFrom: '',
        dateTo: ''
    },
    photoFilters: {
        search: ''
    },
    currentPhoto: 0,
    currentPhotoGroup: null,
    cloudSync: {
        connected: true,
        lastSync: new Date(),
        pendingUploads: 2,
        totalFiles: 156,
        storageUsed: 2.3,
        storageLimit: 15
    }
};

// Global variable for uploaded photos
let currentUploadedPhotos = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    initializeData();        // still clears state (empty arrays)
    // loadPurchases();       // removed — we call it after auth
    // loadPayments();        // removed — called after auth
    setupEventListeners();
    showPage('dashboard');
    updateDashboard();
    updateSyncStatus();
    setInterval(updateSyncStatus, 60000);
});


// Initialize sample data with Indian suppliers and currency
function initializeData() {
  appState.suppliers = [];
  appState.purchases = [];
  appState.payments = [];
}


// Setup event listeners with improved error handling
function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Add a small delay to ensure all elements are rendered
    setTimeout(() => {
        // Navigation event listeners - both desktop and mobile
        const navElements = document.querySelectorAll('[data-page]');
        console.log('Found nav elements:', navElements.length);
        
        navElements.forEach(element => {
            element.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const page = this.getAttribute('data-page');
                console.log('Navigation clicked:', page);
                if (page) {
                    showPage(page);
                }
            });
        });

        // Filter event listeners
        setupFilterListeners();
        
        // Set today's date for date inputs
        setDefaultDates();
        
        console.log('Event listeners setup complete');
    }, 200);
}

function setupFilterListeners() {
    // Search and filters for purchases
    const searchPurchases = document.getElementById('search-purchases');
    if (searchPurchases) {
        searchPurchases.addEventListener('input', (e) => {
            appState.filters.search = e.target.value;
            renderPurchasesTable();
        });
    }

    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            appState.filters.status = e.target.value;
            renderPurchasesTable();
        });
    }

    const supplierFilter = document.getElementById('supplier-filter');
    if (supplierFilter) {
        supplierFilter.addEventListener('change', (e) => {
            appState.filters.supplier = e.target.value;
            renderPurchasesTable();
        });
    }

    // Payment filters
    const searchPayments = document.getElementById('search-payments');
    if (searchPayments) {
        searchPayments.addEventListener('input', (e) => {
            appState.paymentFilters.search = e.target.value;
            renderPaymentHistoryTable();
        });
    }

    const dateFrom = document.getElementById('date-from');
    if (dateFrom) {
        dateFrom.addEventListener('change', (e) => {
            appState.paymentFilters.dateFrom = e.target.value;
            renderPaymentHistoryTable();
        });
    }

    const dateTo = document.getElementById('date-to');
    if (dateTo) {
        dateTo.addEventListener('change', (e) => {
            appState.paymentFilters.dateTo = e.target.value;
            renderPaymentHistoryTable();
        });
    }

    // Photo search
    const searchPhotos = document.getElementById('search-photos');
    if (searchPhotos) {
        searchPhotos.addEventListener('input', (e) => {
            appState.photoFilters.search = e.target.value;
            renderPhotoGallery();
        });
    }

    // Photo upload
    const billPhotos = document.getElementById('bill-photos');
    if (billPhotos) {
        billPhotos.addEventListener('change', handlePhotoUpload);
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    
    const purchaseDate = document.getElementById('purchase-date');
    const billDate = document.getElementById('bill-date');
    const paymentDateInput = document.getElementById('payment-date-input');
    
    if (purchaseDate) purchaseDate.value = today;
    if (billDate) billDate.value = today;
    if (paymentDateInput) paymentDateInput.value = today;
}

// Navigation functions
function showPage(pageName) {
    console.log('Showing page:', pageName);
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Show selected page
    const targetPage = document.getElementById(pageName + '-page');
    if (targetPage) {
        targetPage.classList.add('active');
        console.log('Page activated:', pageName);
    } else {
        console.error('Page not found:', pageName + '-page');
    }

    // Update navigation active states
    document.querySelectorAll('[data-page]').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelectorAll(`[data-page="${pageName}"]`).forEach(link => {
        link.classList.add('active');
    });

    // Load page-specific content
    switch(pageName) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'purchases':
            renderPurchasesTable();
            break;
        case 'payments':
            renderPaymentHistoryTable();
            break;
        case 'photos':
            renderPhotoGallery();
            break;
        case 'suppliers':
            renderSuppliersGrid();
            break;
    }
}

// Dashboard functions
function updateDashboard() {
    const stats = calculateStats();
    
    const totalBillsEl = document.getElementById('total-bills');
    const totalPaidEl = document.getElementById('total-paid');
    const totalOutstandingEl = document.getElementById('total-outstanding');
    const overdueBillsEl = document.getElementById('overdue-bills');
    
    if (totalBillsEl) totalBillsEl.textContent = stats.totalBills;
    if (totalPaidEl) totalPaidEl.textContent = formatCurrency(stats.totalPaid);
    if (totalOutstandingEl) totalOutstandingEl.textContent = formatCurrency(stats.totalOutstanding);
    if (overdueBillsEl) overdueBillsEl.textContent = stats.overdueBills;

    renderRecentActivities();
    renderRecentPurchases();
}

function calculateStats() {
    const totalBills = appState.purchases.length;
    const totalPaid = appState.purchases.reduce((sum, p) => sum + p.amountPaid, 0);
    const totalBillAmount = appState.purchases.reduce((sum, p) => sum + p.billAmount, 0);
    const totalOutstanding = totalBillAmount - totalPaid;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const overdueBills = appState.purchases.filter(p => 
        new Date(p.billDate) < thirtyDaysAgo && p.status !== 'Fully Paid'
    ).length;

    return {
        totalBills,
        totalPaid,
        totalOutstanding,
        overdueBills
    };
}

function renderRecentActivities() {
    const activities = [];
    
    // Add recent payments
    appState.payments.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).forEach(payment => {
        activities.push({
            title: `Payment Added - ${payment.billNumber}`,
            description: `₹${payment.amount.toLocaleString()} paid to ${payment.supplier}`,
            time: formatTimeAgo(payment.date),
            type: 'payment',
            date: payment.date
        });
    });

    // Add recent purchases
    appState.purchases.slice().sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate)).slice(0, 3).forEach(purchase => {
        activities.push({
            title: `New Purchase - ${purchase.billNumber}`,
            description: `${purchase.item} from ${purchase.supplierName}`,
            time: formatTimeAgo(purchase.purchaseDate),
            type: 'purchase',
            date: purchase.purchaseDate
        });
    });

    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const activityList = document.getElementById('recent-activities');
    if (activityList) {
        activityList.innerHTML = activities.slice(0, 8).map(activity => `
            <div class="activity-item">
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-description">${activity.description}</div>
                </div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `).join('');
    }
}

function renderRecentPurchases() {
    const recentPurchases = appState.purchases
        .slice()
        .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
        .slice(0, 10);

    const tbody = document.getElementById('recent-purchases');
    if (tbody) {
        tbody.innerHTML = recentPurchases.map(purchase => `
            <tr>
                <td class="font-mono">${purchase.billNumber}</td>
                <td>${purchase.supplierName}</td>
                <td class="text-right">${formatCurrency(purchase.billAmount)}</td>
                <td>${getStatusBadge(purchase.status)}</td>
            </tr>
        `).join('');
    }
}

// Purchase management functions
function renderPurchasesTable() {
    let filteredPurchases = appState.purchases.slice();

    if (appState.filters.search) {
        const search = appState.filters.search.toLowerCase();
        filteredPurchases = filteredPurchases.filter(p =>
            p.billNumber.toLowerCase().includes(search) ||
            p.supplierName.toLowerCase().includes(search) ||
            p.item.toLowerCase().includes(search)
        );
    }

    if (appState.filters.status) {
        filteredPurchases = filteredPurchases.filter(p => p.status === appState.filters.status);
    }

    if (appState.filters.supplier) {
        const supplierName = appState.suppliers.find(s => s.id == appState.filters.supplier)?.name;
        if (supplierName) {
            filteredPurchases = filteredPurchases.filter(p => p.supplierName === supplierName);
        }
    }

    const tbody = document.getElementById('purchases-table');
    if (tbody) {
        tbody.innerHTML = filteredPurchases.map(purchase => `
            <tr>
                <td class="font-mono">${purchase.billNumber}</td>
                <td>${purchase.supplierName}</td>
                <td class="desktop-only">${purchase.item}</td>
                <td>${formatDate(purchase.purchaseDate)}</td>
                <td class="text-right">${formatCurrency(purchase.billAmount)}</td>
                <td class="desktop-only text-right">${formatCurrency(purchase.amountPaid)}</td>
                <td>${getStatusBadge(purchase.status)}</td>
                <td>
                    <div class="action-buttons">
                        ${purchase.status !== 'Fully Paid' ? 
                            `<button class="btn btn--sm btn--success" onclick="showAddPaymentModal(${purchase.id})">
                                Add Payment
                            </button>` : 
                            '<span class="text-center">Complete</span>'
                        }
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

// Payment History functions
function renderPaymentHistoryTable() {
    let filteredPayments = appState.payments.slice();

    if (appState.paymentFilters.search) {
        const search = appState.paymentFilters.search.toLowerCase();
        filteredPayments = filteredPayments.filter(p =>
            p.billNumber.toLowerCase().includes(search) ||
            p.supplier.toLowerCase().includes(search)
        );
    }

    if (appState.paymentFilters.dateFrom) {
        filteredPayments = filteredPayments.filter(p => p.date >= appState.paymentFilters.dateFrom);
    }

    if (appState.paymentFilters.dateTo) {
        filteredPayments = filteredPayments.filter(p => p.date <= appState.paymentFilters.dateTo);
    }

    filteredPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById('payment-history-table');
    if (tbody) {
        tbody.innerHTML = filteredPayments.map(payment => `
            <tr>
                <td>${formatDate(payment.date)}</td>
                <td class="font-mono">${payment.billNumber}</td>
                <td>${payment.supplier}</td>
                <td class="text-right">${formatCurrency(payment.amount)}</td>
                <td class="desktop-only">${payment.method}</td>
                <td>
                    <span class="status-badge ${payment.type === 'Full Payment' ? 'status-badge--paid' : 'status-badge--partial'}">
                        ${payment.type}
                    </span>
                </td>
            </tr>
        `).join('');
    }
}

// Photo Gallery functions
function renderPhotoGallery() {
    let filteredPurchases = appState.purchases.filter(p => p.photos && p.photos.length > 0);

    if (appState.photoFilters.search) {
        const search = appState.photoFilters.search.toLowerCase();
        filteredPurchases = filteredPurchases.filter(p =>
            p.billNumber.toLowerCase().includes(search) ||
            p.supplierName.toLowerCase().includes(search)
        );
    }

    const gallery = document.getElementById('photo-gallery');
    if (gallery) {
        gallery.innerHTML = filteredPurchases.map(purchase => `
            <div class="photo-group">
                <div class="photo-group-header">
                    <div class="photo-group-title">${purchase.billNumber}</div>
                    <div class="photo-group-info">${purchase.supplierName} • ${purchase.photos.length} photos</div>
                </div>
                <div class="photo-grid">
                    ${purchase.photos.map(photo => `
                        <div class="photo-item" onclick="showPhotoLightbox('${purchase.id}', '${photo.id}')">
                            <img src="${photo.data}" alt="${photo.name}">
                            <div class="photo-overlay"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }
}

function showPhotoLightbox(purchaseId, photoId) {
    const purchase = appState.purchases.find(p => p.id == purchaseId);
    if (!purchase) return;

    const photoIndex = purchase.photos.findIndex(p => p.id === photoId);
    if (photoIndex === -1) return;

    appState.currentPhotoGroup = purchase;
    appState.currentPhoto = photoIndex;

    updateLightboxContent();
    const lightbox = document.getElementById('photo-lightbox');
    if (lightbox) {
        lightbox.classList.remove('hidden');
    }
}

function updateLightboxContent() {
    const purchase = appState.currentPhotoGroup;
    const photo = purchase.photos[appState.currentPhoto];

    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxDetails = document.getElementById('lightbox-details');

    if (lightboxImage) lightboxImage.src = photo.data;
    if (lightboxTitle) lightboxTitle.textContent = `${purchase.billNumber} - ${photo.name}`;
    if (lightboxDetails) lightboxDetails.textContent = 
        `${purchase.supplierName} • Uploaded: ${formatDate(photo.uploadDate)} • Size: ${photo.size}`;
}

function hidePhotoLightbox() {
    const lightbox = document.getElementById('photo-lightbox');
    if (lightbox) {
        lightbox.classList.add('hidden');
    }
    appState.currentPhotoGroup = null;
    appState.currentPhoto = 0;
}

function previousPhoto() {
    if (!appState.currentPhotoGroup) return;
    
    appState.currentPhoto = appState.currentPhoto > 0 ? 
        appState.currentPhoto - 1 : 
        appState.currentPhotoGroup.photos.length - 1;
    
    updateLightboxContent();
}

function nextPhoto() {
    if (!appState.currentPhotoGroup) return;
    
    appState.currentPhoto = (appState.currentPhoto + 1) % appState.currentPhotoGroup.photos.length;
    updateLightboxContent();
}

// Supplier management functions
function renderSuppliersGrid() {
    const grid = document.getElementById('suppliers-grid');
    if (grid) {
        grid.innerHTML = appState.suppliers.map(supplier => {
            const supplierStats = getSupplierStats(supplier.id);
            return `
                <div class="supplier-card">
                    <div class="supplier-header">
                        <h3 class="supplier-name">${supplier.name}</h3>
                    </div>
                    <div class="supplier-details">
                        <div class="supplier-contact">${supplier.contact}</div>
                        <div class="supplier-contact">${supplier.phone}</div>
                        <div class="supplier-contact">${supplier.address}</div>
                    </div>
                    <div class="supplier-stats">
                        <div class="supplier-stat">
                            <div class="supplier-stat-value">${supplierStats.totalPurchases}</div>
                            <div class="supplier-stat-label">Purchases</div>
                        </div>
                        <div class="supplier-stat">
                            <div class="supplier-stat-value">${formatCurrency(supplierStats.totalAmount)}</div>
                            <div class="supplier-stat-label">Total Amount</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function getSupplierStats(supplierId) {
    const supplierPurchases = appState.purchases.filter(p => p.supplierId === supplierId);
    return {
        totalPurchases: supplierPurchases.length,
        totalAmount: supplierPurchases.reduce((sum, p) => sum + p.billAmount, 0)
    };
}

// Google Drive sync simulation
function updateSyncStatus() {
  const statusEl = document.getElementById("sync-status");
  if (!statusEl) return;

  // Use Firestore connection state
  const state = firebase.firestore()._delegate._onlineComponentsProvider._onlineStateTracker.onlineState;

  if (state === "Online") {
    statusEl.innerText = "✅ Synced with Cloud";
    statusEl.style.color = "green";
  } else {
    statusEl.innerText = "⚠️ Offline - Changes will sync when back online";
    statusEl.style.color = "orange";
  }
}


function simulateSync() {
    document.querySelectorAll('.sync-indicator').forEach(indicator => {
        indicator.className = 'sync-indicator syncing';
    });
    
    document.querySelectorAll('.sync-text').forEach(text => {
        text.textContent = 'Syncing to Google Drive...';
    });

    setTimeout(() => {
        appState.cloudSync.lastSync = new Date();
        appState.cloudSync.pendingUploads = Math.max(0, appState.cloudSync.pendingUploads - 1);
        
        document.querySelectorAll('.sync-indicator').forEach(indicator => {
            indicator.className = 'sync-indicator connected';
        });
        
        document.querySelectorAll('.sync-text').forEach(text => {
            text.textContent = 'Connected to Google Drive';
        });
        
        updateSyncStatus();
    }, 2000 + Math.random() * 3000);
}

// Modal functions
function showAddPurchaseModal() {
    console.log('Opening Add Purchase Modal');
    const modal = document.getElementById('add-purchase-modal');
    const form = document.getElementById('purchase-form');
    const photoPreview = document.getElementById('photo-preview');
    
    if (modal) {
        modal.classList.remove('hidden');
        console.log('Modal opened successfully');
    }
    if (form) form.reset();
    if (photoPreview) photoPreview.innerHTML = '';
    
    setDefaultDates();
    currentUploadedPhotos = [];
}

function hideAddPurchaseModal() {
    const modal = document.getElementById('add-purchase-modal');
    const photoPreview = document.getElementById('photo-preview');
    
    if (modal) modal.classList.add('hidden');
    if (photoPreview) photoPreview.innerHTML = '';
    currentUploadedPhotos = [];
}

function showAddPaymentModal(purchaseId) {
    const purchase = appState.purchases.find(p => p.id === purchaseId);
    if (!purchase) return;

    const outstanding = purchase.billAmount - purchase.amountPaid;
    
    const purchaseIdInput = document.getElementById('payment-purchase-id');
    const billInfo = document.getElementById('payment-bill-info');
    const outstandingInfo = document.getElementById('payment-outstanding-info');
    const amountInput = document.getElementById('payment-amount');
    const modal = document.getElementById('add-payment-modal');
    
    if (purchaseIdInput) purchaseIdInput.value = purchaseId;
    if (billInfo) billInfo.textContent = `Bill: ${purchase.billNumber} - ${purchase.supplierName}`;
    if (outstandingInfo) outstandingInfo.textContent = `Outstanding Amount: ${formatCurrency(outstanding)}`;
    if (amountInput) {
        amountInput.max = outstanding;
        amountInput.value = outstanding;
    }
    
    if (modal) modal.classList.remove('hidden');
}

function hideAddPaymentModal() {
    const modal = document.getElementById('add-payment-modal');
    const form = document.getElementById('payment-form');
    
    if (modal) modal.classList.add('hidden');
    if (form) form.reset();
}

function showAddSupplierModal() {
    const modal = document.getElementById('add-supplier-modal');
    const form = document.getElementById('supplier-form');
    
    if (modal) modal.classList.remove('hidden');
    if (form) form.reset();
}

function hideAddSupplierModal() {
    const modal = document.getElementById('add-supplier-modal');
    if (modal) modal.classList.add('hidden');
}

// Save functions
async function savePurchase() {
  const form = document.getElementById('purchase-form');
  if (!form || !form.checkValidity()) {
    if (form) form.reportValidity();
    return;
  }

  const supplierSelect = document.getElementById('supplier-select');
  const billAmountInput = document.getElementById('bill-amount');
  const amountPaidInput = document.getElementById('amount-paid');

  if (!supplierSelect || !billAmountInput) return;

  const supplier = appState.suppliers.find(s => s.id == supplierSelect.value);
  if (!supplier) return;

  const billAmount = parseFloat(billAmountInput.value);
  const amountPaid = parseFloat(amountPaidInput ? amountPaidInput.value : 0) || 0;

  let status;
  if (amountPaid === 0) status = 'Unpaid';
  else if (amountPaid >= billAmount) status = 'Fully Paid';
  else status = 'Partially Paid';

  // Step 1: build a base purchase object
  const basePurchase = {
    billNumber: document.getElementById('bill-number')?.value || '',
    supplierId: supplier.id,
    supplierName: supplier.name,
    item: document.getElementById('item-description')?.value || '',
    purchaseDate: document.getElementById('purchase-date')?.value || new Date().toISOString().split('T')[0],
    billDate: document.getElementById('bill-date')?.value || new Date().toISOString().split('T')[0],
    billAmount: billAmount,
    amountPaid: amountPaid,
    paymentDate: document.getElementById('payment-date')?.value || null,
    paymentMethod: document.getElementById('payment-method')?.value || null,
    status: status,
    photos: [], // will be filled after uploads
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  // Step 2: create Firestore doc
  const docRef = await db.collection('purchases').add(basePurchase);

  // Step 3: upload bill photos (if any) to Firebase Storage
  const fileInput = document.getElementById('bill-photos');
  const uploadedPhotos = [];
  if (fileInput && fileInput.files && fileInput.files.length) {
    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i];
      const path = `purchases/${docRef.id}/photos/${Date.now()}_${file.name}`;
      const storageRef = storage.ref().child(path);

      await storageRef.put(file);
      const url = await storageRef.getDownloadURL();

      uploadedPhotos.push({
        id: `photo_${Date.now()}_${i}`,
        name: file.name,
        uploadDate: new Date().toISOString().split('T')[0],
        size: (file.size / 1024 / 1024).toFixed(1) + 'MB',
        data: url // <--- we store the download URL in photo.data
      });
    }
  }

  // Step 4: update Firestore with photo URLs
  await docRef.update({ photos: uploadedPhotos });

  // Step 5: also update local appState for immediate UI refresh
  const newPurchase = {
    id: docRef.id, // use Firestore doc ID
    ...basePurchase,
    photos: uploadedPhotos
  };

  if (amountPaid > 0) {
  const payment = {
    purchaseId: docRef.id,
    billNumber: basePurchase.billNumber,
    supplier: supplier.name,
    amount: amountPaid,
    date: basePurchase.paymentDate || new Date().toISOString().split('T')[0],
    method: basePurchase.paymentMethod || 'Cash',
    type: amountPaid >= billAmount ? 'Full Payment' : 'Partial Payment',
    newAmountPaid: amountPaid,
    newStatus: status,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  // Add to local state (immediate UI refresh)
  appState.payments.push(payment);

  // Save to Firestore
  await savePayment(docRef.id, payment);
}


  appState.purchases.push(newPurchase);
  hideAddPurchaseModal();

  appState.cloudSync.pendingUploads += newPurchase.photos.length;
  simulateSync();

  updateDashboard();
  renderAllTables();

  // Reset form + previews
  form.reset();
  const preview = document.getElementById('photo-preview');
  if (preview) preview.innerHTML = '';
  const photoInput = document.getElementById('bill-photos');
  if (photoInput) photoInput.value = '';
  currentUploadedPhotos = [];
}

// Save a payment and update purchase in Firestore
async function savePayment(purchaseId, payment) {
  try {
    // 1. Add payment record to Firestore "payments" collection
    await db.collection("payments").add(payment);

    // 2. Update purchase in Firestore with new amountPaid + status
    const purchaseRef = db.collection("purchases").doc(purchaseId);
    await purchaseRef.update({
      amountPaid: payment.newAmountPaid,
      status: payment.newStatus
    });

    console.log("✅ Payment saved & purchase updated in Firestore");
  } catch (err) {
    console.error("❌ Error saving payment:", err);
  }
}

// Load payments from Firestore on startup
function loadPayments() {
  db.collection("payments")
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      appState.payments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Refresh your existing payments table
      renderPaymentsTable();
    });
}


function savePayment() {
    const form = document.getElementById('payment-form');
    if (!form || !form.checkValidity()) {
        if (form) form.reportValidity();
        return;
    }

    const purchaseIdInput = document.getElementById('payment-purchase-id');
    const amountInput = document.getElementById('payment-amount');
    const dateInput = document.getElementById('payment-date-input');
    const methodSelect = document.getElementById('payment-method-select');

    if (!purchaseIdInput || !amountInput || !dateInput || !methodSelect) return;

    const purchaseId = parseInt(purchaseIdInput.value);
    const paymentAmount = parseFloat(amountInput.value);
    const paymentDate = dateInput.value;
    const paymentMethod = methodSelect.value;

    const purchase = appState.purchases.find(p => p.id === purchaseId);
    if (!purchase) return;

    purchase.amountPaid += paymentAmount;
    purchase.paymentDate = paymentDate;
    purchase.paymentMethod = paymentMethod;
    
    if (purchase.amountPaid >= purchase.billAmount) {
        purchase.status = 'Fully Paid';
    } else {
        purchase.status = 'Partially Paid';
    }

    appState.payments.push({
        id: Date.now(),
        purchaseId: purchaseId,
        billNumber: purchase.billNumber,
        supplier: purchase.supplierName,
        amount: paymentAmount,
        date: paymentDate,
        method: paymentMethod,
        type: purchase.amountPaid >= purchase.billAmount ? 'Full Payment' : 'Partial Payment'
    });

    hideAddPaymentModal();
    simulateSync();
    updateDashboard();
    renderAllTables();
}

function saveSupplier() {
    const form = document.getElementById('supplier-form');
    if (!form || !form.checkValidity()) {
        if (form) form.reportValidity();
        return;
    }

    const nameInput = document.getElementById('supplier-name');
    const emailInput = document.getElementById('supplier-email');
    const phoneInput = document.getElementById('supplier-phone');
    const addressInput = document.getElementById('supplier-address');

    if (!nameInput || !emailInput) return;

    const newSupplier = {
        id: Date.now(),
        name: nameInput.value,
        contact: emailInput.value,
        phone: phoneInput ? phoneInput.value : '',
        address: addressInput ? addressInput.value : ''
    };

    appState.suppliers.push(newSupplier);
    populateSupplierDropdowns();
    hideAddSupplierModal();
    renderSuppliersGrid();
    simulateSync();
}

// Utility functions
function populateSupplierDropdowns() {
    const selects = ['supplier-select', 'supplier-filter'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const currentValue = select.value;
        
        if (selectId === 'supplier-filter') {
            select.innerHTML = '<option value="">All Suppliers</option>';
        } else {
            select.innerHTML = '<option value="">Select a supplier</option>';
        }
        
        appState.suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.id;
            option.textContent = supplier.name;
            select.appendChild(option);
        });
        
        select.value = currentValue;
    });
}

function handlePhotoUpload(event) {
    const files = event.target.files;
    const preview = document.getElementById('photo-preview');
    
    if (!preview) return;
    
    preview.innerHTML = '';
    currentUploadedPhotos = [];

    Array.from(files).forEach((file, index) => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const photoData = {
                    id: `photo_${Date.now()}_${index}`,
                    name: file.name,
                    uploadDate: new Date().toISOString().split('T')[0],
                    size: (file.size / 1024 / 1024).toFixed(1) + 'MB',
                    data: e.target.result
                };
                
                currentUploadedPhotos.push(photoData);
                
                const photoItem = document.createElement('div');
                photoItem.className = 'photo-item';
                photoItem.innerHTML = `
                    <img src="${e.target.result}" alt="Bill photo ${index + 1}">
                    <button type="button" class="photo-remove" onclick="removePhoto(${index})">&times;</button>
                `;
                preview.appendChild(photoItem);
            };
            reader.readAsDataURL(file);
        }
    });
}

function removePhoto(index) {
    const fileInput = document.getElementById('bill-photos');
    if (!fileInput) return;
    
    const dt = new DataTransfer();
    const files = Array.from(fileInput.files);
    
    files.forEach((file, i) => {
        if (i !== index) {
            dt.items.add(file);
        }
    });
    
    fileInput.files = dt.files;
    handlePhotoUpload({ target: fileInput });
}

function exportPayments() {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Date,Bill Number,Supplier,Amount,Method,Type\n"
        + appState.payments.map(p => 
            `${p.date},${p.billNumber},${p.supplier},${p.amount},${p.method},${p.type}`
        ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "payment_history.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderAllTables() {
    renderPurchasesTable();
    renderPaymentHistoryTable();
    renderPhotoGallery();
    renderSuppliersGrid();
}

function getStatusBadge(status) {
    const badgeClass = status === 'Fully Paid' ? 'status-badge--paid' :
                      status === 'Partially Paid' ? 'status-badge--partial' :
                      'status-badge--unpaid';
    return `<span class="status-badge ${badgeClass}">${status}</span>`;
}

function formatCurrency(amount) {
    return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

async function savePayment(purchaseId, payment) {
  try {
    // 1. Add payment record to Firestore "payments" collection
    await db.collection("payments").add(payment);

    // 2. Update purchase in Firestore with new amountPaid + status
    const purchaseRef = db.collection("purchases").doc(purchaseId);
    await purchaseRef.update({
      amountPaid: payment.newAmountPaid,
      status: payment.newStatus
    });

    console.log("✅ Payment saved & purchase updated in Firestore");
  } catch (err) {
    console.error("❌ Error saving payment:", err);
  }
}


function formatTimeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
}

// Sorting functions
function sortPurchases(field) {
    if (appState.currentSort.field === field) {
        appState.currentSort.direction = appState.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        appState.currentSort.field = field;
        appState.currentSort.direction = 'asc';
    }
    renderPurchasesTable();
}

function sortPayments(field) {
    if (appState.paymentSort.field === field) {
        appState.paymentSort.direction = appState.paymentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        appState.paymentSort.field = field;
        appState.paymentSort.direction = 'asc';
    }
    renderPaymentHistoryTable();
}

// Load purchases from Firestore on startup
function loadPurchases() {
  db.collection("purchases").orderBy("createdAt", "desc").onSnapshot(snapshot => {
    appState.purchases = snapshot.docs.map(doc => {
      return { id: doc.id, ...doc.data() };
    });

    // Refresh UI with the loaded data
    renderAllTables();
    updateDashboard();
  });
}


// Make functions globally accessible for inline onclick handlers
window.showPage = showPage;
window.showAddPurchaseModal = showAddPurchaseModal;
window.hideAddPurchaseModal = hideAddPurchaseModal;
window.showAddPaymentModal = showAddPaymentModal;
window.hideAddPaymentModal = hideAddPaymentModal;
window.showAddSupplierModal = showAddSupplierModal;
window.hideAddSupplierModal = hideAddSupplierModal;
window.savePurchase = savePurchase;
window.savePayment = savePayment;
window.saveSupplier = saveSupplier;
window.sortPurchases = sortPurchases;
window.sortPayments = sortPayments;
window.showPhotoLightbox = showPhotoLightbox;
window.hidePhotoLightbox = hidePhotoLightbox;
window.previousPhoto = previousPhoto;
window.nextPhoto = nextPhoto;
window.removePhoto = removePhoto;
window.exportPayments = exportPayments;
