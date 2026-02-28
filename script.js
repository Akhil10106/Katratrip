/**
 * TripSplit Premium Core Engine v18.0 - FULL COMPLETE EDITION
 * -----------------------------------------------------------
 * Features: 
 * - Service Worker Registration (PWA)
 * - Firebase Real-time Sync
 * - App Download/Installation Engine
 * - Premium Profile & Settlement Logic
 */

// --- 0. SERVICE WORKER REGISTRATION ---
// This block allows the browser to recognize the site as a downloadable app.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW Registered'))
            .catch(err => console.log('SW Registration Failed', err));
    });
}

// --- 1. CONFIGURATION & STATE ---
const firebaseConfig = {
    apiKey: "AIzaSyCy5NOv_bRx8Ozbq3n5MzXz8D7cF1Piwko",
    authDomain: "services-6ce70.firebaseapp.com",
    databaseURL: "https://services-6ce70-default-rtdb.firebaseio.com",
    projectId: "services-6ce70",
    storageBucket: "services-6ce70.firebasestorage.app",
    messagingSenderId: "153760408547",
    appId: "1:153760408547:web:5f61c39085dbe2f828b6d6"
};

let members = [];
let expenses = [];
let settledHistory = [];
let deferredPrompt; // For PWA Install

// Initialize Firebase
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// --- 2. AUTHENTICATION ---

document.getElementById('google-login-btn').onclick = () => {
    auth.signInWithPopup(provider).catch(err => alert("Login Error: " + err.message));
};

window.handleLogout = () => {
    if(confirm("Are you sure you want to sign out?")) {
        auth.signOut().then(() => location.reload());
    }
};

auth.onAuthStateChanged((user) => {
    const overlay = document.getElementById('auth-overlay');
    if (user) {
        overlay.style.display = 'none';
        
        // Sync User UI Elements
        const updateUI = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
        const updateImg = (id, src) => { const el = document.getElementById(id); if(el) el.src = src; };

        updateUI('user-name', user.displayName);
        updateUI('user-name-mobile', user.displayName);
        updateUI('main-profile-name', user.displayName);
        updateUI('main-profile-email', user.email);
        
        updateImg('user-photo', user.photoURL);
        updateImg('user-photo-mobile', user.photoURL);
        updateImg('main-profile-photo', user.photoURL);

        if (user.email === "akhilgoel985@gmail.com") {
            const badge = document.getElementById('admin-badge');
            if (badge) badge.classList.remove('hidden');
        }

        startRealTimeSync();
        showSection('dashboard');
    } else {
        overlay.style.display = 'flex';
    }
});

// --- 3. NAVIGATION ---

window.showSection = (sectionId) => {
    document.querySelectorAll('.section-content').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-link, .m-nav-item').forEach(n => n.classList.remove('active'));
    
    const target = document.getElementById(`${sectionId}-section`);
    if (target) target.classList.remove('hidden');
    
    document.querySelectorAll(`[onclick="showSection('${sectionId}')"]`).forEach(el => el.classList.add('active'));
    document.getElementById('section-title').innerText = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);

    const desktopAction = document.getElementById('desktop-action-container');
    const mobileAction = document.getElementById('mobile-action-btn');

    if (sectionId === 'profile') {
        desktopAction.innerHTML = '';
        mobileAction.style.display = 'none';
        renderProfileDashboard();
    } else if (sectionId === 'members') {
        desktopAction.innerHTML = `<button class="btn btn-primary" onclick="openModal('memberModal')" style="background: var(--success);"><i data-lucide="user-plus"></i> <span>Member</span></button>`;
        mobileAction.style.display = 'flex';
        mobileAction.setAttribute('onclick', "openModal('memberModal')");
        mobileAction.innerHTML = `<i data-lucide="user-plus" style="color: var(--success);"></i><span>Add</span>`;
    } else if (sectionId === 'settlements') {
        desktopAction.innerHTML = '';
        mobileAction.style.display = 'none';
        renderDetailedSettlements();
        renderSettledHistory();
    } else {
        desktopAction.innerHTML = `<button class="btn btn-primary" onclick="openModal('expenseModal')"><i data-lucide="plus"></i> <span>Expense</span></button>`;
        mobileAction.style.display = 'flex';
        mobileAction.setAttribute('onclick', "openModal('expenseModal')");
        mobileAction.innerHTML = `<i data-lucide="plus-circle" style="color: var(--primary);"></i><span>Add</span>`;
    }
    
    lucide.createIcons();
};

// --- 4. DATA SYNC & UI REFRESH ---

function startRealTimeSync() {
    db.ref('members').on('value', snap => {
        members = snap.val() ? Object.entries(snap.val()).map(([id, v]) => ({ id, ...v })) : [];
        refreshUI();
    });
    db.ref('expenses').on('value', snap => {
        expenses = snap.val() ? Object.entries(snap.val()).map(([id, v]) => ({ id, ...v })) : [];
        refreshUI();
        if (!document.getElementById('profile-section').classList.contains('hidden')) renderProfileDashboard();
    });
    db.ref('settledHistory').on('value', snap => {
        settledHistory = snap.val() ? Object.values(snap.val()).reverse() : [];
        renderSettledHistory();
    });
    db.ref('activityLogs').limitToLast(30).on('value', snap => renderActivityFeed(snap));
}

