(function (global) {
  "use strict";

  var cfg = global.CLOUD_CONFIG || {};
  var firebaseCfg = cfg.firebase || {};
  var adminEmails = Array.isArray(cfg.adminEmails) ? cfg.adminEmails : [];
  var setupError = "";
  var auth = null;
  var db = null;

  function normalizeEmail(v) {
    return String(v || "").trim().toLowerCase();
  }

  function normalizeAdminList(list) {
    return list.map(normalizeEmail).filter(function (v) { return !!v; });
  }

  function hasRequiredFirebaseConfig(v) {
    return !!(v && v.apiKey && v.authDomain && v.projectId && v.appId);
  }

  var normalizedAdmins = normalizeAdminList(adminEmails);
  var ready = false;

  try {
    if (!global.firebase) {
      setupError = "Firebase SDK tidak ditemukan.";
    } else if (!hasRequiredFirebaseConfig(firebaseCfg)) {
      setupError = "Konfigurasi Firebase belum lengkap di cloud-config.js";
    } else {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseCfg);
      }
      auth = firebase.auth();
      db = firebase.firestore();
      ready = true;
    }
  } catch (e) {
    setupError = e && e.message ? e.message : "Gagal inisialisasi Firebase.";
    ready = false;
  }

  function isAdminEmail(email) {
    var target = normalizeEmail(email);
    if (!target) return false;
    return normalizedAdmins.indexOf(target) !== -1;
  }

  async function loadAppState(appId) {
    if (!ready) throw new Error(setupError || "Cloud belum siap.");
    var snap = await db.collection("apps").doc(appId).get();
    if (!snap.exists) {
      return { data: [], counters: {}, history: [] };
    }
    var payload = snap.data() || {};
    return {
      data: Array.isArray(payload.data) ? payload.data : [],
      counters: payload.counters && typeof payload.counters === "object" && !Array.isArray(payload.counters) ? payload.counters : {},
      history: Array.isArray(payload.history) ? payload.history : []
    };
  }

  async function saveAppState(appId, state) {
    if (!ready) throw new Error(setupError || "Cloud belum siap.");
    var payload = {
      data: Array.isArray((state || {}).data) ? state.data : [],
      counters: (state || {}).counters && typeof state.counters === "object" && !Array.isArray(state.counters) ? state.counters : {},
      history: Array.isArray((state || {}).history) ? state.history : [],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection("apps").doc(appId).set(payload, { merge: true });
  }

  function onAuthStateChanged(cb) {
    if (!ready) {
      cb(null);
      return function () {};
    }
    return auth.onAuthStateChanged(cb);
  }

  async function signIn(email, password) {
    if (!ready) throw new Error(setupError || "Cloud belum siap.");
    var cred = await auth.signInWithEmailAndPassword(normalizeEmail(email), String(password || ""));
    return cred.user;
  }

  async function signOut() {
    if (!ready) return;
    await auth.signOut();
  }

  function currentUser() {
    return ready ? auth.currentUser : null;
  }

  global.cloudStore = {
    isReady: function () { return ready; },
    getSetupError: function () { return setupError; },
    isAdminEmail: isAdminEmail,
    loadAppState: loadAppState,
    saveAppState: saveAppState,
    onAuthStateChanged: onAuthStateChanged,
    signIn: signIn,
    signOut: signOut,
    currentUser: currentUser
  };
})(window);
