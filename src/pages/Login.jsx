import { apiFetch } from '../api';
import { supabase } from '../supabaseClient';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import logoLight from '../assets/logo.png';
import logoDark from '../assets/logo-dark.png';
import StudyBackground from '../components/StudyBackground';
import loginBgLight from '../assets/login-bg.png';
import loginBgDark from '../assets/login-bg-dark.png';

import styles from './Login.module.css';

export default function Login() {
    const [isDark, setIsDark] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    // Check saved theme and URL errors
    useEffect(() => {
        const savedTheme = localStorage.getItem('studyapp-theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            setIsDark(true);
        }

        // Check if Supabase redirected back with an error (query string or hash)
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const errDesc = urlParams.get('error_description') || hashParams.get('error_description');
        if (errDesc) {
            setError(errDesc.replace(/\+/g, ' '));
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, []);

    // Redirect if already logged in (e.g. after OAuth redirect)
    const { user } = useAuth();
    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const toggleTheme = () => {
        const newIsDark = !isDark;
        setIsDark(newIsDark);
        if (newIsDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        localStorage.setItem('studyapp-theme', newIsDark ? 'dark' : 'light');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        if (!identifier || !password) {
            setError('Please fill in both fields.');
            return;
        }

        try {
            const response = await apiFetch(`/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: identifier, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Login failed.');
                return;
            }

            login(data.user, data.token);
            if (!data.user.birthYear || !data.user.grade) {
                navigate('/profile-setup');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('An error occurred. Please try again.');
        }
    };

    const loginWithGoogle = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + import.meta.env.BASE_URL + 'login' },
            });
            if (error) {
                setError(error.message || 'Google login failed.');
            }
        } catch (err) {
            console.error('Google login error:', err);
            setError('An error occurred during Google login.');
        }
    };

    useEffect(() => {
        window.fbAsyncInit = function() {
            window.FB.init({
                appId      : '862326466665496',
                cookie     : true,
                xfbml      : true,
                version    : 'v20.0'
            });
        };
        (function(d, s, id){
            var js, fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) {return;}
            js = d.createElement(s); js.id = id;
            js.src = "https://connect.facebook.net/en_US/sdk.js";
            fjs.parentNode.insertBefore(js, fjs);
        }(document, 'script', 'facebook-jssdk'));
    }, []);

    const handleFacebookClick = () => {
        if (!window.FB) {
            setError('Facebook SDK not loaded yet.');
            return;
        }
        window.FB.login((response) => {
            if (response.authResponse) {
                handleFacebookLogin({ accessToken: response.authResponse.accessToken });
            } else {
                console.log('User cancelled login or did not fully authorize.');
            }
        }, {scope: 'public_profile,email'});
    };

    const handleFacebookLogin = async (response) => {
        try {
            const res = await apiFetch(`/auth/facebook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: response.accessToken }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Facebook login failed.');
                return;
            }

            login(data.user, data.token);
            if (!data.user.birthYear || !data.user.grade) {
                navigate('/profile-setup');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            console.error('Facebook login error:', err);
            setError('An error occurred during Facebook login.');
        }
    };

    const sunPath = <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 7a5 5 0 100 10 5 5 0 000-10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>;
    const moonPath = <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>;

    return (
        <div className={styles.loginWrapper}>
            <StudyBackground isDark={isDark} />
            <div className={styles.websiteCanvas}>
                <div className={styles.leftPanel}>
                    <img src={isDark ? loginBgDark : loginBgLight} alt="" className={styles.bgImage} />
                    
                    {/* Dynamic Logo */}
                    <div className={styles.logoContainer}>
                        <img src={isDark ? logoDark : logoLight} alt="Keaktek Logo" className={styles.uploadedLogo} />
                        <span className={styles.logoText}>Keaktek</span>
                    </div>
                    
                    <button 
                        onClick={toggleTheme}
                        className={styles.themeToggleBtn} 
                        aria-label="Toggle Dark Mode"
                        style={{ color: isDark ? '#F3F4F6' : '#F59E0B' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            {isDark ? moonPath : sunPath}
                        </svg>
                    </button>
                </div>
                
                <div className={styles.rightPanel}>
                    <h1 className={styles.loginTitle}>Login</h1>
                    
                    <form className={styles.loginForm} onSubmit={handleLogin}>
                        <div className={`${styles.inputGroup} ${styles.emailGroup}`}>
                            <label className={styles.inputLabel}>Phone number or Username</label>
                            <input 
                                type="text" 
                                className={`${styles.inputBox} ${error ? styles.error : ''}`}
                                placeholder="Enter your phone number or Username"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                            />
                        </div>

                        <div className={`${styles.inputGroup} ${styles.passwordGroup}`}>
                            <label className={styles.inputLabel}>Password</label>
                            <input 
                                type="password" 
                                className={`${styles.inputBox} ${error ? styles.error : ''}`}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        {error && (
                            <span className={styles.inputErrorText} style={{ display: 'block', marginBottom: '10px' }}>
                                {error}
                            </span>
                        )}

                        <Link to="/forgot-password" className={styles.forgotPassword}>Forgot Password?</Link>

                        <button type="submit" className={`${styles.actionButton} ${styles.loginBtn}`}>Login</button>
                        
                        <div className={styles.divider}>
                            <span className={styles.dividerLine}></span>
                            <span className={styles.dividerText}>OR</span>
                            <span className={styles.dividerLine}></span>
                        </div>

                        <div className={styles.socialPillContainer}>
                            <button type="button" onClick={() => loginWithGoogle()} className={styles.socialPillBtn}>
                                <svg viewBox="0 0 24 24" width="24" height="24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                </svg>
                            </button>

                            <button type="button" onClick={handleFacebookClick} className={`${styles.socialPillBtn} ${styles.facebookBtn}`}>
                                <svg viewBox="0 0 24 24" width="24" height="24">
                                    <path fill="#ffffff" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H7v-3h3V9.5C10 6.54 11.75 5 14.4 5c1.29 0 2.65.23 2.65.23v2.92h-1.49c-1.47 0-1.93.91-1.93 1.84V12h3.33l-.53 3h-2.8v6.8C18.56 20.87 22 16.84 22 12z"/>
                                </svg>
                            </button>
                        </div>

                        <div className={styles.signupText}>
                            No account? <Link to="/register" className={styles.signupLink}>Signup</Link>
                        </div>

                        <div className={styles.signupText} style={{ marginTop: '24px' }}>
                            <Link to="/parent-login" style={{ color: 'var(--text-muted)', fontWeight: '600', textDecoration: 'none', fontSize: '14px' }}>Login as Parent</Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}



