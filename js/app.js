import { isFirebaseConfigured } from "./firebase-config.js";
import {
  validateVehiclePayload,
  formatPlateDisplay,
  isMercosulPlate,
} from "./validators.js";
import {
  subscribeToVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from "./vehicle-service.js";

const numberFormatter = new Intl.NumberFormat("pt-BR");

const COLOR_SWATCH_MAP = {
  preto: "#111827",
  preta: "#111827",
  branco: "#f8fafc",
  branca: "#f8fafc",
  prata: "#cbd5e1",
  cinza: "#64748b",
  vermelho: "#dc2626",
  vermelha: "#dc2626",
  azul: "#2563eb",
  verde: "#16a34a",
  amarelo: "#eab308",
  amarela: "#eab308",
  marrom: "#78350f",
  bege: "#e7e5e4",
  vinho: "#7f1d1d",
  laranja: "#ea580c",
  dourado: "#ca8a04",
};

const state = {
  vehicles: [],
  editingId: null,
  pendingDeleteId: null,
  searchQuery: "",
  sortBy: "recent",
  isSubmitting: false,
};

// Referências de DOM
const el = {
  configAlert: document.getElementById("config-alert"),
  kpiTotal: document.getElementById("kpi-total"),
  kpiAvgKm: document.getElementById("kpi-avg-km"),
  kpiNewestYear: document.getElementById("kpi-newest-year"),

  formPanel: document.getElementById("form-panel"),
  formModeBadge: document.getElementById("form-mode-badge"),
  formTitle: document.getElementById("form-title"),
  formSubtitle: document.getElementById("form-subtitle"),
  form: document.getElementById("vehicle-form"),

  inputs: {
    marca: document.getElementById("marca"),
    modelo: document.getElementById("modelo"),
    placa: document.getElementById("placa"),
    cor: document.getElementById("cor"),
    anoFabricacao: document.getElementById("anoFabricacao"),
    kmRodada: document.getElementById("kmRodada"),
  },

  errors: {
    marca: document.getElementById("err-marca"),
    modelo: document.getElementById("err-modelo"),
    placa: document.getElementById("err-placa"),
    cor: document.getElementById("err-cor"),
    anoFabricacao: document.getElementById("err-anoFabricacao"),
    kmRodada: document.getElementById("err-kmRodada"),
  },

  btnSubmit: document.getElementById("btn-submit"),
  btnCancelEdit: document.getElementById("btn-cancel-edit"),
  btnClear: document.getElementById("btn-clear"),

  searchInput: document.getElementById("search-input"),
  sortSelect: document.getElementById("sort-select"),
  resultsCount: document.getElementById("results-count"),
  loadingState: document.getElementById("loading-state"),
  emptyState: document.getElementById("empty-state"),
  emptyTitle: document.getElementById("empty-title"),
  emptyDesc: document.getElementById("empty-desc"),
  tableWrapper: document.getElementById("table-wrapper"),
  tbody: document.getElementById("vehicles-tbody"),

  deleteModal: document.getElementById("delete-modal"),
  deleteDesc: document.getElementById("delete-vehicle-desc"),
  btnCancelDelete: document.getElementById("btn-cancel-delete"),
  btnConfirmDelete: document.getElementById("btn-confirm-delete"),
  toastContainer: document.getElementById("toast-container"),
};

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  el.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function clearValidationErrors() {
  Object.keys(el.errors).forEach((field) => {
    el.errors[field].textContent = "";
    el.inputs[field].classList.remove("input-invalid");
  });
}

function applyValidationErrors(errors) {
  clearValidationErrors();
  Object.entries(errors).forEach(([field, msg]) => {
    if (el.errors[field]) {
      el.errors[field].textContent = msg;
      el.inputs[field].classList.add("input-invalid");
    }
  });
}

function enterEditMode(vehicle) {
  state.editingId = vehicle.id;
  clearValidationErrors();

  el.inputs.marca.value = vehicle.marca;
  el.inputs.modelo.value = vehicle.modelo;
  el.inputs.placa.value = formatPlateDisplay(vehicle.placa);
  el.inputs.cor.value = vehicle.cor;
  el.inputs.anoFabricacao.value = String(vehicle.anoFabricacao);
  el.inputs.kmRodada.value = String(vehicle.kmRodada);

  el.formPanel.classList.add("is-editing");
  el.formModeBadge.className = "mode-badge mode-badge--edit";
  el.formModeBadge.textContent = `Editando • ${formatPlateDisplay(vehicle.placa)}`;
  el.formTitle.textContent = "Alterar Automóvel";
  el.formSubtitle.textContent =
    "Altere os campos desejados e salve para atualizar o cadastro do veículo.";
  el.btnSubmit.textContent = "Salvar Alterações";
  el.btnCancelEdit.classList.remove("hidden");

  renderVehicleList();
  el.formPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  el.inputs.marca.focus();
}

function exitEditMode(resetFields = true) {
  state.editingId = null;
  clearValidationErrors();

  if (resetFields) {
    el.form.reset();
  }

  el.formPanel.classList.remove("is-editing");
  el.formModeBadge.className = "mode-badge mode-badge--create";
  el.formModeBadge.textContent = "Novo Registro";
  el.formTitle.textContent = "Cadastrar Automóvel";
  el.formSubtitle.textContent =
    "Preencha os campos obrigatórios para registrar o veículo na frota.";
  el.btnSubmit.textContent = "Cadastrar Automóvel";
  el.btnCancelEdit.classList.add("hidden");

  renderVehicleList();
}

function updateKPIs() {
  const total = state.vehicles.length;
  el.kpiTotal.textContent = numberFormatter.format(total);

  if (total === 0) {
    el.kpiAvgKm.textContent = "0 km";
    el.kpiNewestYear.textContent = "—";
    return;
  }

  const sumKm = state.vehicles.reduce((acc, v) => acc + v.kmRodada, 0);
  const avgKm = Math.round(sumKm / total);
  const newestYear = Math.max(...state.vehicles.map((v) => v.anoFabricacao));

  el.kpiAvgKm.textContent = `${numberFormatter.format(avgKm)} km`;
  el.kpiNewestYear.textContent = String(newestYear);
}

function resolveColorHex(colorName) {
  const normalized = colorName.trim().toLowerCase().split(" ")[0];
  return COLOR_SWATCH_MAP[normalized] || "#94a3b8";
}

function getFilteredAndSortedVehicles() {
  const queryText = state.searchQuery.trim().toLowerCase();

  const filtered = state.vehicles.filter((v) => {
    if (!queryText) return true;
    const searchable =
      `${v.marca} ${v.modelo} ${v.placa} ${formatPlateDisplay(v.placa)} ${v.cor} ${v.anoFabricacao}`.toLowerCase();
    return searchable.includes(queryText);
  });

  return filtered.sort((a, b) => {
    switch (state.sortBy) {
      case "year_desc":
        return b.anoFabricacao - a.anoFabricacao;
      case "km_asc":
        return a.kmRodada - b.kmRodada;
      case "km_desc":
        return b.kmRodada - a.kmRodada;
      case "az":
        return `${a.marca} ${a.modelo}`.localeCompare(
          `${b.marca} ${b.modelo}`,
          "pt-BR",
        );
      case "recent":
      default:
        return b.criadoEmMs - a.criadoEmMs;
    }
  });
}

function createPlateElement(placa) {
  const wrapper = document.createElement("div");
  const mercosul = isMercosulPlate(placa);
  wrapper.className = mercosul
    ? "plate-badge"
    : "plate-badge plate-badge--legacy";

  const top = document.createElement("span");
  top.className = "plate-badge__top";
  top.textContent = mercosul ? "BRASIL" : "BR • PADRÃO";

  const code = document.createElement("span");
  code.className = "plate-badge__code";
  code.textContent = formatPlateDisplay(placa);

  wrapper.append(top, code);
  return wrapper;
}

function renderVehicleList() {
  el.loadingState.classList.add("hidden");
  const list = getFilteredAndSortedVehicles();

  const totalCount = state.vehicles.length;
  el.resultsCount.textContent =
    totalCount === list.length
      ? `${totalCount} ${totalCount === 1 ? "automóvel cadastrado" : "automóveis cadastrados"}`
      : `Exibindo ${list.length} de ${totalCount} automóveis`;

  if (list.length === 0) {
    el.tableWrapper.classList.add("hidden");
    el.emptyState.classList.remove("hidden");

    if (totalCount === 0) {
      el.emptyTitle.textContent = "Nenhum automóvel cadastrado";
      el.emptyDesc.textContent =
        "Utilize o formulário ao lado para registrar o primeiro veículo da frota.";
    } else {
      el.emptyTitle.textContent = "Nenhum resultado para a busca";
      el.emptyDesc.textContent =
        "Tente ajustar o termo pesquisado no filtro acima.";
    }
    return;
  }

  el.emptyState.classList.add("hidden");
  el.tableWrapper.classList.remove("hidden");
  el.tbody.replaceChildren();

  const fragment = document.createDocumentFragment();

  list.forEach((vehicle) => {
    const tr = document.createElement("tr");
    if (vehicle.id === state.editingId) {
      tr.classList.add("row-editing");
    }

    // Coluna 1: Placa
    const tdPlate = document.createElement("td");
    tdPlate.appendChild(createPlateElement(vehicle.placa));

    // Coluna 2: Marca e Modelo
    const tdModel = document.createElement("td");
    const spanModel = document.createElement("span");
    spanModel.className = "vehicle-main";
    spanModel.textContent = vehicle.modelo;
    const spanBrand = document.createElement("span");
    spanBrand.className = "vehicle-brand";
    spanBrand.textContent = vehicle.marca;
    tdModel.append(spanModel, spanBrand);

    // Coluna 3: Cor
    const tdColor = document.createElement("td");
    const colorChip = document.createElement("span");
    colorChip.className = "color-chip";
    const colorDot = document.createElement("span");
    colorDot.className = "color-chip__dot";
    colorDot.style.backgroundColor = resolveColorHex(vehicle.cor);
    const colorLabel = document.createElement("span");
    colorLabel.textContent = vehicle.cor;
    colorChip.append(colorDot, colorLabel);
    tdColor.appendChild(colorChip);

    // Coluna 4: Ano de Fabricação
    const tdYear = document.createElement("td");
    tdYear.textContent = String(vehicle.anoFabricacao);

    // Coluna 5: Km Rodada
    const tdKm = document.createElement("td");
    tdKm.textContent = `${numberFormatter.format(vehicle.kmRodada)} km`;

    // Coluna 6: Ações (Editar / Excluir)
    const tdActions = document.createElement("td");
    tdActions.className = "text-right";
    const actionsWrap = document.createElement("div");
    actionsWrap.className = "row-actions";

    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.className = "btn btn--ghost btn--sm";
    btnEdit.textContent = "Editar";
    btnEdit.addEventListener("click", () => enterEditMode(vehicle));

    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.className = "btn btn--ghost btn--sm";
    btnDelete.style.color = "var(--danger)";
    btnDelete.textContent = "Excluir";
    btnDelete.addEventListener("click", () => openDeleteModal(vehicle));

    actionsWrap.append(btnEdit, btnDelete);
    tdActions.appendChild(actionsWrap);

    tr.append(tdPlate, tdModel, tdColor, tdYear, tdKm, tdActions);
    fragment.appendChild(tr);
  });

  el.tbody.appendChild(fragment);
}

function openDeleteModal(vehicle) {
  state.pendingDeleteId = vehicle.id;
  el.deleteDesc.textContent = `${vehicle.marca} ${vehicle.modelo} (${formatPlateDisplay(vehicle.placa)})`;
  el.deleteModal.classList.remove("hidden");
}

function closeDeleteModal() {
  state.pendingDeleteId = null;
  el.deleteModal.classList.add("hidden");
}

// Eventos de Interface
el.inputs.placa.addEventListener("input", () => {
  el.inputs.placa.value = el.inputs.placa.value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
});

el.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.isSubmitting) return;

  if (!isFirebaseConfigured()) {
    showToast("Serviço indisponível: configuração pendente.", "error");
    return;
  }

  const rawPayload = {
    marca: el.inputs.marca.value,
    modelo: el.inputs.modelo.value,
    placa: el.inputs.placa.value,
    cor: el.inputs.cor.value,
    anoFabricacao: el.inputs.anoFabricacao.value,
    kmRodada: el.inputs.kmRodada.value,
  };

  const { valid, errors, sanitizedData } = validateVehiclePayload(rawPayload);
  if (!valid) {
    applyValidationErrors(errors);
    showToast("Corrija os campos destacados antes de salvar.", "warning");
    return;
  }

  clearValidationErrors();
  state.isSubmitting = true;
  el.btnSubmit.disabled = true;

  try {
    if (state.editingId) {
      el.btnSubmit.textContent = "Atualizando...";
      await updateVehicle(state.editingId, sanitizedData);
      showToast("Automóvel atualizado com sucesso!", "success");
      exitEditMode(true);
    } else {
      el.btnSubmit.textContent = "Cadastrando...";
      await createVehicle(sanitizedData);
      showToast("Automóvel cadastrado com sucesso!", "success");
      el.form.reset();
      el.inputs.marca.focus();
    }
  } catch (err) {
    console.error("Erro na operação de persistência:", err);
    showToast(
      err.message || "Não foi possível salvar os dados no momento.",
      "error",
    );
  } finally {
    state.isSubmitting = false;
    el.btnSubmit.disabled = false;
    el.btnSubmit.textContent = state.editingId
      ? "Salvar Alterações"
      : "Cadastrar Automóvel";
  }
});

