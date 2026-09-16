const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `Sos el asistente virtual del banco NODO, un banco digital argentino.
Tu rol es ayudar a los clientes con consultas sobre su cuenta, transferencias, reservas, y finanzas personales.
Respondé siempre en español, de forma clara, amable y concisa (máximo 3 oraciones).
No inventes datos del usuario. Si te preguntan algo que no podés saber (saldo exacto, movimientos), indicá que pueden verlo en el dashboard.
No respondas consultas que no tengan relación con finanzas o el banco.`;

const chat = async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ message: "El asistente no está configurado. Agregá GROQ_API_KEY al .env" });
  }

  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ message: "message es requerido" });

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-8).map(m => ({ role: m.role === "model" ? "assistant" : m.role, content: m.text })),
    { role: "user", content: message }
  ];

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.7, max_tokens: 256 })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("[Groq] Error:", response.status, JSON.stringify(err));
      return res.status(502).json({ message: err.error?.message || "Error al contactar el asistente" });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "No pude procesar tu consulta.";
    return res.json({ reply });
  } catch (error) {
    console.error("[Groq] Excepción:", error.message);
    return res.status(500).json({ message: "Error interno", error: error.message });
  }
};

module.exports = { chat };
