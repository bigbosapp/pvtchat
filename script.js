import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, where, onSnapshot, serverTimestamp, updateDoc, arrayUnion, getDocs, doc, getDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyCsqwNfi53mnOsNX6lXuOrKMWqMLcmoP_g",
  authDomain: "pvt-chat-bc438.firebaseapp.com",
  projectId: "pvt-chat-bc438",
  storageBucket: "pvt-chat-bc438.firebasestorage.app",
  messagingSenderId: "556863388234",
  appId: "1:556863388234:web:31b54ef1f79a03576804b3",
  measurementId: "G-SV7RFSVM45"
};

const CLOUDINARY_CLOUD_NAME = "drmgaxtrf"; 
const CLOUDINARY_PRESET = "pvtchat";   

// --- INIT ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- STATE ---
let currentUser = null;
let currentRoomId = null;
let currentRoomData = null;
let unsubscribeMsg = null; 
let confirmCallback = null; 
let pendingFiles = []; 
let currentRoomMessages = []; 
let searchQuery = ""; 
let allRoomsData = []; // Untuk manajemen arsip

let currentSessionPassword = "(Password terenkripsi, masuk via Auto-Login)";

// --- DOM ELEMENTS ---
const dom = {
    authOverlay: document.getElementById('authOverlay'),
    appContainer: document.getElementById('appContainer'),
    roomListPanel: document.getElementById('roomListPanel'),
    chatPanel: document.getElementById('chatPanel'),
    chatHeader: document.getElementById('chatHeader'),
    chatBox: document.getElementById('chatBox'),
    chatInputArea: document.getElementById('chatInputArea'),
    emptyChatState: document.getElementById('emptyChatState'),
    
    // Sidebar & Archive
    roomsContainer: document.getElementById('roomsContainer'),
    toggleArchiveBtn: document.getElementById('toggleArchiveBtn'),
    archivedRoomsContainer: document.getElementById('archivedRoomsContainer'),
    archiveIcon: document.getElementById('archiveIcon'),

    msgInput: document.getElementById('msgInput'),
    sendBtn: document.getElementById('sendBtn'),
    
    // Auth & Forgot Password
    loginBox: document.getElementById('loginBox'),
    forgotBox: document.getElementById('forgotBox'),
    showForgotBtn: document.getElementById('showForgotBtn'),
    backToLoginBtn: document.getElementById('backToLoginBtn'),
    sendResetBtn: document.getElementById('sendResetBtn'),
    forgotEmailInput: document.getElementById('forgotEmailInput'),

    // Search
    searchMenuBtn: document.getElementById('searchMenuBtn'),
    searchContainer: document.getElementById('searchContainer'),
    searchInput: document.getElementById('searchInput'),
    closeSearchBtn: document.getElementById('closeSearchBtn'),

    // Attach
    multiAttachBtn: document.getElementById('multiAttachBtn'),
    attachMenu: document.getElementById('attachMenu'),
    menuAttachImgBtn: document.getElementById('menuAttachImgBtn'),
    menuAttachFileBtn: document.getElementById('menuAttachFileBtn'),
    multiImageInput: document.getElementById('multiImageInput'),
    multiFileInput: document.getElementById('multiFileInput'),
    multiPreviewContainer: document.getElementById('multiPreviewContainer'),
    multiPreviewList: document.getElementById('multiPreviewList'),
    addMoreFilesInsideBtn: document.getElementById('addMoreFilesInsideBtn'),

    // Menus & Sidebar
    groupMenuBtn: document.getElementById('groupMenuBtn'),
    groupMenuDropdown: document.getElementById('groupMenuDropdown'),
    leaveGroupBtn: document.getElementById('leaveGroupBtn'),
    viewMembersBtn: document.getElementById('viewMembersBtn'),
    
    // NEW Menu Items
    toggleNotifBtn: document.getElementById('toggleNotifBtn'),
    archiveRoomBtn: document.getElementById('archiveRoomBtn'),

    modalMembers: document.getElementById('modalMembers'),
    sidebarTitle: document.getElementById('sidebarTitle'),
    sidebarEmail: document.getElementById('sidebarEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    
    // UI
    toastContainer: document.getElementById('toastContainer'),
    confirmModal: document.getElementById('confirmModal'),
    imageViewer: document.getElementById('imageViewer'),
    viewerImage: document.getElementById('viewerImage'),
    viewerVideo: document.getElementById('viewerVideo'),
    viewerMainDownloadBtn: document.getElementById('viewerMainDownloadBtn'),
    downloadOptions: document.getElementById('downloadOptions'),
    dlBtnText: document.getElementById('dlBtnText'),
    btnDlJpg: document.getElementById('btnDlJpg'),
    btnDlPng: document.getElementById('btnDlPng'),

    // Logout Modal
    logoutModal: document.getElementById('logoutModal'),
    logoutTitle: document.getElementById('logoutTitle'),
    logoutEmailDisplay: document.getElementById('logoutEmailDisplay'),
    logoutPasswordDisplay: document.getElementById('logoutPasswordDisplay'),
    btnTogglePassword: document.getElementById('btnTogglePassword'),
    logoutActionButtons: document.getElementById('logoutActionButtons'),
    btnCancelLogout: document.getElementById('btnCancelLogout'),
    btnConfirmLogout: document.getElementById('btnConfirmLogout')
};

// --- NAVIGATION & HARDWARE BACK BUTTON (HISTORY API) ---
window.addEventListener('popstate', (e) => {
    // Jika panel chat sedang terbuka di layar kecil, tombol kembali akan menutup chat
    if (window.innerWidth < 768 && !dom.chatPanel.classList.contains('translate-x-full')) {
        dom.roomListPanel.classList.remove('-translate-x-full');
        dom.chatPanel.classList.add('translate-x-full');
        dom.chatPanel.classList.add('absolute');
        dom.emptyChatState.classList.remove('hidden');
        dom.searchContainer.classList.add('hidden');
    }
});

// --- HELPER FUNCTIONS ---
window.showToast = (msg, type = 'success') => {
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-500' : 'bg-gray-800';
    const icon = type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : '<i class="fas fa-check-circle"></i>';
    toast.className = `${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-bold pointer-events-auto toast-enter`;
    toast.innerHTML = `${icon} <span>${msg}</span>`;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => { toast.classList.remove('toast-enter'); toast.classList.add('toast-enter-active'); }, 10);
    setTimeout(() => { toast.classList.remove('toast-enter-active'); toast.classList.add('toast-exit-active'); setTimeout(() => toast.remove(), 300); }, 3000);
};

