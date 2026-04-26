const SUPABASE_URL = "https://rcrykyskjifzxmmmesbf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnlreXNramlmenhtbW1lc2JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNjEyNDAsImV4cCI6MjA5MjczNzI0MH0.Jnk86K8pBvIA5s4Ab63yzVwGJXEgNufJTfTzXGZDQvs";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const authContainer = document.querySelector(".auth-container");
const appBox = document.getElementById("appBox");

let allTransactions = [];
let editingId = null;
let expensePieChart;
let moneySplitChart;
let savingGoal = 0;
let monthlyBudget = 0;
let currentUserName = "";
let lastBudgetToast = "";

function showLogin() {
  document.getElementById("loginBox").classList.remove("hidden");
  document.getElementById("registerBox").classList.add("hidden");
  document.getElementById("loginTab").classList.add("active");
  document.getElementById("registerTab").classList.remove("active");
  showMessage("");
}

async function getAIAdvice() {
  if (!allTransactions.length) {
    showToast("Add some transactions first", "error");
    return;
  }

  showToast("Analyzing...", "normal");

  try {
    const res = await fetch("http://localhost:3000/ai-advice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        transactions: allTransactions
      })
    });

    const data = await res.json();

    document.getElementById("insightText").innerText = data.advice;

    showToast("AI advice ready", "success");

  } catch (err) {
    showToast("AI failed", "error");
  }
}

function showRegister() {
  document.getElementById("registerBox").classList.remove("hidden");
  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("registerTab").classList.add("active");
  document.getElementById("loginTab").classList.remove("active");
  showMessage("");
}

function togglePassword(id, icon) {
  const input = document.getElementById(id);

  if (input.type === "password") {
    input.type = "text";
    icon.textContent = "🙈";
  } else {
    input.type = "password";
    icon.textContent = "👁";
  }
}

function showMessage(message) {
  document.getElementById("authMessage").innerText = message;
}

function showToast(message, type = "normal") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.innerText = message;

  if (type === "error") toast.style.background = "#dc2626";
  else if (type === "success") toast.style.background = "#16a34a";
  else toast.style.background = "#111827";

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

function toggleDarkMode() {
  document.body.classList.toggle("dark");

  const enabled = document.body.classList.contains("dark");
  localStorage.setItem("darkMode", enabled ? "yes" : "no");

  showToast(enabled ? "Dark mode enabled" : "Light mode enabled", "success");
}

function loadTheme() {
  const darkMode = localStorage.getItem("darkMode");
  if (darkMode === "yes") document.body.classList.add("dark");
}

async function register() {
  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();

  if (!name || !email || !password) {
    showMessage("Please fill all register fields.");
    return;
  }

  const { error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { name } }
  });

  if (error) {
    showMessage(error.message);
    return;
  }

  showMessage("Account created. Please login.");
  showToast("Account created successfully", "success");
  showLogin();
}

async function login() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    showMessage("Please enter email and password.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage(error.message);
    return;
  }

  showToast("Login successful", "success");
  await showApp();
}

async function forgotPassword() {
  const email = document.getElementById("loginEmail").value.trim();

  if (!email) {
    showToast("Enter your email first.", "error");
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);

  if (error) showToast(error.message, "error");
  else showToast("Password reset email sent.", "success");
}

async function logout() {
  await supabaseClient.auth.signOut();
  authContainer.classList.remove("hidden");
  appBox.classList.add("hidden");
  showLogin();
}

async function showApp() {
  const { data: { user } } = await supabaseClient.auth.getUser();

  currentUserName = user?.user_metadata?.name || user?.email || "User";

  const greeting = document.getElementById("userGreeting");
  if (greeting) greeting.innerText = `Welcome, ${currentUserName}`;

  authContainer.classList.add("hidden");
  appBox.classList.remove("hidden");

  savingGoal = parseFloat(localStorage.getItem("savingGoal")) || 0;
  monthlyBudget = parseFloat(localStorage.getItem("budget")) || 0;

  document.getElementById("goalAmount").innerText = savingGoal.toFixed(2);
  document.getElementById("budgetAmount").innerText = monthlyBudget.toFixed(2);

  const dateInput = document.getElementById("date");
  if (dateInput) dateInput.valueAsDate = new Date();

  await processRecurring();
  await loadTransactions();
}

