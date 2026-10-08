import { supabase } from '../../supabaseClient';
import { route, requireRole, unwrap, respond, getMe } from '../core';

// ==============================
// GET /lessons - Get all lessons (for Teacher dashboard)
// ==============================
route('GET', '/lessons', async () => {
  const data = unwrap(await supabase
    .from('lesson')
    .select('*, subject(subjectname)')
    .order('lessonid', { ascending: false })
  );
  return data.map(d => ({
    ...d,
    subjectname: d.subject?.subjectname,
    subject: undefined
  }));
});

// ==============================
// GET /lessons/subject/:subjectId — Get lessons by subject
// ==============================
route('GET', '/lessons/subject/:subjectId', async ({ params }) => {
  const data = unwrap(await supabase
    .from('lesson')
    .select('*')
    .eq('subjectid', params.subjectId)
    .order('lessonorder', { ascending: true })
  );
  return data;
});

// ==============================
// GET /lessons/:id — Get lesson by ID
// ==============================
route('GET', '/lessons/:id', async ({ params }) => {
  const data = unwrap(await supabase
    .from('lesson')
    .select('*, subject(subjectname)')
    .eq('lessonid', params.id)
    .maybeSingle(), 'Lesson not found.');
  return {
    ...data,
    subjectname: data.subject?.subjectname,
    subject: undefined
  };
});

// ==============================
// POST /lessons — Create lesson (Admin/Teacher)
// ==============================
route('POST', '/lessons', async ({ body }) => {
  await requireRole('Admin', 'Teacher');
  const { subjectId, title, description, youtubeURL, xpReward, lessonOrder, summarize, grade, ispublished } = body;
  if (!subjectId || !title) return respond({ error: 'Subject ID and title are required.' }, 400);

  const data = unwrap(await supabase
    .from('lesson')
    .insert({
      subjectid: subjectId,
      title,
      description: description || null,
      youtubeurl: youtubeURL || null,
      xpreward: xpReward || 0,
      lessonorder: lessonOrder || null,
      summarize: summarize || null,
      grade: grade || null,
      ispublished: ispublished !== undefined ? ispublished : true
    })
    .select('*')
    .single()
  );
  return respond(data, 201);
});

// ==============================
// PUT /lessons/:id - Update lesson (Admin/Teacher)
// ==============================
route('PUT', '/lessons/:id', async ({ params, body }) => {
  await requireRole('Admin', 'Teacher');
  const { title, description, youtubeURL, xpReward, lessonOrder, summarize, ispublished, grade, subjectId } = body;
  
  const updates = { updatedat: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (youtubeURL !== undefined) updates.youtubeurl = youtubeURL;
  if (xpReward !== undefined) updates.xpreward = xpReward;
  if (lessonOrder !== undefined) updates.lessonorder = lessonOrder;
  if (summarize !== undefined) updates.summarize = summarize;
  if (ispublished !== undefined) updates.ispublished = ispublished;
  if (grade !== undefined) updates.grade = grade;
  if (subjectId !== undefined) updates.subjectid = subjectId;

  const data = unwrap(await supabase
    .from('lesson')
    .update(updates)
    .eq('lessonid', params.id)
    .select('*')
    .maybeSingle(), 'Lesson not found.');

  const action = ispublished !== undefined ? (ispublished ? 'PUBLISH_LESSON' : 'UNPUBLISH_LESSON') : 'EDIT_LESSON';
  const details = ispublished !== undefined ? `Lesson ${params.id} ${ispublished ? 'published' : 'unpublished'}` : `Lesson ${params.id} modified`;
  await supabase.rpc('log_audit', { action, target_type: 'LESSON', target_id: params.id, details }).catch(() => {});

  return data;
});

// ==============================
// DELETE /lessons/:id - Delete lesson (Admin/Teacher)
// ==============================
route('DELETE', '/lessons/:id', async ({ params }) => {
  await requireRole('Admin', 'Teacher');
  
  const { error } = await supabase.rpc('delete_lesson_transaction', { p_lessonid: parseInt(params.id) });
  if (error) {
    if (error.code === 'P0001') return respond({ error: 'Lesson not found.' }, 404);
    throw error;
  }
  
  await supabase.rpc('log_audit', { action: 'DELETE_LESSON', target_type: 'LESSON', target_id: params.id, details: `Lesson ${params.id} deleted` }).catch(() => {});
  
  return { message: 'Lesson deleted.' };
});

// ==============================
// GET /lessons/:id/progress — Get user's lesson progress
// ==============================
route('GET', '/lessons/:id/progress', async ({ params }) => {
  const me = await getMe();
  const { data, error } = await supabase
    .from('lessonprogress')
    .select('*')
    .eq('lessonid', params.id)
    .eq('uid', me.uid)
    .maybeSingle();
    
  if (error) throw error;
  if (!data) return { progressPercentage: 0, lessonCompleteStatus: false };
  return data;
});

// ==============================
// PUT /lessons/:id/progress — Update lesson progress
// ==============================
route('PUT', '/lessons/:id/progress', async ({ params, body }) => {
  const { progressPercentage, lessonCompleteStatus } = body;
  const data = unwrap(await supabase.rpc('update_lesson_progress', {
    p_lessonid: parseInt(params.id),
    p_progress: progressPercentage || 0,
    p_status: lessonCompleteStatus || false
  }));
  return data;
});

// ==============================
// POST /lessons/assign — Assign lesson to student (Teacher)
// ==============================
route('POST', '/lessons/assign', async ({ body }) => {
  await requireRole('Admin', 'Teacher');
  const me = await getMe();
  const { studentUid, lessonId, dueDate } = body;
  
  const data = unwrap(await supabase
    .from('lessonassignment')
    .insert({
      teacheruid: me.uid,
      studentuid: studentUid,
      lessonid: lessonId,
      duedate: dueDate || null
    })
    .select('*')
    .single()
  );
  return respond(data, 201);
});

// ==============================
// GET /lessons/assignments/:studentUid — Get assignments for a student
// ==============================
route('GET', '/lessons/assignments/:studentUid', async ({ params }) => {
  const me = await getMe();
  const studentUid = parseInt(params.studentUid);
  
  if (me.uid !== studentUid && !['Admin', 'Teacher'].includes(me.roleName)) {
    if (me.roleName === 'Parent') {
      unwrap(await supabase
        .from('parentstudent')
        .select('1')
        .eq('parentuid', me.uid)
        .eq('studentuid', studentUid)
        .single(), 'Access denied.');
    } else {
      return respond({ error: 'Access denied.' }, 403);
    }
  }

  const { data, error } = await supabase
    .from('lessonassignment')
    .select(`
      *,
      lesson:lessonid(title, description, subject:subjectid(subjectname)),
      user:teacheruid(firstname, lastname)
    `)
    .eq('studentuid', studentUid)
    .order('assignedat', { ascending: false });
    
  if (error) throw error;
  
  return data.map(d => ({
    ...d,
    lessontitle: d.lesson?.title,
    lessondescription: d.lesson?.description,
    subjectname: d.lesson?.subject?.subjectname,
    teacherfirstname: d.user?.firstname,
    teacherlastname: d.user?.lastname,
    lesson: undefined,
    user: undefined
  }));
});