window.showCustomConfirm = (title, msg, callback) => {
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmMessage').innerText = msg;
    dom.confirmModal.classList.remove('hidden');
    confirmCallback = callback;
};

document.getElementById('btnCancelConfirm').onclick = () => dom.confirmModal.classList.add('hidden');
document.getElementById('btnOkConfirm').onclick = () => { if(confirmCallback) confirmCallback(); dom.confirmModal.classList.add('hidden'); };

// --- LOGOUT FLOW ---
dom.logoutBtn.onclick = () => {
    dom.logoutModal.classList.remove('hidden');
    dom.logoutTitle.innerText = "Informasi Akun";
    dom.logoutEmailDisplay.innerText = currentUser.email;
    
    dom.logoutPasswordDisplay.innerText = "********";
    dom.logoutPasswordDisplay.classList.add("tracking-widest");
    
    dom.btnTogglePassword.innerText = "Lihat Password";
    dom.btnTogglePassword.classList.remove('hidden');
    dom.logoutActionButtons.classList.add('hidden');
    dom.logoutActionButtons.classList.remove('flex');
};

dom.btnTogglePassword.onclick = () => {
    dom.logoutTitle.innerText = "Keluar Sekarang, Pastikan ingat pasword login anda :";
    dom.logoutPasswordDisplay.innerText = currentSessionPassword;
    dom.logoutPasswordDisplay.classList.remove("tracking-widest");
    
    dom.btnTogglePassword.classList.add('hidden');
    dom.logoutActionButtons.classList.remove('hidden');
    dom.logoutActionButtons.classList.add('flex');
};

dom.btnCancelLogout.onclick = () => dom.logoutModal.classList.add('hidden');

dom.btnConfirmLogout.onclick = () => {
    dom.logoutModal.classList.add('hidden');
    currentSessionPassword = "(Password terenkripsi, masuk via Auto-Login)"; 
    signOut(auth);
};

// --- VIEWER ---
window.viewImage = (url, type, originalName = 'download') => {
    dom.imageViewer.classList.remove('hidden');
    dom.downloadOptions.classList.add('hidden'); 
    
    let baseName = originalName;
    if(baseName.includes('.')) baseName = baseName.substring(0, baseName.lastIndexOf('.'));

    if (type === 'video') {
        dom.viewerImage.classList.add('hidden');
        dom.viewerVideo.classList.remove('hidden');
        dom.viewerVideo.src = url;
        dom.dlBtnText.innerText = "Download Video";
        dom.viewerMainDownloadBtn.onclick = () => {
            const dlUrl = url.replace('/upload/', '/upload/fl_attachment/');
            window.downloadFile(dlUrl, originalName);
        };
    } else {
        dom.viewerVideo.classList.add('hidden');
        dom.viewerImage.classList.remove('hidden');
        dom.viewerImage.src = url;
        dom.dlBtnText.innerText = "Download Options";

        dom.viewerMainDownloadBtn.onclick = (e) => {
            e.stopPropagation();
            dom.downloadOptions.classList.toggle('hidden');
        };

        dom.btnDlJpg.onclick = () => {
            const dlUrl = url.replace('/upload/', '/upload/f_jpg,fl_attachment/');
            window.downloadFile(dlUrl, `${baseName}.jpg`);
            dom.downloadOptions.classList.add('hidden');
        };
        dom.btnDlPng.onclick = () => {
            const dlUrl = url.replace('/upload/', '/upload/f_png,fl_attachment/');
            window.downloadFile(dlUrl, `${baseName}.png`);
            dom.downloadOptions.classList.add('hidden');
        };
    }
};