async function addTransaction() {
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    showToast("Please login first.", "error");
    return;
  }

  const type = document.getElementById("type").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const category = document.getElementById("category").value.trim();
  const note = document.getElementById("note").value.trim();
  const date = document.getElementById("date").value;
  const recurring = document.getElementById("recurring").value;

  if (!amount || amount <= 0) {
    showToast("Please enter valid amount.", "error");
    return;
  }

  if (!date) {
    showToast("Please select date.", "error");
    return;
  }

  let result;
  const payload = { type, amount, category, note, date, recurring };

  if (editingId) {
    result = await supabaseClient
      .from("transactions")
      .update(payload)
      .eq("id", editingId);
  } else {
    result = await supabaseClient
      .from("transactions")
      .insert([{ user_id: user.id, ...payload, last_recurring_date: date }]);
  }

  if (result.error) {
    showToast(result.error.message, "error");
    return;
  }

  showToast(editingId ? "Transaction updated" : "Transaction added", "success");

  editingId = null;
  clearForm();
  await loadTransactions();
}

async function loadTransactions() {
  const { data, error } = await supabaseClient
    .from("transactions")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    showToast(error.message, "error");
    return;
  }

  allTransactions = data || [];
  applyFilters();
}

function applyFilters() {
  const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
  const typeFilter = document.getElementById("typeFilter")?.value || "all";
  const monthFilter = document.getElementById("monthFilter")?.value || "";
  const sortFilter = document.getElementById("sortFilter")?.value || "newest";

  let filtered = [...allTransactions];

  if (search) {
    filtered = filtered.filter(t =>
      (t.category || "").toLowerCase().includes(search) ||
      (t.note || "").toLowerCase().includes(search)
    );
  }

  if (typeFilter !== "all") {
    filtered = filtered.filter(t => t.type === typeFilter);
  }

  if (monthFilter) {
    filtered = filtered.filter(t => t.date && t.date.startsWith(monthFilter));
  }

  filtered.sort((a, b) => {
    if (sortFilter === "oldest") return new Date(a.date) - new Date(b.date);
    return new Date(b.date) - new Date(a.date);
  });

  renderTransactions(filtered);
  renderSummary(allTransactions);
}

function clearFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("typeFilter").value = "all";
  document.getElementById("monthFilter").value = "";
  document.getElementById("sortFilter").value = "newest";
  applyFilters();
}

function renderTransactions(transactions) {
  const list = document.getElementById("transactionList");
  list.innerHTML = "";

  if (!transactions.length) {
    list.innerHTML = "<li>No transactions found.</li>";
    return;
  }

  const colors = {
    income: "#16a34a",
    expense: "#dc2626",
    saving: "#7c3aed"
  };

  transactions.forEach(t => {
    const sign = t.type === "expense" ? "-" : "+";
    const li = document.createElement("li");

    li.style.borderLeft = `6px solid ${colors[t.type] || "#2563eb"}`;

    li.innerHTML = `
      <strong>${t.type.toUpperCase()}</strong>
      ${sign}₹${Number(t.amount).toFixed(2)}
      ${t.recurring && t.recurring !== "none" ? `<span class="recurring-badge"> ${t.recurring}</span>` : ""}
      <br>
      ${t.category || "-"} | ${t.note || "-"} | ${t.date}
      <br>
      <button onclick="editTransaction('${t.id}')">Edit</button>
      <button onclick="deleteTransaction('${t.id}')">Delete</button>
    `;

    list.appendChild(li);
  });
}

function renderSummary(transactions) {
  const income = transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expense = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const saving = transactions
    .filter(t => t.type === "saving")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  document.getElementById("income").innerText = income.toFixed(2);
  document.getElementById("expense").innerText = expense.toFixed(2);
  document.getElementById("saving").innerText = saving.toFixed(2);
  document.getElementById("balance").innerText = (income - expense - saving).toFixed(2);

  updateBudgetUI(expense);
  renderCharts(transactions, income, expense, saving);
  updateSavingsUI(saving, income, expense);
  updateReportSummary(transactions);
}

function editTransaction(id) {
  const t = allTransactions.find(item => item.id === id);

  if (!t) {
    showToast("Transaction not found.", "error");
    return;
  }

  editingId = id;

  document.getElementById("type").value = t.type;
  document.getElementById("amount").value = t.amount;
  document.getElementById("category").value = t.category || "";
  document.getElementById("note").value = t.note || "";
  document.getElementById("date").value = t.date;
  document.getElementById("recurring").value = t.recurring || "none";

  const addButton = document.querySelector(".form-panel button");
  addButton.innerText = "Update Transaction";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearForm() {
  document.getElementById("amount").value = "";
  document.getElementById("category").value = "";
  document.getElementById("note").value = "";
  document.getElementById("date").valueAsDate = new Date();
  document.getElementById("recurring").value = "none";

  editingId = null;

  const addButton = document.querySelector(".form-panel button");
  addButton.innerText = "Add Transaction";
}

async function deleteTransaction(id) {
  const confirmDelete = confirm("Delete this transaction?");
  if (!confirmDelete) return;

  const { error } = await supabaseClient
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) {
    showToast(error.message, "error");
    return;
  }

  showToast("Transaction deleted", "success");
  await loadTransactions();
}

