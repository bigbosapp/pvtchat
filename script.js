import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
    roomsContainer: document.getElementById('roomsContainer'),
    msgInput: document.getElementById('msgInput'),
    sendBtn: document.getElementById('sendBtn'),
    fileInput: document.getElementById('fileInput'),
    previewContainer: document.getElementById('previewContainer'),
    cancelFileBtn: document.getElementById('cancelFileBtn'),
    groupMenuBtn: document.getElementById('groupMenuBtn'),
    groupMenuDropdown: document.getElementById('groupMenuDropdown'),
    leaveGroupBtn: document.getElementById('leaveGroupBtn'),
    viewMembersBtn: document.getElementById('viewMembersBtn'),
    modalMembers: document.getElementById('modalMembers'),
    sidebarTitle: document.getElementById('sidebarTitle'),
    sidebarEmail: document.getElementById('sidebarEmail') // Element baru untuk email
};

// --- AUTH SYSTEM ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        dom.authOverlay.classList.add('hidden');
        dom.appContainer.classList.remove('hidden');
        
        // UPDATE SIDEBAR: USERNAME & EMAIL
        const displayName = user.displayName || user.email.split('@')[0];
        dom.sidebarTitle.innerText = displayName; 
        dom.sidebarEmail.innerText = user.email; // Ganti tulisan "Online" dengan Email
        
        loadRooms(); 
    } else {
        dom.authOverlay.classList.remove('hidden');
        dom.appContainer.classList.add('hidden');
    }
});

// AUTH ACTIONS
document.getElementById('toggleAuthBtn').onclick = function() {
    const isLogin = document.getElementById('authBtn').innerText.includes("Masuk");
    if (isLogin) {
        this.innerHTML = `Sudah punya akun? <span class="font-bold">Login Disini</span>`;
        document.getElementById('authBtn').innerText = "Daftar Akun Baru";
        document.getElementById('authTitle').innerText = "Buat Akun Baru";
        document.getElementById('usernameField').classList.remove('hidden');
    } else {
        this.innerHTML = `Belum punya akun? <span class="font-bold">Daftar Sekarang</span>`;
        document.getElementById('authBtn').innerText = "Masuk";
        document.getElementById('authTitle').innerText = "Login untuk Masuk";
        document.getElementById('usernameField').classList.add('hidden');
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
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
        }
    } catch (e) {
        document.getElementById('authError').innerText = e.message;
        document.getElementById('authError').classList.remove('hidden');
    }
};
document.getElementById('logoutBtn').onclick = () => signOut(auth);

// --- MODAL HANDLERS ---
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
    } catch (e) { alert(e.message); }
};

document.getElementById('confirmJoinRoom').onclick = async () => {
    const code = document.getElementById('joinRoomCode').value.toUpperCase();
    const q = query(collection(db, "rooms"), where("code", "==", code));
    const snap = await getDocs(q);
    if(snap.empty) return alert("Kode salah!");
    const roomDoc = snap.docs[0];
    const roomData = roomDoc.data();
    if(roomData.memberIds && roomData.memberIds.includes(currentUser.uid)) return alert("Sudah bergabung.");

    try {
        const myProfile = { uid: currentUser.uid, email: currentUser.email, username: currentUser.displayName || currentUser.email };
        await updateDoc(roomDoc.ref, { members: arrayUnion(myProfile), memberIds: arrayUnion(currentUser.uid) });
        toggleModal('modalJoin', false); alert("Berhasil bergabung!");
    } catch (e) { alert(e.message); }
};

// --- LOAD ROOMS ---
function loadRooms() {
    const q = query(collection(db, "rooms"), where("memberIds", "array-contains", currentUser.uid));
    onSnapshot(q, (snap) => {
        dom.roomsContainer.innerHTML = '';
        snap.forEach(doc => {
            const data = doc.data();
            const el = document.createElement('div');
            el.className = "p-3 bg-white border border-gray-100 rounded-xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition flex items-center gap-3";
            el.innerHTML = `
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">${data.name[0].toUpperCase()}</div>
                <div class="overflow-hidden"><h4 class="font-bold text-gray-800 text-sm truncate w-full">${data.name}</h4><p class="text-[10px] text-gray-400 font-mono bg-gray-100 px-1 rounded inline-block">Code: ${data.code}</p></div>
            `;
            el.onclick = () => openChatRoom(doc.id, data);
            dom.roomsContainer.appendChild(el);
        });
    });
}