document.addEventListener('click', (e) => {
    if (!dom.downloadOptions.contains(e.target) && !dom.viewerMainDownloadBtn.contains(e.target)) {
        dom.downloadOptions.classList.add('hidden');
    }
    if (!dom.attachMenu.contains(e.target) && !dom.multiAttachBtn.contains(e.target) && !dom.addMoreFilesInsideBtn.contains(e.target)) {
        dom.attachMenu.classList.add('hidden');
    }
});

document.getElementById('closeImageViewer').onclick = () => {
    dom.imageViewer.classList.add('hidden');
    dom.viewerVideo.pause(); 
    dom.viewerVideo.src = "";
};

window.downloadFile = async (url, filename) => {
    showToast(`Mengunduh ${filename}...`, "success");
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};

// --- MULTI ATTACHMENT ---
dom.multiAttachBtn.onclick = (e) => {
    e.stopPropagation();
    dom.attachMenu.classList.toggle('hidden');
};
dom.addMoreFilesInsideBtn.onclick = (e) => {
    e.stopPropagation();
    dom.attachMenu.classList.remove('hidden');
};

dom.menuAttachImgBtn.onclick = () => { dom.multiImageInput.click(); dom.attachMenu.classList.add('hidden'); };
dom.menuAttachFileBtn.onclick = () => { dom.multiFileInput.click(); dom.attachMenu.classList.add('hidden'); };

function handleFileSelection(e) {
    if(e.target.files.length > 0) {
        pendingFiles = pendingFiles.concat(Array.from(e.target.files));
        renderPendingFiles();
    }
    e.target.value = ''; 
}

dom.multiImageInput.onchange = handleFileSelection;
dom.multiFileInput.onchange = handleFileSelection;

window.removePendingFile = (index) => {
    pendingFiles.splice(index, 1);
    renderPendingFiles();
};

function renderPendingFiles() {
    if(pendingFiles.length === 0) {
        dom.multiPreviewContainer.classList.add('hidden');
        return;
    }
    
    dom.multiPreviewContainer.classList.remove('hidden');
    dom.multiPreviewList.innerHTML = '';
    
    pendingFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = "relative flex items-center gap-2 p-2 bg-gray-50 border rounded-lg max-w-[200px] w-full group";
        
        let iconHtml = '<i class="fas fa-file-alt text-2xl text-indigo-400"></i>';
        if (file.type.startsWith('image/')) {
            const tempUrl = URL.createObjectURL(file);
            iconHtml = `<img src="${tempUrl}" class="w-8 h-8 object-cover rounded shadow-sm">`;
        } else if (file.type.startsWith('video/')) {
            iconHtml = '<i class="fas fa-video text-2xl text-purple-400"></i>';
        }

        div.innerHTML = `
            <div class="flex-shrink-0">${iconHtml}</div>
            <div class="overflow-hidden w-full">
                <p class="text-xs font-bold text-gray-700 truncate" title="${file.name}">${file.name}</p>
                <p class="text-[10px] text-gray-400">${(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onclick="removePendingFile(${index})" class="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center shadow transition scale-0 group-hover:scale-100">
                <i class="fas fa-times text-[10px]"></i>
            </button>
        `;
        dom.multiPreviewList.appendChild(div);
    });
}

// --- SEARCH SYSTEM ---
dom.searchMenuBtn.onclick = () => {
    dom.searchContainer.classList.remove('hidden');
    dom.searchContainer.classList.add('flex');
    dom.searchInput.focus();
};

dom.closeSearchBtn.onclick = () => {
    dom.searchContainer.classList.add('hidden');
    dom.searchContainer.classList.remove('flex');
    dom.searchInput.value = '';
    searchQuery = '';
    renderAllMessages(); 
};

dom.searchInput.oninput = (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderAllMessages(); 
};

// --- AUTH SYSTEM & LUPA PASSWORD ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        dom.authOverlay.classList.add('hidden');
        dom.appContainer.classList.remove('hidden');
        const displayName = user.displayName || user.email.split('@')[0];
        dom.sidebarTitle.innerText = displayName; 
        dom.sidebarEmail.innerText = user.email; 
        loadRooms(); 
    } else {
        dom.authOverlay.classList.remove('hidden');
        dom.appContainer.classList.add('hidden');
        dom.forgotBox.classList.add('hidden');
        dom.loginBox.classList.remove('hidden');
    }
});

dom.showForgotBtn.onclick = () => {
    dom.loginBox.classList.add('hidden');
    dom.forgotBox.classList.remove('hidden');
    dom.forgotEmailInput.value = document.getElementById('emailInput').value;
};

