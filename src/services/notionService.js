/**
 * Serviço de Integração com o Notion
 * Responsável por conectar a interface de estudo (Flashcards) ao banco real do Notion.
 * 
 * Requisitos:
 * 1. O servidor de dev (Vite) deve estar rodando com o proxy configurado (/notion-api).
 * 2. O token de integração (Internal Integration Secret) deve estar no arquivo .env como VITE_NOTION_TOKEN
 */

const NOTION_DATABASE_ID = '332885d5-a0e3-8083-bacb-d7298cedf9fb';
const CONFIG_DATABASE_ID = '332885d5-a0e3-809f-a459-ea05d36a3c5e';

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

/**
 * Universal extractor for string-convertible properties.
 * Handles: Select, Multi-Select (first item), Formula, Rich Text, Title.
 */
const extractFlexible = (property) => {
  if (!property) return '';
  
  // 1. Select
  if (property.select) return property.select.name || '';
  
  // 2. Multi-Select (take first)
  if (property.multi_select && property.multi_select.length > 0) {
    return property.multi_select[0].name || '';
  }
  
  // 3. Formula
  if (property.formula) {
    return String(property.formula.string || property.formula.number || '');
  }

  // 4. Rich Text or Title
  const textArr = property.rich_text || property.title || [];
  if (textArr.length > 0) {
    return textArr.map(t => t.plain_text).join('');
  }

  return '';
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
    
    // Categorias / Rich Text / Selects (Flexible Extraction)
    deck: extractFlexible(props['Deck']),
    deckPai: extractFlexible(props['Deck_pai']),
    feedback: extractFlexible(props['Feedback']),
    ultimoFeedback: extractFlexible(props['Ultimo Feedback']),
    // Schema confirms 'Status' is rich_text in some databases, so extractFlexible is safer
    status: extractFlexible(props['Status']), 
    materia: extractFlexible(props['Materia']),
    topico: extractFlexible(props['Topico']),
    assunto: extractFlexible(props['Assunto']),
    subAssunto: extractFlexible(props['Sub_Assunto']),
    
    // Números
    acertos: extractNumber(props['Acertos']),
    erros: extractNumber(props['Erros']),
    
    // Datas no Notion do usuário (confirmadas como Date Type via Schema)
    proximaRevisao: extractDate(props['Proxima_Revisao']),
    ultimaRevisao: extractDate(props['Ultima_Revisao']),
    
    // Novos campos solicitados (Flexible Extraction)
    tipo: extractFlexible(props['Tipo']),
    categoria: extractFlexible(props['Categoria']),
    
    // Novo: Tempo da sessao 
    score: extractNumber(props['Score']) || 0,
  };
}


// -----------------------------------------------------
// 2. FUNÇÕES DA API (CRUD)
// -----------------------------------------------------

/**
 * Busca todos os flashcards do Notion usando paginação completa.
 */
