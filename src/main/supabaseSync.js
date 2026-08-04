const { createClient } = require('@supabase/supabase-js');

// Disable SSL verification for corporate proxy
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const supabaseUrl = 'https://acwjoujhommwwmabtlbe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd2pvdWpob21td3dtYWJ0bGJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MzM3MTksImV4cCI6MjEwMTQwOTcxOX0.cBVKexLMOTXgVbaYltusQgeAkweBg01vDxlYC9OW_jQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncTransactionsToSupabase(transactions, accountName) {
  const toSync = transactions.map(t => ({
    external_id: t.identifier || `${t.date}-${t.chargedAmount}-${t.description}`,
    date: t.date,
    amount: t.chargedAmount,
    description: t.description,
    original_category: t.category,
    merchant: t.memo,
    card_number: t.accountNumber ? t.accountNumber.slice(-4) : null,
    card_holder_name: t.cardHolderName || null,
    purchase_time: t.purchaseTime || null,
    max_label: t.maxLabel || null,
    account_name: accountName
  }));

  const { error } = await supabase
    .from('transactions')
    .upsert(toSync, { onConflict: 'external_id' });

  if (error) {
    console.error('Supabase sync error:', error);
    throw error;
  }

  console.log(`Synced ${toSync.length} transactions to Supabase`);
  return toSync.length;
}

async function syncAllFromDatabase(db) {
  const transactions = db.queryAll(`
    SELECT t.*, a.name as account_name
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
  `);

  const toSync = transactions.map(t => ({
    external_id: t.external_id,
    date: t.date,
    amount: t.amount,
    description: t.description,
    original_category: t.original_category,
    merchant: t.merchant,
    card_number: t.card_number,
    card_holder_name: t.card_holder_name,
    purchase_time: t.purchase_time,
    max_label: t.max_label,
    tag_id: t.tag_id,
    account_name: t.account_name
  }));

  if (toSync.length === 0) {
    console.log('No transactions to sync');
    return 0;
  }

  const { error } = await supabase
    .from('transactions')
    .upsert(toSync, { onConflict: 'external_id' });

  if (error) {
    console.error('Supabase sync error:', error);
    throw error;
  }

  console.log(`Synced ${toSync.length} transactions to Supabase`);
  return toSync.length;
}

module.exports = { syncTransactionsToSupabase, syncAllFromDatabase, supabase };