dom.backToLoginBtn.onclick = () => {
    dom.forgotBox.classList.add('hidden');
    dom.loginBox.classList.remove('hidden');
};

dom.sendResetBtn.onclick = async () => {
    const email = dom.forgotEmailInput.value.trim();
    if (!email) return showToast("Masukkan alamat email Anda terlebih dahulu!", "error");

    dom.sendResetBtn.disabled = true;
    dom.sendResetBtn.innerText = "Mengirim...";
    try {
        await sendPasswordResetEmail(auth, email);
        showToast("Tautan reset terkirim! Silakan cek email Anda.", "success");
        dom.forgotEmailInput.value = '';
        dom.backToLoginBtn.click(); 
    } catch (e) { showToast("Gagal: " + e.message, "error"); } 
    finally { dom.sendResetBtn.disabled = false; dom.sendResetBtn.innerText = "Kirim Link Reset"; }
};

document.getElementById('toggleAuthBtn').onclick = function() {
    const isLogin = document.getElementById('authBtn').innerText.includes("Masuk");
    if (isLogin) {
        this.innerHTML = `Sudah punya akun? <span class="font-bold">Login Disini</span>`;
        document.getElementById('authBtn').innerText = "Daftar Akun Baru";
        document.getElementById('authTitle').innerText = "Buat Akun Baru";
        document.getElementById('usernameField').classList.remove('hidden');
        dom.showForgotBtn.classList.add('hidden'); 
    } else {
        this.innerHTML = `Belum punya akun? <span class="font-bold">Daftar Sekarang</span>`;
        document.getElementById('authBtn').innerText = "Masuk";
        document.getElementById('authTitle').innerText = "Login untuk Masuk";
        document.getElementById('usernameField').classList.add('hidden');
        dom.showForgotBtn.classList.remove('hidden'); 
    }
};

document.getElementById('authBtn').onclick = async () => {
    const email = document.getElementById('emailInput').value;
    const pass = document.getElementById('passInput').value;
    const username = document.getElementById('usernameInput').value;
    const isRegister = document.getElementById('authBtn').innerText.includes("Daftar");

    try {
        if (isRegister) {
            if (!username) throw new Error("Username wajib diisi!");
            const userCred = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(userCred.user, { displayName: username });
            currentUser = userCred.user;
            currentSessionPassword = pass; 
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
            currentSessionPassword = pass; 
        }
    } catch (e) { showToast(e.message, 'error'); }
};

// --- MODALS ---
const toggleModal = (id, show) => document.getElementById(id).classList.toggle('hidden', !show);
document.getElementById('btnOpenCreate').onclick = () => toggleModal('modalCreate', true);
document.getElementById('btnOpenJoin').onclick = () => toggleModal('modalJoin', true);
document.getElementById('btnCloseCreate').onclick = () => toggleModal('modalCreate', false);
document.getElementById('btnCloseJoin').onclick = () => toggleModal('modalJoin', false);
document.getElementById('btnCloseSuccess').onclick = () => toggleModal('modalSuccess', false);

// --- GROUP LOGIC ---
document.getElementById('confirmCreateRoom').onclick = async () => {
    const name = document.getElementById('newRoomName').value.trim();
    if(!name) return;
    const code = Math.random().toString(36).substring(2, 9).toUpperCase();
    try {
        const myProfile = { uid: currentUser.uid, email: currentUser.email, username: currentUser.displayName || currentUser.email };
        await addDoc(collection(db, "rooms"), {
            name: name, code: code, members: [myProfile], memberIds: [currentUser.uid], 
            createdBy: currentUser.email, createdAt: serverTimestamp()
        });
        toggleModal('modalCreate', false); toggleModal('modalSuccess', true);
        document.getElementById('generatedCodeDisplay').innerText = code;
    } catch (e) { showToast(e.message, 'error'); }
};

document.getElementById('confirmJoinRoom').onclick = async () => {
    const code = document.getElementById('joinRoomCode').value.toUpperCase();
    const q = query(collection(db, "rooms"), where("code", "==", code));
    const snap = await getDocs(q);
    if(snap.empty) return showToast("Kode salah!", 'error');
    const roomDoc = snap.docs[0];
    const roomData = roomDoc.data();
    if(roomData.memberIds && roomData.memberIds.includes(currentUser.uid)) return showToast("Sudah bergabung.", 'error');

    try {
        const myProfile = { uid: currentUser.uid, email: currentUser.email, username: currentUser.displayName || currentUser.email };
        await updateDoc(roomDoc.ref, { members: arrayUnion(myProfile), memberIds: arrayUnion(currentUser.uid) });
        toggleModal('modalJoin', false); showToast("Berhasil bergabung!", 'success');
    } catch (e) { showToast(e.message, 'error'); }
};

// --- ARSIP & LOAD ROOMS ---
dom.toggleArchiveBtn.onclick = () => {
    dom.archivedRoomsContainer.classList.toggle('hidden');
    dom.archiveIcon.classList.toggle('rotate-180');
};

