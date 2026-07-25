import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import WaveBackground from '../components/WaveBackground';
import styles from './Register.module.css';

export default function ParentRegister() {
    const [isDark, setIsDark] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    // Check saved theme
    useEffect(() => {
        const savedTheme = localStorage.getItem('studyapp-theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            setIsDark(true);
        }
    }, []);

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

    const loginWithGoogle = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/google`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: tokenResponse.access_token, roleName: 'Parent' }),
                });

                const data = await response.json();

                if (!response.ok) {
                    setError(data.error || 'Google login failed.');
                    return;
                }

                login(data.user, data.token);
                navigate('/dashboard');
            } catch (err) {
                console.error('Google login error:', err);
                setError('An error occurred during Google login.');
            }
        },
        onError: () => setError('Google Login Failed')
    });

    const sunPath = <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 7a5 5 0 100 10 5 5 0 000-10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>;
    const moonPath = <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>;

    return (
        <div className={styles.registerWrapper}>
            <div className={styles.websiteCanvas}>
                
                <div className={styles.leftPanel}>
                    <WaveBackground className={styles.bgCanvas} isDark={isDark} />
                    
                    {/* Dynamic Logo */}
                    <img src={isDark ? "/logo-dark.png" : "/logo.png"} alt="Keaktek Logo" className={styles.uploadedLogo} />
                    
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
                    <h1 className={styles.loginTitle}>Parent Sign up</h1>
                    
                    <div className={styles.authOptions}>
                        {error && (
                            <span className={styles.inputErrorText} style={{ display: 'block', marginBottom: '10px', textAlign: 'center' }}>
                                {error}
                            </span>
                        )}

                        <button onClick={() => navigate('/parent-phone-signup')} className={`${styles.socialBtn} ${styles.btnPhone}`}>
                            <svg viewBox="0 0 24 24">
                                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                            </svg>
                            <span>Sign up with phone number</span>
                        </button>

                        <button className={`${styles.socialBtn} ${styles.btnFb}`}>
                            <svg viewBox="0 0 24 24">
                                <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H7v-3h3V9.5C10 6.54 11.75 5 14.4 5c1.29 0 2.65.23 2.65.23v2.92h-1.49c-1.47 0-1.93.91-1.93 1.84V12h3.33l-.53 3h-2.8v6.8C18.56 20.87 22 16.84 22 12z"/>
                            </svg>
                            <span>Sign up with facebook</span>
                        </button>
                        
                        <button type="button" onClick={() => loginWithGoogle()} className={`${styles.socialBtn} ${styles.btnGoogle}`}>
                            <svg viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            <span>Sign up with google</span>
                        </button>
                    </div>

                    <div className={styles.loginRedirect}>
                        Have an account? <Link to="/parent-login">Login</Link>
                    </div>

                    <div className={styles.loginRedirect} style={{ marginTop: '24px' }}>
                        <Link to="/register" style={{ color: 'var(--text-muted)', fontWeight: '600', textDecoration: 'none', fontSize: '14px' }}>Sign up as Student</Link>
                    </div>

                </div>

            </div>
        </div>
    );
}
