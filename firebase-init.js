(() => {
  "use strict";
  const cfg = window.FIREBASE_CONFIG || {};
  const looksReal = cfg.apiKey && !/YOUR_/.test(cfg.apiKey) && cfg.projectId && !/YOUR_/.test(cfg.projectId);
  let auth = null, db = null, ready = false;

  if (looksReal && window.firebase) {
    try {
      firebase.initializeApp(cfg);
      auth = firebase.auth();
      db = firebase.firestore();
      ready = true;
    } catch (e) {
      console.warn("Firebase init failed:", e);
    }
  } else {
    console.warn("Firebase nu este configurat (completează firebase-config.js). Aplicația rulează doar local, fără cont.");
  }

  const listeners = [];
  if (ready) auth.onAuthStateChanged(user => listeners.forEach(fn => fn(user)));

  window.AppAuth = {
    ready,
    onChange(fn) {
      listeners.push(fn);
      // Dacă Firebase nu e configurat deloc, raportează imediat "neautentificat".
      // Dacă e configurat, așteaptă callback-ul real (poate restaura o sesiune salvată),
      // ca să nu clipească fereastra de login pentru cineva deja conectat.
      if (!ready) fn(null);
    },
    currentUser() { return ready ? auth.currentUser : null; },
    async signUp(email, password) {
      if (!ready) throw { code: "app/offline" };
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      return cred.user;
    },
    async signIn(email, password) {
      if (!ready) throw { code: "app/offline" };
      const cred = await auth.signInWithEmailAndPassword(email, password);
      return cred.user;
    },
    async signOutUser() {
      if (ready) await auth.signOut();
    },
    async resetPassword(email) {
      if (!ready) throw { code: "app/offline" };
      await auth.sendPasswordResetEmail(email);
    }
  };

  window.AppCloud = {
    ready,
    async loadUserData(uid) {
      if (!ready) return null;
      const snap = await db.collection("users").doc(uid).get();
      return snap.exists ? snap.data() : null;
    },
    async saveUserData(uid, data) {
      if (!ready) return;
      await db.collection("users").doc(uid).set(
        { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    },
    // payload public = aceleași date, dar FĂRĂ telefoane, salvate separat astfel
    // încât regulile Firestore să poată permite citire publică doar aici.
    async setPublicShare(uid, payload) {
      if (!ready) return;
      await db.collection("shares").doc(uid).set(
        { ...payload, ownerUid: uid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    },
    async loadPublicShare(uid) {
      if (!ready) return null;
      const snap = await db.collection("shares").doc(uid).get();
      if (!snap.exists) return null;
      const data = snap.data();
      return data && data.public ? data : null;
    }
  };
})();
