import { supabase } from '../../supabaseClient';
import { route, requireRole, unwrap, respond } from '../core';

// ==============================
// GET /subjects — List all subjects
// ==============================
route('GET', '/subjects', async () => {
  return unwrap(await supabase.from('subject').select('*').order('subjectid'));
});

// ==============================
// GET /subjects/:id — Get subject by ID
// ==============================
route('GET', '/subjects/:id', async ({ params }) => {
  return unwrap(await supabase.from('subject').select('*').eq('subjectid', params.id).maybeSingle(), 'Subject not found.');
});

// ==============================
// POST /subjects — Create subject (Admin/Teacher)
// ==============================
route('POST', '/subjects', async ({ body }) => {
  await requireRole('Admin', 'Teacher');
  const { subjectName, description } = body;
  if (!subjectName) return respond({ error: 'Subject name is required.' }, 400);

  const data = unwrap(await supabase
    .from('subject')
    .insert({ subjectname: subjectName, description: description || null })
    .select('*')
    .single()
  );
  return respond(data, 201);
});

// ==============================
// PUT /subjects/:id — Update subject (Admin/Teacher)
// ==============================
route('PUT', '/subjects/:id', async ({ params, body }) => {
  await requireRole('Admin', 'Teacher');
  const { subjectName, description } = body;
  const updates = {};
  if (subjectName !== undefined) updates.subjectname = subjectName;
  if (description !== undefined) updates.description = description;

  return unwrap(await supabase
    .from('subject')
    .update(updates)
    .eq('subjectid', params.id)
    .select('*')
    .maybeSingle(), 'Subject not found.');
});

// ==============================
// DELETE /subjects/:id — Delete subject (Admin only)
// ==============================
route('DELETE', '/subjects/:id', async ({ params }) => {
  await requireRole('Admin');
  unwrap(await supabase.from('subject').delete().eq('subjectid', params.id).select('subjectid').maybeSingle(), 'Subject not found.');
  return { message: 'Subject deleted.' };
});

// ==============================
// GET /flashcards/lesson/:lessonId — Get flashcards for a lesson
// ==============================
route('GET', '/flashcards/lesson/:lessonId', async ({ params }) => {
  return unwrap(await supabase.from('flashcard').select('*').eq('lessonid', params.lessonId).order('flashcardid'));
});

// ==============================
// POST /flashcards — Create flashcard (Admin/Teacher)
// ==============================
route('POST', '/flashcards', async ({ body }) => {
  await requireRole('Admin', 'Teacher');
  const { lessonId, content } = body;
  if (!lessonId || !content) return respond({ error: 'Lesson ID and content are required.' }, 400);

  const data = unwrap(await supabase
    .from('flashcard')
    .insert({ lessonid: lessonId, content })
    .select('*')
    .single()
  );
  return respond(data, 201);
});

// ==============================
// DELETE /flashcards/:id — Delete flashcard (Admin/Teacher)
// ==============================
route('DELETE', '/flashcards/:id', async ({ params }) => {
  await requireRole('Admin', 'Teacher');
  unwrap(await supabase.from('flashcard').delete().eq('flashcardid', params.id).select('flashcardid').maybeSingle(), 'Flashcard not found.');
  return { message: 'Flashcard deleted.' };
});

// ==============================
// POST /ai/chat — AI Chat
// ==============================
route('POST', '/ai/chat', async ({ body }) => {
  const { data, error } = await supabase.functions.invoke('ai-chat', { body });
  
  if (error) {
    if (error.message.includes('Relay Error') || error.message.includes('not found') || error.message.includes('FunctionsHttpError')) {
      return respond({ error: 'AI tutor is not deployed yet' }, 503);
    }
    return respond({ error: 'The AI tutor could not answer right now' }, 500);
  }
  
  if (data && data.error) {
    const status = data.error.includes('prompt') ? 400 : (data.error.includes('configured') ? 503 : 500);
    return respond({ error: data.error }, status);
  }
  
  return data;
});
