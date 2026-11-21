import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const COLLECTION_NAME = "automoveis";

/**
 * Inscreve um listener em tempo real na coleção "automoveis".
 * A ordenação principal é feita em memória para garantir que documentos criados
 * manualmente pelo console do Firebase (sem timestamp) também apareçam na listagem.
 */
export function subscribeToVehicles(onData, onError) {
  const colRef = collection(db, COLLECTION_NAME);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          marca: String(data.marca ?? ""),
          modelo: String(data.modelo ?? ""),
          cor: String(data.cor ?? ""),
          placa: String(data.placa ?? ""),
          anoFabricacao: Number(data.anoFabricacao ?? 0),
          kmRodada: Number(data.kmRodada ?? 0),
          criadoEmMs: data.criadoEm?.toMillis ? data.criadoEm.toMillis() : 0,
        };
      });

      onData(items);
    },
    (error) => {
      if (onError) onError(error);
    },
  );
}

/**
 * Verifica se já existe outro automóvel persistido com a mesma placa.
 */
async function ensureUniquePlate(placa, ignoreDocId = null) {
  const q = query(collection(db, COLLECTION_NAME), where("placa", "==", placa));
  const snap = await getDocs(q);

  const conflict = snap.docs.some((docItem) => docItem.id !== ignoreDocId);
  if (conflict) {
    throw new Error(`Já existe um automóvel cadastrado com a placa ${placa}.`);
  }
}

/**
 * Cadastra um novo automóvel no Cloud Firestore.
 */
export async function createVehicle(vehicleData) {
  await ensureUniquePlate(vehicleData.placa);

  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    marca: vehicleData.marca,
    modelo: vehicleData.modelo,
    cor: vehicleData.cor,
    placa: vehicleData.placa,
    anoFabricacao: vehicleData.anoFabricacao,
    kmRodada: vehicleData.kmRodada,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Atualiza os dados de um automóvel existente no Cloud Firestore.
 */
export async function updateVehicle(id, vehicleData) {
  await ensureUniquePlate(vehicleData.placa, id);

  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    marca: vehicleData.marca,
    modelo: vehicleData.modelo,
    cor: vehicleData.cor,
    placa: vehicleData.placa,
    anoFabricacao: vehicleData.anoFabricacao,
    kmRodada: vehicleData.kmRodada,
    atualizadoEm: serverTimestamp(),
  });
}

/**
 * Remove um automóvel do Cloud Firestore.
 */
export async function deleteVehicle(id) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}