function setSavingGoal() {
  savingGoal = parseFloat(document.getElementById("savingGoalInput").value) || 0;
  localStorage.setItem("savingGoal", savingGoal);
  document.getElementById("goalAmount").innerText = savingGoal.toFixed(2);
  updateSavingsUI();
  showToast("Saving goal updated", "success");
}

function setBudget() {
  monthlyBudget = parseFloat(document.getElementById("budgetInput").value) || 0;
  localStorage.setItem("budget", monthlyBudget);
  document.getElementById("budgetAmount").innerText = monthlyBudget.toFixed(2);
  renderSummary(allTransactions);
  showToast("Budget updated", "success");
}

function updateBudgetUI(expense = 0) {
  const budgetLeft = monthlyBudget - expense;
  document.getElementById("budgetAmount").innerText = monthlyBudget.toFixed(2);
  document.getElementById("budgetLeft").innerText = budgetLeft.toFixed(2);

  if (monthlyBudget <= 0) return;

  let warning = "";

  if (expense > monthlyBudget) {
    warning = "exceeded";
  } else if (expense > monthlyBudget * 0.8) {
    warning = "near";
  }

  if (warning && warning !== lastBudgetToast) {
    lastBudgetToast = warning;
    if (warning === "exceeded") showToast("🚨 Budget exceeded!", "error");
    if (warning === "near") showToast("⚠️ You are near budget limit", "normal");
  }

  if (!warning) lastBudgetToast = "";
}

function updateSavingsUI(saving = 0, income = 0, expense = 0) {
  document.getElementById("savedAmount").innerText = saving.toFixed(2);

  let percent = savingGoal > 0 ? (saving / savingGoal) * 100 : 0;
  percent = Math.min(percent, 100);

  document.getElementById("progressFill").style.width = percent + "%";
  document.getElementById("progressPercent").innerText = percent.toFixed(1);

  const balance = income - expense - saving;
  const savingRate = income > 0 ? (saving / income) * 100 : 0;
  const expenseRate = income > 0 ? (expense / income) * 100 : 0;

  let insight = "";

  if (income === 0 && expense === 0 && saving === 0) {
    insight = "Start by adding your income, expenses, and savings to get smart insights.";
  } else if (income === 0 && expense > 0) {
    insight = "⚠️ You have expenses but no income added. Add income to get accurate analysis.";
  } else if (expense > income) {
    insight = `🚨 Your expenses are higher than your income by ₹${(expense - income).toFixed(2)}. Try reducing non-essential spending.`;
  } else if (savingGoal > 0 && saving >= savingGoal) {
    insight = `🔥 Excellent! You reached your saving goal of ₹${savingGoal.toFixed(2)}. You saved ${savingRate.toFixed(1)}% of your income.`;
  } else if (savingGoal > 0 && saving < savingGoal) {
    const remaining = savingGoal - saving;

    if (percent >= 75) {
      insight = `💪 Great progress! You are ${percent.toFixed(1)}% close to your goal. Only ₹${remaining.toFixed(2)} left.`;
    } else if (percent >= 40) {
      insight = `👍 You are doing well. You have saved ${percent.toFixed(1)}% of your goal. Try saving ₹${remaining.toFixed(2)} more.`;
    } else {
      insight = `⚠️ You are behind your saving goal. You still need ₹${remaining.toFixed(2)} to reach your target.`;
    }
  } else if (savingRate >= 40) {
    insight = `🔥 Excellent saving habit! You saved ${savingRate.toFixed(1)}% of your income. Keep this consistency.`;
  } else if (savingRate >= 20) {
    insight = `✅ Good job! You saved ${savingRate.toFixed(1)}% of your income. Try pushing it closer to 30%.`;
  } else if (savingRate > 0) {
    insight = `⚠️ Your saving rate is only ${savingRate.toFixed(1)}%. Try cutting small daily expenses and save more.`;
  } else {
    insight = "💡 You have not added any savings yet. Try saving at least 20% of your income.";
  }

  if (balance < 0) {
    insight += ` Your balance is negative by ₹${Math.abs(balance).toFixed(2)}.`;
  } else if (balance > 0 && expenseRate < 60) {
    insight += ` Your spending is under control. Current balance: ₹${balance.toFixed(2)}.`;
  }

  document.getElementById("insightText").innerText = insight;
}

