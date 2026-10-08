import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StudyBackground from '../components/StudyBackground';
import WaveBackground from '../components/WaveBackground';
import { auth } from '../firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import styles from './PhoneSignUp.module.css';
import logoLight from '../assets/logo.png';
import logoDark from '../assets/logo-dark.png';
import loginBgLight from '../assets/login-bg.png';
import loginBgDark from '../assets/login-bg-dark.png';

export default function PhoneSignUp() {
    const [isDark, setIsDark] = useState(false);
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showOtp, setShowOtp] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [confirmationResult, setConfirmationResult] = useState(null);
    
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

    // OTP Countdown Timer
    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setInterval(() => {
                setCountdown((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [countdown]);

    const setupRecaptcha = () => {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: 'invisible'
            });
        }
    };

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

    const handlePhoneChange = (e) => {
        setPhone(e.target.value);
        if (e.target.value.trim().length === 0) {
            setShowOtp(false);
        }
    };

    const handleGetOtp = async () => {
        if (!phone) {
            setError('Please enter a phone number.');
            return;
        }
        if (countdown > 0) return;

        setError('');
        setLoading(true);

        try {
            setupRecaptcha();
            const appVerifier = window.recaptchaVerifier;
            
            // Automatically format for Cambodia (+855) if no country code is provided
            let formattedPhone = phone;
            if (!formattedPhone.startsWith('+')) {
                // Remove leading zero if present for local Cambodian numbers
                const localNumber = formattedPhone.startsWith('0') ? formattedPhone.slice(1) : formattedPhone;
                formattedPhone = `+855${localNumber}`;
            }
            
            const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
            setConfirmationResult(confirmation);
            setShowOtp(true);
            setCountdown(30);
        } catch (err) {
            console.error('Firebase OTP Error:', err);
            if (err.code === 'auth/invalid-phone-number') {
                setError('Invalid phone number format. Please include your country code (e.g., +1, +44, +84).');
            } else {
                setError('Failed to send OTP. Please try again. ' + (err.message || ''));
            }
            // Do NOT clear recaptchaVerifier here, as it causes "already rendered" errors on retry.
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async () => {
        if (!phone || !otp || !password || !confirmPassword) {
            setError('Please fill in all fields.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setError('');
        setLoading(true);

        try {
            if (!confirmationResult) {
                setError('Please request a new OTP first.');
                setLoading(false);
                return;
            }

            // 1. Verify OTP with Firebase
            const result = await confirmationResult.confirm(otp);
            const fbUser = result.user;
            
            // 2. Get Firebase ID Token
            const idToken = await fbUser.getIdToken();

            // 3. Send token to our backend for database linking and JWT generation
            const response = await apiFetch(`/auth/phone/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken, password, phoneNumber: fbUser.phoneNumber })
            });

            const data = await response.json();
            if (response.ok) {
                // Log the user in with the token
                login(data.user, data.token);
                // Redirect to profile setup
                navigate('/profile-setup');
            } else {
                setError(data.error || 'Verification failed.');
            }
        } catch (err) {
            console.error('Sign up error:', err);
            if (err.code === 'auth/invalid-verification-code') {
                setError('Invalid OTP code.');
                setOtp('');
            } else {
                setError('Verification error. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const sunPath = <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 7a5 5 0 100 10 5 5 0 000-10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>;
    const moonPath = <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>;

    return (
        <div className={styles.wrapper}>
            <StudyBackground isDark={isDark} />
            <div className={styles.websiteCanvas}>
                
                <div className={styles.leftPanel}>
                    <WaveBackground className={styles.bgCanvas} isDark={isDark} />
                    
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
                    <h1 className={styles.loginTitle}>Sign up</h1>
                    
                    <form className={styles.loginForm} onSubmit={(e) => e.preventDefault()}>
                        <div id="recaptcha-container"></div>
                        
                        {error && error !== 'Invalid OTP code.' && (
                            <span className={styles.inputErrorText} style={{ display: 'block', marginBottom: '10px', textAlign: 'center', color: '#ff4d4d' }}>
                                {error}
                            </span>
                        )}

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Phone number</label>
                            
                            <div className={styles.inputWrapper}>
                                <input 
                                    type="tel" 
                                    className={styles.inputBox} 
                                    placeholder="Your phone number"
                                    value={phone}
                                    onChange={handlePhoneChange}
                                />
                                {phone.trim().length > 0 && (
                                    <span 
                                        className={styles.getOtpBtn} 
                                        onClick={countdown === 0 ? handleGetOtp : undefined}
                                        style={{ opacity: countdown > 0 ? 0.6 : 1, cursor: countdown > 0 ? 'default' : 'pointer' }}
                                    >
                                        {countdown > 0 ? `${countdown}s` : 'Get OTP'}
                                    </span>
                                )}
                            </div>
                            
                            {showOtp && (
                                <input 
                                    type="text" 
                                    className={`${styles.inputBox} ${styles.otpInput} ${error === 'Invalid OTP code.' ? styles.inputError : ''}`} 
                                    placeholder={error === 'Invalid OTP code.' ? "Invalid OTP code." : "Enter OTP"}
                                    value={otp}
                                    onChange={(e) => {
                                        setOtp(e.target.value);
                                        if (error === 'Invalid OTP code.') setError('');
                                    }}
                                    autoFocus
                                />
                            )}
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Password</label>
                            <input 
                                type="password" 
                                className={styles.inputBox} 
                                placeholder="Create your password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <input 
                                type="password" 
                                className={styles.inputBox} 
                                placeholder="Confirm your password" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>

                        <button 
                            type="button" 
                            className={`${styles.actionButton} ${styles.loginBtn}`} 
                            onClick={handleSignUp}
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : 'Sign up'}
                        </button>
                        
                        <div className={styles.loginRedirect}>
                            Have an account? <Link to="/login">Login</Link>
                        </div>
                        
                    </form>
                </div>

            </div>
        </div>
    );
}


