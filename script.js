/**
 * TripSplit Premium Core Engine v23.0 - STABLE OFFLINE EDITION
 * -----------------------------------------------------------
 * Fixes: 
 * - Corrected setPersistenceEnabled syntax for Firebase Compat v9
 * - Optimized Auth State Observer for PWA stability
 * - Full Disk Persistence for Katra (Zero-Internet zones)
 */

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

// Initialize Firebase
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- THE CRITICAL OFFLINE FIX ---
// Corrected syntax for Firebase 9.x Compat
db.setPersistenceEnabled(true); 

const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// --- 2. AUTHENTICATION & PERSISTENCE ---

// Ensures session stays active in no-network areas
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

window.handleGoogleLogin = () => {
    const btn = document.getElementById('google-login-btn');
    btn.innerHTML = "Checking Connection...";
    btn.disabled = true;

    if (!navigator.onLine) {
        alert("First-time login requires internet. After that, you are good for the whole trip!");
        btn.innerHTML = "Continue with Google";
        btn.disabled = false;
        return;
    }

    // Hybrid Auth: Try Popup, fallback to Redirect if blocked
    auth.signInWithPopup(provider)
        .then(() => console.log("Auth: Popup Success"))
        .catch((error) => {
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
                console.log("Auth: Popup blocked, trying Redirect...");
                auth.signInWithRedirect(provider);
            } else {
                alert("Login Error: " + error.message);
                btn.innerHTML = "Continue with Google";
                btn.disabled = false;
            }
        });
};

document.getElementById('google-login-btn').onclick = window.handleGoogleLogin;

auth.getRedirectResult().catch(err => console.error("Redirect Error:", err));

window.handleLogout = () => {
    if(confirm("Sign out from TripSplit?")) {
        auth.signOut().then(() => location.reload());
    }
};

auth.onAuthStateChanged((user) => {
    const overlay = document.getElementById('auth-overlay');
    if (user) {
        overlay.style.display = 'none';
        
        // UI Syncing
        const nameFields = ['user-name', 'user-name-mobile', 'main-profile-name'];
        const photoFields = ['user-photo', 'user-photo-mobile', 'main-profile-photo'];
        
        nameFields.forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = user.displayName; });
        photoFields.forEach(id => { if(document.getElementById(id)) document.getElementById(id).src = user.photoURL; });

        if (user.email === "akhilgoel985@gmail.com") {
            document.getElementById('admin-badge')?.classList.remove('hidden');
        }

        startRealTimeSync();
        showSection('dashboard');
    } else {
        overlay.style.display = 'flex';
        const loginBtn = document.getElementById('google-login-btn');
        if(loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = "Continue with Google";
        }
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
        if(mobileAction) mobileAction.style.display = 'none';
        renderProfileDashboard();
    } else if (sectionId === 'members') {
        desktopAction.innerHTML = `<button class="btn btn-primary" onclick="openModal('memberModal')" style="background: var(--success);"><i data-lucide="user-plus"></i> <span>Member</span></button>`;
        if(mobileAction) {
            mobileAction.style.display = 'flex';
            mobileAction.setAttribute('onclick', "openModal('memberModal')");
            mobileAction.innerHTML = `<i data-lucide="user-plus" style="color: var(--success);"></i><span>Add</span>`;
        }
    } else if (sectionId === 'settlements') {
        desktopAction.innerHTML = '';
        if(mobileAction) mobileAction.style.display = 'none';
        renderDetailedSettlements();
        renderSettledHistory();
    } else {
        desktopAction.innerHTML = `<button class="btn btn-primary" onclick="openModal('expenseModal')"><i data-lucide="plus"></i> <span>Expense</span></button>`;
        if(mobileAction) {
            mobileAction.style.display = 'flex';
            mobileAction.setAttribute('onclick', "openModal('expenseModal')");
            mobileAction.innerHTML = `<i data-lucide="plus-circle" style="color: var(--primary);"></i><span>Add</span>`;
        }
    }
    lucide.createIcons();
};

