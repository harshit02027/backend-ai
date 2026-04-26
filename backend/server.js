import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY";

app.post("/ai-advice", async (req, res) => {
  try {
    const { transactions } = req.body;

    const summary = generateSummary(transactions);

    const prompt = `
You are a personal finance advisor.

Analyze this data and give clear, short, actionable advice:

${summary}

Rules:
- Be practical
- Give numbers when possible
- Suggest improvements
- Keep it under 5 lines
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    res.json({
      advice: data.choices[0].message.content
    });

  } catch (err) {
    res.status(500).json({ error: "AI failed" });
  }
});

function generateSummary(transactions) {
  let income = 0, expense = 0, saving = 0;
  let categories = {};

  transactions.forEach(t => {
    const amt = Number(t.amount);

    if (t.type === "income") income += amt;
    if (t.type === "expense") {
      expense += amt;
      categories[t.category] = (categories[t.category] || 0) + amt;
    }
    if (t.type === "saving") saving += amt;
  });

  return `
Income: ₹${income}
Expense: ₹${expense}
Saving: ₹${saving}
Top categories: ${JSON.stringify(categories)}
`;
}

app.listen(3000, () => console.log("AI server running"));