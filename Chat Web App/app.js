import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDocs, setDoc 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Elements
const welcomeScreen = document.getElementById('welcomeScreen');
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const startButton = document.getElementById('startButton');
const googleLogin = document.getElementById('googleLogin');
const logoutButton = document.getElementById('logoutButton');
const userName = document.getElementById('userName');
const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
let currentUser = null;
let selectedUser = null;

// --- Screens ---
startButton.onclick = () => {
  welcomeScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
};

googleLogin.onclick = async () => {
  await signInWithPopup(auth, provider); 
};

logoutButton.onclick = async () => {
  await signOut(auth);
};

// --- Auth State Change and User Save Logic  ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    userName.textContent = user.displayName;

    // Firestore
    const userRef = doc(db, "users", user.uid);
    
    try {
      // 1. Data Save
      await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          photoURL: user.photoURL || null,
          lastSeen: serverTimestamp() 
      }, { merge: true });

      // 2. Loading Users Lists
      await loadUsers(); 

      // 3. MOVING TO CHAT SCREEN
      welcomeScreen.classList.add('hidden');
      loginScreen.classList.add('hidden');
      chatScreen.classList.remove('hidden');
      
    } catch (error) {
      console.error("লগইন বা ইউজার লোড করার সময় গুরুতর সমস্যা:", error);
     
      await signOut(auth); 
    }
  } else {
    
    currentUser = null;
    selectedUser = null;
    chatScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden'); 
    welcomeScreen.classList.add('hidden');
  }
});

// --- Load Users ---
async function loadUsers() {
  const userListDiv = document.getElementById('userList');
  if (!userListDiv) return;
  userListDiv.innerHTML = '';
  
  const q = query(collection(db, "users"), orderBy("name")); 
  const usersSnapshot = await getDocs(q);
  
  usersSnapshot.forEach((docSnap) => {
    const user = docSnap.data();
    if (user.uid !== currentUser.uid) {
      const btn = document.createElement('button');
      btn.textContent = user.name;
      btn.className = "p-2 border rounded my-1 hover:bg-blue-100 dark:hover:bg-gray-700 w-full text-left"; 
      btn.onclick = () => openChat(user);
      userListDiv.appendChild(btn);
    }
  });
}

// --- Open Chat ---
function openChat(user) {
  selectedUser = user;
  messagesDiv.innerHTML = '';
  loadMessages();
}

// --- Get Chat ID ---
function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

// --- Load Messages ---
async function loadMessages() {
  if (!selectedUser) return;
  const chatId = getChatId(currentUser.uid, selectedUser.uid);
  const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp"));
  
  onSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = '';
    
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const div = document.createElement('div');
      
      const isSent = msg.sender === currentUser.uid;
      const baseClass = isSent ? 'sent' : 'received';

      div.className = `message ${baseClass}`;
      
      div.textContent = msg.text;
      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// --- Send Message ---
messageForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!messageInput.value.trim() || !selectedUser) return;
  
  const chatId = getChatId(currentUser.uid, selectedUser.uid);
  
  await addDoc(collection(db, "chats", chatId, "messages"), {
    sender: currentUser.uid,
    text: messageInput.value.trim(),
    timestamp: serverTimestamp()
  });
  messageInput.value = '';
};

// --- Theme Logic ---
function applySystemTheme() {
  const html = document.documentElement;
  const prefersDark = mediaQuery.matches;

  if (prefersDark) {
    html.setAttribute('data-theme', 'dark');
    html.classList.add("dark");
  } else {
    html.setAttribute('data-theme', 'light');
    html.classList.remove("dark");
  }
}

// Initial Load and Listener setup
applySystemTheme();
mediaQuery.addEventListener('change', applySystemTheme);