// --- 4. DATA SYNC & RENDERERS ---

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
}

function refreshUI() {
    const payerSelect = document.getElementById('exp-payer');
    if (payerSelect) payerSelect.innerHTML = members.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    const splitBox = document.getElementById('split-participants');
    if (splitBox) splitBox.innerHTML = members.map(m => `<label><input type="checkbox" value="${m.name}" checked> <span>${m.name}</span></label>`).join('');
    renderExpensesTable();
    renderMembersGrid();
    const totalSpent = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    if (document.getElementById('total-expense-val')) document.getElementById('total-expense-val').innerText = `₹${totalSpent.toLocaleString('en-IN')}`;
    if (document.getElementById('pending-settle-val')) document.getElementById('pending-settle-val').innerText = expenses.length;
}

document.getElementById('expense-form').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const title = document.getElementById('exp-title').value.trim();
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const paidBy = document.getElementById('exp-payer').value;
    const category = document.getElementById('exp-category').value;
    const participants = Array.from(document.querySelectorAll('#split-participants input:checked')).map(i => i.value);

    try {
        submitBtn.disabled = true;
        const shareAmount = amount / participants.length;
        await db.ref('expenses').push({ title, amount, paidBy, category, participants, fixedShare: shareAmount, time: Date.now() });
        closeModal('expenseModal');
        e.target.reset();
    } catch (err) { console.error("Offline Save Failed:", err); }
    finally { submitBtn.disabled = false; lucide.createIcons(); }
};

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
                <button class="btn" style="color:var(--danger); background: var(--danger-soft); padding:8px;" onclick="triggerDelete('expenses', '${e.id}', '${e.title}')">
                    <i data-lucide="trash-2" size="16"></i>
                </button>
            </td>
        </tr>`).join('');
    lucide.createIcons();
}

function renderMembersGrid() {
    const grid = document.getElementById('members-grid');
    if (!grid) return;
    grid.innerHTML = members.map(m => `
        <div class="stat-card member-card" onclick="openUserProfile('${m.name}')">
            <div class="member-profile-btn">
                <div class="member-avatar">${m.name[0]}</div>
                <div><b>${m.name}</b></div>
            </div>
            <button class="btn" onclick="event.stopPropagation(); triggerDelete('members', '${m.id}', '${m.name}')">
                <i data-lucide="user-minus" size="16"></i>
            </button>
        </div>`).join('') + `
        <div class="stat-card mobile-add-member" onclick="openModal('memberModal')" style="cursor: pointer; background: var(--success-soft); border: 2px dashed var(--success);">
            <p class="stat-label" style="color: var(--success);">Add Friend</p>
            <div class="stat-value" style="color: var(--success);"><i data-lucide="user-plus"></i></div>
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
            const othersShare = share * (exp.participants.filter(p => p !== name).length);
            lent += othersShare;
            if (othersShare > 0) html += `<div class="activity-card" style="border-left-color: var(--success)"><div class="activity-header"><span class="activity-title">${exp.title}</span><span class="activity-amount" style="color:var(--success)">+ ₹${Math.round(othersShare)}</span></div></div>`;
        } else if (exp.participants.includes(name)) {
            owed += share;
            html += `<div class="activity-card" style="border-left-color: var(--danger)"><div class="activity-header"><span class="activity-title">${exp.title}</span><span class="activity-amount" style="color:var(--danger)">- ₹${Math.round(share)}</span></div></div>`;
        }
    });
    document.getElementById('profile-lent-val').innerText = `₹${Math.round(lent)}`;
    document.getElementById('profile-owed-val').innerText = `₹${Math.round(owed)}`;
    const net = lent - owed;
    document.getElementById('profile-balance-val').innerText = `₹${Math.round(Math.abs(net))}`;
    document.getElementById('profile-balance-val').style.color = net >= 0 ? 'var(--success)' : 'var(--danger)';
    ledger.innerHTML = html || `<p style="text-align:center; padding:2rem; color:var(--text-light);">No activity recorded.</p>`;
}

