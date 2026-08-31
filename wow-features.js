const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const state = () => window.BirthdayApp.getState();
const lang = () => state().lang;
const t = key => window.I18N?.[lang()]?.[key] || key;
const notify = message => window.BirthdayApp.notify(message);
const FAMILY_KEY = "birthday-family-code-v1";
let historyPersonId = null;
let familySyncTimer = null;

function requireUser() {
  const user = state().user;
  if (!user) {
    notify(t("aiLogin"));
    window.BirthdayApp.openAuth();
    return null;
  }
  return user;
}

function birthdayDays(date) {
  const [, month, day] = String(date).split("-").map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), month - 1, day);
  if (next < today) next = new Date(now.getFullYear() + 1, month - 1, day);
  return Math.round((next - today) / 86400000);
}

function renderReminder() {
  const box = $("#smartReminder");
  const upcoming = [...state().items].sort((a, b) => birthdayDays(a.date) - birthdayDays(b.date))[0];
  if (!upcoming) {
    box.innerHTML = `<span class="reminder-icon">✨</span><div><b>${t("reminderEmpty")}</b><small>${t("reminderEmptyHint")}</small></div>`;
    return;
  }
  const days = birthdayDays(upcoming.date);
  const budget = upcoming.budget ? `${upcoming.budget} ${state().profile?.currency || "MDL"}` : t("budgetFlexible");
  box.innerHTML = `<span class="reminder-icon">🔔</span><div><b>${t("inDays").replace("{days}", days).replace("{name}", upcoming.name)}</b><small>${t("smartReminderText").replace("{budget}", budget)}</small></div><button type="button" data-reminder-gift="${upcoming.id}">${t("getIdeas")}</button>`;
  box.querySelector("button").onclick = () => {
    $$('[data-view]').find(button => button.dataset.view === "gifts")?.click();
    setTimeout(() => $(`[data-ai-gift="${upcoming.id}"]`)?.click(), 100);
  };
}

function renderRelationshipMap() {
  const map = $("#relationshipMap"), items = state().items.slice(0, 10);
  if (!items.length) {
    map.innerHTML = `<p class="relationship-empty">${t("relationshipEmpty")}</p>`;
    return;
  }
  const center = state().profile?.name || t("me");
  map.innerHTML = `<div class="relation-center">${center.slice(0, 12)}</div>` + items.map((item, index) => {
    const angle = (index / items.length) * Math.PI * 2 - Math.PI / 2;
    const radius = items.length > 6 ? 42 : 36;
    const x = 50 + Math.cos(angle) * radius, y = 50 + Math.sin(angle) * radius;
    return `<button class="relation-node" style="left:calc(${x}% - 30px);top:calc(${y}% - 30px)" data-map-person="${item.id}">${item.name.slice(0, 14)}</button>`;
  }).join("");
  $$('[data-map-person]').forEach(button => button.onclick = () => window.BirthdayApp.openPerson(state().items.find(item => item.id === button.dataset.mapPerson)));
}

async function enableNotifications() {
  if (!("Notification" in window)) return notify(t("notificationsUnsupported"));
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return notify(t("notificationsDenied"));
  notify(t("notificationsEnabled"));
  sendDailyNotification();
}

function sendDailyNotification() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const today = new Date().toISOString().slice(0, 10), key = `birthday-notified-${today}`;
  if (localStorage.getItem(key)) return;
  const next = [...state().items].filter(item => birthdayDays(item.date) <= 7).sort((a, b) => birthdayDays(a.date) - birthdayDays(b.date))[0];
  if (!next) return;
  new Notification(t("notificationTitle"), { body: t("notificationBody").replace("{name}", next.name).replace("{days}", birthdayDays(next.date)), icon: "icon.svg" });
  localStorage.setItem(key, "1");
}

$("#enableNotifications").onclick = enableNotifications;
$("#openPartyAI").onclick = () => $("#partyDialog").showModal();
$("#partyForm").onsubmit = async event => {
  event.preventDefault();
  if (!requireUser()) return;
  const result = $("#partyResult");
  result.hidden = false;
  result.textContent = t("aiThinking");
  try {
    const response = await window.BirthdayAI.request("/api/assistant", { task: "party", lang: lang(), occasion: $("#partyOccasion").value, guests: $("#partyGuests").value, budget: $("#partyBudget").value, mood: $("#partyMood").value, currency: state().profile?.currency || "MDL" });
    result.textContent = response.result;
  } catch (error) {
    if (error.message !== "AUTH_REQUIRED") result.textContent = t("aiError");
  }
};

$("#generateGreetingAI").onclick = async () => {
  const person = window.BirthdayApp.getItem($("#messageFor").dataset.personId);
  if (!person || !requireUser()) return;
  const button = $("#generateGreetingAI");
  button.disabled = true;
  try {
    const response = await window.BirthdayAI.request("/api/assistant", { task: "greeting", ...person, tone: $(".tone-row .active")?.dataset.tone, lang: lang() });
    $("#greetingText").value = response.result;
  } catch (error) {
    if (error.message !== "AUTH_REQUIRED") notify(t("aiError"));
  } finally { button.disabled = false; }
};

