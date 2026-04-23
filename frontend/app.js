/* ════════════════════════════════════════════════════════════════
   AI GYM COACH — ARIA  |  app.js
   Three.js 3D Background · Onboarding · Chat · Profile Management
   localStorage persistence for profile + chat history
   ════════════════════════════════════════════════════════════════ */

"use strict";

// Always use same-origin `/api/*` (Vercel rewrites or local reverse proxy).
const API_BASE = "";

/* ══════════════════════════════════════════════════════════════════
   LOCAL STORAGE HELPERS
   Keys: aria_profile, aria_chat_history
   ══════════════════════════════════════════════════════════════════ */

const LS_PROFILE = "aria_profile";
const LS_HISTORY = "aria_chat_history";

function lsGetProfile() {
  try { return JSON.parse(localStorage.getItem(LS_PROFILE)) || null; }
  catch { return null; }
}

function lsSaveProfile(profile) {
  localStorage.setItem(LS_PROFILE, JSON.stringify(profile));
}

function lsGetHistory() {
  try { return JSON.parse(localStorage.getItem(LS_HISTORY)) || []; }
  catch { return []; }
}

function lsSaveHistory(history) {
  // Cap at 200 messages to avoid bloating localStorage
  const capped = history.slice(-200);
  localStorage.setItem(LS_HISTORY, JSON.stringify(capped));
}

function lsClearHistory() {
  localStorage.removeItem(LS_HISTORY);
}

function lsClearAll() {
  localStorage.removeItem(LS_PROFILE);
  localStorage.removeItem(LS_HISTORY);
}

// In-memory chat history array kept in sync with localStorage
let localChatHistory = lsGetHistory();


/* ══════════════════════════════════════════════════════════════════
   THREE.JS — 3D ANIMATED BACKGROUND
   ══════════════════════════════════════════════════════════════════ */

