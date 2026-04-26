import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.get("/", (req, res) => {
  res.send("AI backend is running");
});

app.post("/ai-advice", async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OpenAI API key missing" });
    }

    const summary = createSummary(transactions || []);

    const prompt = `
You are a personal finance advisor.

Analyze this user's hostel/personal expense data:

${summary}

Give advice in simple language.
Keep it under 5 lines.
Give practical saving tips.
Use INR values.
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || "OpenAI error" });
    }

    res.json({ advice: data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: "AI failed" });
  }
});

function createSummary(transactions) {
  let income = 0;
  let expense = 0;
  let saving = 0;
  const categories = {};

  transactions.forEach(t => {
    const amount = Number(t.amount) || 0;

    if (t.type === "income") income += amount;
    if (t.type === "expense") {
      expense += amount;
      const cat = t.category || "Other";
      categories[cat] = (categories[cat] || 0) + amount;
    }
    if (t.type === "saving") saving += amount;
  });

  return `
Income: ₹${income}
Expense: ₹${expense}
Saving: ₹${saving}
Balance: ₹${income - expense - saving}
Expense Categories: ${JSON.stringify(categories)}
`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI server running on port ${PORT}`));