function renderRoomsList() {
    dom.roomsContainer.innerHTML = '';
    dom.archivedRoomsContainer.innerHTML = '';
    let archivedList = JSON.parse(localStorage.getItem(`archive_${currentUser.uid}`) || '[]');
    
    allRoomsData.forEach(data => {
        const el = document.createElement('div');
        el.className = "p-3 bg-white border border-gray-100 rounded-xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition flex items-center gap-3";
        el.innerHTML = `
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">${data.name[0].toUpperCase()}</div>
            <div class="overflow-hidden"><h4 class="font-bold text-gray-800 text-sm truncate w-full">${data.name}</h4><p class="text-[10px] text-gray-400 font-mono bg-gray-100 px-1 rounded inline-block">Code: ${data.code}</p></div>
        `;
        el.onclick = () => openChatRoom(data.id, data);
        
        if (archivedList.includes(data.id)) {
            dom.archivedRoomsContainer.appendChild(el);
        } else {
            dom.roomsContainer.appendChild(el);
        }
    });
}

function loadRooms() {
    const q = query(collection(db, "rooms"), where("memberIds", "array-contains", currentUser.uid));
    onSnapshot(q, (snap) => {
        allRoomsData = [];
        snap.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            allRoomsData.push(data);
        });
        renderRoomsList();
    });
}

function openChatRoom(roomId, roomData) {
    currentRoomId = roomId;
    currentRoomData = roomData;
    document.getElementById('activeRoomName').innerText = roomData.name;
    document.getElementById('activeRoomCode').innerText = roomData.code;

    dom.searchContainer.classList.add('hidden');
    dom.searchContainer.classList.remove('flex');
    dom.searchInput.value = '';
    searchQuery = '';
    updateDropdownMenuText(); // Sinkronkan text tombol Notif & Arsip

    if (window.innerWidth < 768) {
        // Daftarkan ke History API saat membuka obrolan baru dari dashboard
        if (dom.chatPanel.classList.contains('translate-x-full')) {
            history.pushState({ page: 'chat' }, '', '#chat');
        }
        dom.roomListPanel.classList.add('-translate-x-full');
        dom.chatPanel.classList.remove('translate-x-full');
        dom.chatPanel.classList.remove('absolute');
    }
    dom.emptyChatState.classList.add('hidden'); 
    dom.chatHeader.classList.remove('hidden');
    dom.chatBox.classList.remove('hidden');
    dom.chatInputArea.classList.remove('hidden');
    dom.groupMenuDropdown.classList.add('hidden'); 
    loadMessages(roomId);
}

document.getElementById('backToDashboard').onclick = () => {
    // Memanggil API Kembali Bawaan (Browser/HP) agar urutan tetap sinkron
    history.back(); 
};

// --- MENU TITIK 3 (NOTIF & ARSIP) ---
function updateDropdownMenuText() {
    let archivedList = JSON.parse(localStorage.getItem(`archive_${currentUser.uid}`) || '[]');
    let notifList = JSON.parse(localStorage.getItem(`notif_${currentUser.uid}`) || '[]');
    
    dom.archiveRoomBtn.innerHTML = archivedList.includes(currentRoomId) 
        ? '<i class="fas fa-box-open mr-2 text-gray-500"></i> Keluarkan dari Arsip'
        : '<i class="fas fa-archive mr-2 text-gray-500"></i> Arsipkan Chat';
        
    dom.toggleNotifBtn.innerHTML = notifList.includes(currentRoomId)
        ? '<i class="fas fa-bell-slash mr-2 text-yellow-500"></i> Matikan Notifikasi'
        : '<i class="fas fa-bell mr-2 text-yellow-500"></i> Aktifkan Notifikasi';
}

dom.groupMenuBtn.onclick = () => {
    updateDropdownMenuText();
    dom.groupMenuDropdown.classList.toggle('hidden');
};

dom.archiveRoomBtn.onclick = () => {
    dom.groupMenuDropdown.classList.add('hidden');
    let archivedList = JSON.parse(localStorage.getItem(`archive_${currentUser.uid}`) || '[]');
    if (archivedList.includes(currentRoomId)) {
        archivedList = archivedList.filter(id => id !== currentRoomId);
        showToast("Chat dikembalikan ke utama", "success");
    } else {
        archivedList.push(currentRoomId);
        showToast("Chat diarsipkan", "success");
        if (window.innerWidth < 768) history.back(); // Otomatis kembali jika di HP
    }
    localStorage.setItem(`archive_${currentUser.uid}`, JSON.stringify(archivedList));
    renderRoomsList();
    updateDropdownMenuText();
};