function renderDetailedSettlements() {
    const container = document.getElementById('detailed-settlement-view');
    if (!container) return;
    container.innerHTML = expenses.flatMap(exp => {
        const share = exp.fixedShare || (exp.amount / exp.participants.length);
        return exp.participants.filter(p => p !== exp.paidBy).map(person => `
            <div class="activity-card">
                <div class="activity-header"><span class="activity-title">${exp.title}</span><span class="activity-amount">₹${Math.round(share)}</span></div>
                <div class="debt-line"><span><b>${person}</b> owes <b>${exp.paidBy}</b></span><button class="btn" style="background: var(--success-soft); color: var(--success); padding: 5px 10px; font-size: 0.7rem;" onclick="settleSpecificDebt('${exp.id}', '${person}', '${exp.title}')">Mark Paid</button></div>
            </div>`);
    }).join('') || `<p style="text-align:center; padding:1rem; color:var(--text-light);">No pending debts.</p>`;
    lucide.createIcons();
}

function renderSettledHistory() {
    const container = document.getElementById('settled-history-view');
    if (!container) return;
    container.innerHTML = settledHistory.map(h => `<div class="activity-node" style="border-left-color: var(--success);"><div style="display:flex; justify-content:space-between;"><span><b>${h.from}</b> → <b>${h.to}</b></span><b>₹${Math.round(h.amount)}</b></div><div style="font-size:0.7rem; color:var(--text-muted);">For: ${h.title}</div></div>`).join('');
}

window.settleSpecificDebt = async (expenseId, person, title) => {
    if (!confirm(`Mark ${person}'s debt for "${title}" as paid?`)) return;
    const expRef = db.ref('expenses').child(expenseId);
    const snap = await expRef.once('value');
    const exp = snap.val();
    const share = exp.fixedShare || (exp.amount / exp.participants.length);
    await db.ref('settledHistory').push({ title, from: person, to: exp.paidBy, amount: share, time: Date.now() });
    const newParticipants = exp.participants.filter(p => p !== person);
    if (newParticipants.length === 0) await expRef.remove();
    else await expRef.update({ participants: newParticipants });
};

// --- 5. MODALS & UTILS ---

window.openModal = (id) => { const m = document.getElementById(id); m.style.display = 'flex'; setTimeout(() => m.style.opacity = '1', 10); };
window.closeModal = (id) => { const m = document.getElementById(id); m.style.opacity = '0'; setTimeout(() => m.style.display = 'none', 300); };
window.triggerFullReset = () => { if (confirm("DANGER: Delete all trip records?")) db.ref('/').remove(); };
window.triggerDelete = (path, id, label) => { if (confirm(`Delete ${label}?`)) db.ref(path).child(id).remove(); };
window.submitNewMember = async () => {
    const val = document.getElementById('new-member-name').value.trim();
    if (!val) return;
    await db.ref('members').push({ name: val });
    document.getElementById('new-member-name').value = '';
    closeModal('memberModal');
};
window.openUserProfile = (name) => {
    const historyList = document.getElementById('user-transaction-history');
    let hHtml = '';
    expenses.forEach(exp => {
        const share = exp.fixedShare || (exp.amount / exp.participants.length);
        if (exp.paidBy === name) {
            const receive = share * (exp.participants.filter(p => p !== name).length);
            if(receive > 0) hHtml += `<div class="activity-node" style="border-left-color: var(--success)"><b>${exp.title}:</b> Receive ₹${Math.round(receive)}</div>`;
        } else if (exp.participants.includes(name)) {
            hHtml += `<div class="activity-node" style="border-left-color: var(--danger)"><b>${exp.title}:</b> Owe ${exp.paidBy} ₹${Math.round(share)}</div>`;
        }
    });
    document.getElementById('user-profile-header').innerHTML = `<h2 style="font-weight:900;">${name}</h2>`;
    historyList.innerHTML = hHtml || "<p>No active history.</p>";
    openModal('userProfileModal');
};
window.toggleFilter = () => document.getElementById('filter-panel').classList.toggle('hidden');
window.applyFilters = () => refreshUI();
