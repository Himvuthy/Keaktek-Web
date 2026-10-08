import { supabase } from '../../supabaseClient';
import { route, getMe, requireRole, unwrap, respond } from '../core';

const cache = new Map();
const CACHE_TTL = 60000;

function getCached(key) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
    return null;
}

function setCache(key, data) {
    cache.set(key, { time: Date.now(), data });
}

// GET /stats/overview
route('GET', '/stats/overview', async () => {
    await requireRole('Admin');
    const cachedStats = getCached('overviewStats');
    if (cachedStats) return cachedStats;

    const rawData = unwrap(await supabase.rpc('users_admin_stats_overview'));
    
    // Process userGrowth
    const userGrowth = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        userGrowth.push({ month: d.toLocaleString('default', { month: 'short' }), count: 0 });
    }
    const dbGrowth = rawData.userGrowth || [];
    dbGrowth.forEach(row => {
        const index = userGrowth.findIndex(g => g.month === row.month);
        if (index !== -1) userGrowth[index].count = parseInt(row.count, 10);
    });
    rawData.userGrowth = userGrowth;

    // Process dailyActivity
    const dailyActivity = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        dailyActivity.push({ day: dayName, count: 0 });
    }
    const dbDaily = rawData.dailyActivity || [];
    dbDaily.forEach(row => {
        const index = dailyActivity.findIndex(a => a.day === row.day);
        if (index !== -1) dailyActivity[index].count = parseInt(row.count, 10);
    });
    rawData.dailyActivity = dailyActivity;

    setCache('overviewStats', rawData);
    return rawData;
});

// GET /stats/recent-users
route('GET', '/stats/recent-users', async () => {
    await requireRole('Admin');
    const cachedRecent = getCached('recentUsers');
    if (cachedRecent) return cachedRecent;

    const data = unwrap(await supabase
        .from('User')
        .select('uid, username, email, firstname, lastname, profilepictureurl, createdat, role!inner(rolename)')
        .order('createdat', { ascending: false })
        .limit(10));
    
    const mapped = data.map(u => ({
        uid: u.uid,
        username: u.username,
        email: u.email,
        firstname: u.firstname,
        lastname: u.lastname,
        profilepictureurl: u.profilepictureurl,
        createdat: u.createdat,
        rolename: u.role?.rolename
    }));

    setCache('recentUsers', mapped);
    return mapped;
});


// GET /stats/user-growth
route('GET', '/stats/user-growth', async ({ query }) => {
    await requireRole('Admin');
    const year = parseInt(query.year) || new Date().getFullYear();
    
    const dbGrowth = unwrap(await supabase.rpc('get_user_growth_by_year', { p_year: year }));
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const userGrowth = months.map(m => ({ month: m, count: 0 }));
    
    if (dbGrowth && dbGrowth.length) {
        dbGrowth.forEach(row => {
            const index = userGrowth.findIndex(g => g.month === row.month);
            if (index !== -1) userGrowth[index].count = parseInt(row.count, 10);
        });
    }
    
    return userGrowth;
});
