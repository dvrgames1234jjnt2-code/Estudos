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
        "Assunto": "assunto",
        "Tipo": "tipo",
        "Categoria": "categoria"
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
        tipo: parts[4] || "",
        categoria: parts[5] || "",
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
