import { supabase } from '../../supabaseClient';
import { route, getMe, requireRole, unwrap, respond } from '../core';

async function logAuditAction(action, target_type, target_id, details) {
    try {
        const me = await getMe();
        await supabase.rpc('log_audit', { action, target_type, target_id, details });
    } catch (e) {
        console.warn('Failed to log audit action:', e.message);
    }
}

// GET /users
route('GET', '/users', async () => {
    await requireRole('Admin', 'Teacher');
    const data = unwrap(await supabase
        .from('User')
        .select(`
            uid, username, email, firstname, lastname, bio, xp, profilepictureurl, createdat, lasteditdate, grade,
            role!inner(rolename), streak(lastlogindate)
        `)
        .order('createdat', { ascending: false })
    );

    return data.map(u => ({
        uid: u.uid, username: u.username, email: u.email, firstname: u.firstname, lastname: u.lastname, bio: u.bio, xp: u.xp,
        profilepictureurl: u.profilepictureurl, createdat: u.createdat, lasteditdate: u.lasteditdate, grade: u.grade,
        rolename: u.role?.rolename,
        lastlogindate: (u.streak && u.streak.length > 0) ? u.streak[0].lastlogindate : null,
        login_method: 'Email'
    }));
});

// GET /users/:id
route('GET', '/users/:id', async ({ params }) => {
    const me = await getMe();
    if (String(me.uid) !== params.id && !['Admin', 'Teacher'].includes(me.roleName)) {
        return respond({ error: 'Access denied.' }, 403);
    }
    const data = unwrap(await supabase
        .from('User')
        .select(`uid, username, email, firstname, lastname, bio, xp, profilepictureurl, createdat, lasteditdate, role!inner(rolename)`)
        .eq('uid', params.id)
        .maybeSingle(), 'User not found.');
    
    return { ...data, rolename: data.role?.rolename };
});

// PUT /users/:id
route('PUT', '/users/:id', async ({ params, body }) => {
    const me = await getMe();
    if (String(me.uid) !== params.id && me.roleName !== 'Admin') {
        return respond({ error: 'Access denied.' }, 403);
    }
    const { firstName, lastName, bio, profilePictureURL } = body;
    const updates = { lasteditdate: new Date().toISOString() };
    if (firstName !== undefined) updates.firstname = firstName;
    if (lastName !== undefined) updates.lastname = lastName;
    if (bio !== undefined) updates.bio = bio;
    if (profilePictureURL !== undefined) updates.profilepictureurl = profilePictureURL;
    
    const data = unwrap(await supabase
        .from('User')
        .update(updates)
        .eq('uid', params.id)
        .select('uid, username, email, firstname, lastname, bio, profilepictureurl, lasteditdate')
        .maybeSingle(), 'User not found.');
    
    let actionDesc = 'Profile updated';
    if (String(me.uid) !== params.id) actionDesc = `User ${data.username} modified by Admin`;
    await logAuditAction('EDIT_USER', 'USER', params.id, actionDesc);
    
    return { message: 'Profile updated.', user: data };
});

// DELETE /users/:id
route('DELETE', '/users/:id', async ({ params }) => {
    await requireRole('Admin');
    const user = unwrap(await supabase.from('User').select('uid, username').eq('uid', params.id).maybeSingle(), 'User not found.');
    
    unwrap(await supabase.rpc('users_admin_delete_user', { p_uid: parseInt(params.id, 10) }));
    
    const username = user.username || `User ID ${params.id}`;
    await logAuditAction('DELETE_USER', 'USER', params.id, `User ${username} deleted by Admin`);
    return { message: 'User deleted successfully.' };
});

// PUT /users/:id/role
route('PUT', '/users/:id/role', async ({ params, body }) => {
    await requireRole('Admin');
    const { roleName } = body;
    if (!roleName) return respond({ error: 'Role name is required.' }, 400);
    
    const role = unwrap(await supabase.from('role').select('roleid').eq('rolename', roleName).maybeSingle(), 'Invalid role name.');
    const user = unwrap(await supabase.from('User').update({ roleid: role.roleid }).eq('uid', params.id).select('uid, username').maybeSingle(), 'User not found.');
    
    await logAuditAction('UPDATE_ROLE', 'USER', params.id, `Role changed to ${roleName} by Admin`);
    return { message: 'Role updated successfully.', user: { ...user, rolename: roleName } };
});

// GET /users/:id/children
route('GET', '/users/:id/children', async ({ params }) => {
    const me = await getMe();
    if (String(me.uid) !== params.id && me.roleName !== 'Admin') {
        return respond({ error: 'Access denied.' }, 403);
    }
    const data = unwrap(await supabase
        .from('parentstudent')
        .select(`
            User!studentuid (uid, username, email, firstname, lastname, xp, profilepictureurl, grade, streak(currentstreak, longeststreak, lastlogindate))
        `)
        .eq('parentuid', params.id)
    );
    return data.map(r => {
        const u = r.User;
        const s = (u.streak && u.streak.length > 0) ? u.streak[0] : { currentstreak: null, longeststreak: null, lastlogindate: null };
        return {
            uid: u.uid, username: u.username, email: u.email, firstname: u.firstname, lastname: u.lastname, xp: u.xp,
            profilepictureurl: u.profilepictureurl, grade: u.grade,
            currentstreak: s.currentstreak, longeststreak: s.longeststreak, lastlogindate: s.lastlogindate
        };
    });
});