el.btnCancelEdit.addEventListener("click", () => {
  exitEditMode(true);
  showToast("Modo de edição cancelado.");
});

el.btnClear.addEventListener("click", () => {
  el.form.reset();
  clearValidationErrors();
});

el.searchInput.addEventListener("input", (e) => {
  state.searchQuery = e.target.value;
  renderVehicleList();
});

el.sortSelect.addEventListener("change", (e) => {
  state.sortBy = e.target.value;
  renderVehicleList();
});

el.btnCancelDelete.addEventListener("click", closeDeleteModal);

el.deleteModal.addEventListener("click", (e) => {
  if (e.target === el.deleteModal) closeDeleteModal();
});

el.btnConfirmDelete.addEventListener("click", async () => {
  if (!state.pendingDeleteId) return;
  const targetId = state.pendingDeleteId;
  el.btnConfirmDelete.disabled = true;

  try {
    await deleteVehicle(targetId);
    if (state.editingId === targetId) {
      exitEditMode(true);
    }
    showToast("Automóvel removido do cadastro.", "success");
    closeDeleteModal();
  } catch (err) {
    console.error("Erro ao excluir:", err);
    showToast("Não foi possível excluir o registro.", "error");
  } finally {
    el.btnConfirmDelete.disabled = false;
  }
});

// Inicialização da Aplicação
function init() {
  const maxYear = new Date().getFullYear() + 1;
  el.inputs.anoFabricacao.max = String(maxYear);

  if (!isFirebaseConfigured()) {
    el.configAlert.classList.remove("hidden");
    el.loadingState.classList.add("hidden");
    el.emptyState.classList.remove("hidden");
    el.resultsCount.textContent = "Serviço aguardando configuração";
    return;
  }

  subscribeToVehicles(
    (vehicles) => {
      state.vehicles = vehicles;

      // Caso o veículo em edição tenha sido excluído remotamente por outro membro do grupo
      if (state.editingId && !vehicles.some((v) => v.id === state.editingId)) {
        exitEditMode(true);
        showToast(
          "O automóvel em edição foi removido por outro usuário.",
          "warning",
        );
      }

      updateKPIs();
      renderVehicleList();
    },
    (error) => {
      console.error("Erro na leitura do banco de dados:", error);
      el.loadingState.classList.add("hidden");
      el.resultsCount.textContent = "Indisponível no momento";
      showToast(
        "Não foi possível carregar os automóveis. Verifique sua conexão.",
        "error",
      );
    },
  );
}

init();