function refreshUI() {
    const payerSelect = document.getElementById('exp-payer');
    if (payerSelect) payerSelect.innerHTML = members.map(m => `<option value="${m.name}">${m.name}</option>`).join('');

    const splitBox = document.getElementById('split-participants');
    if (splitBox) splitBox.innerHTML = members.map(m => `<label><input type="checkbox" value="${m.name}" checked> <span>${m.name}</span></label>`).join('');

    renderExpensesTable();
    renderMembersGrid();
    
    const totalSpent = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const totalEl = document.getElementById('total-expense-val');
    const pendingEl = document.getElementById('pending-settle-val');
    
    if (totalEl) totalEl.innerText = `₹${totalSpent.toLocaleString('en-IN')}`;
    if (pendingEl) pendingEl.innerText = expenses.length;
}

// --- 5. CORE LOGIC (EXPENSES & SETTLEMENTS) ---

document.getElementById('expense-form').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    const title = document.getElementById('exp-title').value.trim();
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const paidBy = document.getElementById('exp-payer').value;
    const category = document.getElementById('exp-category').value;
    const participants = Array.from(document.querySelectorAll('#split-participants input:checked')).map(i => i.value);

    if (!title || isNaN(amount) || amount <= 0 || participants.length === 0) return alert("Please fill all fields.");

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "Saving...";
        const shareAmount = amount / participants.length;

        await db.ref('expenses').push({
            title, amount, paidBy, category, participants,
            fixedShare: shareAmount, time: Date.now()
        });

        await logActivity(`${paidBy} paid ₹${amount} for ${title}`, 'expense');
        closeModal('expenseModal');
        e.target.reset();
    } catch (err) {
        alert("Error saving to Firebase.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        lucide.createIcons();
    }
};

window.settleSpecificDebt = async (expenseId, person, title) => {
    if (confirm(`Mark ${person}'s share for "${title}" as paid?`)) {
        try {
            const expRef = db.ref('expenses').child(expenseId);
            const snap = await expRef.once('value');
            const exp = snap.val();
            const share = exp.fixedShare || (exp.amount / exp.participants.length);

            await db.ref('settledHistory').push({
                title, from: person, to: exp.paidBy, amount: share, time: Date.now()
            });

            const newParticipants = exp.participants.filter(p => p !== person);
            if (newParticipants.length === 0) await expRef.remove();
            else await expRef.update({ participants: newParticipants });

            logActivity(`${person} settled for ${title}`, 'settle');
        } catch (e) { console.error("Settlement failed", e); }
    }
};

// --- 6. RENDERERS ---

function renderExpensesTable() {
    const tbody = document.getElementById('expenses-tbody');
    if (!tbody) return;
    tbody.innerHTML = expenses.map(e => `
        <tr class="table-row-hover">
            <td><div class="bill-info"><span class="bill-title">${e.title}</span></div></td>
            <td class="hide-mobile"><b>${e.paidBy}</b></td>
            <td><span class="bill-amount">₹${parseFloat(e.amount).toLocaleString('en-IN')}</span></td>
            <td><span class="badge badge-${e.category?.toLowerCase()}">${e.category}</span></td>
            <td class="action-cell">
                <button class="btn" style="color:var(--danger); background: var(--danger-soft); border-radius:12px; padding:10px;" onclick="triggerDelete('expenses', '${e.id}', '${e.title}')">
                    <i data-lucide="trash-2" size="18"></i>
                </button>
            </td>
        </tr>`).join('');
    lucide.createIcons();
}

function renderMembersGrid() {
    const grid = document.getElementById('members-grid');
    if (!grid) return;
    grid.innerHTML = members.map(m => `
        <div class="stat-card member-card animate-in" onclick="openUserProfile('${m.name}')">
            <div class="member-profile-btn">
                <div class="member-avatar">${m.name[0]}</div>
                <div><b>${m.name}</b></div>
            </div>
            <button class="btn" onclick="event.stopPropagation(); triggerDelete('members', '${m.id}', '${m.name}')">
                <i data-lucide="user-minus" size="16"></i>
            </button>
        </div>`).join('') + 
        `<div class="stat-card mobile-add-member" onclick="openModal('memberModal')" style="cursor: pointer; background: #f0fdf4; border: 2px dashed #bbf7d0;">
            <p class="stat-label" style="color: #16a34a;">Add Friend</p>
            <div class="stat-value" style="color: #16a34a;"><i data-lucide="user-plus"></i></div>
        </div>`;
    lucide.createIcons();
}