// POST /users/link-child
route('POST', '/users/link-child', async ({ body }) => {
    await requireRole('Admin');
    const { parentUid, studentUid } = body;
    const { error } = await supabase.from('parentstudent').insert({ parentuid: parentUid, studentuid: studentUid });
    // Ignore conflict errors
    if (error && error.code !== '23505') unwrap({ error });
    return respond({ message: 'Parent linked to student.' }, 201);
});

// POST /users/:id/reset-password
route('POST', '/users/:id/reset-password', async ({ params, body }) => {
    await requireRole('Admin');
    const { newPassword } = body;
    if (!newPassword) return respond({ error: 'New password is required.' }, 400);
    
    const user = unwrap(await supabase.from('User').select('uid, username').eq('uid', params.id).maybeSingle(), 'User not found.');
    unwrap(await supabase.rpc('users_admin_reset_password', { p_uid: parseInt(params.id, 10), p_new_pw: newPassword }));
    
    const username = user.username || `User ID ${params.id}`;
    await logAuditAction('RESET_PASSWORD', 'USER', params.id, `Password reset for ${username}`);
    return { message: 'Password reset successfully.' };
});

// POST /users/generate-connection-code
route('POST', '/users/generate-connection-code', async () => {
    await requireRole('Student');
    const data = unwrap(await supabase.rpc('users_generate_connection_code'));
    return respond(data, 201);
});

// POST /users/submit-connection-code
route('POST', '/users/submit-connection-code', async ({ body }) => {
    await requireRole('Parent');
    const { code } = body;
    unwrap(await supabase.rpc('users_submit_connection_code', { p_code: code }));
    return respond({ message: 'Successfully connected to student.' }, 201);
});

// GET /users/invitations
route('GET', '/users/invitations', async () => {
    const me = await requireRole('Student');
    const data = unwrap(await supabase
        .from('parent_student_invitations')
        .select(`id, parent_uid, status, created_at, User!parent_uid(username, firstname, lastname)`)
        .eq('student_uid', me.uid)
        .eq('status', 'pending')
    );
    return data.map(i => ({
        id: i.id, parent_uid: i.parent_uid, status: i.status, created_at: i.created_at,
        parent_username: i.User?.username, firstname: i.User?.firstname, lastname: i.User?.lastname
    }));
});

// GET /users/parent-invitations
route('GET', '/users/parent-invitations', async () => {
    const me = await requireRole('Parent');
    const data = unwrap(await supabase
        .from('parent_student_invitations')
        .select(`id, student_uid, status, created_at, User!student_uid(username, firstname, lastname)`)
        .eq('parent_uid', me.uid)
        .eq('status', 'pending')
    );
    return data.map(i => ({
        id: i.id, student_uid: i.student_uid, status: i.status, created_at: i.created_at,
        student_username: i.User?.username, firstname: i.User?.firstname, lastname: i.User?.lastname
    }));
});

// POST /users/respond-invitation
route('POST', '/users/respond-invitation', async ({ body }) => {
    await requireRole('Student');
    const { invitationId, accept } = body;
    unwrap(await supabase.rpc('users_respond_invitation', { p_invitation_id: invitationId, p_accept: accept }));
    return { message: accept ? 'Invitation accepted.' : 'Invitation rejected.' };
});

// POST /users/initiate-disconnect
route('POST', '/users/initiate-disconnect', async ({ body }) => {
    const { targetUid } = body;
    unwrap(await supabase.rpc('users_initiate_disconnect', { p_target_uid: parseInt(targetUid, 10) }));
    return respond({ message: 'Disconnect request sent.' }, 201);
});

// POST /users/respond-disconnect
route('POST', '/users/respond-disconnect', async ({ body }) => {
    const { requestId, accept } = body;
    unwrap(await supabase.rpc('users_respond_disconnect', { p_request_id: requestId, p_accept: accept }));
    return { message: accept ? 'Disconnected successfully.' : 'Disconnect request rejected.' };
});

// GET /users/notifications
route('GET', '/users/notifications', async () => {
    const me = await getMe();
    let notifications = [];

    if (me.roleName === 'Student') {
        const invData = unwrap(await supabase
            .from('parent_student_invitations')
            .select(`id, parent_uid, status, created_at, User!parent_uid(username, firstname, lastname)`)
            .eq('student_uid', me.uid)
            .eq('status', 'pending')
        );
        notifications.push(...invData.map(i => ({
            id: i.id, from_uid: i.parent_uid, status: i.status, created_at: i.created_at,
            from_username: i.User?.username, from_firstname: i.User?.firstname, from_lastname: i.User?.lastname, type: 'connection'
        })));
    }

    const drData = unwrap(await supabase
        .from('disconnect_requests')
        .select(`id, initiated_by, status, created_at, User!initiated_by(username, firstname, lastname)`)
        .or(`parent_uid.eq.${me.uid},student_uid.eq.${me.uid}`)
        .neq('initiated_by', me.uid)
        .eq('status', 'pending')
    );
    
    notifications.push(...drData.map(d => ({
        id: d.id, from_uid: d.initiated_by, status: d.status, created_at: d.created_at,
        from_username: d.User?.username, from_firstname: d.User?.firstname, from_lastname: d.User?.lastname, type: 'disconnect'
    })));

    notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return notifications;
});