export async function fetchCardsFromNotion() {
  try {
    let allResults = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const response = await fetch(`/api/notion/databases/${NOTION_DATABASE_ID}/query`, {
        method: 'POST',
        headers: getHeaders(),
        cache: 'no-store',
        body: JSON.stringify({
          start_cursor: startCursor,
          sorts: [
            { timestamp: "last_edited_time", direction: "descending" }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Erro buscando cartões: ${response.status} ${await response.text()}`);
      }

      const data = await response.json();
      allResults = [...allResults, ...data.results];
      hasMore = data.has_more;
      startCursor = data.next_cursor;
    }

    return allResults.map(parseNotionCard);
  } catch (error) {
    console.error("Erro no fetchCardsFromNotion:", error);
    throw error;
  }
}


// Paleta de cores por nome de nível SRS
const NIVEL_COLORS = {
  'Esqueci':    '#ef4444',
  'Errei':      '#f97316',
  'Pensei':     '#eab308',
  'Rápido':     '#22c55e',
  'Automático': '#6366f1',
};
const DEFAULT_NIVEL_COLOR = '#64748b';

/**
 * Busca todas as configurações de níveis, com paginação.
 */
export async function fetchConfigFromNotion() {
  try {
    let allResults = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const response = await fetch(`/api/notion/databases/${CONFIG_DATABASE_ID}/query`, {
        method: 'POST',
        headers: getHeaders(),
        cache: 'no-store',
        body: JSON.stringify({
          start_cursor: startCursor
        })
      });

      if (!response.ok) {
        throw new Error(`Erro buscando configs: ${response.status} ${await response.text()}`);
      }

      const data = await response.json();
      allResults = [...allResults, ...data.results];
      hasMore = data.has_more;
      startCursor = data.next_cursor;
    }

    return allResults.map(page => {
      const p = page.properties;
      const nivel = extractText(p['Nivel']);
      
      // Schema observation: Carga, Limite e Quantidade are rich_text in Notion.
      return {
        id:   nivel,
        name: nivel,
        color: NIVEL_COLORS[nivel] || DEFAULT_NIVEL_COLOR,
        nivel,
        notionId: page.id,
        descricao: extractText(p['Descrição']),
        carga: Number(extractText(p['Carga'])) || 0,
        fatorDias: extractNumber(p['Fato de dias']),
        qtdDeCards: Number(extractText(p['Quantidade de cards'])) || 0,
        limiteDeCard: Number(extractText(p['Limite de card'])) || 1,
        tempoDaSessao: extractNumber(p['Tempo da sessao']) || 0,
      };
    });
  } catch (error) {
    console.error("Erro no fetchConfigFromNotion:", error);
    throw error;
  }
}

/**
 * Atualiza um único cartão após uma revisão (Feedback do SRS).
 */
export async function updateCardInNotion(pageId, updates) {
  const properties = {};

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
    properties['Feedback'] = { rich_text: updates.feedback ? [{ text: { content: String(updates.feedback) } }] : [] };
  }
  if (updates.ultimoFeedback !== undefined) {
    properties['Ultimo Feedback'] = { rich_text: updates.ultimoFeedback ? [{ text: { content: String(updates.ultimoFeedback) } }] : [] };
  }
  
  // Update 'Status' as rich_text if that's what's in the DB
  if (updates.status !== undefined) {
    properties['Status'] = { rich_text: [{ text: { content: String(updates.status) } }] };
  }

  // Support categories in update
  if (updates.deck !== undefined) properties['Deck'] = { rich_text: [{ text: { content: String(updates.deck) } }] };
  if (updates.deckPai !== undefined) properties['Deck_pai'] = { rich_text: [{ text: { content: String(updates.deckPai) } }] };
  if (updates.materia !== undefined) properties['Materia'] = { rich_text: [{ text: { content: String(updates.materia) } }] };
  if (updates.topico !== undefined) properties['Topico'] = { rich_text: [{ text: { content: String(updates.topico) } }] };
  if (updates.assunto !== undefined) properties['Assunto'] = { rich_text: [{ text: { content: String(updates.assunto) } }] };
  if (updates.subAssunto !== undefined) properties['Sub_Assunto'] = { rich_text: [{ text: { content: String(updates.subAssunto) } }] };
  if (updates.tipo !== undefined) properties['Tipo'] = { rich_text: [{ text: { content: String(updates.tipo) } }] };
  if (updates.categoria !== undefined) properties['Categoria'] = { rich_text: [{ text: { content: String(updates.categoria) } }] };

  if (updates.score !== undefined) {
    properties['Score'] = { number: Number(updates.score) };
  }

  if (Object.keys(properties).length === 0) return true;

  try {
    const response = await fetch(`/api/notion/pages/${pageId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ properties })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Notion Update Error:", errorText, properties);
      throw new Error(`Erro ao atualizar: ${response.status} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Erro no updateCardInNotion:", error);
    return false;
  }
}

/**
 * Cria um novo cartão no Notion.
 */
export async function createCardInNotion(card) {
  const properties = {
    'Pergunta': { title: [{ text: { content: String(card.pergunta || "") } }] },
    'Resposta': { rich_text: [{ text: { content: String(card.resposta || "") } }] },
    'Referencia': { url: card.referencia ? (card.referencia.startsWith('http') ? card.referencia : null) : null },
    'Explicacao': { rich_text: [{ text: { content: String(card.explicacao || "") } }] },
    'Feedback': { rich_text: [{ text: { content: String(card.feedback || "") } }] },
    'Ultimo Feedback': { rich_text: [{ text: { content: String(card.ultimoFeedback || "") } }] },
    'Status': { rich_text: [{ text: { content: String(card.status || "Novo") } }] },
    'Acertos': { number: Number(card.acertos || 0) },
    'Erros': { number: Number(card.erros || 0) },
    'Deck': { rich_text: [{ text: { content: String(card.deck || "") } }] },
    'Deck_pai': { rich_text: [{ text: { content: String(card.deckPai || "") } }] },
    'Materia': { rich_text: [{ text: { content: String(card.materia || "") } }] },
    'Topico': { rich_text: [{ text: { content: String(card.topico || "") } }] },
    'Assunto': { rich_text: [{ text: { content: String(card.assunto || "") } }] },
    'Sub_Assunto': { rich_text: [{ text: { content: String(card.subAssunto || "") } }] },
    'Tipo': { rich_text: [{ text: { content: String(card.tipo || "") } }] },
    'Categoria': { rich_text: [{ text: { content: String(card.categoria || "") } }] }
  };

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
