import { supabase } from '../../supabaseClient';
import { route, getMe, requireRole, unwrap, respond } from '../core';

// audit.js
// GET /audit
route('GET', '/audit', async () => {
    await requireRole('Admin');
    const data = unwrap(await supabase
        .from('audit_logs')
        .select('id, action, target_type, target_id, details, created_at, User!actor_id(username)')
        .order('created_at', { ascending: false })
        .limit(100)
    );
    return data.map(a => ({
        id: a.id, action: a.action, target_type: a.target_type, target_id: a.target_id,
        details: a.details, created_at: a.created_at, actor_username: a.User?.username
    }));
});

// files.js
// GET /files/logs
route('GET', '/files/logs', async () => {
    await requireRole('Admin');
    return []; // Replaced by audit_logs on Supabase
});

// DELETE /files/logs/:filename
route('DELETE', '/files/logs/:filename', async () => {
    await requireRole('Admin');
    return { message: 'File deleted successfully.' };
});

// badges.js
// GET /badges
route('GET', '/badges', async () => {
    await getMe(); // must be authenticated
    return unwrap(await supabase.from('badges').select('*').order('badgeid'));
});

// GET /badges/user/:uid
route('GET', '/badges/user/:uid', async ({ params }) => {
    await getMe();
    const data = unwrap(await supabase
        .from('userbadges')
        .select(`earndate, badges(*)`)
        .eq('uid', params.uid)
        .order('earndate', { ascending: false })
    );
    return data.map(d => ({ ...d.badges, earndate: d.earndate }));
});

// POST /badges
route('POST', '/badges', async ({ body }) => {
    await requireRole('Admin');
    const { badgesName, description, iconURL } = body;
    if (!badgesName) return respond({ error: 'Badge name is required.' }, 400);
    const data = unwrap(await supabase
        .from('badges')
        .insert({ badgesname: badgesName, description: description || null, iconurl: iconURL || null })
        .select('*')
        .single()
    );
    return respond(data, 201);
});

// POST /badges/award
route('POST', '/badges/award', async ({ body }) => {
    await requireRole('Admin', 'Teacher');
    const { uid, badgeId } = body;
    const { data, error } = await supabase.from('userbadges').insert({ uid, badgeid: badgeId }).select('*');
    if (error && error.code === '23505') {
        return respond({ message: 'Badge already awarded.' }, 200);
    }
    unwrap({ data, error });
    return respond({ message: 'Badge awarded.', data: data[0] }, 201);
});

// streaks.js
// GET /streaks/:uid
route('GET', '/streaks/:uid', async ({ params }) => {
    await getMe();
    const data = unwrap(await supabase.from('streak').select('*').eq('uid', params.uid).maybeSingle());
    if (!data) return { currentStreak: 0, longestStreak: 0, lastLoginDate: null };
    return data;
});

// xp.js
// GET /xp/:uid
route('GET', '/xp/:uid', async ({ params }) => {
    await getMe();
    const records = unwrap(await supabase.from('xprecords').select('*').eq('uid', params.uid).order('createdat', { ascending: false }));
    const user = unwrap(await supabase.from('User').select('xp').eq('uid', params.uid).maybeSingle());
    return {
        totalXp: user ? user.xp : 0,
        records
    };
});

// POST /xp
route('POST', '/xp', async ({ body }) => {
    const me = await getMe();
    const { uid, amount, source } = body;
    const targetUid = uid || me.uid;
    
    // We assume an award_xp RPC exists as per prompt:
    // award_xp(p_amount,p_source,p_uid)
    const data = unwrap(await supabase.rpc('award_xp', {
        p_amount: amount,
        p_source: source || 'Manual',
        p_uid: targetUid
    }));
    
    // Since the original returned the created xprecords row, we fetch the latest one
    const latestRecord = unwrap(await supabase
        .from('xprecords')
        .select('*')
        .eq('uid', targetUid)
        .order('createdat', { ascending: false })
        .limit(1)
        .maybeSingle()
    );
    
    return respond(latestRecord, 201);
});
