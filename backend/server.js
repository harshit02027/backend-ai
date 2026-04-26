import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

app.get("/", (req, res) => {
  res.send("AI backend is running with OpenRouter");
});

app.post("/ai-advice", async (req, res) => {
  try {
    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({
        error: "OPENROUTER_API_KEY is missing in Render environment variables"
      });
    }

    const { transactions } = req.body;

    const limitedTransactions = (transactions || []).slice(0, 30);

    const summary = JSON.stringify(limitedTransactions);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hostelexpensetracking.netlify.app",
        "X-Title": "Expense Tracker"
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct:free",
        messages: [
          {
            role: "user",
            content: `
You are a personal finance advisor.

Analyze these transactions and give short, practical advice in simple language.

Transactions:
${summary}

Keep response under 5 lines.
Use INR values.
`
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data.error?.message || "OpenRouter request failed"
      });
    }

    res.json({
      advice: data.choices?.[0]?.message?.content || "No advice generated."
    });

  } catch (error) {
    res.status(500).json({
      error: "AI failed"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`AI backend running on port ${PORT}`);
});