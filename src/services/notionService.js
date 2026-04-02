/**
 * Serviço de Integração com o Notion
 * Responsável por conectar a interface de estudo (Flashcards) ao banco real do Notion.
 * 
 * Requisitos:
 * 1. O servidor de dev (Vite) deve estar rodando com o proxy configurado (/notion-api).
 * 2. O token de integração (Internal Integration Secret) deve estar no arquivo .env como VITE_NOTION_TOKEN
 */

const NOTION_DATABASE_ID = '332885d5-a0e3-8083-bacb-d7298cedf9fb';

// Retorna os headers padrão necessários para a API do Notion
function getHeaders() {
  const token = import.meta.env.VITE_NOTION_TOKEN;
  if (!token) {
    console.error("VITE_NOTION_TOKEN não encontrado no .env!");
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };
}

// -----------------------------------------------------
// 1. EXTRACTORS (Helpers para ler os dados do Notion de forma segura)
// -----------------------------------------------------

const extractText = (property) => {
  if (!property) return '';
  // Title ou Rich Text
  const arr = property.title || property.rich_text || [];
  return arr.map(t => t.plain_text).join('');
};

const extractSelect = (property) => {
  if (!property || !property.select) return null;
  return property.select.name;
};

const extractNumber = (property) => {
  if (!property || property.number == null) return 0;
  return property.number;
};

const extractDate = (property) => {
  if (!property || !property.date || !property.date.start) return null;
  return property.date.start;
};

const extractUrl = (property) => {
  if (!property || property.url == null) return '';
  return property.url;
};

// Converte a linha inteira (page) que vem do Notion para um objeto limpo JS
export function parseNotionCard(page) {
  const props = page.properties;
  
  return {
    id: page.id,
    
    // Textos
    pergunta: extractText(props['Pergunta']),
    resposta: extractText(props['Resposta']),
    referencia: extractUrl(props['Referencia']),
    explicacao: extractText(props['Explicacao']),
    
    // Categorias / Rich Text / Selects
    deck: extractText(props['Deck']),          // rich_text
    deckPai: extractText(props['Deck_pai']),      // rich_text
    feedback: extractText(props['Feedback']),  // rich_text
    ultimoFeedback: extractText(props['Ultimo Feedback']), // rich_text
    status: extractSelect(props['Status']),    // select
    materia: extractText(props['Materia']),    // rich_text
    topico: extractText(props['Topico']),      // rich_text
    assunto: extractText(props['Assunto']),    // rich_text
    subAssunto: extractText(props['Sub_Assunto']), // rich_text
    
    // Números
    acertos: extractNumber(props['Acertos']),
    erros: extractNumber(props['Erros']),
    
    // Datas no Notion do usuário (confirmadas como Date Type via Schema)
    proximaRevisao: extractDate(props['Proxima_Revisao']),
    ultimaRevisao: extractDate(props['Ultima_Revisao']),
    
    // Novos campos solicitados
    tipo: extractSelect(props['Tipo']),
    categoria: extractSelect(props['Categoria']),
  };
}


// -----------------------------------------------------
// 2. FUNÇÕES DA API (CRUD)
// -----------------------------------------------------

/**
 * Busca todos os flashcards do Notion usando filtro e paginação rudimentar
 * O proxy do Vite vai interceptar '/notion-api' e jogar pra 'https://api.notion.com'
 */
