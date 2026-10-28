import React, { useState, useRef, useEffect } from 'react';
import styles from './KeaktekAIChat.module.css';

const STARTER_PROMPTS = [
    { icon: '✨', label: 'Generate a Grade 12 Physics quiz' },
    { icon: '📊', label: 'Summarize student performance trends' },
    { icon: '📝', label: 'Draft a new Mathematics lesson plan' },
    { icon: '🎯', label: 'Analyze placement test readiness' }
];

export function GeminiSparkleIcon({ size = 20 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M12 2C12.3 7.2 16.8 11.7 22 12C16.8 12.3 12.3 16.8 12 22C11.7 16.8 7.2 12.3 2 12C7.2 11.7 11.7 7.2 12 2Z"
                fill="currentColor"
            />
        </svg>
    );
}

export default function KeaktekAIChat({ isOpen, onClose, user }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 120);
        }
    }, [isOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    if (!isOpen) return null;

    const sendMessage = (textToSend) => {
        const trimmed = (textToSend ?? input).trim();
        if (!trimmed || isTyping) return;

        const userMsg = {
            id: Date.now(),
            sender: 'user',
            text: trimmed
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        setTimeout(() => {
            setIsTyping(false);
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now() + 1,
                    sender: 'ai',
                    text: `Keaktek AI UI is ready! (Backend AI model is not configured yet for: "${trimmed}")`
                }
            ]);
        }, 700);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage();
    };

    const firstName = user?.username || user?.name || 'Admin';

    return (
        <div className={`${styles.aiPopupContainer} ${isExpanded ? styles.expanded : ''}`}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.brandGroup}>
                    <div className={styles.aiOrb}>
                        <GeminiSparkleIcon size={19} />
                    </div>
                    <div className={styles.titleGroup}>
                        <div className={styles.titleRow}>
                            <h3 className={styles.title}>Keaktek AI</h3>
                            <span className={styles.badge}>Beta</span>
                        </div>
                        <p className={styles.subtitle}>
                            <span className={styles.statusDot} />
                            Smart Learning & Admin Assistant
                        </p>
                    </div>
                </div>

                <div className={styles.headerActions}>
                    {messages.length > 0 && (
                        <button
                            type="button"
                            className={styles.headerIconBtn}
                            title="Clear conversation"
                            onClick={() => {
                                setMessages([]);
                                setIsTyping(false);
                            }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                            </svg>
                        </button>
                    )}
                    <button
                        type="button"
                        className={styles.headerIconBtn}
                        title={isExpanded ? 'Restore size' : 'Expand window'}
                        onClick={() => setIsExpanded(prev => !prev)}
                    >
                        {isExpanded ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="4 14 10 14 10 20" />
                                <polyline points="20 10 14 10 14 4" />
                                <line x1="14" y1="10" x2="21" y2="3" />
                                <line x1="3" y1="21" x2="10" y2="14" />
                            </svg>
                        ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 3 21 3 21 9" />
                                <polyline points="9 21 3 21 3 15" />
                                <line x1="21" y1="3" x2="14" y2="10" />
                                <line x1="3" y1="21" x2="10" y2="14" />
                            </svg>
                        )}
                    </button>
                    <button
                        type="button"
                        className={styles.headerIconBtn}
                        title="Close Keaktek AI"
                        onClick={onClose}
                    >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className={styles.messagesBody}>
                {messages.length === 0 ? (
                    <div className={styles.welcomeState}>
                        <div className={styles.heroSparkle}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <linearGradient id="keaktekGeminiGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%" stopColor="#8b5cf6" />
                                        <stop offset="55%" stopColor="#3b82f6" />
                                        <stop offset="100%" stopColor="#06b6d4" />
                                    </linearGradient>
                                </defs>
                                <path
                                    d="M12 2C12.3 7.2 16.8 11.7 22 12C16.8 12.3 12.3 16.8 12 22C11.7 16.8 7.2 12.3 2 12C7.2 11.7 11.7 7.2 12 2Z"
                                    fill="url(#keaktekGeminiGrad)"
                                />
                            </svg>
                        </div>
                        <h4 className={styles.welcomeTitle}>Hi {firstName}, I'm Keaktek AI</h4>
                        <p className={styles.welcomeDesc}>
                            How can I help you manage lessons, quizzes, or student analytics today?
                        </p>

                        <div className={styles.suggestionsGrid}>
                            {STARTER_PROMPTS.map((item, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    className={styles.suggestionChip}
                                    onClick={() => sendMessage(item.label)}
                                >
                                    <span className={styles.chipIcon}>{item.icon}</span>
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map(msg => (
                            <div
                                key={msg.id}
                                className={`${styles.messageRow} ${msg.sender === 'user' ? styles.userRow : ''}`}
                            >
                                {msg.sender === 'ai' && (
                                    <div className={styles.aiAvatarSmall}>
                                        <GeminiSparkleIcon size={14} />
                                    </div>
                                )}
                                <div
                                    className={`${styles.bubble} ${
                                        msg.sender === 'user' ? styles.userBubble : styles.aiBubble
                                    }`}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className={styles.messageRow}>
                                <div className={styles.aiAvatarSmall}>
                                    <GeminiSparkleIcon size={14} />
                                </div>
                                <div className={`${styles.bubble} ${styles.aiBubble}`}>
                                    <div className={styles.typingDots}>
                                        <span />
                                        <span />
                                        <span />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Footer Input */}
            <div className={styles.footer}>
                <form className={styles.inputForm} onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="text"
                        className={styles.textInput}
                        placeholder="Ask Keaktek AI anything..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                    />
                    <button
                        type="submit"
                        className={styles.sendBtn}
                        disabled={!input.trim() || isTyping}
                        aria-label="Send message"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
}
