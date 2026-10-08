import { supabase } from '../../supabaseClient';
import { route, requireRole, unwrap, respond, getMe } from '../core';

// ==============================
// GET /quizzes - Get all quizzes (for Teacher dashboard)
// ==============================
route('GET', '/quizzes', async () => {
  const data = unwrap(await supabase
    .from('quiz')
    .select(`
      *,
      lesson:lessonid(title, subject:subjectid(subjectname)),
      subject:subjectid(subjectname),
      questions:question(
        questionid, quizid, questiontext, hint1, hint2,
        options:option(optionid, questionid, option, iscorrect)
      )
    `)
    .order('quizid', { ascending: false })
  );
  
  return data.map(q => ({
    ...q,
    lessontitle: q.lesson?.title,
    subjectname: q.subject?.subjectname || q.lesson?.subject?.subjectname,
    lesson: undefined,
    subject: undefined,
    questions: (q.questions || []).map(qu => ({
      ...qu,
      options: qu.options || []
    })).sort((a,b) => a.questionid - b.questionid)
  }));
});

// ==============================
// GET /quizzes/lesson/:lessonId — Get quizzes for a lesson
// ==============================
route('GET', '/quizzes/lesson/:lessonId', async ({ params }) => {
  return unwrap(await supabase.from('quiz').select('*').eq('lessonid', params.lessonId));
});

// ==============================
// GET /quizzes/:id — Get quiz with questions & options
// ==============================
route('GET', '/quizzes/:id', async ({ params }) => {
  const data = unwrap(await supabase
    .from('quiz')
    .select(`
      *,
      questions:question(
        *,
        options:option(*)
      )
    `)
    .eq('quizid', params.id)
    .maybeSingle(), 'Quiz not found.');
    
  data.questions = (data.questions || []).sort((a, b) => a.questionid - b.questionid);
  data.questions.forEach(q => q.options = (q.options || []));
  
  return data;
});

// ==============================
// POST /quizzes — Create quiz (Admin/Teacher)
// ==============================
route('POST', '/quizzes', async ({ body }) => {
  await requireRole('Admin', 'Teacher');
  const { lessonId, title, xpReward, subjectId, grade, ispublished } = body;
  if (!title) return respond({ error: 'Title is required.' }, 400);

  const data = unwrap(await supabase
    .from('quiz')
    .insert({
      lessonid: lessonId || null,
      title,
      xpreward: xpReward || 0,
      subjectid: subjectId || null,
      grade: grade || null,
      ispublished: ispublished !== undefined ? ispublished : true
    })
    .select('*')
    .single()
  );
  return respond(data, 201);
});

// ==============================
// POST /quizzes/:id/questions — Add question with options (Admin/Teacher)
// ==============================
route('POST', '/quizzes/:id/questions', async ({ params, body }) => {
  await requireRole('Admin', 'Teacher');
  const { questionText, hint1, hint2, options } = body;
  if (!questionText || !options || options.length === 0) return respond({ error: 'Question text and options are required.' }, 400);

  const question = unwrap(await supabase
    .from('question')
    .insert({
      quizid: params.id,
      questiontext: questionText,
      hint1: hint1 || null,
      hint2: hint2 || null
    })
    .select('*')
    .single()
  );

  const optionsToInsert = options.map(opt => ({
    questionid: question.questionid,
    option: opt.option,
    iscorrect: opt.isCorrect || false
  }));

  const insertedOptions = unwrap(await supabase
    .from('option')
    .insert(optionsToInsert)
    .select('*')
  );

  return respond({ ...question, options: insertedOptions }, 201);
});

// ==============================
// POST /quizzes/:id/submit — Submit quiz attempt
// ==============================
route('POST', '/quizzes/:id/submit', async ({ params, body }) => {
  const { score } = body;
  const data = unwrap(await supabase.rpc('submit_quiz_score', {
    p_quizid: parseInt(params.id),
    p_score: score
  }));
  return respond(data, 201);
});

// ==============================
// GET /quizzes/:id/records — Get quiz attempt history
// ==============================
route('GET', '/quizzes/:id/records', async ({ params }) => {
  const me = await getMe();
  return unwrap(await supabase
    .from('quizrecords')
    .select('*')
    .eq('quizid', params.id)
    .eq('uid', me.uid)
    .order('completedat', { ascending: false })
  );
});

// ==============================
// DELETE /quizzes/:id - Delete quiz (Admin/Teacher)
// ==============================
route('DELETE', '/quizzes/:id', async ({ params }) => {
  await requireRole('Admin', 'Teacher');
  const { error } = await supabase.rpc('delete_quiz_transaction', { p_quizid: parseInt(params.id) });
  if (error) {
    if (error.code === 'P0001') return respond({ error: 'Quiz not found.' }, 404);
    throw error;
  }
  await supabase.rpc('log_audit', { action: 'DELETE_QUIZ', target_type: 'QUIZ', target_id: params.id, details: `Quiz ${params.id} deleted` }).catch(() => {});
  return { message: 'Quiz deleted.' };
});

// ==============================
// PUT /quizzes/:id - Update quiz (Admin/Teacher)
// ==============================
route('PUT', '/quizzes/:id', async ({ params, body }) => {
  await requireRole('Admin', 'Teacher');
  const { title, xpreward, ispublished, xpReward, subjectId, grade, lessonId, questions } = body;
  
  const data = unwrap(await supabase.rpc('update_quiz_transaction', {
    p_quizid: parseInt(params.id),
    p_title: title,
    p_xpreward: xpreward !== undefined ? xpreward : (xpReward !== undefined ? xpReward : null),
    p_ispublished: ispublished,
    p_subjectid: subjectId,
    p_grade: grade,
    p_lessonid: lessonId,
    p_questions: questions
  }));
  
  const pubStatus = ispublished !== undefined ? ispublished : null;
  const action = pubStatus !== null ? (pubStatus ? 'PUBLISH_QUIZ' : 'UNPUBLISH_QUIZ') : 'EDIT_QUIZ';
  const details = pubStatus !== null ? `Quiz ${params.id} ${pubStatus ? 'published' : 'unpublished'}` : `Quiz ${params.id} modified`;
  await supabase.rpc('log_audit', { action, target_type: 'QUIZ', target_id: params.id, details }).catch(() => {});
  
  return data;
});
