import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://acwjoujhommwwmabtlbe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd2pvdWpob21td3dtYWJ0bGJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MzM3MTksImV4cCI6MjEwMTQwOTcxOX0.cBVKexLMOTXgVbaYltusQgeAkweBg01vDxlYC9OW_jQ';

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getTransactions(filters = {}) {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });

  if (filters.startDate) {
    query = query.gte('date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('date', filters.endDate);
  }
  if (filters.search) {
    query = query.ilike('description', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data;
}

export async function getTags() {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

export async function updateTransactionTag(transactionId, tagId) {
  const { error } = await supabase
    .from('transactions')
    .update({ tag_id: tagId })
    .eq('id', transactionId);
  if (error) throw error;
}

export async function bulkUpdateTag(transactionIds, tagId) {
  const { error } = await supabase
    .from('transactions')
    .update({ tag_id: tagId })
    .in('id', transactionIds);
  if (error) throw error;
}
