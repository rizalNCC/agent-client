const form = document.getElementById("chat-form");
const agentEl = document.getElementById("agent");
const messageEl = document.getElementById("message");
const courseIdEl = document.getElementById("course_id");
const submitBtn = document.getElementById("submit-btn");
const presetReco = document.getElementById("preset-reco");
const presetDetail = document.getElementById("preset-detail");

const displayMessageEl = document.getElementById("display-message");
const courseDetailEl = document.getElementById("course-detail");
const rawJsonEl = document.getElementById("raw-json");
const itemsEl = document.getElementById("items");

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Sending..." : "Send";
}

function renderItems(items) {
  itemsEl.innerHTML = "";
  if (!items.length) {
    itemsEl.innerHTML = '<p class="muted">No recommendation items.</p>';
    return;
  }

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <h3>${item.title || "(untitled)"}</h3>
      <p>${item.description || ""}</p>
      ${item.url ? `<a href="${item.url}" target="_blank" rel="noreferrer">Open course</a>` : ""}
    `;
    itemsEl.appendChild(card);
  }
}

async function submit(payload) {
  setLoading(true);
  try {
    const res = await fetch("/api/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.detail || "Request failed.");
    }

    displayMessageEl.textContent = data.display_message || "(no message)";
    courseDetailEl.textContent = data.course_detail
      ? JSON.stringify(data.course_detail, null, 2)
      : "No course detail.";
    rawJsonEl.textContent = JSON.stringify(data.raw_response, null, 2);
    renderItems(data.recommendation_items || []);
  } catch (error) {
    displayMessageEl.textContent = `Error: ${error.message}`;
    courseDetailEl.textContent = "No course detail.";
    rawJsonEl.textContent = "No raw response.";
    itemsEl.innerHTML = "";
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const payload = {
    agent: agentEl.value,
    message: messageEl.value.trim(),
    course_id: courseIdEl.value ? Number(courseIdEl.value) : undefined
  };
  submit(payload);
});

presetReco.addEventListener("click", () => {
  agentEl.value = "home-assistant";
  courseIdEl.value = "";
  messageEl.value = "berikan saya rekomendasi course mengenai data analysis";
});

presetDetail.addEventListener("click", () => {
  agentEl.value = "course-assistant";
  courseIdEl.value = "28";
  messageEl.value = "rangkumin materi ini dong";
});

if (!messageEl.value.trim()) {
  messageEl.value = "berikan saya rekomendasi course mengenai kepemimpinan dong";
}
