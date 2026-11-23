// D-271 · Dua perbaikan yang dilaporkan user:
//   (1) "gak bisa nyimpan api key kie ai" — check constraint DB hanya izinkan
//       ('groq','gemini','openrouter','custom'), padahal server mendukung Kie AI.
//   (2) "form provider kostum sama form bank suara masih nempel" — panel Pengaturan
//       memakai blok div biasa (bukan .form-field), jadi aturan jarak D-270 tidak kena.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROVIDERS, PROVIDER_INFO } from '../server/provider-keys.js';

const html = readFileSync('public/index.html', 'utf8');
const keysSql = readFileSync('supabase/ai_key_vault_migration.sql', 'utf8');
const groupsSql = readFileSync('supabase/ai_key_vault_groups_migration.sql', 'utf8');
const memberSql = readFileSync('supabase/member_ai_keys.sql', 'utf8');
const schemaSql = readFileSync('supabase/schema.sql', 'utf8');
const kieSql = readFileSync('supabase/ai_provider_kie_constraint_migration.sql', 'utf8');
const allSql = [keysSql, groupsSql, memberSql, schemaSql, kieSql].join('\n');

test('D-271: constraint DB mengizinkan provider kie di semua tabel AI', () => {
  // Tiap file migrasi harus menyebut kie di check constraint provider.
  const files = [
    ['ai_key_vault_migration.sql', keysSql],
    ['ai_key_vault_groups_migration.sql', groupsSql],
    ['member_ai_keys.sql', memberSql],
    ['schema.sql', schemaSql],
  ];
  for (const [name, src] of files) {
    const checks = src.match(/provider in \(([^)]*)\)/g) || [];
    assert.ok(checks.length > 0, `${name} harus punya check constraint provider`);
    for (const c of checks) {
      assert.ok(c.includes("'kie'"), `${name}: check constraint harus mengizinkan 'kie' -> ${c}`);
    }
  }
});

test('D-271: tidak ada lagi check provider yang hanya 3-4 provider lama', () => {
  // Pola lama: ('groq','gemini','openrouter') TANPA kie sama sekali.
  assert.ok(!/provider in \('groq','gemini','openrouter'\)/.test(allSql),
    'constraint lama 3 provider (tanpa kie/custom) harus hilang');
  assert.ok(!/provider in \('gemini','groq','openrouter'\)/.test(allSql),
    'constraint lama ai_conversations harus hilang');
  assert.ok(!/provider in \('groq','gemini','openrouter','custom'\)/.test(allSql),
    'constraint lama tanpa kie harus hilang');
});

test('D-271: migrasi kie mencakup 3 tabel (keys, settings, conversations)', () => {
  assert.ok(kieSql.includes('ai_provider_keys_provider_check'), 'harus ada constraint ai_provider_keys');
  assert.ok(kieSql.includes('ai_provider_settings_provider_check'), 'harus ada constraint ai_provider_settings');
  assert.ok(kieSql.includes('ai_conversations_provider_check'), 'harus ada constraint ai_conversations');
  // Idempoten: drop sebelum add.
  assert.ok((kieSql.match(/drop constraint if exists/g) || []).length >= 3,
    'tiap constraint harus di-drop dulu (idempoten)');
  // Kie AI resmi provider yang didukung server.
  assert.ok(PROVIDERS.includes('kie'), 'server harus mendukung kie');
  assert.ok(PROVIDER_INFO.kie?.keyUrl, 'kie harus punya link ambil API key');
});

test('D-271: panel Provider Kustom & Bank Suara punya jarak antar blok', () => {
  // Aturan jarak panel admin (blok div, bukan .form-field).
  assert.ok(html.includes('#customProvidersPanel > * + *'),
    'panel provider kustom harus beri jarak antar blok');
  assert.ok(html.includes('#bankSuaraPanel > * + *'),
    'panel bank suara harus beri jarak antar blok');
  // Tombol submit di form provider kustom dipisah dari field di atasnya.
  assert.ok(html.includes('#customProvidersPanel .form-grid .form-field.full{'),
    'baris tombol provider kustom harus punya styling sendiri');
  // Area upload bank suara: catatan & tombol upload diberi jarak.
  assert.ok(html.includes('#bankSuaraPanel .bank-upload-foot{'),
    'footer upload bank suara harus punya styling sendiri');
  assert.ok(html.includes('#bankSuaraPanel .bank-upload-drop{'),
    'drop area bank suara harus punya styling sendiri');
});

test('D-271: jarak panel admin tidak merusak jarak di dalam .form-grid', () => {
  // Aturan D-270 untuk .form-grid tetap berlaku (margin 0, jarak dari gap grid).
  assert.ok(html.includes('.form-grid > .form-field + .form-field{margin-top:0}'),
    'margin dobel di dalam form-grid harus tetap dinolkan');
  // .form-grid di panel kustom tetap pakai gap grid.
  const gridRule = html.match(/#customProvidersPanel > \.form-grid\{([^}]*)\}/);
  assert.ok(gridRule, 'aturan .form-grid panel kustom harus ada');
  assert.ok(!/margin-top:\s*0/.test(gridRule[1]), 'jarak .form-grid jangan dinolkan');
});
