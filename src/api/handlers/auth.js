import { supabase } from '../../supabaseClient';
import { route, getMe, respond, unwrap, fail } from '../core';

/**
 * Generate candidate usernames
 */
async function generateUniqueUserId() {
    let usernameExists = true;
    let newUserId;
    while(usernameExists) {
        newUserId = Math.floor(100000 + Math.random() * 900000).toString();
        const { data } = await supabase.from('User').select('uid').eq('username', newUserId);
        if (!data || data.length === 0) {
            usernameExists = false;
        }
    }
    return newUserId;
}

function mapProfile(userProfile) {
    if (!userProfile) return userProfile;
    const { roleName, ...rest } = userProfile;
    return { ...rest, role: roleName };
}

// POST /auth/register
route('POST', '/auth/register', async ({ body }) => {
    const { email, password, firstName, lastName, roleName, username } = body;

    if (!email || !password) {
        fail(400, 'Email and password are required.');
    }

    // Role mapping: 3 for Parent, else 4 (Student). Never 1 or 2.
    const roleId = roleName === 'Parent' ? 3 : 4;
    
    let finalUsername = username;
    if (!finalUsername) {
        finalUsername = await generateUniqueUserId();
    } else {
        const { data: existingUser } = await supabase.from('User').select('uid').eq('username', finalUsername).maybeSingle();
        if (existingUser) {
            fail(409, 'Username already taken.');
        }
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username: finalUsername,
                roleid: roleId,
                firstname: firstName || null,
                lastname: lastName || null
            }
        }
    });

    if (authError) {
        if (authError.message.toLowerCase().includes('already registered')) {
            fail(409, 'Email already exists.');
        }
        fail(400, authError.message);
    }

    let session = authData.session;
    if (!session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) fail(400, signInError.message);
        session = signInData.session;
    }

    const userProfile = await getMe({ force: true });
    
    await supabase.rpc('log_audit', {
        p_action: 'ADD_USER',
        p_target_type: 'USER',
        p_target_id: userProfile.uid,
        p_details: `New user registered: ${userProfile.username}`
    });

    return respond({
        message: 'User registered successfully.',
        token: session.access_token,
        user: { ...mapProfile(userProfile), createdAt: new Date().toISOString() }
    }, 201);
});

// POST /auth/login
route('POST', '/auth/login', async ({ body }) => {
    const { email, password } = body;
    if (!email || !password) {
        fail(400, 'Identifier and password are required.');
    }

    // Resolve identifier to email using RPC
    const { data: resolvedEmail, error: rpcError } = await supabase.rpc('get_login_email', { identifier: email });
    const loginEmail = !rpcError && resolvedEmail ? resolvedEmail : email;

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password
    });

    if (authError) {
        fail(401, 'Invalid email or password.');
    }

    // Touch streak
    await supabase.rpc('touch_login_streak');

    const userProfile = await getMe({ force: true });

    return {
        message: 'Login successful.',
        token: authData.session.access_token,
        user: mapProfile(userProfile)
    };
});

// GET /auth/me
route('GET', '/auth/me', async () => {
    const userProfile = await getMe();
    return { user: mapProfile(userProfile) };
});

// GET /auth/config
route('GET', '/auth/config', async () => {
    return {
        googleClientId: (typeof import !== 'undefined' && import.meta && import.meta.env ? import.meta.env.VITE_GOOGLE_CLIENT_ID : null),
        facebookAppId: (typeof import !== 'undefined' && import.meta && import.meta.env ? import.meta.env.VITE_FACEBOOK_APP_ID : null)
    };
});

// POST /auth/google
route('POST', '/auth/google', async ({ body }) => {
    const { token } = body;
    if (token) {
        const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token
        });
        if (error) {
            if (error.message.includes('not supported') || error.message.includes('not configured') || error.message.includes('server error')) {
                fail(501, 'Google sign-in is not enabled yet on Supabase. Please configure it in the dashboard (Authentication > Providers > Google).');
            }
            fail(400, error.message);
        }
        
        await supabase.rpc('touch_login_streak');
        const userProfile = await getMe({ force: true });
        
        return {
            message: 'Google Login successful.',
            token: data.session?.access_token,
            user: mapProfile(userProfile)
        };
    } else {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
        });
        if (error) fail(501, 'Google sign-in is not enabled yet on Supabase. Please configure it in the dashboard (Authentication > Providers > Google).');
        return data; // Will typically redirect, so no token yet
    }
});

// POST /auth/facebook
route('POST', '/auth/facebook', async ({ body }) => {
    const { accessToken } = body;
    if (accessToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'facebook',
            token: accessToken
        });
        if (error) {
            fail(501, 'Facebook sign-in is not enabled yet on Supabase. Please configure it in the dashboard (Authentication > Providers > Facebook).');
        }
        
        await supabase.rpc('touch_login_streak');
        const userProfile = await getMe({ force: true });
        
        return {
            message: 'Facebook Login successful.',
            token: data.session?.access_token,
            user: mapProfile(userProfile)
        };
    } else {
        const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'facebook' });
        if (error) fail(501, 'Facebook sign-in is not enabled yet on Supabase. Please configure it in the dashboard (Authentication > Providers > Facebook).');
        return data;
    }
});

