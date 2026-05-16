import JSZip from 'jszip';
import initSqlJs from 'sql.js/dist/sql-asm.js';

export async function processAnkiFile(file) {
  console.log("[AnkiImport] Analisando pacote...");
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  
  const fileNames = Object.keys(content.files);
  console.log("[AnkiImport] Arquivos no ZIP:", fileNames);

  // Vamos procurar o arquivo que tem o maior tamanho real, independente do nome
  let targetDbName = null;
  let maxDataSize = -1;

  fileNames.forEach(name => {
    if (name.includes("collection.anki")) {
      const fileData = content.files[name];
      // O tamanho descompactado nos dirá qual é o banco real
      const size = fileData._data.uncompressedSize || 0;
      console.log(`[AnkiImport] Candidato: ${name} (${(size/1024).toFixed(1)} KB)`);
      
      if (size > maxDataSize) {
        maxDataSize = size;
        targetDbName = name;
      }
    }
  });

  console.log(`[AnkiImport] VENCEDOR: ${targetDbName}`);

  const dbFile = content.file(targetDbName);
  const dbArrayBuffer = await dbFile.async("arraybuffer");
  const SQL = await initSqlJs();
  
  let db;
  try {
    db = new SQL.Database(new Uint8Array(dbArrayBuffer));
  } catch (err) {
    console.error("[AnkiImport] Erro Crítico:", err);
    if (targetDbName.endsWith('b')) {
      throw new Error("O Anki exportou em formato compactado (Zstd). Por favor, exporte novamente e certifique-se de marcar 'Support older Anki versions' no menu de exportação.");
    }
    throw err;
  }
  
  let cards = [];
  try {
    const colRes = db.exec("SELECT decks FROM col");
    const decksMap = JSON.parse(colRes[0].values[0][0]);
    
    const res = db.exec(`
      SELECT n.flds, c.did, n.id 
      FROM cards c 
      JOIN notes n ON c.nid = n.id
    `);

    if (res && res.length > 0) {
      cards = res[0].values.map(row => {
        const flds = row[0] || "";
        const did = row[1];
        const nid = row[2];
        const parts = flds.split('\x1f');
        const fullDeckName = decksMap[did]?.name || "Deck Importado";
        
        // Novo mapeamento inteligente:
        // Se tem 4+ campos: 0=Materia, 1=Topico, 2=Pergunta, 3=Resposta
        // Se tem 2-3 campos: 0=Pergunta, 1=Resposta, 2=Explicação
        let pergunta, resposta, materia, topico, explicacao;

        if (parts.length >= 4) {
          materia = parts[0].replace(/<\/?[^>]+(>|$)/g, "").trim(); // Remove HTML da matéria
          topico = parts[1].replace(/<\/?[^>]+(>|$)/g, "").trim();  // Remove HTML do tópico
          pergunta = parts[2] || "Sem pergunta";
          resposta = parts[3] || "Sem resposta";
          explicacao = parts.slice(4).join('<br><br>') || "";
        } else {
          materia = fullDeckName;
          topico = "";
          pergunta = parts[0] || "Sem pergunta";
          resposta = parts[1] || parts[0] || "Sem resposta";
          explicacao = parts.slice(2).join('<br><br>') || "";
        }
        
        return {
          pergunta,
          resposta,
          explicacao,
          materia,
          topico,
          anki_nid: nid,
          deck_name: fullDeckName,
          status: "Novo",
          feedback: "novo"
        };
      });
    }
  } catch (err) {
    console.error("[AnkiImport] Erro SQL:", err);
  }

  db.close();
  console.log(`[AnkiImport] SUCESSO! ${cards.length} cartões extraídos.`);
  return cards;
}
