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
    { value: 'Grade 12 (Science)', label: 'Grade 12 (Science)' },
    { value: 'Grade 12 (Social Science)', label: 'Grade 12 (Social Science)' },
    { value: 'Grade 12 - Science', label: 'Grade 12 - Science' },
    { value: 'Grade 12 - Social Science', label: 'Grade 12 - Social Science' },
    { value: 'Casual Grade', label: 'Casual Grade' },
];

export default function NewQuizModal({ editingItem, defaultIsPlacement = false, onClose }) {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [form, setForm] = useState({
        title: '',
        subjectName: '',
        grade: '',
        xpReward: 0,
        lessonId: '',
        is_placement: defaultIsPlacement
    });

    const [questions, setQuestions] = useState([
        {
            id: 1,
            text: '',
            topic: '',
            options: [
                { id: 1, text: '', isCorrect: true, rationale: '' },
                { id: 2, text: '', isCorrect: false, rationale: '' },
                { id: 3, text: '', isCorrect: false, rationale: '' },
                { id: 4, text: '', isCorrect: false, rationale: '' }
            ]
        }
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
                lessonId: editingItem.lessonid || '',
                is_placement: !!editingItem.is_placement
            });

            const mapLoadedQuestions = (qList) => {
                if (!Array.isArray(qList) || qList.length === 0) return;
                setQuestions(qList.map((q, qIdx) => ({
                    id: q.questionid || Date.now() + qIdx,
                    text: q.questiontext || q.text || '',
                    topic: q.topic || '',
                    options: Array.isArray(q.options) && q.options.length > 0
                        ? q.options.map((opt, oIdx) => ({
                            id: opt.optionid || Date.now() + qIdx * 100 + oIdx,
                            text: opt.option || opt.text || '',
                            isCorrect: !!(opt.iscorrect || opt.isCorrect),
                            rationale: opt.rationale || ''
                        }))
                        : [
                            { id: Date.now() + 1, text: '', isCorrect: true, rationale: '' },
                            { id: Date.now() + 2, text: '', isCorrect: false, rationale: '' }
                        ]
                })));
            };

            if (Array.isArray(editingItem.questions) && editingItem.questions.length > 0) {
                mapLoadedQuestions(editingItem.questions);
            } else if (editingItem.id) {
                const token = localStorage.getItem('studyapp_token');
                apiFetch(`/quizzes/${editingItem.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(r => r.ok ? r.json() : null).then(detail => {
                    if (detail?.questions) mapLoadedQuestions(detail.questions);
                }).catch(() => {});
            }
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
        const base = Date.now();
        setQuestions([...questions, { 
            id: base, 
            text: '', 
            topic: '',
            options: [
                { id: base + 1, text: '', isCorrect: true, rationale: '' },
                { id: base + 2, text: '', isCorrect: false, rationale: '' },
                { id: base + 3, text: '', isCorrect: false, rationale: '' },
                { id: base + 4, text: '', isCorrect: false, rationale: '' }
            ] 
        }]);
    };

    const handleRemoveQuestion = (qId) => {
        setQuestions(questions.filter(q => q.id !== qId));
    };

    const handleAddOption = (qId) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                return { ...q, options: [...q.options, { id: Date.now(), text: '', isCorrect: false, rationale: '' }] };
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

    const handleOptionRationaleChange = (qId, oId, rationale) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                return { ...q, options: q.options.map(o => o.id === oId ? { ...o, rationale } : o) };
            }
            return q;
        }));
    };

    const handleQuestionTextChange = (qId, text) => {
        setQuestions(questions.map(q => q.id === qId ? { ...q, text } : q));
    };

    const handleQuestionTopicChange = (qId, topic) => {
        setQuestions(questions.map(q => q.id === qId ? { ...q, topic } : q));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            const token = localStorage.getItem('studyapp_token');
            const subjectId = await getOrCreateSubjectId(form.subjectName);
            
            const formattedQuestions = questions
                .filter(q => q.text && q.text.trim() !== '')
                .map(q => ({
                    questionText: q.text.trim(),
                    topic: q.topic ? q.topic.trim() : null,
                    options: q.options
                        .filter(o => o.text && o.text.trim() !== '')
                        .map(o => ({
                            option: o.text.trim(),
                            isCorrect: !!o.isCorrect,
                            rationale: o.rationale ? o.rationale.trim() : null
                        }))
                }))
                .filter(q => q.options.length > 0);

            const quizPayload = {
                title: form.title,
                subjectId,
                grade: form.grade,
                xpReward: form.xpReward,
                lessonId: form.lessonId || null,
                is_placement: !!form.is_placement,
                questions: formattedQuestions
            };

            const method = editingItem ? 'PUT' : 'POST';
            const endpoint = editingItem ? `/quizzes/${editingItem.id}` : '/quizzes';
            
            if (editingItem) {
                const res = await apiFetch(endpoint, {
                    method,
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(quizPayload)
                });
                if (!res.ok) throw new Error('Failed to save quiz');
                queryClient.invalidateQueries({ queryKey: ['contentData'] });
                queryClient.invalidateQueries({ queryKey: ['placementQuestions'] });
                onClose();
            } else {
                const quizRes = await apiFetch(endpoint, {
                    method,
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(quizPayload)
                });
                
                if (!quizRes.ok) throw new Error('Failed to save quiz');
                const createdQuiz = await quizRes.json();
                const quizId = createdQuiz.quizid;

                for (const qPayload of formattedQuestions) {
                    await apiFetch(`/quizzes/${quizId}/questions`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(qPayload)
                    });
                }
                queryClient.invalidateQueries({ queryKey: ['contentData'] });
                queryClient.invalidateQueries({ queryKey: ['placementQuestions'] });
                onClose();
            }
        } catch (err) {
            setError(err.message || 'Failed to save quiz.');
            setLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modalFrame} style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
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
                        <input type="text" placeholder="e.g. Grade 12 Mathematics Placement Test" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
                    </div>

                    <div className={styles.rowGroup}>
                        <div className={styles.inputGroup} style={{flex: 2}}>
                            <label>Subject / Category</label>
                            <input type="text" placeholder="e.g. Math, Physics" value={form.subjectName} onChange={e => setForm({...form, subjectName: e.target.value})} required />
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

                    <div className={styles.rowGroup}>
                        <div className={styles.inputGroup} style={{ flex: 1 }}>
                            <label>XP Reward</label>
                            <input type="number" placeholder="50" value={form.xpReward} onChange={e => setForm({...form, xpReward: parseInt(e.target.value) || 0})} />
                        </div>
                        <div className={styles.inputGroup} style={{ flex: 1, justifyContent: 'flex-end' }}>
                            <label>Quiz Type</label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: form.is_placement ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-hover)', border: form.is_placement ? '1px solid #8b5cf6' : '1px solid transparent', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600 }}>
                                <input
                                    type="checkbox"
                                    checked={!!form.is_placement}
                                    onChange={e => setForm({ ...form, is_placement: e.target.checked })}
                                    style={{ width: 16, height: 16, accentColor: '#8b5cf6' }}
                                />
                                Grade Placement Test
                            </label>
                        </div>
                    </div>

                    {!form.is_placement && (
                        <div className={styles.inputGroup}>
                            <label>Select Lesson</label>
                            <CustomSelect 
                                options={lessons.map(l => ({ value: l.lessonid, label: l.title }))} 
                                value={form.lessonId} 
                                onChange={val => setForm({...form, lessonId: val})} 
                                placeholder="None (Standalone Quiz)"
                            />
                        </div>
                    )}

                    <h3 className={styles.sectionTitle}>Questions ({questions.length})</h3>
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
                                placeholder="Topic / Skill (e.g. Logarithmic Equations, Simple Harmonic Motion)" 
                                value={q.topic || ''} 
                                onChange={e => handleQuestionTopicChange(q.id, e.target.value)} 
                                style={{ fontSize: 13 }}
                            />
                            <textarea 
                                rows={2}
                                className={styles.questionInput} 
                                placeholder="Enter question text (supports LaTeX $...$)..." 
                                value={q.text} 
                                onChange={e => handleQuestionTextChange(q.id, e.target.value)} 
                                required 
                            />
                            
                            <div className={styles.optionsList}>
                                {q.options.map((opt, optIndex) => (
                                    <div key={opt.id} className={`${styles.optionCard} ${opt.isCorrect ? styles.optionCardCorrect : ''}`}>
                                        <div className={styles.optionRow}>
                                            <div 
                                                className={`${styles.radioBtn} ${opt.isCorrect ? styles.selected : ''}`}
                                                onClick={() => handleSetCorrectOption(q.id, opt.id)}
                                                title="Mark as correct option"
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
                                        <input
                                            type="text"
                                            className={styles.optionInput}
                                            style={{ marginLeft: 32, fontSize: 12, padding: '8px 12px' }}
                                            placeholder="Rationale / Explanation (optional — shown in Grade Placement diagnostics)"
                                            value={opt.rationale || ''}
                                            onChange={e => handleOptionRationaleChange(q.id, opt.id, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                            <button type="button" className={styles.addOptionBtn} onClick={() => handleAddOption(q.id)}>+ Add Option</button>
                        </div>
                    ))}

                    <button type="button" className={styles.addQuestionBtn} onClick={handleAddQuestion}>
                        + Add Another Question
                    </button>

                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                        {loading ? 'Saving...' : (editingItem ? 'Save Changes' : 'Publish')}
                    </button>
                </form>
            </div>
        </div>
    );
}
