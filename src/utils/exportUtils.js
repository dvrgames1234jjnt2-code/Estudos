/**
 * Utility for exporting flashcards to TSV (Tab-Separated Values) format.
 * This is better than CSV for flashcards because questions/answers 
 * often contain commas but rarely contain tabs.
 */

export function downloadFlashcardsAsTSV(cards) {
  if (!cards || cards.length === 0) {
    alert("Nenhum cartão disponível para exportar.");
    return;
  }

  // Header definition
  const headers = [
    "Pergunta", "Resposta", "Referencia", "Explicacao", "Feedback", 
    "Status", "Acertos", "Erros", "Proxima_Revisao", "Ultima_Revisao", 
    "Ultimo Feedback", "Deck", "Deck_pai", "Materia", "Topico", "Assunto"
  ];

  // Helper to escape or clean strings (remove tabs and normalize line breaks)
  const clean = (val) => {
    if (val === undefined || val === null) return "";
    return String(val)
      .replace(/\t/g, " ") // Replace tabs with spaces
      .replace(/\n/g, "\\n") // Preserve newlines by escaping them
      .trim();
  };

  // Build the rows
  const rows = cards.map(c => [
    clean(c.pergunta),
    clean(c.resposta),
    clean(c.referencia),
    clean(c.explicacao),
    clean(c.feedback),
    clean(c.status),
    clean(c.acertos),
    clean(c.erros),
    clean(c.proximaRevisao),
    clean(c.ultimaRevisao),
    clean(c.ultimoFeedback),
    "", // Deck (Manual)
    "", // Deck_pai (Manual)
    "", // Materia (Manual)
    "", // Topico (Manual)
    ""  // Assunto (Manual)
  ].join("\t"));

  // Create the final string
  const tsvContent = [headers.join("\t"), ...rows].join("\n");

  // Trigger download
  const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute("href", url);
  link.setAttribute("download", `mindful_scholar_export_${timestamp}.tsv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
