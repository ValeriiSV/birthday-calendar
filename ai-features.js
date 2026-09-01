const $ = selector => document.querySelector(selector);
const language = () => window.BirthdayApp?.getState().lang || "ro";
const text = key => window.I18N?.[language()]?.[key] || key;

async function aiRequest(path, payload) {
  const token = await window.AppAuth?.getToken?.();
  if (!token) {
    window.BirthdayApp.notify(text("aiLogin"));
    window.BirthdayApp.openAuth();
    throw new Error("AUTH_REQUIRED");
  }
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "AI_ERROR");
    error.status = response.status;
    throw error;
  }
  return result;
}

window.BirthdayAI = { request: aiRequest };

$("#generatePhotoAI").addEventListener("click", async () => {
  const button = $("#generatePhotoAI");
  const payload = {
    name: $("#personName").value.trim(),
    interests: $("#personInterests").value.trim(),
    description: $("#personNote").value.trim(),
    lang: language()
  };
  if (!payload.interests && !payload.description) {
    window.BirthdayApp.notify(language() === "ro" ? "Adaugă interesele sau o scurtă descriere." : "Добавьте интересы или краткое описание.");
    return;
  }
  button.disabled = true;
  button.classList.add("loading");
  const oldText = button.querySelector("span").textContent;
  button.querySelector("span").textContent = text("aiThinking");
  try {
    const result = await aiRequest("/api/generate-image", payload);
    window.BirthdayApp.setPendingPhoto(result.dataURI);
    window.BirthdayApp.notify(language() === "ro" ? "Imaginea AI este gata." : "Изображение ИИ готово.");
  } catch (error) {
    if (error.message !== "AUTH_REQUIRED") window.BirthdayApp.notify(text("aiError"));
  } finally {
    button.disabled = false;
    button.classList.remove("loading");
    button.querySelector("span").textContent = oldText;
  }
});

$("#giftList").addEventListener("click", async event => {
  const button = event.target.closest("[data-ai-gift]");
  if (!button) return;
  const person = window.BirthdayApp.getItem(button.dataset.aiGift);
  if (!person) return;
  $("#aiGiftFor").textContent = person.name;
  $("#aiGiftResult").textContent = text("aiThinking");
  $("#giftAiDialog").showModal();
  button.disabled = true;
  try {
    const result = await aiRequest("/api/gift-advice", { ...person, lang: language(), currency: window.BirthdayApp.getState().profile?.currency || "MDL" });
    $("#aiGiftResult").textContent = result.advice;
  } catch (error) {
    if (error.message === "AUTH_REQUIRED") $("#giftAiDialog").close();
    else $("#aiGiftResult").textContent = text("aiError");
  } finally {
    button.disabled = false;
  }
});

$("#copyGiftAdvice").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("#aiGiftResult").textContent);
  window.BirthdayApp.notify(text("copied"));
});
