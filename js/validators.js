const MERCOSUL_PLATE_REGEX = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
const LEGACY_PLATE_REGEX = /^[A-Z]{3}[0-9]{4}$/;

/**
 * Normaliza a placa removendo hifens e espaços para armazenamento canônico (7 caracteres).
 */
export function normalizePlate(rawPlate = "") {
  return String(rawPlate)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function isMercosulPlate(normalizedPlate) {
  return MERCOSUL_PLATE_REGEX.test(normalizedPlate);
}

/**
 * Formata a placa para exibição em tela (ABC-1234 no padrão cinza ou ABC1D23 no Mercosul).
 */
export function formatPlateDisplay(normalizedPlate) {
  if (LEGACY_PLATE_REGEX.test(normalizedPlate)) {
    return `${normalizedPlate.slice(0, 3)}-${normalizedPlate.slice(3)}`;
  }
  return normalizedPlate;
}

/**
 * Valida e higieniza todos os campos exigidos pelos requisitos da disciplina.
 */
export function validateVehiclePayload(raw) {
  const errors = {};
  const maxYear = new Date().getFullYear() + 1;

  const marca = String(raw.marca ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const modelo = String(raw.modelo ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const cor = String(raw.cor ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const placa = normalizePlate(raw.placa);

  const rawYear = String(raw.anoFabricacao ?? "").trim();
  const anoFabricacao = rawYear === "" ? NaN : Number(rawYear);

  const rawKm = String(raw.kmRodada ?? "").trim();
  const kmRodada = rawKm === "" ? NaN : Number(rawKm);

  if (marca.length < 2 || marca.length > 50) {
    errors.marca = "Informe a marca (entre 2 e 50 caracteres).";
  }

  if (modelo.length < 1 || modelo.length > 60) {
    errors.modelo = "Informe o modelo do automóvel.";
  }

  if (cor.length < 3 || cor.length > 30) {
    errors.cor = "Informe uma cor válida (mín. 3 caracteres).";
  }

  if (!MERCOSUL_PLATE_REGEX.test(placa) && !LEGACY_PLATE_REGEX.test(placa)) {
    errors.placa = "Placa inválida. Use ABC1D23 ou ABC-1234.";
  }

  if (
    !Number.isInteger(anoFabricacao) ||
    anoFabricacao < 1900 ||
    anoFabricacao > maxYear
  ) {
    errors.anoFabricacao = `Ano deve estar entre 1900 e ${maxYear}.`;
  }

  if (
    !Number.isFinite(kmRodada) ||
    kmRodada < 0 ||
    kmRodada > 9999999 ||
    !Number.isInteger(kmRodada)
  ) {
    errors.kmRodada = "Informe uma Km inteira igual ou maior que 0.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: {
      marca,
      modelo,
      cor,
      placa,
      anoFabricacao,
      kmRodada,
    },
  };
}
