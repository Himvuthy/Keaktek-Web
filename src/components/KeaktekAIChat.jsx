import React, { useState, useRef, useEffect } from 'react';
import styles from './KeaktekAIChat.module.css';

const STARTER_PROMPTS = [
    { icon: '✨', label: 'Generate a Grade 12 Physics quiz' },
    { icon: '📊', label: 'Summarize student performance trends' },
    { icon: '📝', label: 'Draft a new Mathematics lesson plan' },
    { icon: '🎯', label: 'Analyze placement test readiness' }
];

const PLUS_ACTIONS = [
    { id: 'file', icon: '📎', label: 'Upload file or document' },
    { id: 'image', icon: '🖼️', label: 'Attach image' },
    { id: 'curriculum', icon: '📚', label: 'Reference Lesson or Quiz' },
    { id: 'analytics', icon: '📊', label: 'Attach student report' }
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

    // Plus button menu & attachments
    const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const fileInputRef = useRef(null);
    const plusMenuRef = useRef(null);

    // Resizable window state (when in floating popup mode)
    const [size, setSize] = useState({ width: 400, height: 560 });
    const [isResizing, setIsResizing] = useState(false);
    const resizeRef = useRef(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 120);
        } else {
            setIsPlusMenuOpen(false);
        }
    }, [isOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Close plus menu when clicking outside
    useEffect(() => {
        const handleOutside = (e) => {
            if (plusMenuRef.current && !plusMenuRef.current.contains(e.target)) {
                setIsPlusMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    // Drag-to-resize logic
    const startResize = (direction) => (e) => {
        if (isExpanded) return;
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = size.width;
        const startHeight = size.height;

        setIsResizing(true);

        const onMouseMove = (moveEvent) => {
            const deltaX = startX - moveEvent.clientX; // anchored right -> moving left increases width
            const deltaY = startY - moveEvent.clientY; // anchored bottom -> moving up increases height

            const maxW = Math.min(window.innerWidth - 40, 1000);
            const maxH = Math.min(window.innerHeight - 40, 900);

            setSize({
                width: direction.includes('left')
                    ? Math.max(340, Math.min(maxW, startWidth + deltaX))
                    : startWidth,
                height: direction.includes('top')
                    ? Math.max(420, Math.min(maxH, startHeight + deltaY))
                    : startHeight
            });
        };

        const onMouseUp = () => {
            setIsResizing(false);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    if (!isOpen) return null;

    const handlePlusOption = (action) => {
        setIsPlusMenuOpen(false);
        if (action.id === 'file' || action.id === 'image') {
            fileInputRef.current?.click();
            return;
        }
        const label = action.id === 'curriculum' ? '📚 Curriculum Reference' : '📊 Student Analytics Report';
        setAttachments(prev => [...prev, { id: Date.now(), name: label }]);
        inputRef.current?.focus();
    };

    const handleFileChosen = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            const added = files.map((f, i) => ({
                id: Date.now() + i,
                name: `📎 ${f.name}`
            }));
            setAttachments(prev => [...prev, ...added]);
        }
        e.target.value = '';
        inputRef.current?.focus();
    };

    const removeAttachment = (id) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    const sendMessage = (textToSend) => {
        const trimmed = (textToSend ?? input).trim();
        if ((!trimmed && attachments.length === 0) || isTyping) return;

        const attachedPrefix = attachments.length > 0
            ? `[Attached: ${attachments.map(a => a.name).join(', ')}]\n`
            : '';
        const finalText = `${attachedPrefix}${trimmed || 'Analyze attached item'}`;

        const userMsg = {
            id: Date.now(),
            sender: 'user',
            text: finalText
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setAttachments([]);
        setIsTyping(true);

        setTimeout(() => {
            setIsTyping(false);
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now() + 1,
                    sender: 'ai',
                    text: `Keaktek AI UI is ready! (Backend AI model is not configured yet for: "${trimmed || 'attachment'}")`
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
        <div
            ref={resizeRef}
            className={`${styles.aiPopupContainer} ${isExpanded ? styles.expanded : ''} ${isResizing ? styles.resizing : ''}`}
            style={!isExpanded ? { width: `${size.width}px`, height: `${size.height}px` } : undefined}
        >
            {/* Drag-to-resize handles when not maximized */}
            {!isExpanded && (
                <>
                    <div
                        className={styles.resizeHandleTopLeft}
                        onMouseDown={startResize('top-left')}
                        title="Drag corner to resize"
                    >
                        <div className={styles.resizeGripLines} />
                    </div>
                    <div
                        className={styles.resizeHandleTop}
                        onMouseDown={startResize('top')}
                    />
                    <div
                        className={styles.resizeHandleLeft}
                        onMouseDown={startResize('left')}
                    />
                </>
            )}

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
                        title={isExpanded ? 'Restore floating window' : 'Maximize like a tab'}
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
                <div className={styles.messagesInner}>
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
            </div>

            {/* Footer Input */}
            <div className={styles.footer}>
                <div className={styles.footerInner} ref={plusMenuRef}>
                    {/* Hidden file input for UI preview */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleFileChosen}
                    />

                    {/* Plus Popover Menu */}
                    {isPlusMenuOpen && (
                        <div className={styles.plusPopover}>
                            {PLUS_ACTIONS.map(action => (
                                <button
                                    key={action.id}
                                    type="button"
                                    className={styles.plusPopoverItem}
                                    onClick={() => handlePlusOption(action)}
                                >
                                    <span>{action.icon}</span>
                                    <span>{action.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Attachment Chips */}
                    {attachments.length > 0 && (
                        <div className={styles.attachmentRow}>
                            {attachments.map(att => (
                                <span key={att.id} className={styles.attachmentTag}>
                                    <span>{att.name}</span>
                                    <button
                                        type="button"
                                        className={styles.removeAttachmentBtn}
                                        onClick={() => removeAttachment(att.id)}
                                        aria-label="Remove attachment"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    <form className={styles.inputForm} onSubmit={handleSubmit}>
                        <button
                            type="button"
                            className={`${styles.plusBtn} ${isPlusMenuOpen ? styles.active : ''}`}
                            onClick={() => setIsPlusMenuOpen(prev => !prev)}
                            title="Add files or context"
                            aria-label="Add attachment"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </button>

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
                            disabled={(!input.trim() && attachments.length === 0) || isTyping}
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
        </div>
    );
}