dom.toggleNotifBtn.onclick = async () => {
    dom.groupMenuDropdown.classList.add('hidden');
    
    if (Notification.permission !== "granted") {
        try {
            const perm = await Notification.requestPermission();
            if (perm !== "granted") return showToast("Izin notifikasi ditolak browser.", "error");
        } catch (e) {
            return showToast("Browser tidak mendukung notifikasi", "error");
        }
    }
    
    let notifList = JSON.parse(localStorage.getItem(`notif_${currentUser.uid}`) || '[]');
    if (notifList.includes(currentRoomId)) {
        notifList = notifList.filter(id => id !== currentRoomId);
        showToast("Notifikasi dimatikan untuk grup ini", "success");
    } else {
        notifList.push(currentRoomId);
        showToast("Notifikasi diaktifkan untuk grup ini", "success");
    }
    localStorage.setItem(`notif_${currentUser.uid}`, JSON.stringify(notifList));
    updateDropdownMenuText();
};

// Fungsi Pemicu Notifikasi
function checkAndShowNotification(roomId, msgData) {
    let notifList = JSON.parse(localStorage.getItem(`notif_${currentUser.uid}`) || '[]');
    if (notifList.includes(roomId) && Notification.permission === "granted") {
        let notifBody = msgData.text || "Mengirim lampiran";
        if (msgData.attachments && msgData.attachments.length > 0) {
             notifBody = "Mengirim " + msgData.attachments.length + " file/gambar";
        }
        new Notification(msgData.username || "Pesan Baru", {
            body: notifBody,
            icon: "https://cdn-icons-png.flaticon.com/512/1041/1041916.png" 
        });
    }
}

// --- MESSAGES LOGIC & SEARCH RENDER ---
function loadMessages(roomId) {
    if (unsubscribeMsg) unsubscribeMsg();
    const q = query(collection(db, "messages"), where("roomId", "==", roomId), orderBy("timestamp", "asc"));

    let isFirstLoad = true; // Pencegah spam notifikasi saat baru buka room
    
    unsubscribeMsg = onSnapshot(q, (snap) => {
        currentRoomMessages = []; 
        
        // Cek pesan yang benar-benar BARU untuk memicu notifikasi
        snap.docChanges().forEach((change) => {
            if (change.type === "added" && !isFirstLoad) {
                const msgData = change.doc.data();
                if (msgData.uid !== currentUser.uid) {
                    checkAndShowNotification(roomId, msgData);
                }
            }
        });
        
        snap.forEach(doc => {
            const msgData = doc.data();
            msgData.id = doc.id;
            currentRoomMessages.push(msgData);
        });
        
        isFirstLoad = false;
        renderAllMessages(); 
    });
}

function renderAllMessages() {
    dom.chatBox.innerHTML = '';
    let lastDateString = null; 

    const isSearchingImage = searchQuery === 'gambar' || searchQuery === 'foto';
    const isSearchingVideo = searchQuery === 'video';
    const isSearchingFile = searchQuery === 'file' || searchQuery === 'dokumen' || searchQuery === 'pdf';

    const filteredMessages = currentRoomMessages.filter(msg => {
        if (!searchQuery) return true; 
        
        if (isSearchingImage && (msg.type === 'image' || (msg.attachments && msg.attachments.some(a => a.type === 'image')))) return true;
        if (isSearchingVideo && (msg.type === 'video' || (msg.attachments && msg.attachments.some(a => a.type === 'video')))) return true;
        if (isSearchingFile && (msg.type === 'raw' || (msg.attachments && msg.attachments.some(a => a.type === 'raw')))) return true;

        if (msg.text && msg.text.toLowerCase().includes(searchQuery)) return true;
        
        if (msg.fileName && msg.fileName.toLowerCase().includes(searchQuery)) return true;
        
        if (msg.attachments && msg.attachments.length > 0) {
            return msg.attachments.some(att => att.fileName && att.fileName.toLowerCase().includes(searchQuery));
        }
        
        return false; 
    });

    if (filteredMessages.length === 0 && searchQuery) {
        dom.chatBox.innerHTML = `<div class="text-center text-gray-400 mt-10 text-sm">Tidak ada hasil ditemukan untuk "<b>${searchQuery}</b>"</div>`;
        return;
    }

    filteredMessages.forEach(msgData => {
        const msgDate = msgData.timestamp ? msgData.timestamp.toDate() : new Date();
        const currentDateString = msgDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        if (currentDateString !== lastDateString) {
            const divider = document.createElement('div');
            divider.className = "flex justify-center items-center my-6 select-none";
            divider.innerHTML = `
                <div class="h-px bg-gray-200 flex-1"></div>
                <span class="px-4 py-1 rounded-full bg-gray-50 border text-[10px] font-bold text-gray-500 uppercase tracking-widest">${currentDateString}</span>
                <div class="h-px bg-gray-200 flex-1"></div>
            `;
            dom.chatBox.appendChild(divider);
            lastDateString = currentDateString;
        }

        renderMessage(msgData);
    });
    
    if (!searchQuery) {
        dom.chatBox.scrollTop = dom.chatBox.scrollHeight;
    }
}