export async function fetchCardsFromNotion() {
  try {
    const response = await fetch(`/api/notion/databases/${NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        // Adicione page_size ou filters aqui se a base for muito grande
        // filter: { property: "Status", select: { does_not_equal: "Arquivado" } }
      })
    });

    if (!response.ok) {
      throw new Error(`Erro buscando cartões: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return data.results.map(parseNotionCard);
  } catch (error) {
    console.error("Erro no fetchCardsFromNotion:", error);
    throw error;
  }
}


/**
 * Atualiza um único cartão após uma revisão (Feedback do SRS).
 * @param {string} pageId - ID original do Notion block/page do cartão
 * @param {object} updates - Objeto JS com os campos que se deseja atualizar
 */
export async function updateCardInNotion(pageId, updates) {
  const properties = {};

  // Mapeamento dinâmico reverso JS -> Payload Notion (Datas confirmadas como Date Type)
  if (updates.proximaRevisao !== undefined) {
    properties['Proxima_Revisao'] = { date: updates.proximaRevisao ? { start: updates.proximaRevisao.split('T')[0] } : null };
  }
  if (updates.ultimaRevisao !== undefined) {
    properties['Ultima_Revisao'] = { date: updates.ultimaRevisao ? { start: updates.ultimaRevisao.split('T')[0] } : null };
  }
  if (updates.acertos !== undefined) {
    properties['Acertos'] = { number: updates.acertos };
  }
  if (updates.erros !== undefined) {
    properties['Erros'] = { number: updates.erros };
  }
  if (updates.feedback !== undefined) {
    // Feedback is a rich_text field
    properties['Feedback'] = { rich_text: updates.feedback ? [{ text: { content: String(updates.feedback) } }] : [] };
  }
  if (updates.ultimoFeedback !== undefined) {
    // Ultimo Feedback is a rich_text field
    properties['Ultimo Feedback'] = { rich_text: updates.ultimoFeedback ? [{ text: { content: String(updates.ultimoFeedback) } }] : [] };
  }
  if (updates.status !== undefined) {
    properties['Status'] = { select: updates.status ? { name: String(updates.status) } : null };
  }

  // Support categories in update too (useful for bulk topic re-categorization)
  if (updates.deck !== undefined) properties['Deck'] = { rich_text: [{ text: { content: String(updates.deck) } }] };
  if (updates.deckPai !== undefined) properties['Deck_pai'] = { rich_text: [{ text: { content: String(updates.deckPai) } }] };
  if (updates.materia !== undefined) properties['Materia'] = { rich_text: [{ text: { content: String(updates.materia) } }] };
  if (updates.topico !== undefined) properties['Topico'] = { rich_text: [{ text: { content: String(updates.topico) } }] };
  if (updates.assunto !== undefined) properties['Assunto'] = { rich_text: [{ text: { content: String(updates.assunto) } }] };
  if (updates.subAssunto !== undefined) properties['Sub_Assunto'] = { rich_text: [{ text: { content: String(updates.subAssunto) } }] };
  if (updates.tipo !== undefined) properties['Tipo'] = { select: updates.tipo ? { name: String(updates.tipo) } : null };
  if (updates.categoria !== undefined) properties['Categoria'] = { select: updates.categoria ? { name: String(updates.categoria) } : null };

  // Se nenhum campo pra atualizar foi passado
  if (Object.keys(properties).length === 0) return true;

  try {
    const response = await fetch(`/api/notion/pages/${pageId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ properties })
    });

    if (!response.ok) throw new Error(`Erro ao atualizar: ${response.status}`);
    
    return await response.json(); // retorna o card atualizado
  } catch (error) {
    console.error("Erro no updateCardInNotion:", error);
    return false;
  }
}

/**
 * Cria um novo cartão no Notion.
 * @param {object} card - Objeto JS com as propriedades do cartão.
 */
export async function createCardInNotion(card) {
  const properties = {
    'Pergunta': { title: [{ text: { content: String(card.pergunta || "") } }] },
    'Resposta': { rich_text: [{ text: { content: String(card.resposta || "") } }] },
    'Referencia': { url: card.referencia ? (card.referencia.startsWith('http') ? card.referencia : null) : null },
    'Explicacao': { rich_text: [{ text: { content: String(card.explicacao || "") } }] },
    'Feedback': { rich_text: [{ text: { content: String(card.feedback || "") } }] },
    'Ultimo Feedback': { rich_text: [{ text: { content: String(card.ultimoFeedback || "") } }] },
    'Status': { select: card.status ? { name: String(card.status) } : { name: "Novo" } },
    'Acertos': { number: Number(card.acertos || 0) },
    'Erros': { number: Number(card.erros || 0) },
    'Deck': { rich_text: [{ text: { content: String(card.deck || "") } }] },
    'Deck_pai': { rich_text: [{ text: { content: String(card.deckPai || "") } }] },
    'Materia': { rich_text: [{ text: { content: String(card.materia || "") } }] },
    'Topico': { rich_text: [{ text: { content: String(card.topico || "") } }] },
    'Assunto': { rich_text: [{ text: { content: String(card.assunto || "") } }] },
    'Sub_Assunto': { rich_text: [{ text: { content: String(card.subAssunto || "") } }] },
    'Tipo': { select: card.tipo ? { name: String(card.tipo) } : null },
    'Categoria': { select: card.categoria ? { name: String(card.categoria) } : null }
  };

  // Datas (Apenas se existirem)
  if (card.proximaRevisao) properties['Proxima_Revisao'] = { date: { start: card.proximaRevisao.split('T')[0] } };
  if (card.ultimaRevisao) properties['Ultima_Revisao'] = { date: { start: card.ultimaRevisao.split('T')[0] } };

  try {
    const response = await fetch(`/api/notion/pages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao criar: ${response.status} - ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Erro no createCardInNotion:", error);
    return false;
  }
}