function wrapText(context, text, x, y, maxWidth, lineHeight, maxLines = 5) {
  const words = text.split(/\s+/); let line = "", lines = [];
  for (const word of words) {
    const test = `${line}${word} `;
    if (context.measureText(test).width > maxWidth && line) { lines.push(line.trim()); line = `${word} `; }
    else line = test;
  }
  if (line && lines.length < maxLines) lines.push(line.trim());
  lines.slice(0, maxLines).forEach((value, index) => context.fillText(value, x, y + index * lineHeight));
}

async function dataUrlToFile(dataUrl, name) {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: "image/png" });
}

$("#generateCardAI").onclick = async () => {
  const person = window.BirthdayApp.getItem($("#messageFor").dataset.personId);
  if (!person || !requireUser()) return;
  const button = $("#generateCardAI"); button.disabled = true;
  try {
    const description = `${person.style || ""} ${person.personality || ""}`.trim() || "elegant, joyful, warm celebration";
    const image = await window.BirthdayAI.request("/api/generate-image", { mode: "card", name: person.name, interests: person.interests, description, lang: lang() });
    const canvas = $("#greetingCard"), context = canvas.getContext("2d"), background = new Image();
    await new Promise((resolve, reject) => { background.onload = resolve; background.onerror = reject; background.src = image.dataURI; });
    context.drawImage(background, 0, 0, canvas.width, canvas.height);
    const gradient = context.createLinearGradient(0, 650, 0, 1350); gradient.addColorStop(0, "#12082410"); gradient.addColorStop(1, "#120824df"); context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center"; context.fillStyle = "white"; context.shadowColor = "#0008"; context.shadowBlur = 18; context.font = "800 78px system-ui"; context.fillText(person.name, 540, 940);
    context.font = "500 38px system-ui"; wrapText(context, $("#greetingText").value, 540, 1020, 820, 52, 5);
    $("#cardFor").textContent = person.name; $("#cardDialog").showModal();
  } catch (error) { if (error.message !== "AUTH_REQUIRED") notify(t("aiError")); }
  finally { button.disabled = false; }
};

$("#downloadCard").onclick = () => { const link = document.createElement("a"); link.href = $("#greetingCard").toDataURL("image/png"); link.download = "card-aniversar.png"; link.click(); };
$("#shareCard").onclick = async () => {
  const file = await dataUrlToFile($("#greetingCard").toDataURL("image/png"), "card-aniversar.png");
  if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: t("aiCardTitle") }); else $("#downloadCard").click();
};

function renderHistory() {
  const person = window.BirthdayApp.getItem(historyPersonId), list = $("#historyList");
  list.innerHTML = person?.giftHistory?.length ? person.giftHistory.slice().sort((a,b)=>b.year-a.year).map(entry => `<div class="history-item"><b>${entry.year}</b><span>${entry.gift}</span></div>`).join("") : `<p>${t("historyEmpty")}</p>`;
}
$("#giftList").addEventListener("click", event => {
  const button = event.target.closest("[data-gift-history]"); if (!button) return;
  historyPersonId = button.dataset.giftHistory; const person = window.BirthdayApp.getItem(historyPersonId);
  $("#historyFor").textContent = person.name; $("#historyYear").value = new Date().getFullYear(); renderHistory(); $("#historyDialog").showModal();
});
$("#historyForm").onsubmit = event => { event.preventDefault(); const person = window.BirthdayApp.getItem(historyPersonId); const giftHistory = [...person.giftHistory, { id: crypto.randomUUID(), gift: $("#historyGift").value.trim(), year: Number($("#historyYear").value) }]; window.BirthdayApp.updateItem(historyPersonId, { giftHistory }); event.target.reset(); $("#historyYear").value = new Date().getFullYear(); renderHistory(); };