window.deleteMessage = (msgId) => {
    showCustomConfirm("Hapus Pesan", "Pesan akan dihapus untuk semua orang. Lanjutkan?", async () => {
        try {
            const msgRef = doc(db, "messages", msgId);
            await updateDoc(msgRef, { isDeleted: true, text: "", fileUrl: null, attachments: null });
            showToast("Pesan dihapus", 'success');
        } catch (e) { showToast(e.message, 'error'); }
    });
};

function renderMessage(msg) {
    const isMe = msg.uid === currentUser.uid;
    const senderName = msg.username || msg.email.split('@')[0];
    const div = document.createElement('div');
    div.className = `flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in group`;

    const deleteBtn = (isMe && !msg.isDeleted) ? 
        `<button onclick="deleteMessage('${msg.id}')" class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition ml-2" title="Hapus"><i class="fas fa-trash-alt"></i></button>` : '';

    const bubbleHeader = `
        <div class="flex justify-between items-start mb-1 gap-4 border-b border-black/5 pb-1">
            <span class="text-[10px] font-bold ${isMe ? 'text-indigo-800' : 'text-orange-600'}">${senderName}</span>
            ${deleteBtn}
        </div>
    `;
    
    let contentHtml = '';
    if (msg.isDeleted) {
        contentHtml = `<div class="flex items-center gap-2 text-gray-400 italic text-sm py-1"><i class="fas fa-ban text-xs"></i> <span>Pesan dihapus</span></div>`;
    } else {
        let mediaContent = '';
        
        let attachmentsToRender = msg.attachments || [];
        if (msg.fileUrl && attachmentsToRender.length === 0) {
            attachmentsToRender.push({ fileUrl: msg.fileUrl, fileName: msg.fileName, type: msg.type });
        }

        if (attachmentsToRender.length > 0) {
            mediaContent += `<div class="flex flex-wrap gap-2 mt-2 mb-2">`;
            attachmentsToRender.forEach(att => {
                const safeName = (att.fileName || 'file_terlampir').replace(/'/g, "\\'");
                if(att.type === 'image') {
                    mediaContent += `
                        <div class="relative inline-block">
                            <img src="${att.fileUrl}" class="rounded-lg h-28 w-auto object-cover border bg-black/10 cursor-pointer hover:opacity-90 transition" 
                            onclick="viewImage('${att.fileUrl}', 'image', '${safeName}')">
                        </div>`;
                } else if (att.type === 'video') {
                    mediaContent += `
                        <div class="relative inline-block h-28 w-auto">
                            <video src="${att.fileUrl}" class="rounded-lg h-full object-cover border bg-black/10 cursor-pointer" onclick="viewImage('${att.fileUrl}', 'video', '${safeName}')"></video>
                            <button onclick="viewImage('${att.fileUrl}', 'video', '${safeName}')" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/50 hover:bg-indigo-600 transition text-white w-10 h-10 rounded-full flex items-center justify-center"><i class="fas fa-play"></i></button>
                        </div>`;
                } else {
                    const dName = att.fileName || 'File Terlampir';
                    mediaContent += `
                        <div class="relative inline-block mb-1 w-full max-w-[250px]">
                            <div class="flex items-center gap-3 p-2 bg-black/5 hover:bg-black/10 transition border rounded-lg">
                                <div class="bg-white border text-indigo-600 w-10 h-10 rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                                    <i class="fas fa-file-alt text-xl"></i>
                                </div>
                                <div class="overflow-hidden w-full flex flex-col justify-center">
                                    <p class="text-xs font-bold text-gray-700 truncate" title="${dName}">${dName}</p>
                                    <button type="button" onclick="downloadFile('${att.fileUrl}', '${safeName}')" class="text-[10px] text-indigo-600 font-bold hover:underline mt-1 inline-block text-left cursor-pointer border-none bg-transparent p-0 w-fit">
                                        <i class="fas fa-download mr-1"></i> Unduh
                                    </button>
                                </div>
                            </div>
                        </div>`;
                }
            });
            mediaContent += `</div>`;
        }

        let displayMsgText = msg.text || '';
        if (searchQuery && displayMsgText.toLowerCase().includes(searchQuery)) {
            const regex = new RegExp(`(${searchQuery})`, "gi");
            displayMsgText = displayMsgText.replace(regex, "<span class='bg-yellow-200 text-black px-1 rounded'>$1</span>");
        }

        const textContent = displayMsgText ? `<p class="text-sm leading-relaxed whitespace-pre-wrap">${displayMsgText}</p>` : '';
        contentHtml = mediaContent + textContent;
    }

    const bubbleClass = isMe ? 'bg-[#d9fdd3] text-gray-800 rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border';
    
    const msgDate = msg.timestamp ? msg.timestamp.toDate() : new Date();
    const timeString = msgDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');

    div.innerHTML = `
        <div class="max-w-[85%] min-w-[140px] px-3 py-2 rounded-xl shadow-sm ${bubbleClass} relative">
            ${bubbleHeader} 
            ${contentHtml}
            <div class="flex justify-end items-center gap-1 mt-1">
                <span class="text-[9px] text-gray-400 select-none">${timeString}</span>
                ${isMe && !msg.isDeleted ? '<i class="fas fa-check-double text-[9px] text-blue-500"></i>' : ''}
            </div>
        </div>
    `;
    dom.chatBox.appendChild(div);
}

// --- SEND MESSAGE ---
dom.sendBtn.onclick = async () => {
    if (!currentRoomId) return;
    const text = dom.msgInput.value.trim();
    if (!text && pendingFiles.length === 0) return;

    dom.sendBtn.disabled = true;
    dom.sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 

    let finalAttachments = [];

    try {
        if (pendingFiles.length > 0) {
            const uploadPromises = pendingFiles.map(async (file) => {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("upload_preset", CLOUDINARY_PRESET);
                
                let resourceType = 'raw';
                if (file.type.startsWith('image/')) resourceType = 'image';
                else if (file.type.startsWith('video/')) resourceType = 'video';
                
                const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, { method: "POST", body: formData });
                const data = await res.json();
                
                return {
                    fileUrl: data.secure_url,
                    fileName: file.name,
                    type: resourceType
                };
            });

            finalAttachments = await Promise.all(uploadPromises);
        }

        await addDoc(collection(db, "messages"), {
            roomId: currentRoomId,
            text: text,
            uid: currentUser.uid,
            email: currentUser.email,
            username: currentUser.displayName || currentUser.email.split('@')[0], 
            attachments: finalAttachments.length > 0 ? finalAttachments : null,
            isDeleted: false,
            timestamp: serverTimestamp()
        });

        dom.msgInput.value = '';
        pendingFiles = [];
        renderPendingFiles();

    } catch (e) { 
        showToast("Gagal mengirim: " + e.message, 'error'); 
    } finally { 
        dom.sendBtn.disabled = false; 
        dom.sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>'; 
    }
};