(function initThreeJS() {
  const canvas   = document.getElementById("three-canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.z = 50;

  const orbCount  = 14;
  const orbMeshes = [];
  const orbSpeeds = [];
  const orbColors = [0xFF6B35, 0xFF8C5A, 0x39FF14, 0xFF6B35, 0x39FF14,
                     0xFF6B35, 0xFF3D00, 0x39FF14, 0xFF8C5A, 0xFF6B35,
                     0x39FF14, 0xFF6B35, 0xFF8C5A, 0x39FF14];

  for (let i = 0; i < orbCount; i++) {
    const radius = Math.random() * 1.4 + 0.3;
    const geo    = new THREE.SphereGeometry(radius, 16, 16);
    const mat    = new THREE.MeshStandardMaterial({
      color: orbColors[i], emissive: orbColors[i], emissiveIntensity: 0.6,
      transparent: true, opacity: Math.random() * 0.25 + 0.08,
      roughness: 0.4, metalness: 0.8,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 90,
      (Math.random() - 0.5) * 70,
      (Math.random() - 0.5) * 40 - 10
    );
    orbSpeeds.push({
      x: (Math.random() - 0.5) * 0.006, y: (Math.random() - 0.5) * 0.005,
      rotX: (Math.random() - 0.5) * 0.008, rotY: (Math.random() - 0.5) * 0.008,
      phase: Math.random() * Math.PI * 2,
    });
    scene.add(mesh);
    orbMeshes.push(mesh);
  }

  const particleCount = 500;
  const positions     = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 160;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 120;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 80 - 20;
  }
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const partMat = new THREE.PointsMaterial({
    color: 0xFF6B35, size: 0.18, transparent: true, opacity: 0.35, sizeAttenuation: true,
  });
  const particles = new THREE.Points(partGeo, partMat);
  scene.add(particles);

  const gridHelper = new THREE.GridHelper(140, 30, 0x1a1a1a, 0x111111);
  gridHelper.position.y = -30;
  gridHelper.rotation.x = Math.PI * 0.04;
  scene.add(gridHelper);

  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const orange = new THREE.PointLight(0xFF6B35, 2.5, 80);
  orange.position.set(20, 20, 20);
  scene.add(orange);
  const neon = new THREE.PointLight(0x39FF14, 1.5, 70);
  neon.position.set(-25, -15, 15);
  scene.add(neon);

  let mouseX = 0, mouseY = 0;
  document.addEventListener("mousemove", (e) => {
    mouseX = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  let lastTime = 0;
  const fpsInterval = 1000 / 30;

  function animate(currentTime) {
    requestAnimationFrame(animate);
    const elapsed = currentTime - lastTime;
    if (elapsed < fpsInterval) return;
    lastTime = currentTime - (elapsed % fpsInterval);
    const t = clock.getElapsedTime();

    camera.position.x += (mouseX * 4 - camera.position.x) * 0.03;
    camera.position.y += (-mouseY * 3 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    orbMeshes.forEach((mesh, i) => {
      const s = orbSpeeds[i];
      mesh.position.x += s.x;
      mesh.position.y += s.y + Math.sin(t + s.phase) * 0.003;
      mesh.rotation.x += s.rotX;
      mesh.rotation.y += s.rotY;
      if (Math.abs(mesh.position.x) > 55) s.x *= -1;
      if (Math.abs(mesh.position.y) > 45) s.y *= -1;
    });

    particles.rotation.y = t * 0.012;
    particles.rotation.x = t * 0.006;
    orange.intensity = 2 + Math.sin(t * 1.5) * 0.8;
    neon.intensity   = 1.2 + Math.cos(t * 1.2) * 0.5;
    renderer.render(scene, camera);
  }
  animate();
})();


/* ══════════════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════════════ */

let currentProfile   = null;
let selectedGoal     = "fit";
let editSelectedGoal = "fit";
let isLoading        = false;

/* ══════════════════════════════════════════════════════════════════
   DOM REFERENCES
   ══════════════════════════════════════════════════════════════════ */

const onboardingScreen = document.getElementById("onboarding-screen");
const chatScreen       = document.getElementById("chat-screen");
const chatMessages     = document.getElementById("chat-messages");
const chatInput        = document.getElementById("chat-input");
const sendBtn          = document.getElementById("send-btn");
const toast            = document.getElementById("toast");
const editModal        = document.getElementById("edit-modal");
const inputHint        = document.querySelector(".input-hint");

lucide.createIcons();

/* ══════════════════════════════════════════════════════════════════
   OFFLINE / ERROR BANNER
   ══════════════════════════════════════════════════════════════════ */

function showOfflineBanner(message) {
  const old = document.getElementById("offline-banner");
  if (old) old.remove();
  const banner = document.createElement("div");
  banner.id = "offline-banner";
  banner.style.cssText = `
    position:fixed;inset:0;z-index:900;display:flex;flex-direction:column;
    align-items:center;justify-content:center;background:rgba(8,9,10,0.96);
    backdrop-filter:blur(16px);padding:32px;text-align:center;
  `;
  banner.innerHTML = `
    <div style="font-size:52px;margin-bottom:20px;animation:floatOrb 3s ease-in-out infinite;">⚠️</div>
    <h2 style="font-size:22px;font-weight:800;color:#FF6B35;margin-bottom:12px;">Server Offline</h2>
    <p style="color:#9AA0AE;font-size:14px;max-width:420px;line-height:1.7;margin-bottom:28px;">${message}</p>
    <div style="background:rgba(255,107,53,0.08);border:1px solid rgba(255,107,53,0.25);border-radius:12px;
      padding:16px 24px;font-family:'JetBrains Mono',monospace;font-size:13px;color:#FF8C5A;margin-bottom:28px;">
      cd &quot;AI Gym Coach&quot;<br>
      pip install -r requirements.txt<br>
      python api/index.py
    </div>
    <button onclick="location.reload()" style="background:linear-gradient(135deg,#FF6B35,#E8530A);
      border:none;border-radius:12px;padding:12px 32px;color:#fff;
      font-family:'Outfit',sans-serif;font-size:15px;font-weight:700;
      cursor:pointer;box-shadow:0 4px 20px rgba(255,107,53,0.35);">🔄 Retry Connection</button>
  `;
  document.body.appendChild(banner);
}

function hideOfflineBanner() {
  const b = document.getElementById("offline-banner");
  if (b) b.remove();
}

/* ══════════════════════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════════════════════ */

let toastTimer = null;

function showToast(msg, type = "default") {
  toast.textContent = msg;
  toast.className   = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

/* ══════════════════════════════════════════════════════════════════
   SCREEN TRANSITIONS
   ══════════════════════════════════════════════════════════════════ */

function showChatScreen() {
  onboardingScreen.style.display = "none";
  chatScreen.style.display       = "flex";
  chatInput.focus();
  lucide.createIcons();
}

function showOnboarding() {
  chatScreen.style.display       = "none";
  onboardingScreen.style.display = "flex";
}

/* ══════════════════════════════════════════════════════════════════
   PROFILE HELPERS
   ══════════════════════════════════════════════════════════════════ */

function updateSidebarStats(profile) {
  const goalLabels = { bulk: "💪 BULK", cut: "🔥 CUT", fit: "⚡ FIT" };
  document.getElementById("stat-name").textContent   = profile.name   || "—";
  document.getElementById("stat-age").textContent    = profile.age    ? `${profile.age} yrs`    : "—";
  document.getElementById("stat-weight").textContent = profile.weight ? `${profile.weight} kg`  : "—";
  document.getElementById("stat-height").textContent = profile.height ? `${profile.height} cm`  : "—";
  document.getElementById("stat-goal").textContent   = goalLabels[profile.goal] || profile.goal || "—";
  document.getElementById("header-profile-name").textContent = profile.name || "Athlete";
  document.getElementById("welcome-name").textContent        = profile.name || "Champ";
}


/* ══════════════════════════════════════════════════════════════════
   API CALLS
   ══════════════════════════════════════════════════════════════════ */

async function fetchProfile() {
  try {
    const res  = await fetch(`${API_BASE}/api/profile`);
    const data = await res.json();
    return data.profile || null;
  } catch { return null; }
}

async function saveProfile(payload) {
  const res = await fetch(`${API_BASE}/api/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  // Always parse the JSON body, but attach the HTTP ok flag so callers can trust it
  const data = await res.json();
  // Normalise: treat HTTP 2xx + JSON success:true as the only real success
  data._ok = res.ok && data.success === true;
  return data;
}

async function fetchHistory() {
  try {
    const res  = await fetch(`${API_BASE}/api/history`);
    const data = await res.json();
    return data.history || [];
  } catch { return []; }
}

async function sendChatMessage(message) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const msg = (data && (data.error || data.reply)) ? (data.error || data.reply) : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function clearChatHistoryAPI() {
  try { await fetch(`${API_BASE}/api/history`, { method: "DELETE" }); }
  catch { /* backend may be offline; localStorage is cleared regardless */ }
}

/* ══════════════════════════════════════════════════════════════════
   CHAT UI — MESSAGE RENDERING
   ══════════════════════════════════════════════════════════════════ */

function createMessageEl(role, content) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className   = "msg-avatar";
  avatar.textContent = role === "model" ? "🤖" : "👤";

  const msgContent = document.createElement("div");
  msgContent.className = "msg-content";

  const roleLabel = document.createElement("div");
  roleLabel.className   = "msg-role";
  roleLabel.textContent = role === "model" ? "ARIA" : "You";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";

  if (role === "model") {
    bubble.innerHTML = marked.parse(content, { breaks: true, gfm: true });
    bubble.querySelectorAll("a").forEach(a => {
      a.target = "_blank";
      a.rel    = "noopener noreferrer";
    });
  } else {
    bubble.textContent = content;
  }

  msgContent.appendChild(roleLabel);
  msgContent.appendChild(bubble);
  wrapper.appendChild(avatar);
  wrapper.appendChild(msgContent);
  return wrapper;
}

/**
 * Append a message to the DOM and persist it to localStorage.
 * @param {string} role    - "user" | "model"
 * @param {string} content - message text
 * @param {boolean} persist - false when replaying history (already stored)
 */
function appendMessage(role, content, persist = true) {
  const banner = document.getElementById("welcome-banner");
  if (banner) banner.remove();

  const el = createMessageEl(role, content);
  chatMessages.appendChild(el);
  scrollToBottom();

  if (persist) {
    localChatHistory.push({ role, content });
    lsSaveHistory(localChatHistory);
  }

  return el;
}

function showTypingIndicator() {
  const wrapper = document.createElement("div");
  wrapper.className = "message model";
  wrapper.id        = "typing-indicator";

  const avatar = document.createElement("div");
  avatar.className   = "msg-avatar";
  avatar.textContent = "🤖";

  const indicator = document.createElement("div");
  indicator.className = "typing-indicator";
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("div");
    dot.className = "typing-dot";
    indicator.appendChild(dot);
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(indicator);
  chatMessages.appendChild(wrapper);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById("typing-indicator");
  if (el) el.remove();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}


/* ══════════════════════════════════════════════════════════════════
   CHAT — SEND MESSAGE
   ══════════════════════════════════════════════════════════════════ */

async function handleSend() {
  const message = chatInput.value.trim();
  if (!message || isLoading) return;

  isLoading        = true;
  sendBtn.disabled = true;
  sendBtn.dataset.prevTitle = sendBtn.title || "";
  sendBtn.title = "ARIA is thinking...";
  if (inputHint) inputHint.dataset.prevText = inputHint.textContent || "";
  if (inputHint) inputHint.textContent = "ARIA is thinking... please wait.";
  chatInput.value  = "";
  autoResizeTextarea();

  appendMessage("user", message);
  showTypingIndicator();

  try {
    const data = await sendChatMessage(message);
    removeTypingIndicator();

    if (data.success) {
      appendMessage("model", data.reply);

      // Weight update detected by AI — refresh profile everywhere
      if (data.weight_update !== null && data.weight_update !== undefined) {
        if (currentProfile) {
          currentProfile.weight = data.weight_update;
          lsSaveProfile(currentProfile);
          updateSidebarStats(currentProfile);
        }
        showToast(`✅ Weight updated to ${data.weight_update} kg!`, "success");
      }
    } else {
      const msg = data.error || "Something went wrong. Please try again.";
      showToast(msg, "error");
      appendMessage("model", `⚠️ **Error:** ${msg}`);
    }
  } catch (err) {
    removeTypingIndicator();
    const status = err?.status;
    if (status === 429) {
      showToast("Too many requests. Please wait and try again.", "error");
      appendMessage("model", "⚠️ **Rate limit hit (429).** Please wait a moment and retry.");
    } else if (status === 503) {
      showToast("ARIA is temporarily unavailable. Try again shortly.", "error");
      appendMessage("model", "⚠️ **Service unavailable (503).** Try again in a moment.");
    } else {
      showToast("Connection error. Please try again.", "error");
      appendMessage("model", "⚠️ **Connection error.** Please try again.");
    }
    console.error("Chat error:", err);
  } finally {
    isLoading        = false;
    sendBtn.disabled = false;
    sendBtn.title = sendBtn.dataset.prevTitle || "Send message";
    if (inputHint) inputHint.textContent = inputHint.dataset.prevText || "";
    chatInput.focus();
  }
}

/* ══════════════════════════════════════════════════════════════════
   CHAT INPUT — AUTO-RESIZE & KEYBOARD
   ══════════════════════════════════════════════════════════════════ */

function autoResizeTextarea() {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
}

chatInput.addEventListener("input", autoResizeTextarea);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
});
sendBtn.addEventListener("click", handleSend);

/* ══════════════════════════════════════════════════════════════════
   QUICK PROMPT CHIPS
   ══════════════════════════════════════════════════════════════════ */

document.querySelectorAll(".quick-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const prompt = chip.dataset.prompt;
    if (!prompt || isLoading) return;
    chatInput.value = prompt;
    autoResizeTextarea();
    handleSend();
  });
});

/* ══════════════════════════════════════════════════════════════════
   CLEAR CHAT
   Wipes both localStorage and the backend DB history.
   ══════════════════════════════════════════════════════════════════ */

document.getElementById("clear-chat-btn").addEventListener("click", async () => {
  if (!confirm("Clear all chat history? This cannot be undone.")) return;

  // Clear both stores
  lsClearHistory();
  localChatHistory = [];
  await clearChatHistoryAPI();

  // Reset the message panel
  chatMessages.innerHTML = "";
  const banner = document.createElement("div");
  banner.className = "welcome-banner";
  banner.id        = "welcome-banner";
  banner.innerHTML = `
    <div class="welcome-orb">🤖</div>
    <div class="welcome-heading">Hey <span>${currentProfile?.name || "Champ"}</span>, I'm ARIA!</div>
    <p class="welcome-text">Chat cleared. Ready for a fresh start! Ask me anything about your training or nutrition. 💪</p>
  `;
  chatMessages.appendChild(banner);
  showToast("🗑️ Chat history cleared.", "success");
});

/* ══════════════════════════════════════════════════════════════════
   GOAL SELECTOR
   ══════════════════════════════════════════════════════════════════ */

function setupGoalSelector(selectorId, onSelect) {
  const selector = document.getElementById(selectorId);
  if (!selector) return;
  selector.querySelectorAll(".goal-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selector.querySelectorAll(".goal-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      onSelect(btn.dataset.goal);
    });
  });
}

setupGoalSelector("goal-selector",      (g) => { selectedGoal     = g; });
setupGoalSelector("edit-goal-selector", (g) => { editSelectedGoal = g; });


/* ══════════════════════════════════════════════════════════════════
   ONBOARDING FORM — SUBMIT
   Saves to backend + localStorage on success.
   ══════════════════════════════════════════════════════════════════ */

document.getElementById("onboarding-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name   = document.getElementById("input-name").value.trim();
  const age    = parseInt(document.getElementById("input-age").value, 10);
  const weight = parseFloat(document.getElementById("input-weight").value);
  const height = parseFloat(document.getElementById("input-height").value);

  if (!name)                        { showToast("⚠️ Please enter your name.", "error");              return; }
  if (!age || age < 13 || age > 100){ showToast("⚠️ Please enter a valid age (13–100).", "error");   return; }
  if (!weight || weight < 30)       { showToast("⚠️ Please enter a valid weight.", "error");          return; }
  if (!height || height < 100)      { showToast("⚠️ Please enter a valid height.", "error");          return; }

  const submitBtn  = document.getElementById("onboarding-submit");
  const submitText = document.getElementById("submit-text");
  submitBtn.disabled     = true;
  submitText.textContent = "Activating...";

  const payload = { name, age, height, weight, goal: selectedGoal };

  try {
    const result = await saveProfile(payload);

    if (result._ok) {
      currentProfile = payload;
      lsSaveProfile(currentProfile);       // ← persist only after confirmed 200
      updateSidebarStats(currentProfile);
      showChatScreen();
      await loadHistory();
      showToast(`🚀 Welcome aboard, ${name}! ARIA is ready.`, "success");
    } else {
      showToast(`❌ ${result.error || "Failed to save profile."}`, "error");
    }
  } catch {
    // Backend unreachable — still save locally so the user can continue
    currentProfile = payload;
    lsSaveProfile(currentProfile);
    updateSidebarStats(currentProfile);
    showChatScreen();
    renderLocalHistory();
    showToast(`🚀 Welcome, ${name}! (Offline mode — data saved locally)`, "success");
  } finally {
    submitBtn.disabled     = false;
    submitText.textContent = "Activate ARIA";
  }
});

/* ══════════════════════════════════════════════════════════════════
   LOAD & RENDER CHAT HISTORY
   Priority: backend (source of truth) → localStorage fallback
   ══════════════════════════════════════════════════════════════════ */

function renderLocalHistory() {
  if (localChatHistory.length === 0) return;
  const banner = document.getElementById("welcome-banner");
  if (banner) banner.remove();
  localChatHistory.forEach(msg => {
    const el = createMessageEl(msg.role, msg.content);
    chatMessages.appendChild(el);
  });
  scrollToBottom();
}

async function loadHistory() {
  try {
    const history = await fetchHistory();

    if (history.length > 0) {
      // Sync localStorage with the authoritative backend history
      localChatHistory = history.map(m => ({ role: m.role, content: m.content }));
      lsSaveHistory(localChatHistory);

      const banner = document.getElementById("welcome-banner");
      if (banner) banner.remove();
      history.forEach(msg => {
        const el = createMessageEl(msg.role, msg.content);
        chatMessages.appendChild(el);
      });
      scrollToBottom();
    } else {
      // Backend has no history — render whatever is in localStorage
      renderLocalHistory();
    }
  } catch {
    // Backend offline — fall back to localStorage silently
    renderLocalHistory();
  }
}

/* ══════════════════════════════════════════════════════════════════
   EDIT PROFILE MODAL
   Saves to backend + localStorage on success.
   ══════════════════════════════════════════════════════════════════ */

function openEditModal() {
  if (!currentProfile) return;
  document.getElementById("edit-name").value   = currentProfile.name   || "";
  document.getElementById("edit-age").value    = currentProfile.age    || "";
  document.getElementById("edit-weight").value = currentProfile.weight || "";
  document.getElementById("edit-height").value = currentProfile.height || "";

  editSelectedGoal = currentProfile.goal || "fit";
  document.getElementById("edit-goal-selector").querySelectorAll(".goal-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.goal === editSelectedGoal);
  });
  editModal.classList.add("open");
}

function closeEditModal() { editModal.classList.remove("open"); }

document.getElementById("edit-profile-btn").addEventListener("click", openEditModal);
document.getElementById("modal-close").addEventListener("click", closeEditModal);
editModal.addEventListener("click", (e) => { if (e.target === editModal) closeEditModal(); });

document.getElementById("edit-profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name   = document.getElementById("edit-name").value.trim();
  const age    = parseInt(document.getElementById("edit-age").value, 10);
  const weight = parseFloat(document.getElementById("edit-weight").value);
  const height = parseFloat(document.getElementById("edit-height").value);

  if (!name || !age || !weight || !height) {
    showToast("⚠️ Please fill all fields.", "error"); return;
  }

  const payload = { name, age, height, weight, goal: editSelectedGoal };

  try {
    const result = await saveProfile(payload);
    if (result._ok) {
      currentProfile = payload;
      lsSaveProfile(currentProfile);       // ← persist only after confirmed 200
      updateSidebarStats(currentProfile);
      closeEditModal();
      showToast("✅ Profile updated!", "success");
    } else {
      showToast(`❌ ${result.error || "Failed to update profile."}`, "error");
    }
  } catch {
    // Backend offline — save locally anyway
    currentProfile = payload;
    lsSaveProfile(currentProfile);
    updateSidebarStats(currentProfile);
    closeEditModal();
    showToast("✅ Profile updated locally!", "success");
  }
});

/* ══════════════════════════════════════════════════════════════════
   APP INIT
   Flow:
     1. Check localStorage for existing profile → skip onboarding if found
     2. Ping backend (non-blocking for UI)
     3. Sync profile & history from backend when available
   ══════════════════════════════════════════════════════════════════ */

(async function init() {
  const cachedProfile = lsGetProfile();

  // ── Fast path: returning user with cached data ─────────────────
  if (cachedProfile) {
    currentProfile = cachedProfile;
    updateSidebarStats(cachedProfile);
    showChatScreen();
    // Render cached history immediately — no waiting for network
    renderLocalHistory();
  } else {
    showOnboarding();
  }

  // ── Background: verify backend is alive ───────────────────────
  try {
    const ping = await fetch(`${API_BASE}/api/status`, { signal: AbortSignal.timeout(8000) });
    if (!ping.ok) throw new Error("Non-OK status");
    hideOfflineBanner();
  } catch {
    // If no cached profile, show the offline banner so the user knows
    if (!cachedProfile) {
      showOfflineBanner(
        "The AI backend is currently unavailable. "
        + "If this is a fresh deployment, please wait a moment for the server to wake up."
      );
    }
    // If cached profile exists, user can still see their history — no banner needed
    return;
  }

  // ── Sync with backend when online ─────────────────────────────
  try {
    const serverProfile = await fetchProfile();

    if (serverProfile) {
      // Merge: backend is authoritative for profile data
      currentProfile = serverProfile;
      lsSaveProfile(currentProfile);
      updateSidebarStats(currentProfile);

      if (!cachedProfile) {
        // First time reaching backend after a fresh visit
        showChatScreen();
      }

      // Reload history from backend to stay in sync
      // (clears the locally-rendered messages and re-renders from server)
      chatMessages.innerHTML = "";
      const banner = document.createElement("div");
      banner.className = "welcome-banner";
      banner.id        = "welcome-banner";
      banner.innerHTML = `
        <div class="welcome-orb">🤖</div>
        <div class="welcome-heading">Hey <span id="welcome-name">${currentProfile.name || "Champ"}</span>, I'm ARIA!</div>
        <p class="welcome-text">Your AI-powered personal gym coach. Ask me anything — workout plans, meal prep, supplements, or just some motivation. Let's get to work! 💪</p>
      `;
      chatMessages.appendChild(banner);
      await loadHistory();

    } else if (!cachedProfile) {
      showOnboarding();
    }
  } catch (err) {
    console.error("Init sync error:", err);
    // Already showing cached data — no action needed
  }
})();