function unfoldIcs(text) { return text.replace(/\r?\n[ \t]/g, ""); }
function parseIcs(text) {
  return unfoldIcs(text).split("BEGIN:VEVENT").slice(1).map(block => {
    const summary = block.match(/\nSUMMARY(?:;[^:]*)?:(.+)/)?.[1]?.replace(/\\,/g, ",").trim();
    const rawDate = block.match(/\nDTSTART(?:;[^:]*)?:(\d{8})/)?.[1];
    if (!summary || !rawDate) return null;
    const date = `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`;
    const name = summary.replace(/^(birthday|ziua de naștere|день рождения|🎂)[:\s-]*/i, "").trim();
    return { id: crypto.randomUUID(), name, date, eventType: /birthday|naștere|рождения|🎂/i.test(summary) ? "birthday" : "important", relation: "other", giftStatus: "idea", giftHistory: [], note: t("importedFromCalendar") };
  }).filter(Boolean);
}
$("#importCalendarButton").onclick = () => $("#icsImport").click();
$("#icsImport").onchange = async event => { const file = event.target.files[0]; if (!file) return; const records = parseIcs(await file.text()); window.BirthdayApp.addItems(records); notify(t("importCount").replace("{count}", records.length)); event.target.value = ""; };
$("#importContactsButton").onclick = async () => {
  if (!("contacts" in navigator) || typeof navigator.contacts.select !== "function") return notify(t("contactsUnsupported"));
  try {
    const contacts = await navigator.contacts.select(["name", "tel"], { multiple: false });
    if (!contacts.length) return;
    window.BirthdayApp.openPerson({ name: contacts[0].name?.[0] || "", phone: contacts[0].tel?.[0] || "", eventType: "birthday", relation: "other" });
    notify(t("completeBirthdayDate"));
  } catch { /* user cancelled */ }
};

$("#openFamilyGroup").onclick = () => { $("#familyDialog").showModal(); const code = localStorage.getItem(FAMILY_KEY); $("#familyStatus").textContent = code ? t("activeFamily").replace("{code}", code) : t("familyNotConnected"); };
$("#createFamily").onclick = async () => { const user = requireUser(); if (!user) return; try { const code = await AppCloud.createFamily(user.uid, $("#familyName").value.trim() || t("myFamily"), state().items); localStorage.setItem(FAMILY_KEY, code); $("#familyStatus").textContent = t("familyCreated").replace("{code}", code); } catch { notify(t("cloudError")); } };
$("#joinFamily").onclick = async () => { const user = requireUser(); if (!user) return; try { const data = await AppCloud.joinFamily(user.uid, $("#familyCode").value); localStorage.setItem(FAMILY_KEY, data.code); window.BirthdayApp.addItems(data.items || []); $("#familyStatus").textContent = t("familyJoined").replace("{name}", data.name).replace("{code}", data.code); } catch { notify(t("familyInvalid")); } };
window.addEventListener("birthday-data-changed", () => { renderReminder(); renderRelationshipMap(); const code = localStorage.getItem(FAMILY_KEY), user = state().user; if (!code || !user) return; clearTimeout(familySyncTimer); familySyncTimer = setTimeout(() => AppCloud.saveFamilyItems(code, user.uid, state().items).catch(() => {}), 1200); });

function wishlistLink(uid) { return `${location.origin}${location.pathname}?wishlist=${uid}`; }
$("#openWishlist").onclick = async () => { const user = requireUser(); if (!user) return; $("#wishlistDialog").showModal(); const data = await AppCloud.loadWishlist(user.uid).catch(() => null); $("#wishlistItems").value = data?.items?.map(item => item.text).join("\n") || ""; $("#wishlistShare").innerHTML = data ? `<a href="${wishlistLink(user.uid)}">${wishlistLink(user.uid)}</a>` : t("wishlistNotPublished"); };
$("#wishlistForm").onsubmit = async event => { event.preventDefault(); const user = requireUser(); if (!user) return; const old = await AppCloud.loadWishlist(user.uid).catch(() => null); const oldByText = new Map((old?.items || []).map(item => [item.text, item])); const items = $("#wishlistItems").value.split("\n").map(text => text.trim()).filter(Boolean).map(text => oldByText.get(text) || { id: crypto.randomUUID(), text }); await AppCloud.saveWishlist(user.uid, { name: state().profile?.name || "", items, reservations: old?.reservations || {} }); const link = wishlistLink(user.uid); $("#wishlistShare").innerHTML = `${t("wishlistReady")}<br><a href="${link}">${link}</a>`; await navigator.clipboard.writeText(link).catch(() => {}); };

async function openSharedWishlist(ownerUid) {
  const data = await AppCloud.loadWishlist(ownerUid).catch(() => null); if (!data) return;
  $("#wishlistDialog").showModal(); $("#wishlistForm").hidden = true;
  $("#wishlistShare").innerHTML = `<h3>${t("wishlistOf").replace("{name}", data.name || "")}</h3>` + data.items.map(item => { const reserved = Boolean(data.reservations?.[item.id]); return `<div class="history-item"><span>${item.text}</span><button data-reserve-wish="${item.id}" ${reserved?"disabled":""}>${reserved?t("reserved"):t("reserve")}</button></div>`; }).join("");
  $$('[data-reserve-wish]').forEach(button => button.onclick = async () => { const user = requireUser(); if (!user) return; await AppCloud.reserveWish(ownerUid, button.dataset.reserveWish, user.uid); button.disabled = true; button.textContent = t("reserved"); });
}

renderReminder(); renderRelationshipMap(); sendDailyNotification();
const wishlistOwner = new URLSearchParams(location.search).get("wishlist");
if (wishlistOwner) setTimeout(() => openSharedWishlist(wishlistOwner), 900);