// --- GROUP MENU OTHER ACTIONS ---
dom.viewMembersBtn.onclick = () => {
    dom.groupMenuDropdown.classList.add('hidden');
    dom.modalMembers.classList.remove('hidden');
    const list = document.getElementById('membersListContainer');
    list.innerHTML = '';
    const members = currentRoomData.members || []; 
    document.getElementById('memberCount').innerText = members.length;

    members.forEach(m => {
        const name = (typeof m === 'object') ? (m.username || m.email.split('@')[0]) : "User Lama";
        const email = (typeof m === 'object') ? m.email : "Hidden";
        const uid = (typeof m === 'object') ? m.uid : m;
        const isLeader = (currentRoomData.createdBy === email);
        const isMe = (uid === currentUser.uid);

        const item = document.createElement('div');
        item.className = "flex justify-between items-center p-3 border-b last:border-0";
        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">${name[0].toUpperCase()}</div>
                <div><p class="text-sm font-bold text-gray-800">${name} ${isMe ? '(Anda)' : ''}</p></div>
            </div>
            ${isLeader ? '<span class="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-1 rounded font-bold">Admin</span>' : ''}
        `;
        list.appendChild(item);
    });
};

dom.leaveGroupBtn.onclick = () => {
    showCustomConfirm("Keluar Grup", "Anda akan keluar dari grup ini. Lanjutkan?", async () => {
        dom.groupMenuDropdown.classList.add('hidden');
        try {
            const roomRef = doc(db, "rooms", currentRoomId);
            const roomSnap = await getDoc(roomRef);
            const rData = roomSnap.data();

            const newMembers = rData.members.filter(m => ((typeof m === 'object' ? m.uid : m) !== currentUser.uid));
            const newMemberIds = rData.memberIds.filter(id => id !== currentUser.uid);

            if (newMembers.length === 0) {
                await deleteDoc(roomRef);
                const chatQ = query(collection(db, "messages"), where("roomId", "==", currentRoomId));
                const chatSnap = await getDocs(chatQ);
                const batch = writeBatch(db);
                chatSnap.forEach(d => batch.delete(d.ref));
                await batch.commit();
                showToast("Grup dihapus karena kosong.", 'success');
            } else {
                let newLeader = rData.createdBy;
                if (rData.createdBy === currentUser.email) {
                    const nextUser = newMembers[0];
                    newLeader = (typeof nextUser === 'object') ? nextUser.email : "Unknown";
                    showToast(`Admin dialihkan ke: ${newLeader}`, 'success');
                }
                await updateDoc(roomRef, { members: newMembers, memberIds: newMemberIds, createdBy: newLeader });
                showToast("Anda telah keluar.", 'success');
            }
            dom.emptyChatState.classList.remove('hidden');
            dom.chatHeader.classList.add('hidden');
            dom.chatBox.classList.add('hidden');
            dom.chatInputArea.classList.add('hidden');
        } catch (e) { showToast(e.message, 'error'); }
    });
};
