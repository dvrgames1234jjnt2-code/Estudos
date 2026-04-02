import { createCardInNotion } from '../services/notionService';

/**
 * Parses a TSV string into an array of card objects.
 * Assumes the first row is headers.
 */
export function parseTSVToCards(tsvString) {
  const lines = tsvString.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t').map(h => h.trim());
  const cards = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t');
    const card = {};
    
    headers.forEach((header, index) => {
      let val = values[index] || "";
      val = val.replace(/\\n/g, '\n');
      
      const mapping = {
        "Pergunta": "pergunta",
        "Resposta": "resposta",
        "Referencia": "referencia",
        "Explicacao": "explicacao",
        "Feedback": "feedback",
        "Status": "status",
        "Acertos": "acertos",
        "Erros": "erros",
        "Proxima_Revisao": "proximaRevisao",
        "Ultima_Revisao": "ultimaRevisao",
        "Ultimo Feedback": "ultimoFeedback",
        "Deck": "deck",
        "Deck_pai": "deckPai",
        "Materia": "materia",
        "Topico": "topico",
        "Assunto": "assunto"
      };

      const key = mapping[header] || header;
      card[key] = val;
    });

    if (card.pergunta) {
      cards.push(card);
    }
  }

  return cards;
}

/**
 * Parses raw pasted text (semicolon separated) and applies metadata.
 */
export function parsePastedTextToCards(text, meta) {
  const lines = text.trim().split('\n');
  const cards = [];

  for (let line of lines) {
    if (!line.trim()) continue;

    // Pattern: Pergunta ; Resposta ; [Referencia] ; [Explicacao]
    const parts = line.split(';').map(p => p.trim());
    
    if (parts.length >= 2) {
      cards.push({
        pergunta: parts[0],
        resposta: parts[1],
        referencia: parts[2] || "",
        explicacao: parts[3] || "",
        // Metadata from form
        deck: meta.deck || "",
        deckPai: meta.deckPai || "",
        materia: meta.materia || "",
        topico: meta.topico || "",
        assunto: meta.assunto || "",
        // Defaults for new cards
        status: "Novo",
        feedback: "desconhecido",
        acertos: 0,
        erros: 0
      });
    }
  }

  return cards;
}

/**
 * Handles bulk import from raw pasted text.
 */
export async function handleRawTextImport(text, meta, onProgress, onComplete) {
  const cardsToImport = parsePastedTextToCards(text, meta);
  const total = cardsToImport.length;
  let successCount = 0;

  if (total === 0) {
    alert("Nenhum dado válido encontrado. Use o formato: Pergunta ; Resposta");
    onComplete(0, 0);
    return;
  }

  for (let i = 0; i < total; i++) {
    onProgress(i + 1, total);
    const result = await createCardInNotion(cardsToImport[i]);
    if (result) successCount++;
    
    // Safety delay
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  onComplete(successCount, total);
}
