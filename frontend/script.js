const SUPABASE_URL = "https://rcrykyskjifzxmmmesbf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnlreXNramlmenhtbW1lc2JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNjEyNDAsImV4cCI6MjA5MjczNzI0MH0.Jnk86K8pBvIA5s4Ab63yzVwGJXEgNufJTfTzXGZDQvs";
const AI_BACKEND_URL = "https://backend-ai-rusp.onrender.com/ai-advice";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const authContainer = document.getElementById("authContainer");
const appBox = document.getElementById("appBox");

let allTransactions = [];
let editingId = null;
let savingGoal = 0;
let monthlyBudget = 0;
let expensePieChart;
let moneySplitChart;

function showLogin() {
  document.getElementById("loginBox").classList.remove("hidden");
  document.getElementById("registerBox").classList.add("hidden");
  document.getElementById("loginTab").classList.add("active");
  document.getElementById("registerTab").classList.remove("active");
  showMessage("");
}

function showRegister() {
  document.getElementById("registerBox").classList.remove("hidden");
  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("registerTab").classList.add("active");
  document.getElementById("loginTab").classList.remove("active");
  showMessage("");
}

function showMessage(msg) {
  document.getElementById("authMessage").innerText = msg;
}

function showToast(msg, type = "normal") {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.style.background = type === "error" ? "#dc2626" : type === "success" ? "#16a34a" : "#111827";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

async function register() {
  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();

  if (!name || !email || !password) {
    showMessage("Please fill all fields.");
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

  showToast("Account created. Please login.", "success");
  showLogin();
}

async function login() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    showMessage("Enter email and password.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    showMessage(error.message);
    return;
  }

  await showApp();
}

async function logout() {
  await supabaseClient.auth.signOut();
  authContainer.classList.remove("hidden");
  appBox.classList.add("hidden");
}

async function showApp() {
  const { data: { user } } = await supabaseClient.auth.getUser();

  authContainer.classList.add("hidden");
  appBox.classList.remove("hidden");

  document.getElementById("userGreeting").innerText =
    `Welcome, ${user?.user_metadata?.name || user?.email || "User"}`;

  savingGoal = Number(localStorage.getItem("savingGoal")) || 0;
  monthlyBudget = Number(localStorage.getItem("monthlyBudget")) || 0;

  document.getElementById("goalAmount").innerText = savingGoal.toFixed(2);
  document.getElementById("budgetAmount").innerText = monthlyBudget.toFixed(2);

  document.getElementById("date").valueAsDate = new Date();

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

  if (!amount || amount <= 0) {
    showToast("Enter valid amount.", "error");
    return;
  }

  if (!date) {
    showToast("Select date.", "error");
    return;
  }

  let result;

  if (editingId) {
    result = await supabaseClient
      .from("transactions")
      .update({ type, amount, category, note, date })
      .eq("id", editingId);
  } else {
    result = await supabaseClient
      .from("transactions")
      .insert([{ user_id: user.id, type, amount, category, note, date }]);
  }

  if (result.error) {
    showToast(result.error.message, "error");
    return;
  }

  showToast(editingId ? "Transaction updated" : "Transaction added", "success");
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
  const search = document.getElementById("searchInput").value.toLowerCase();
  const typeFilter = document.getElementById("typeFilter").value;
  const monthFilter = document.getElementById("monthFilter").value;
  const sortFilter = document.getElementById("sortFilter").value;

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

  filtered.sort((a, b) =>
    sortFilter === "oldest"
      ? new Date(a.date) - new Date(b.date)
      : new Date(b.date) - new Date(a.date)
  );

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

  transactions.forEach(t => {
    const li = document.createElement("li");
    const sign = t.type === "expense" ? "-" : "+";

    li.innerHTML = `
      <strong>${t.type.toUpperCase()}</strong> ${sign}₹${Number(t.amount).toFixed(2)}
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
  const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const saving = transactions.filter(t => t.type === "saving").reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense - saving;

  document.getElementById("income").innerText = income.toFixed(2);
  document.getElementById("expense").innerText = expense.toFixed(2);
  document.getElementById("saving").innerText = saving.toFixed(2);
  document.getElementById("balance").innerText = balance.toFixed(2);

  updateSavingsUI(saving, income, expense);
  updateBudgetUI(expense);
  updateReportSummary(transactions);
  renderCharts(transactions, income, expense, saving);
}

function editTransaction(id) {
  const t = allTransactions.find(item => item.id === id);
  if (!t) return;

  editingId = id;

  document.getElementById("type").value = t.type;
  document.getElementById("amount").value = t.amount;
  document.getElementById("category").value = t.category || "";
  document.getElementById("note").value = t.note || "";
  document.getElementById("date").value = t.date;
  document.getElementById("transactionBtn").innerText = "Update Transaction";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteTransaction(id) {
  if (!confirm("Delete this transaction?")) return;

  const { error } = await supabaseClient.from("transactions").delete().eq("id", id);

  if (error) {
    showToast(error.message, "error");
    return;
  }

  showToast("Transaction deleted", "success");
  await loadTransactions();
}

function clearForm() {
  editingId = null;
  document.getElementById("amount").value = "";
  document.getElementById("category").value = "";
  document.getElementById("note").value = "";
  document.getElementById("date").valueAsDate = new Date();
  document.getElementById("transactionBtn").innerText = "Add Transaction";
}

function setSavingGoal() {
  savingGoal = Number(document.getElementById("savingGoalInput").value) || 0;
  localStorage.setItem("savingGoal", savingGoal);
  document.getElementById("goalAmount").innerText = savingGoal.toFixed(2);
  renderSummary(allTransactions);
}

function setBudget() {
  monthlyBudget = Number(document.getElementById("budgetInput").value) || 0;
  localStorage.setItem("monthlyBudget", monthlyBudget);
  document.getElementById("budgetAmount").innerText = monthlyBudget.toFixed(2);
  renderSummary(allTransactions);
}

function updateSavingsUI(saving, income, expense) {
  document.getElementById("savedAmount").innerText = saving.toFixed(2);

  const percent = savingGoal > 0 ? Math.min((saving / savingGoal) * 100, 100) : 0;
  document.getElementById("progressFill").style.width = percent + "%";
  document.getElementById("progressPercent").innerText = percent.toFixed(1);

  const savingRate = income > 0 ? (saving / income) * 100 : 0;
  let insight = "Start adding transactions to get smart insights.";

  if (income > 0) {
    if (expense > income) insight = "🚨 Expenses are higher than income. Reduce unnecessary spending.";
    else if (savingRate >= 30) insight = `🔥 Great! You saved ${savingRate.toFixed(1)}% of your income.`;
    else if (savingRate > 0) insight = `👍 You saved ${savingRate.toFixed(1)}%. Try reaching 20–30%.`;
    else insight = "💡 You have income but no savings yet. Try saving at least 20%.";
  }

  document.getElementById("insightText").innerText = insight;
}

function updateBudgetUI(expense) {
  const left = monthlyBudget - expense;
  document.getElementById("budgetLeft").innerText = left.toFixed(2);
}

function updateReportSummary(transactions) {
  const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const saving = transactions.filter(t => t.type === "saving").reduce((s, t) => s + Number(t.amount), 0);

  document.getElementById("reportSummary").innerHTML = `
    <p>Total Income: ₹${income.toFixed(2)}</p>
    <p>Total Expense: ₹${expense.toFixed(2)}</p>
    <p>Total Saving: ₹${saving.toFixed(2)}</p>
    <p>Total Transactions: ${transactions.length}</p>
  `;
}

function renderCharts(transactions, income, expense, saving) {
  const categoryTotals = {};

  transactions.filter(t => t.type === "expense").forEach(t => {
    const cat = t.category || "Other";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
  });

  if (expensePieChart) expensePieChart.destroy();
  expensePieChart = new Chart(document.getElementById("expensePieChart"), {
    type: "pie",
    data: {
      labels: Object.keys(categoryTotals).length ? Object.keys(categoryTotals) : ["No Expense"],
      datasets: [{ data: Object.values(categoryTotals).length ? Object.values(categoryTotals) : [1] }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  if (moneySplitChart) moneySplitChart.destroy();
  moneySplitChart = new Chart(document.getElementById("moneySplitChart"), {
    type: "doughnut",
    data: {
      labels: ["Income", "Expense", "Saving"],
      datasets: [{ data: [income, expense, saving] }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function exportCSV() {
  if (!allTransactions.length) {
    showToast("No transactions to export.", "error");
    return;
  }

  const rows = [["Type", "Amount", "Category", "Note", "Date"]];
  allTransactions.forEach(t => rows.push([t.type, t.amount, t.category || "", t.note || "", t.date || ""]));

  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "expense-report.csv";
  a.click();

  URL.revokeObjectURL(url);
}

function printReport() {
  window.print();
}

async function getAIAdvice() {
  if (!allTransactions.length) {
    showToast("Add some transactions first.", "error");
    return;
  }

  const situation = document.getElementById("userSituation").value.trim();

  showToast("AI is analyzing...", "normal");

  try {
    const response = await fetch(AI_BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactions: allTransactions,
        situation: situation
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || "AI failed.", "error");
      return;
    }

    document.getElementById("insightText").innerText = data.advice;
    showToast("AI advice ready.", "success");
  } catch {
    showToast("Could not connect to AI backend.", "error");
  }
}

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) await showApp();
  else {
    authContainer.classList.remove("hidden");
    appBox.classList.add("hidden");
  }
}

checkSession();