// --- OPEN CHAT ---
function openChatRoom(roomId, roomData) {
    currentRoomId = roomId;
    currentRoomData = roomData;
    document.getElementById('activeRoomName').innerText = roomData.name;
    document.getElementById('activeRoomCode').innerText = roomData.code;

    if (window.innerWidth < 768) {
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
    dom.roomListPanel.classList.remove('-translate-x-full');
    dom.chatPanel.classList.add('translate-x-full');
    dom.chatPanel.classList.add('absolute');
    dom.emptyChatState.classList.remove('hidden');
};

// --- MESSAGES LOGIC (TAMPILAN BARU) ---
function loadMessages(roomId) {
    if (unsubscribeMsg) unsubscribeMsg();
    const q = query(collection(db, "messages"), where("roomId", "==", roomId), orderBy("timestamp", "asc"));

    unsubscribeMsg = onSnapshot(q, (snap) => {
        dom.chatBox.innerHTML = '';
        snap.forEach(doc => {
            const msgData = doc.data();
            msgData.id = doc.id;
            renderMessage(msgData);
        });
        dom.chatBox.scrollTop = dom.chatBox.scrollHeight;
    });
}

window.deleteMessage = async (msgId) => {
    if(!confirm("Hapus pesan ini?")) return;
    try {
        const msgRef = doc(db, "messages", msgId);
        await updateDoc(msgRef, { isDeleted: true, text: "", fileUrl: null });
    } catch (e) { alert(e.message); }
};

function renderMessage(msg) {
    const isMe = msg.uid === currentUser.uid;
    const senderName = msg.username || msg.email.split('@')[0];
    const div = document.createElement('div');
    
    // Layout dasar
    div.className = `flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in group`;

    // 1. Tombol Hapus (Sampah) - Sekarang di Kanan Atas Bubble
    const deleteBtn = (isMe && !msg.isDeleted) ? 
        `<button onclick="deleteMessage('${msg.id}')" class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition ml-2" title="Hapus"><i class="fas fa-trash-alt"></i></button>` : '';

    // 2. Header Bubble (Nama & Hapus)
    const bubbleHeader = `
        <div class="flex justify-between items-start mb-1 gap-4 border-b border-black/5 pb-1">
            <span class="text-[10px] font-bold ${isMe ? 'text-indigo-800' : 'text-orange-600'}">${senderName}</span>
            ${deleteBtn}
        </div>
    `;
    
    // 3. Konten Pesan
    let contentHtml = '';
    if (msg.isDeleted) {
        contentHtml = `<div class="flex items-center gap-2 text-gray-400 italic text-sm py-1"><i class="fas fa-ban text-xs"></i> <span>Pesan dihapus</span></div>`;
    } else {
        let mediaContent = '';
        if(msg.fileUrl) {
            const downloadUrl = msg.fileUrl.replace('/upload/', '/upload/fl_attachment/');
            const downloadMenu = `
                <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition z-10">
                    <button class="bg-black/50 text-white w-6 h-6 rounded-full text-xs hover:bg-black" onclick="toggleDownloadMenu(this)"><i class="fas fa-ellipsis-h"></i></button>
                    <div class="hidden absolute right-0 mt-1 w-32 bg-white shadow-lg rounded-lg py-1 text-xs text-gray-700 z-20 border">
                        <p class="px-2 py-1 bg-gray-50 font-bold text-[10px] text-gray-400 uppercase">Download</p>
                        ${msg.type === 'image' ? `
                            <a href="${msg.fileUrl.replace('/upload/', '/upload/f_jpg,fl_attachment/')}" target="_blank" class="block px-3 py-2 hover:bg-gray-100">as JPG</a>
                            <a href="${msg.fileUrl.replace('/upload/', '/upload/f_png,fl_attachment/')}" target="_blank" class="block px-3 py-2 hover:bg-gray-100">as PNG</a>
                        ` : `
                             <a href="${downloadUrl}" target="_blank" class="block px-3 py-2 hover:bg-gray-100">Video File</a>
                        `}
                    </div>
                </div>
            `;
            const tag = msg.type === 'image' ? 'img' : 'video';
            mediaContent = `<div class="relative inline-block mt-1">${downloadMenu}<${tag} src="${msg.fileUrl}" ${msg.type === 'video' ? 'controls' : ''} class="rounded-lg max-w-[200px] mb-2 border bg-black/10 cursor-pointer" onclick="window.open(this.src)"></${tag}></div>`;
        }
        const textContent = msg.text ? `<p class="text-sm leading-relaxed whitespace-pre-wrap">${msg.text}</p>` : '';
        contentHtml = mediaContent + textContent;
    }

    const bubbleClass = isMe ? 'bg-[#d9fdd3] text-gray-800 rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border';
    const timeString = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...';

    // RENDER FINAL BUBBLE (Username & Hapus ada di dalam)
    div.innerHTML = `
        <div class="max-w-[85%] min-w-[140px] px-3 py-2 rounded-xl shadow-sm ${bubbleClass} relative">
            ${bubbleHeader} ${contentHtml}
            
            <div class="flex justify-end items-center gap-1 mt-1">
                <span class="text-[9px] text-gray-400 select-none">${timeString}</span>
                ${isMe && !msg.isDeleted ? '<i class="fas fa-check-double text-[9px] text-blue-500"></i>' : ''}
            </div>
        </div>
    `;
    dom.chatBox.appendChild(div);
}

window.toggleDownloadMenu = (btn) => {
    const menu = btn.nextElementSibling;
    menu.classList.toggle('hidden');
    setTimeout(() => { document.addEventListener('click', function c(e) { if(!menu.contains(e.target) && e.target !== btn) { menu.classList.add('hidden'); document.removeEventListener('click', c); } }); }, 100);
};

// --- SEND MESSAGE ---
dom.sendBtn.onclick = async () => {
    if (!currentRoomId) return;
    const text = dom.msgInput.value.trim();
    const file = dom.fileInput.files[0];
    if (!text && !file) return;

    dom.sendBtn.disabled = true;
    dom.sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 

    let fileUrl = null;
    let type = 'text';

    try {
        if (file) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", CLOUDINARY_PRESET);
            const resourceType = file.type.startsWith('video') ? 'video' : 'image';
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, { method: "POST", body: formData });
            const data = await res.json();
            fileUrl = data.secure_url;
            type = resourceType;
        }

        await addDoc(collection(db, "messages"), {
            roomId: currentRoomId,
            text: text,
            uid: currentUser.uid,
            email: currentUser.email,
            username: currentUser.displayName || currentUser.email.split('@')[0], 
            fileUrl: fileUrl,
            type: type,
            isDeleted: false,
            timestamp: serverTimestamp()
        });
        dom.msgInput.value = '';
        dom.fileInput.value = '';
        dom.previewContainer.classList.add('hidden');
    } catch (e) { alert("Error: " + e.message); } 
    finally { dom.sendBtn.disabled = false; dom.sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>'; }
};

