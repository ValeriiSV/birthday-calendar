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
    async getToken(forceRefresh = false) { return ready && auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null; },
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
    },
    async createFamily(uid, name, items) {
      if (!ready) throw { code: "app/offline" };
      const code = Array.from(crypto.getRandomValues(new Uint8Array(5)), byte => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[byte % 32]).join("");
      await db.collection("groups").doc(code).set({ code, name, ownerUid: uid, members: [uid], items, inviteOpen: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      return code;
    },
    async joinFamily(uid, code) {
      if (!ready) throw { code: "app/offline" };
      const ref = db.collection("groups").doc(String(code).trim().toUpperCase());
      await db.runTransaction(async transaction => {
        const snap = await transaction.get(ref);
        if (!snap.exists || !snap.data().inviteOpen) throw { code: "group/not-found" };
        const members = Array.from(new Set([...(snap.data().members || []), uid]));
        transaction.update(ref, { members, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
      return (await ref.get()).data();
    },
    async loadFamily(code) {
      if (!ready) return null;
      const snap = await db.collection("groups").doc(String(code).trim().toUpperCase()).get();
      return snap.exists ? snap.data() : null;
    },
    async saveFamilyItems(code, uid, items) {
      if (!ready) throw { code: "app/offline" };
      await db.collection("groups").doc(String(code).trim().toUpperCase()).update({ items, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    },
    async saveWishlist(uid, payload) {
      if (!ready) throw { code: "app/offline" };
      await db.collection("wishlists").doc(uid).set({ ...payload, ownerUid: uid, public: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    },
    async loadWishlist(uid) {
      if (!ready) return null;
      const snap = await db.collection("wishlists").doc(uid).get();
      return snap.exists && snap.data().public ? snap.data() : null;
    },
    async reserveWish(ownerUid, itemId, reserverUid) {
      if (!ready) throw { code: "app/offline" };
      const ref = db.collection("wishlists").doc(ownerUid);
      await db.runTransaction(async transaction => {
        const snap = await transaction.get(ref);
        if (!snap.exists) throw { code: "wishlist/not-found" };
        const reservations = { ...(snap.data().reservations || {}), [itemId]: reserverUid };
        transaction.update(ref, { reservations, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
    }
  };
})();
