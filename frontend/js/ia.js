document.addEventListener("DOMContentLoaded", () => {
  const aiToggle   = document.getElementById("aiToggle");
  const aiWindow   = document.getElementById("aiChatWindow");
  const aiClose    = document.getElementById("aiClose");
  const aiSend     = document.getElementById("aiSend");
  const aiQuery    = document.getElementById("aiQuery");
  const aiMessages = document.getElementById("aiMessages");
  const chatHistory = [];

  if (aiToggle) aiToggle.addEventListener("click", () => aiWindow?.classList.toggle("hidden"));
  if (aiClose)  aiClose.addEventListener("click",  () => aiWindow?.classList.add("hidden"));

  const aiAppendMsg = (text, role) => {
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    div.textContent = text;
    aiMessages.appendChild(div);
    aiMessages.scrollTop = aiMessages.scrollHeight;
  };

  const aiSetLoading = (on) => {
    if (!aiSend) return;
    aiSend.disabled = on;
    aiSend.innerHTML = on
      ? '<i class="fas fa-spinner fa-spin"></i>'
      : '<i class="fas fa-paper-plane"></i>';
  };

  const enviarMensaje = async () => {
    const text = aiQuery.value.trim();
    if (!text) return;
    aiQuery.value = "";
    aiAppendMsg(text, "user");
    chatHistory.push({ role: "user", text });
    aiSetLoading(true);
    try {
      const data = await apiFetch("/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, history: chatHistory.slice(0, -1) })
      });
      aiAppendMsg(data.reply, "bot");
      chatHistory.push({ role: "model", text: data.reply });
    } catch {
      aiAppendMsg("No pude conectarme con el asistente. Intentá de nuevo.", "bot");
    } finally {
      aiSetLoading(false);
    }
  };

  if (aiSend)  aiSend.addEventListener("click", enviarMensaje);
  if (aiQuery) aiQuery.addEventListener("keydown", e => { if (e.key === "Enter") enviarMensaje(); });
});