// POST /auth/phone/verify
route('POST', '/auth/phone/verify', async ({ body }) => {
    const { idToken, password, phoneNumber } = body;
    
    // We can't verify Firebase tokens directly on the client reliably without a custom backend.
    // However, if we just try to sign in or sign up via Supabase Phone Auth:
    // But the payload specifically says "not fully configured by us yet".
    fail(501, 'Phone authentication is not enabled yet on Supabase. Please configure Twilio or another provider in the Supabase dashboard (Authentication > Providers > Phone).');
});

// POST /auth/check-username
route('POST', '/auth/check-username', async ({ body }) => {
    const { username } = body;
    if (!username) fail(400, 'Username is required');
    
    const userProfile = await getMe(); // ensures authenticated
    const { data } = await supabase
        .from('User')
        .select('uid')
        .eq('username', username)
        .neq('uid', userProfile.uid);
        
    return { available: !data || data.length === 0 };
});

// POST /auth/suggest-usernames
route('POST', '/auth/suggest-usernames', async ({ body }) => {
    const { firstName, lastName } = body;
    if (!firstName || !lastName) fail(400, 'First and last name required.');
    
    await getMe(); // ensures authenticated

    const fn = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const ln = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');

    const candidates = [
        `${fn}${ln}`,
        `${fn}_${ln}`,
        `${fn[0]}${ln}`,
        `${fn}${ln.substring(0, 3)}`,
        `${fn}${Math.floor(Math.random() * 1000)}`,
        `${fn}${ln}${Math.floor(Math.random() * 1000)}`,
        `${fn}_${ln}${Math.floor(Math.random() * 1000)}`,
        `${fn[0]}${ln}${Math.floor(Math.random() * 1000)}`
    ];

    const { data } = await supabase
        .from('User')
        .select('username')
        .in('username', candidates);
        
    const takenUsernames = (data || []).map(r => r.username);

    const uniqueSuggestions = candidates
        .filter(c => !takenUsernames.includes(c))
        .filter((value, index, self) => self.indexOf(value) === index)
        .slice(0, 3);

    return { suggestions: uniqueSuggestions };
});

// PUT /auth/profile
route('PUT', '/auth/profile', async ({ body }) => {
    const { firstName, lastName, birthYear, grade, avatarIndex, username, role, childUsername } = body;
    const userProfile = await getMe();

    let studentUid = null;
    if (childUsername) {
        const { data: childData } = await supabase.from('User').select('uid').eq('username', childUsername).maybeSingle();
        if (!childData) fail(404, 'Child username not found.');
        studentUid = childData.uid;
    }

    let profilePictureURL = undefined;
    if (avatarIndex !== undefined && avatarIndex !== null) {
        const index = (parseInt(avatarIndex, 10) % 10) + 1;
        profilePictureURL = `/avatars/avatar-${index}.svg`;
    }

    let roleId = undefined;
    if (role) {
        const { data: roleData } = await supabase.from('role').select('roleid').ilike('rolename', role).maybeSingle();
        if (roleData) {
            roleId = roleData.roleid;
        }
    }

    const updates = {};
    if (firstName !== undefined) updates.firstname = firstName;
    if (lastName !== undefined) updates.lastname = lastName;
    if (birthYear !== undefined) updates.birth_year = birthYear ? parseInt(birthYear, 10) : null;
    if (grade !== undefined) updates.grade = grade;
    if (profilePictureURL !== undefined) updates.profilepictureurl = profilePictureURL;
    if (username !== undefined) updates.username = username;
    if (roleId !== undefined) updates.roleid = roleId;

    if (Object.keys(updates).length > 0) {
        updates.lasteditdate = new Date().toISOString();
        const { error: updateError } = await supabase
            .from('User')
            .update(updates)
            .eq('uid', userProfile.uid);
            
        if (updateError) fail(400, updateError.message);
    }

    if (studentUid) {
        const { data: existingLink } = await supabase
            .from('parentstudent')
            .select('parentuid')
            .eq('parentuid', userProfile.uid)
            .eq('studentuid', studentUid)
            .maybeSingle();

        if (!existingLink) {
            const { data: existingInv } = await supabase
                .from('parent_student_invitations')
                .select('id, status')
                .eq('parent_uid', userProfile.uid)
                .eq('student_uid', studentUid)
                .maybeSingle();

            if (!existingInv) {
                await supabase.from('parent_student_invitations').insert({
                    parent_uid: userProfile.uid,
                    student_uid: studentUid,
                    status: 'pending'
                });
            } else if (existingInv.status !== 'pending') {
                await supabase.from('parent_student_invitations').update({
                    status: 'pending',
                    created_at: new Date().toISOString()
                }).eq('id', existingInv.id);
            }
        }
    }

    const updatedProfile = await getMe({ force: true });
    const { data: { session } } = await supabase.auth.getSession();

    return {
        message: 'Profile updated successfully.',
        token: session?.access_token,
        user: mapProfile(updatedProfile)
    };
});

// PUT /auth/password
route('PUT', '/auth/password', async ({ body }) => {
    const { password } = body;
    if (!password) fail(400, 'Password is required.');
    
    await getMe(); // Ensures authenticated

    const { error } = await supabase.auth.updateUser({ password });
    if (error) fail(400, error.message);

    return { message: 'Password updated successfully.' };
});
