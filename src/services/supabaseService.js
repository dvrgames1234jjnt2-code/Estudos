import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Inserts multiple cards into Supabase, associating them with a deck.
 * @param {Array} cards - Array of card objects
 * @param {string} deckIdentifier - The title or ID of the deck
 * @param {string} userId - The explicit user ID to ensure FK consistency
 */
export async function insertCardsToSupabase(cards, deckIdentifier = "Importação Anki", userId = null) {
  if (!supabase) return { error: "Supabase não configurado" };

  try {
    let finalUserId = userId?.trim();
    
    if (!finalUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      finalUserId = user?.id;
    }

    if (!finalUserId) {
      throw new Error("Sessão inválida. Por favor, saia (Logout) e entre novamente.");
    }

    // 1. Encontrar ou criar o baralho de forma segura
    let deckId;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deckIdentifier);
    
    if (isUUID) {
      deckId = deckIdentifier;
    } else {
      // Primeiro tentamos buscar se já existe para evitar o 409
      const { data: existingDeck } = await supabase
        .from('decks')
        .select('id')
        .eq('title', deckIdentifier)
        .eq('user_id', finalUserId)
        .maybeSingle();

      if (existingDeck) {
        deckId = existingDeck.id;
      } else {
        // Tenta criar. Usamos insert simples para evitar erros de restrição de upsert do Supabase
        const { data: newDeck, error: createError } = await supabase
          .from('decks')
          .insert({ 
            title: deckIdentifier, 
            user_id: finalUserId,
            description: "Importado do Anki" 
          })
          .select()
          .single();
        
        if (createError) {
          // Se deu conflito (409), significa que alguém criou entre o select e o insert
          if (createError.code === '23505' || createError.status === 409) {
             const { data: retryDeck } = await supabase
              .from('decks')
              .select('id')
              .eq('title', deckIdentifier)
              .eq('user_id', finalUserId)
              .single();
             deckId = retryDeck.id;
          } else {
            throw createError;
          }
        } else {
          deckId = newDeck.id;
        }
      }
    }

    // 2. Mapear e Inserir cartões
    const cardsToInsert = cards.map(c => {
      // Se vier do novo importador, c.materia e c.topico estarão definidos
      const pathParts = [];
      if (c.materia && c.materia !== c.deck_name) pathParts.push(c.materia);
      if (c.topico) pathParts.push(c.topico);
      
      const fullPathTitle = pathParts.join('::');

      return {
        deck_id: deckId,
        user_id: finalUserId,
        front: c.pergunta || "",
        back: c.resposta || "",
        anki_nid: c.anki_nid,
        title: fullPathTitle || c.title || "",
        context: c.assunto || "",
        explanation: c.explicacao || ""
      };
    });

    const { data, error } = await supabase
      .from('cards')
      .insert(cardsToInsert);

    if (error) {
      if (error.code === '23503') {
        throw new Error("Erro de integridade (FK). Sua sessão pode ser de outro projeto. Por favor, faça Logout e Login novamente.");
      }
      throw error;
    }

    return { data, error: null };
  } catch (err) {
    console.error("[SupabaseService] Erro Detalhado:", err);
    return { error: err.message };
  }
}

/**
 * Fetches all cards from Supabase and maps them back to the UI format.
 */
export async function fetchCardsFromSupabase() {
  if (!supabase) return [];
  
  let allData = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('cards')
      .select(`
        *,
        decks (title)
      `)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Erro ao buscar cartões do Supabase:", error);
      return allData; // Return whatever we managed to fetch
    }

    allData = [...allData, ...(data || [])];
    
    if (!data || data.length < pageSize) {
      hasMore = false;
    } else {
      from += pageSize;
    }
  }

  const finalData = allData;
    
  // Map database schema (front/back) to UI schema (pergunta/resposta)
  return (finalData || []).map(c => ({
    id: c.id,
    pergunta: c.front,
    resposta: c.back,
    materia: c.decks?.title || 'Importado',
    topico: c.title || '',
    assunto: c.context || '',
    explicacao: c.explanation || '',
    anki_nid: c.anki_nid,
    // Add other fields expected by the UI
    feedback: c.card_progress?.[0]?.interval > 0 ? 'Revisando' : 'Novo', // Simplistic mapping
    proximaRevisao: c.card_progress?.[0]?.next_review || null,
    source: 'supabase'
  }));
}

/**
 * Updates card progress in Supabase (SRS logic).
 */
export async function updateCardInSupabase(cardId, updates) {
  if (!supabase) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // The user's schema uses a separate card_progress table
    // We'll upsert into card_progress based on card_id and user_id
    const { error } = await supabase
      .from('card_progress')
      .upsert({
        user_id: user.id,
        card_id: cardId,
        next_review: updates.proximaRevisao,
        // Map updates to schema fields
        interval: updates.interval || 0,
        ease_factor: updates.easeFactor || 2.5,
        repetitions: (updates.acertos || 0) + (updates.erros || 0)
      }, { onConflict: 'user_id,card_id' });

    if (error) throw error;
  } catch (err) {
    console.error("Erro ao atualizar progresso no Supabase:", err);
  }
}

export async function deleteAllCards() {
  if (!supabase) return { error: "Supabase not initialized" };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("Erro ao apagar cartões:", err);
    return { error: err.message };
  }
}