function renderCharts(transactions, income, expense, saving) {
  const expenseCategoryTotals = {};

  transactions
    .filter(t => t.type === "expense")
    .forEach(t => {
      const category = t.category || "Other";
      expenseCategoryTotals[category] =
        (expenseCategoryTotals[category] || 0) + Number(t.amount);
    });

  const expenseCanvas = document.getElementById("expensePieChart");

  if (expenseCanvas) {
    if (expensePieChart) expensePieChart.destroy();

    expensePieChart = new Chart(expenseCanvas, {
      type: "pie",
      data: {
        labels: Object.keys(expenseCategoryTotals).length
          ? Object.keys(expenseCategoryTotals)
          : ["No Expense"],
        datasets: [{
          data: Object.values(expenseCategoryTotals).length
            ? Object.values(expenseCategoryTotals)
            : [1]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  const splitCanvas = document.getElementById("moneySplitChart");

  if (splitCanvas) {
    if (moneySplitChart) moneySplitChart.destroy();

    moneySplitChart = new Chart(splitCanvas, {
      type: "doughnut",
      data: {
        labels: ["Income", "Expense", "Saving"],
        datasets: [{
          data: [income || 0, expense || 0, saving || 0]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
}

async function processRecurring() {
  const { data, error } = await supabaseClient
    .from("transactions")
    .select("*")
    .neq("recurring", "none");

  if (error || !data) return;

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  for (const t of data) {
    const lastDateStr = t.last_recurring_date || t.date;
    if (!lastDateStr) continue;

    const last = new Date(lastDateStr);
    let shouldAdd = false;

    if (t.recurring === "daily") {
      shouldAdd = todayStr !== lastDateStr;
    }

    if (t.recurring === "weekly") {
      shouldAdd = today - last >= 7 * 24 * 60 * 60 * 1000;
    }

    if (t.recurring === "monthly") {
      shouldAdd =
        today.getFullYear() !== last.getFullYear() ||
        today.getMonth() !== last.getMonth();
    }

    if (shouldAdd) {
      await supabaseClient.from("transactions").insert([{
        user_id: t.user_id,
        type: t.type,
        amount: t.amount,
        category: t.category,
        note: t.note,
        date: todayStr,
        recurring: "none",
        last_recurring_date: todayStr
      }]);

      await supabaseClient
        .from("transactions")
        .update({ last_recurring_date: todayStr })
        .eq("id", t.id);
    }
  }
}

function updateReportSummary(transactions = allTransactions) {
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const currentYear = now.getFullYear();
  const monthKey = `${currentYear}-${currentMonth}`;

  const monthlyTransactions = transactions.filter(t => t.date && t.date.startsWith(monthKey));

  const income = monthlyTransactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expense = monthlyTransactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const saving = monthlyTransactions
    .filter(t => t.type === "saving")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = income - expense - saving;
  const savingRate = income > 0 ? (saving / income) * 100 : 0;

  const highestExpense = monthlyTransactions
    .filter(t => t.type === "expense")
    .reduce((max, t) => Math.max(max, Number(t.amount)), 0);

  const reportBox = document.getElementById("reportSummary");

  if (!reportBox) return;

  reportBox.innerHTML = `
    <p><strong>This Month Report</strong></p>
    <p>Total Income: ₹${income.toFixed(2)}</p>
    <p>Total Expense: ₹${expense.toFixed(2)}</p>
    <p>Total Saving: ₹${saving.toFixed(2)}</p>
    <p>Balance: ₹${balance.toFixed(2)}</p>
    <p>Saving Rate: ${savingRate.toFixed(1)}%</p>
    <p>Total Transactions: ${monthlyTransactions.length}</p>
    <p>Highest Expense: ₹${highestExpense.toFixed(2)}</p>
  `;
}

function exportCSV() {
  if (!allTransactions.length) {
    showToast("No transactions to export.", "error");
    return;
  }

  const headers = ["Type", "Amount", "Category", "Note", "Date", "Recurring"];
  const rows = allTransactions.map(t => [
    t.type,
    Number(t.amount).toFixed(2),
    t.category || "",
    t.note || "",
    t.date || "",
    t.recurring || "none"
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")
    )
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "expense-report.csv";
  link.click();

  URL.revokeObjectURL(url);
  showToast("CSV exported", "success");
}

function printReport() {
  const report = document.getElementById("reportSummary").innerHTML;
  const transactionItems = document.getElementById("transactionList").innerHTML;

  const printWindow = window.open("", "_blank");

  printWindow.document.write(`
    <html>
      <head>
        <title>Expense Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 30px;
            color: #111827;
          }

          h1 {
            margin-bottom: 20px;
          }

          .summary {
            background: #f3f4f6;
            padding: 18px;
            border-radius: 12px;
            margin-bottom: 24px;
          }

          li {
            list-style: none;
            padding: 12px;
            border-bottom: 1px solid #ddd;
          }

          button {
            display: none;
          }
        </style>
      </head>
      <body>
        <h1>Expense Tracker Report</h1>
        <div class="summary">${report}</div>
        <h2>Transactions</h2>
        <ul>${transactionItems}</ul>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.print();
}

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    await showApp();
  } else {
    authContainer.classList.remove("hidden");
    appBox.classList.add("hidden");
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

loadTheme();
checkSession();