// Import this file (not core.js) from screens. Importing it registers every handler.
import './handlers/auth';     // routes/auth.js
import './handlers/users';    // routes/users.js
import './handlers/stats';    // routes/stats.js
import './handlers/lessons';  // routes/lessons.js
import './handlers/quizzes';  // routes/quizzes.js
import './handlers/misc';     // routes/audit.js, files.js, badges.js, streaks.js, xp.js
import './handlers/content';  // routes/subjects.js, flashcards.js, ai.js

export { apiFetch, request, dispatch, getMe, clearMeCache, ApiError } from './core';
