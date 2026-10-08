import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import styles from './NewModal.module.css';
import CustomSelect from './CustomSelect';

const GRADE_OPTIONS = [
    { value: 'Grade 6', label: 'Grade 6' },
    { value: 'Grade 7', label: 'Grade 7' },
    { value: 'Grade 8', label: 'Grade 8' },
    { value: 'Grade 9', label: 'Grade 9' },
    { value: 'Grade 10', label: 'Grade 10' },
    { value: 'Grade 11', label: 'Grade 11' },
    { value: 'Grade 12 - Science', label: 'Grade 12 - Science' },
    { value: 'Grade 12 - Social Science', label: 'Grade 12 - Social Science' },
    { value: 'Casual', label: 'Casual' },
];

export default function NewQuizModal({ editingItem, onClose }) {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [form, setForm] = useState({
        title: '',
        subjectName: '',
        grade: '',
        xpReward: 0,
        lessonId: ''
    });

    const [questions, setQuestions] = useState([
        { id: 1, text: '', options: [{ id: 1, text: '', isCorrect: true }, { id: 2, text: '', isCorrect: false }] }
    ]);

    // Fetch lessons for the dropdown
    const { data: lessons = [] } = useQuery({
        queryKey: ['lessonsList'],
        queryFn: async () => {
            const token = localStorage.getItem('studyapp_token');
            const res = await apiFetch('/lessons', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) return [];
            return await res.json();
        }
    });

    useEffect(() => {
        if (editingItem) {
            setForm({
                title: editingItem.title || '',
                subjectName: editingItem.subjectname || '',
                grade: editingItem.grade || '',
                xpReward: editingItem.xpreward || 0,
                lessonId: editingItem.lessonid || ''
            });
            // We'd need to fetch existing questions if editing, but for now we focus on creation per the mockups.
            // If editing is required, a separate fetch to /quizzes/:id would populate questions.
        }
    }, [editingItem]);

    const getOrCreateSubjectId = async (subjectName) => {
        if (!subjectName) return null;
        const token = localStorage.getItem('studyapp_token');
        
        const res = await apiFetch('/subjects', { headers: { 'Authorization': `Bearer ${token}` } });
        const subjects = await res.json();
        
        const existing = subjects.find(s => s.subjectname.toLowerCase() === subjectName.toLowerCase());
        if (existing) return existing.subjectid;
        
        const createRes = await apiFetch('/subjects', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ subjectName })
        });
        const newSubject = await createRes.json();
        return newSubject.subjectid;
    };

    const handleAddQuestion = () => {
        setQuestions([...questions, { 
            id: Date.now(), 
            text: '', 
            options: [{ id: Date.now()+1, text: '', isCorrect: true }, { id: Date.now()+2, text: '', isCorrect: false }] 
        }]);
    };

    const handleRemoveQuestion = (qId) => {
        setQuestions(questions.filter(q => q.id !== qId));
    };

    const handleAddOption = (qId) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                return { ...q, options: [...q.options, { id: Date.now(), text: '', isCorrect: false }] };
            }
            return q;
        }));
    };

    const handleRemoveOption = (qId, oId) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                return { ...q, options: q.options.filter(o => o.id !== oId) };
            }
            return q;
        }));
    };

    const handleSetCorrectOption = (qId, oId) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                return { ...q, options: q.options.map(o => ({ ...o, isCorrect: o.id === oId })) };
            }
            return q;
        }));
    };

    const handleOptionTextChange = (qId, oId, text) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                return { ...q, options: q.options.map(o => o.id === oId ? { ...o, text } : o) };
            }
            return q;
        }));
    };

    const handleQuestionTextChange = (qId, text) => {
        setQuestions(questions.map(q => q.id === qId ? { ...q, text } : q));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            const token = localStorage.getItem('studyapp_token');
            const subjectId = await getOrCreateSubjectId(form.subjectName);
            
            // 1. Create Quiz
            const quizPayload = {
                title: form.title,
                subjectId,
                grade: form.grade,
                xpReward: form.xpReward,
                lessonId: form.lessonId || null
            };

            const method = editingItem ? 'PUT' : 'POST';
            const endpoint = editingItem ? `/quizzes/${editingItem.id}` : '/quizzes';
            
            if (editingItem) {
                // Optimistic UI update for edit
                queryClient.setQueryData(['contentData'], (old) => {
                    if (!old) return [];
                    return old.map(c => c.id === editingItem.id && c.type === 'Quiz' ? { ...c, ...quizPayload, subjectname: form.subjectName, updatedat: new Date().toISOString() } : c);
                });
                onClose(); // Close modal immediately for snappy UX

                apiFetch(endpoint, {
                    method,
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(quizPayload)
                }).then(res => {
                    if (!res.ok) throw new Error('Failed to save quiz');
                    queryClient.invalidateQueries({ queryKey: ['contentData'] });
                }).catch(err => {
                    console.error('Failed to save quiz', err);
                    queryClient.invalidateQueries({ queryKey: ['contentData'] }); // rollback
                });
            } else {
                // Create mode - wait for ID
                const quizRes = await apiFetch(endpoint, {
                    method,
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(quizPayload)
                });
                
                if (!quizRes.ok) throw new Error('Failed to save quiz');
                const createdQuiz = await quizRes.json();
                const quizId = createdQuiz.quizid;

                // 2. Create Questions
                for (const q of questions) {
                    if (!q.text) continue;
                    const qPayload = {
                        questionText: q.text,
                        options: q.options.map(o => ({ option: o.text, isCorrect: o.isCorrect })).filter(o => o.option.trim() !== '')
                    };
                    if (qPayload.options.length === 0) continue;

                    await apiFetch(`/quizzes/${quizId}/questions`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(qPayload)
                    });
                }
                queryClient.invalidateQueries({ queryKey: ['contentData'] });
                onClose();
            }
        } catch (err) {
            setError(err.message || 'Failed to save quiz.');
            setLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modalFrame} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <button type="button" className={styles.backBtn} onClick={onClose}>
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="#8b5cf6" strokeWidth="2" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        <span style={{ color: '#8b5cf6', fontWeight: '500' }}>Back</span>
                    </button>
                    <h2 className={styles.headerTitle}>{editingItem ? 'Edit Quiz' : 'New Quiz'}</h2>
                    <div style={{width: 60}}></div>
                </div>
                
                <form className={styles.scrollArea} onSubmit={handleSubmit}>
                    {error && <div className={styles.errorBox}>{error}</div>}

                    <div className={styles.inputGroup}>
                        <label>Title</label>
                        <input type="text" placeholder="e.g. Introduction to React" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
                    </div>

                    <div className={styles.rowGroup}>
                        <div className={styles.inputGroup} style={{flex: 2}}>
                            <label>Subject / Category</label>
                            <input type="text" placeholder="e.g. Web Developr" value={form.subjectName} onChange={e => setForm({...form, subjectName: e.target.value})} required />
                        </div>
                        <div className={styles.inputGroup} style={{flex: 1}}>
                            <label>Grade</label>
                            <CustomSelect 
                                options={GRADE_OPTIONS} 
                                value={form.grade} 
                                onChange={val => setForm({...form, grade: val})} 
                                placeholder="Select"
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>XP Reward</label>
                        <input type="number" placeholder="50" value={form.xpReward} onChange={e => setForm({...form, xpReward: parseInt(e.target.value) || 0})} />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Select Lesson</label>
                        <CustomSelect 
                            options={lessons.map(l => ({ value: l.lessonid, label: l.title }))} 
                            value={form.lessonId} 
                            onChange={val => setForm({...form, lessonId: val})} 
                            placeholder="None (Standalone Quiz)"
                        />
                    </div>

                    {!editingItem && (
                        <>
                            <h3 className={styles.sectionTitle}>Questions</h3>
                            {questions.map((q, index) => (
                                <div key={q.id} className={styles.questionCard}>
                                    <div className={styles.questionHeader}>
                                        <span>Question {index + 1}</span>
                                        {questions.length > 1 && (
                                            <button type="button" className={styles.removeBtn} onClick={() => handleRemoveQuestion(q.id)}>Remove</button>
                                        )}
                                    </div>
                                    <input 
                                        type="text" 
                                        className={styles.questionInput} 
                                        placeholder="Enter question..." 
                                        value={q.text} 
                                        onChange={e => handleQuestionTextChange(q.id, e.target.value)} 
                                        required 
                                    />
                                    
                                    <div className={styles.optionsList}>
                                        {q.options.map((opt, optIndex) => (
                                            <div key={opt.id} className={styles.optionRow}>
                                                <div 
                                                    className={`${styles.radioBtn} ${opt.isCorrect ? styles.selected : ''}`}
                                                    onClick={() => handleSetCorrectOption(q.id, opt.id)}
                                                ></div>
                                                <input 
                                                    type="text" 
                                                    className={styles.optionInput} 
                                                    placeholder={`Option ${optIndex + 1}`} 
                                                    value={opt.text} 
                                                    onChange={e => handleOptionTextChange(q.id, opt.id, e.target.value)} 
                                                    required 
                                                />
                                                {q.options.length > 2 && (
                                                    <button type="button" className={styles.removeBtn} onClick={() => handleRemoveOption(q.id, opt.id)}>✕</button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" className={styles.addOptionBtn} onClick={() => handleAddOption(q.id)}>+ Add Option</button>
                                </div>
                            ))}

                            <button type="button" className={styles.addQuestionBtn} onClick={handleAddQuestion}>
                                + Add Another Question
                            </button>
                        </>
                    )}

                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                        {loading ? 'Publishing...' : 'Publish'}
                    </button>
                </form>
            </div>
        </div>
    );
}