function renderProfileDashboard() {
    const user = auth.currentUser;
    if (!user) return;
    const ledger = document.getElementById('personal-ledger-list');
    let lent = 0, owed = 0, html = '';
    const name = user.displayName;

    expenses.forEach(exp => {
        const share = exp.fixedShare || (exp.amount / exp.participants.length);
        if (exp.paidBy === name) {
            const currentLent = share * (exp.participants.filter(p => p !== name).length);
            lent += currentLent;
            if (currentLent > 0) html += `<div class="activity-card" style="border-left-color: var(--success)"><div class="activity-header"><span class="activity-title">${exp.title}</span><span class="activity-amount" style="color: var(--success)">+ ₹${Math.round(currentLent)}</span></div></div>`;
        } else if (exp.participants.includes(name)) {
            owed += share;
            html += `<div class="activity-card" style="border-left-color: var(--danger)"><div class="activity-header"><span class="activity-title">${exp.title}</span><span class="activity-amount" style="color: var(--danger)">- ₹${Math.round(share)}</span></div></div>`;
        }
    });

    document.getElementById('profile-lent-val').innerText = `₹${Math.round(lent)}`;
    document.getElementById('profile-owed-val').innerText = `₹${Math.round(owed)}`;
    const net = lent - owed;
    const bal = document.getElementById('profile-balance-val');
    bal.innerText = `₹${Math.round(Math.abs(net))}`;
    bal.style.color = net >= 0 ? 'var(--success)' : 'var(--danger)';
    ledger.innerHTML = html || `<p style="text-align:center; padding:2rem; color:var(--text-light);">No activity found.</p>`;
}

function renderActivityFeed(snap) {
    const feed = document.getElementById('activity-feed');
    if (!feed) return;
    const data = snap.val() ? Object.values(snap.val()).reverse() : [];
    feed.innerHTML = data.map(l => `
        <div class="activity-card-mini act-${l.type} animate-in">
            <div class="activity-icon"><i data-lucide="bell" size="14"></i></div>
            <div class="activity-info"><span class="activity-text">${l.text}</span></div>
        </div>`).join('');
    lucide.createIcons();
}

// --- 7. APP INSTALLATION ENGINE (PWA) ---

const installBtnDesktop = document.getElementById('install-btn-desktop');
const installBtnMobile = document.getElementById('install-btn-mobile');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtnDesktop) installBtnDesktop.style.display = 'flex';
    if (installBtnMobile) installBtnMobile.style.display = 'flex';
});

async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (installBtnDesktop) installBtnDesktop.style.display = 'none';
    if (installBtnMobile) installBtnMobile.style.display = 'none';
}

if (installBtnDesktop) installBtnDesktop.addEventListener('click', handleInstallClick);
if (installBtnMobile) installBtnMobile.addEventListener('click', handleInstallClick);

// --- 8. HELPERS & SYSTEM ACTIONS ---

window.openModal = (id) => { 
    const m = document.getElementById(id);
    m.style.display = 'flex'; 
    setTimeout(() => m.style.opacity = '1', 10);
};

window.closeModal = (id) => { 
    const m = document.getElementById(id);
    m.style.opacity = '0';
    setTimeout(() => m.style.display = 'none', 300);
};

window.submitNewMember = async () => {
    const val = document.getElementById('new-member-name').value.trim();
    if (!val) return;
    await db.ref('members').push({ name: val });
    logActivity(`${val} joined`, 'join');
    document.getElementById('new-member-name').value = ''; closeModal('memberModal');
};

window.triggerFullReset = () => { if (confirm("Clear all trip data?")) { db.ref('/').remove(); location.reload(); } };
window.triggerDelete = (path, id, label) => { if (confirm(`Delete ${label}?`)) db.ref(path).child(id).remove(); };

async function logActivity(text, type) {
    try { await db.ref('activityLogs').push({ text, type, time: Date.now() }); } catch (e) {}
}

function renderDetailedSettlements() {
    const container = document.getElementById('detailed-settlement-view');
    if (!container) return;
    let html = expenses.flatMap(exp => {
        const share = exp.fixedShare || (exp.amount / exp.participants.length);
        return exp.participants.filter(p => p !== exp.paidBy).map(person => `
            <div class="activity-card animate-in">
                <div class="activity-header"><span class="activity-title">${exp.title}</span><span class="activity-amount">₹${Math.round(share)}</span></div>
                <div class="debt-line"><div class="debt-info"><strong>${person}</strong> owes <strong>${exp.paidBy}</strong></div><button class="btn" style="background: var(--success-soft); color: var(--success); padding: 6px 12px; font-size: 0.7rem;" onclick="settleSpecificDebt('${exp.id}', '${person}', '${exp.title}')">Mark Paid</button></div>
            </div>`);
    }).join('');
    container.innerHTML = html || `<div class="activity-card">All settled! ☀️</div>`;
    lucide.createIcons();
}

function renderSettledHistory() {
    const container = document.getElementById('settled-history-view');
    if (!container) return;
    container.innerHTML = settledHistory.map(h => `<div class="activity-node" style="border-left-color: var(--success); background: #f0fdf4; margin-bottom: 8px;"><div style="display:flex; justify-content:space-between;"><span><b>${h.from}</b> paid <b>${h.to}</b></span><span style="color:var(--success); font-weight:900;">₹${Math.round(h.amount)}</span></div><div style="font-size:0.7rem; color:var(--text-muted);">For: ${h.title}</div></div>`).join('');
}
