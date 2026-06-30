const seed = window.TRACKER_SEED;
const storageKey = "t12-mrr-tracker-v1";
let deferredInstallPrompt = null;
let activeFilter = "All";
let editingIndex = null;

const state = loadState();

const els = {
  periodTitle: document.querySelector("#periodTitle"),
  selectedCount: document.querySelector("#selectedCount"),
  implementedCount: document.querySelector("#implementedCount"),
  sustainedCount: document.querySelector("#sustainedCount"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  recordList: document.querySelector("#recordList"),
  addButton: document.querySelector("#addButton"),
  exportButton: document.querySelector("#exportButton"),
  resetButton: document.querySelector("#resetButton"),
  installButton: document.querySelector("#installButton"),
  dialog: document.querySelector("#editorDialog"),
  form: document.querySelector("#editorForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  accountPicker: document.querySelector("#accountPicker"),
  accountInput: document.querySelector("#accountInput"),
  initiativeInput: document.querySelector("#initiativeInput"),
  statusInput: document.querySelector("#statusInput"),
  actionInput: document.querySelector("#actionInput"),
  certInput: document.querySelector("#certInput"),
  salesInput: document.querySelector("#salesInput"),
  conedInput: document.querySelector("#conedInput"),
  proInput: document.querySelector("#proInput"),
  notesInput: document.querySelector("#notesInput"),
  deleteButton: document.querySelector("#deleteButton"),
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }
  return structuredClone({ meta: seed.meta, records: seed.records });
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function render() {
  els.periodTitle.textContent = `${state.meta.month} ${state.meta.quarter} - RM ${state.meta.rm} - Region ${state.meta.region}`;
  const selected = state.records.length;
  const implemented = state.records.filter((record) => record.status === "Implemented").length;
  const sustained = state.records.filter((record) => record.status === "Sustained").length;
  els.selectedCount.textContent = `${selected}/${state.meta.targetAccounts}`;
  els.implementedCount.textContent = `${implemented}/${state.meta.targetImplemented}`;
  els.sustainedCount.textContent = sustained;

  const query = els.searchInput.value.trim().toLowerCase();
  const records = state.records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => {
      const matchesFilter = activeFilter === "All" || record.status === activeFilter;
      const text = `${record.account} ${record.initiative} ${record.status}`.toLowerCase();
      return matchesFilter && text.includes(query);
    });

  els.recordList.innerHTML = "";
  for (const item of records) {
    els.recordList.appendChild(renderRecord(item.record, item.index));
  }
}

function renderRecord(record, index) {
  const article = document.createElement("article");
  article.className = `record ${record.status.toLowerCase()}`;
  article.tabIndex = 0;
  article.setAttribute("role", "button");
  article.addEventListener("click", () => openEditor(index));
  article.addEventListener("keydown", (event) => {
    if (event.key === "Enter") openEditor(index);
  });

  const kpis = [
    ["cert", "Cert"],
    ["sales", "Sales"],
    ["coned", "ConEd"],
    ["pro", "Pro"],
  ];

  article.innerHTML = `
    <div class="record-top">
      <h3>${escapeHtml(record.account)}</h3>
      <span class="pill">${escapeHtml(record.status || "No status")}</span>
    </div>
    <p>${escapeHtml(record.initiative || "No initiative selected")}</p>
    ${record.action ? `<p>${escapeHtml(record.action)}</p>` : ""}
    <div class="kpis">
      ${kpis.map(([key, label]) => `<span class="${record.kpi[key] ? "on" : ""}">${label}</span>`).join("")}
    </div>
  `;
  return article;
}

function populateOptions() {
  els.initiativeInput.innerHTML = ["", ...seed.initiativeOptions]
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value || "Select initiative")}</option>`)
    .join("");
  els.statusInput.innerHTML = seed.statusOptions
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");
}

function openEditor(index = null) {
  editingIndex = index;
  const record = index === null
    ? { account: "", initiative: "", status: "Selected", action: "", notes: "", kpi: {} }
    : state.records[index];

  els.dialogTitle.textContent = index === null ? "Add account" : "Edit account";
  els.accountInput.value = record.account || "";
  els.initiativeInput.value = record.initiative || "";
  els.statusInput.value = record.status || "Selected";
  els.actionInput.value = record.action || "";
  els.notesInput.value = record.notes || "";
  els.certInput.checked = Boolean(record.kpi.cert);
  els.salesInput.checked = Boolean(record.kpi.sales);
  els.conedInput.checked = Boolean(record.kpi.coned);
  els.proInput.checked = Boolean(record.kpi.pro);
  els.deleteButton.hidden = index === null;
  renderAccountPicker();
  els.dialog.showModal();
}

function renderAccountPicker() {
  const query = els.accountInput.value.trim().toLowerCase();
  const selectedAccounts = new Set(state.records.map((record) => record.account));
  const matches = seed.stores
    .filter((store) => {
      const text = `${store.store} ${store.country} ${store.number} ${store.account}`.toLowerCase();
      return !query || text.includes(query);
    })
    .slice(0, 25);

  els.accountPicker.innerHTML = matches
    .map((store) => {
      const alreadySelected = selectedAccounts.has(store.account);
      return `
        <button type="button" class="account-option" data-account="${escapeHtml(store.account)}">
          <span>${escapeHtml(store.store)}</span>
          <small>${escapeHtml(store.number)} - ${escapeHtml(store.country)}${alreadySelected ? " - selected" : ""}</small>
        </button>
      `;
    })
    .join("");
}

function saveEditor(event) {
  event.preventDefault();
  const record = {
    account: els.accountInput.value.trim(),
    initiative: els.initiativeInput.value,
    status: els.statusInput.value,
    action: els.actionInput.value.trim(),
    notes: els.notesInput.value.trim(),
    kpi: {
      cert: els.certInput.checked,
      sales: els.salesInput.checked,
      coned: els.conedInput.checked,
      pro: els.proInput.checked,
    },
  };

  if (editingIndex === null) {
    state.records.unshift(record);
  } else {
    state.records[editingIndex] = record;
  }
  saveState();
  els.dialog.close();
  render();
}

function exportCsv() {
  const headers = ["Account", "Initiative", "Status", "Current Action", "Cert", "Sales", "ConEd", "Pro", "Notes"];
  const rows = state.records.map((record) => [
    record.account,
    record.initiative,
    record.status,
    record.action,
    record.kpi.cert ? "yes" : "",
    record.kpi.sales ? "yes" : "",
    record.kpi.coned ? "yes" : "",
    record.kpi.pro ? "yes" : "",
    record.notes,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `t12-mrr-${state.meta.month}-${state.meta.quarter}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

els.searchInput.addEventListener("input", render);
els.addButton.addEventListener("click", () => openEditor());
els.accountInput.addEventListener("input", renderAccountPicker);
els.accountInput.addEventListener("focus", renderAccountPicker);
els.accountPicker.addEventListener("click", (event) => {
  const button = event.target.closest(".account-option");
  if (!button) return;
  els.accountInput.value = button.dataset.account;
  renderAccountPicker();
});
els.form.addEventListener("submit", saveEditor);
els.exportButton.addEventListener("click", exportCsv);
els.resetButton.addEventListener("click", () => {
  if (confirm("Reset local changes and reload the spreadsheet data?")) {
    localStorage.removeItem(storageKey);
    Object.assign(state, structuredClone({ meta: seed.meta, records: seed.records }));
    render();
  }
});
els.deleteButton.addEventListener("click", () => {
  if (editingIndex !== null && confirm("Delete this account from the tracker?")) {
    state.records.splice(editingIndex, 1);
    saveState();
    els.dialog.close();
    render();
  }
});
els.statusFilter.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  activeFilter = button.dataset.filter;
  els.statusFilter.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
  render();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  els.installButton.hidden = false;
});
els.installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt = null;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

populateOptions();
els.installButton.hidden = true;
render();
