import { supabase } from '../../supabaseClient';
import { route, requireRole, unwrap, respond, getMe } from '../core';

// ==============================
// GET /quizzes - Get all quizzes (for Teacher/Admin dashboard & Mobile sync)
// ==============================
route('GET', '/quizzes', async () => {
  const data = unwrap(await supabase
    .from('quiz')
    .select(`
      *,
      lesson:lessonid(title, subject:subjectid(subjectname)),
      subject:subjectid(subjectname),
      questions:question(
        questionid, quizid, questiontext, topic, hint1, hint2,
        options:option(optionid, questionid, option, iscorrect, rationale)
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
      options: (qu.options || []).sort((a, b) => a.optionid - b.optionid)
    })).sort((a, b) => a.questionid - b.questionid)
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
      subject:subjectid(subjectname),
      lesson:lessonid(title, subject:subjectid(subjectname)),
      questions:question(
        *,
        options:option(*)
      )
    `)
    .eq('quizid', params.id)
    .maybeSingle(), 'Quiz not found.');
    
  data.subjectname = data.subject?.subjectname || data.lesson?.subject?.subjectname;
  data.lessontitle = data.lesson?.title;
  delete data.subject;
  delete data.lesson;
  data.questions = (data.questions || []).sort((a, b) => a.questionid - b.questionid);
  data.questions.forEach(q => {
    q.options = (q.options || []).sort((a, b) => a.optionid - b.optionid);
  });
  
  return data;
});