dom.fileInput.onchange = (e) => { if(e.target.files[0]) { dom.previewContainer.classList.remove('hidden'); document.getElementById('previewName').innerText = e.target.files[0].name; } };
dom.cancelFileBtn.onclick = () => { dom.fileInput.value = ''; dom.previewContainer.classList.add('hidden'); };

// --- GROUP MENU & LEAVE ---
dom.groupMenuBtn.onclick = () => dom.groupMenuDropdown.classList.toggle('hidden');

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

dom.leaveGroupBtn.onclick = async () => {
    if(!confirm("Keluar dari grup?")) return;
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
            alert("Grup dihapus.");
        } else {
            let newLeader = rData.createdBy;
            if (rData.createdBy === currentUser.email) {
                const nextUser = newMembers[0];
                newLeader = (typeof nextUser === 'object') ? nextUser.email : "Unknown";
                alert(`Admin dialihkan ke: ${newLeader}`);
            }
            await updateDoc(roomRef, { members: newMembers, memberIds: newMemberIds, createdBy: newLeader });
            alert("Anda keluar.");
        }
        dom.emptyChatState.classList.remove('hidden');
        dom.chatHeader.classList.add('hidden');
        dom.chatBox.classList.add('hidden');
        dom.chatInputArea.classList.add('hidden');
    } catch (e) { alert(e.message); }
};
