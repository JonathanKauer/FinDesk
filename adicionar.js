import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase-config";

async function adicionarRegistro(data) {
  try {
    const docRef = await addDoc(collection(db, "financas"), data);
    console.log("Documento adicionado com ID:", docRef.id);
  } catch (e) {
    console.error("Erro ao adicionar documento:", e);
  }
}

// Exemplo de dados a serem inseridos
const dadosExemplo = {
  nome: "Conta Corrente",
  saldo: 1000,
  data: new Date()
};

// Chama a função para adicionar os dados
adicionarRegistro(dadosExemplo);