// ==============================
// POST /quizzes — Create quiz (Admin/Teacher)
// ==============================
route('POST', '/quizzes', async ({ body }) => {
  await requireRole('Admin', 'Teacher');
  const { lessonId, title, xpReward, subjectId, grade, ispublished, is_placement, isPlacement } = body;
  if (!title) return respond({ error: 'Title is required.' }, 400);

  const data = unwrap(await supabase
    .from('quiz')
    .insert({
      lessonid: lessonId || null,
      title,
      xpreward: xpReward || 0,
      subjectid: subjectId || null,
      grade: grade || null,
      ispublished: ispublished !== undefined ? ispublished : true,
      is_placement: is_placement !== undefined ? !!is_placement : (isPlacement !== undefined ? !!isPlacement : false)
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
  const { questionText, topic, hint1, hint2, options } = body;
  if (!questionText || !options || options.length === 0) return respond({ error: 'Question text and options are required.' }, 400);

  const question = unwrap(await supabase
    .from('question')
    .insert({
      quizid: params.id,
      questiontext: questionText,
      topic: topic || null,
      hint1: hint1 || null,
      hint2: hint2 || null
    })
    .select('*')
    .single()
  );

  const optionsToInsert = options.map(opt => ({
    questionid: question.questionid,
    option: opt.option,
    iscorrect: opt.isCorrect || opt.iscorrect || false,
    rationale: opt.rationale || null
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
  const { title, xpreward, ispublished, xpReward, subjectId, grade, lessonId, questions, is_placement, isPlacement } = body;
  
  const data = unwrap(await supabase.rpc('update_quiz_transaction', {
    p_quizid: parseInt(params.id),
    p_title: title ?? null,
    p_xpreward: xpreward !== undefined ? xpreward : (xpReward !== undefined ? xpReward : null),
    p_ispublished: ispublished ?? null,
    p_subjectid: subjectId ?? null,
    p_grade: grade ?? null,
    p_lessonid: lessonId ?? null,
    p_questions: questions ?? null,
    p_is_placement: is_placement !== undefined ? is_placement : (isPlacement !== undefined ? isPlacement : null)
  }));
  
  const pubStatus = ispublished !== undefined ? ispublished : null;
  const action = pubStatus !== null ? (pubStatus ? 'PUBLISH_QUIZ' : 'UNPUBLISH_QUIZ') : 'EDIT_QUIZ';
  const details = pubStatus !== null ? `Quiz ${params.id} ${pubStatus ? 'published' : 'unpublished'}` : `Quiz ${params.id} modified`;
  await supabase.rpc('log_audit', { action, target_type: 'QUIZ', target_id: params.id, details }).catch(() => {});
  
  return data;
});

// ==============================
// GET /placement-questions — Get all Grade Placement questions
// ==============================
route('GET', '/placement-questions', async () => {
  const quizzes = unwrap(await supabase
    .from('quiz')
    .select(`
      quizid, title, grade, subjectid, ispublished, is_placement, xpreward,
      subject:subjectid(subjectname),
      questions:question(
        questionid, quizid, questiontext, topic, hint1, hint2, createdat,
        options:option(optionid, questionid, option, iscorrect, rationale)
      )
    `)
    .eq('is_placement', true)
    .order('quizid', { ascending: true })
  );

  const flatQuestions = [];
  for (const qz of quizzes || []) {
    const subjectName = qz.subject?.subjectname || 'General';
    const sortedQuestions = (qz.questions || []).sort((a, b) => a.questionid - b.questionid);
    for (const q of sortedQuestions) {
      flatQuestions.push({
        questionid: q.questionid,
        quizid: qz.quizid,
        quizTitle: qz.title,
        subjectid: qz.subjectid,
        subjectname: subjectName,
        grade: qz.grade || 'Grade 12 (Science)',
        questiontext: q.questiontext,
        topic: q.topic || '',
        hint1: q.hint1 || null,
        hint2: q.hint2 || null,
        createdat: q.createdat,
        options: (q.options || []).sort((a, b) => a.optionid - b.optionid)
      });
    }
  }
  return flatQuestions;
});

// ==============================
// POST /placement-questions — Create a Grade Placement question (Admin/Teacher)
// ==============================
route('POST', '/placement-questions', async ({ body }) => {
  await requireRole('Admin', 'Teacher');
  const { quizId, subjectId, subjectName, grade, topic, questionText, options } = body;
  if (!questionText || !Array.isArray(options) || options.length < 2) {
    return respond({ error: 'Question text and at least 2 options are required.' }, 400);
  }

  let targetQuizId = quizId ? parseInt(quizId) : null;
  let resolvedSubjectId = subjectId ? parseInt(subjectId) : null;

  if (!resolvedSubjectId && subjectName) {
    const existingSubj = unwrap(await supabase
      .from('subject')
      .select('*')
      .ilike('subjectname', subjectName.trim())
      .maybeSingle()
    );
    if (existingSubj) {
      resolvedSubjectId = existingSubj.subjectid;
    } else {
      const createdSubj = unwrap(await supabase
        .from('subject')
        .insert({ subjectname: subjectName.trim(), description: `${subjectName.trim()} Curriculum` })
        .select('*')
        .single()
      );
      resolvedSubjectId = createdSubj.subjectid;
    }
  }

  if (!targetQuizId) {
    // Find an existing placement quiz for this subject & grade, or create one
    let query = supabase.from('quiz').select('*').eq('is_placement', true);
    if (resolvedSubjectId) query = query.eq('subjectid', resolvedSubjectId);
    const matches = unwrap(await query.order('quizid', { ascending: true }));
    const targetGrade = grade || 'Grade 12 (Science)';
    const matchedQuiz = (matches || []).find(qz => !grade || qz.grade === targetGrade) || (matches || [])[0];
    if (matchedQuiz) {
      targetQuizId = matchedQuiz.quizid;
    } else {
      const newQuiz = unwrap(await supabase
        .from('quiz')
        .insert({
          title: `${targetGrade} ${subjectName || 'Subject'} Placement Test`,
          subjectid: resolvedSubjectId,
          grade: targetGrade,
          xpreward: 100,
          ispublished: true,
          is_placement: true
        })
        .select('*')
        .single()
      );
      targetQuizId = newQuiz.quizid;
    }
  }

  const question = unwrap(await supabase
    .from('question')
    .insert({
      quizid: targetQuizId,
      questiontext: questionText.trim(),
      topic: topic ? topic.trim() : null
    })
    .select('*')
    .single()
  );

  const optionsToInsert = options
    .filter(o => (o.option || o.text || '').trim() !== '')
    .map(opt => ({
      questionid: question.questionid,
      option: (opt.option || opt.text || '').trim(),
      iscorrect: !!(opt.isCorrect || opt.iscorrect),
      rationale: opt.rationale ? opt.rationale.trim() : null
    }));

  const insertedOptions = unwrap(await supabase
    .from('option')
    .insert(optionsToInsert)
    .select('*')
  );

  await supabase.rpc('log_audit', {
    action: 'CREATE_PLACEMENT_QUESTION',
    target_type: 'QUESTION',
    target_id: String(question.questionid),
    details: `Placement question ${question.questionid} created in quiz ${targetQuizId}`
  }).catch(() => {});

  return respond({ ...question, options: insertedOptions }, 201);
});

// ==============================
// PUT /placement-questions/:questionId — Update a Grade Placement question (Admin/Teacher)
// ==============================
route('PUT', '/placement-questions/:questionId', async ({ params, body }) => {
  await requireRole('Admin', 'Teacher');
  const questionId = parseInt(params.questionId);
  const { questionText, topic, options, grade, subjectId } = body;
  if (!questionText || !Array.isArray(options) || options.length < 2) {
    return respond({ error: 'Question text and at least 2 options are required.' }, 400);
  }

  const updatedQuestion = unwrap(await supabase
    .from('question')
    .update({
      questiontext: questionText.trim(),
      topic: topic ? topic.trim() : null
    })
    .eq('questionid', questionId)
    .select('*')
    .single()
  );

  if (grade || subjectId) {
    const quizUpdates = { updatedat: new Date().toISOString() };
    if (grade) quizUpdates.grade = grade;
    if (subjectId) quizUpdates.subjectid = parseInt(subjectId);
    await supabase.from('quiz').update(quizUpdates).eq('quizid', updatedQuestion.quizid);
  }

  unwrap(await supabase.from('option').delete().eq('questionid', questionId));

  const optionsToInsert = options
    .filter(o => (o.option || o.text || '').trim() !== '')
    .map(opt => ({
      questionid: questionId,
      option: (opt.option || opt.text || '').trim(),
      iscorrect: !!(opt.isCorrect || opt.iscorrect),
      rationale: opt.rationale ? opt.rationale.trim() : null
    }));

  const insertedOptions = unwrap(await supabase
    .from('option')
    .insert(optionsToInsert)
    .select('*')
  );

  await supabase.rpc('log_audit', {
    action: 'EDIT_PLACEMENT_QUESTION',
    target_type: 'QUESTION',
    target_id: String(questionId),
    details: `Placement question ${questionId} updated`
  }).catch(() => {});

  return { ...updatedQuestion, options: insertedOptions };
});

// ==============================
// DELETE /placement-questions/:questionId — Delete a Grade Placement question (Admin/Teacher)
// ==============================
route('DELETE', '/placement-questions/:questionId', async ({ params }) => {
  await requireRole('Admin', 'Teacher');
  const questionId = parseInt(params.questionId);
  unwrap(await supabase.from('option').delete().eq('questionid', questionId));
  unwrap(await supabase.from('question').delete().eq('questionid', questionId));

  await supabase.rpc('log_audit', {
    action: 'DELETE_PLACEMENT_QUESTION',
    target_type: 'QUESTION',
    target_id: String(questionId),
    details: `Placement question ${questionId} deleted`
  }).catch(() => {});

  return { message: 'Placement question deleted.' };
});
