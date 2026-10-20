import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
    { value: 'Casual Grade', label: 'Casual Grade' },
];

const SUBJECT_OPTIONS = [
    { value: 'Math', label: 'Mathematics' },
    { value: 'Physics', label: 'Physics' },
    { value: 'Chemistry', label: 'Chemistry' },
    { value: 'Biology', label: 'Biology' },
    { value: 'Khmer Literature', label: 'Khmer Literature' },
    { value: 'English', label: 'English' },
    { value: 'History', label: 'History' },
    { value: 'Geography', label: 'Geography' },
];

export default function PlacementQuestionModal({ editingQuestion, onClose }) {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [form, setForm] = useState({
        subjectName: 'Math',
        grade: 'Grade 12 (Science)',
        topic: '',
        questionText: '',
    });

    const [options, setOptions] = useState([
        { id: 1, text: '', isCorrect: true, rationale: '' },
        { id: 2, text: '', isCorrect: false, rationale: '' },
        { id: 3, text: '', isCorrect: false, rationale: '' },
        { id: 4, text: '', isCorrect: false, rationale: '' },
    ]);

    useEffect(() => {
        if (editingQuestion) {
            setForm({
                subjectName: editingQuestion.subjectname || 'Math',
                grade: editingQuestion.grade || 'Grade 12 (Science)',
                topic: editingQuestion.topic || '',
                questionText: editingQuestion.questiontext || '',
            });
            if (Array.isArray(editingQuestion.options) && editingQuestion.options.length > 0) {
                setOptions(editingQuestion.options.map((opt, idx) => ({
                    id: opt.optionid || idx + 1,
                    text: opt.option || opt.text || '',
                    isCorrect: !!(opt.iscorrect || opt.isCorrect),
                    rationale: opt.rationale || '',
                })));
            }
        }
    }, [editingQuestion]);

    const handleSetCorrect = (id) => {
        setOptions(options.map(o => ({ ...o, isCorrect: o.id === id })));
    };

    const handleOptionChange = (id, field, value) => {
        setOptions(options.map(o => o.id === id ? { ...o, [field]: value } : o));
    };

    const handleAddOption = () => {
        setOptions([...options, { id: Date.now(), text: '', isCorrect: false, rationale: '' }]);
    };

    const handleRemoveOption = (id) => {
        const remaining = options.filter(o => o.id !== id);
        if (remaining.length > 0 && !remaining.some(o => o.isCorrect)) {
            remaining[0].isCorrect = true;
        }
        setOptions(remaining);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const validOptions = options.filter(o => o.text.trim() !== '');
            if (validOptions.length < 2) {
                throw new Error('Please provide at least 2 options.');
            }
            if (!validOptions.some(o => o.isCorrect)) {
                validOptions[0].isCorrect = true;
            }

            const token = localStorage.getItem('studyapp_token');
            const payload = {
                quizId: editingQuestion?.quizid || null,
                subjectName: form.subjectName,
                grade: form.grade,
                topic: form.topic,
                questionText: form.questionText,
                options: validOptions.map(o => ({
                    option: o.text.trim(),
                    isCorrect: !!o.isCorrect,
                    rationale: o.rationale.trim() || null
                }))
            };

            const endpoint = editingQuestion
                ? `/placement-questions/${editingQuestion.questionid}`
                : '/placement-questions';
            const method = editingQuestion ? 'PUT' : 'POST';

            const res = await apiFetch(endpoint, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to save placement question.');
            }

            queryClient.invalidateQueries({ queryKey: ['placementQuestions'] });
            queryClient.invalidateQueries({ queryKey: ['contentData'] });
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to save placement question.');
            setLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modalFrame} style={{ maxWidth: 660 }} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <button type="button" className={styles.backBtn} onClick={onClose}>
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="#8b5cf6" strokeWidth="2" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        <span style={{ color: '#8b5cf6', fontWeight: '500' }}>Back</span>
                    </button>
                    <h2 className={styles.headerTitle}>
                        {editingQuestion ? `Edit Placement Question #${editingQuestion.questionid}` : 'New Grade Placement Question'}
                    </h2>
                    <div style={{ width: 60 }}></div>
                </div>

                <form className={styles.scrollArea} onSubmit={handleSubmit}>
                    {error && <div className={styles.errorBox}>{error}</div>}

                    <div className={styles.rowGroup}>
                        <div className={styles.inputGroup} style={{ flex: 1 }}>
                            <label>Subject</label>
                            <CustomSelect
                                options={SUBJECT_OPTIONS}
                                value={form.subjectName}
                                onChange={val => setForm({ ...form, subjectName: val })}
                                placeholder="Select Subject"
                            />
                        </div>
                        <div className={styles.inputGroup} style={{ flex: 1 }}>
                            <label>Target Grade</label>
                            <CustomSelect
                                options={GRADE_OPTIONS}
                                value={form.grade}
                                onChange={val => setForm({ ...form, grade: val })}
                                placeholder="Select Grade"
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Diagnostic Topic / Skill (used for Strengths & Weaknesses report)</label>
                        <input
                            type="text"
                            placeholder="e.g. Logarithmic Equations, Derivatives, Simple Harmonic Motion"
                            value={form.topic}
                            onChange={e => setForm({ ...form, topic: e.target.value })}
                            required
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Question Prompt (supports LaTeX math like $\log_2(x)$)</label>
                        <textarea
                            rows={3}
                            placeholder="Enter placement question text..."
                            value={form.questionText}
                            onChange={e => setForm({ ...form, questionText: e.target.value })}
                            required
                        />
                    </div>

                    <h3 className={styles.sectionTitle} style={{ fontSize: 15 }}>
                        Answer Options & Diagnostic Rationales (select the radio button for the correct answer)
                    </h3>

                    <div className={styles.optionsList}>
                        {options.map((opt, idx) => (
                            <div
                                key={opt.id}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 8,
                                    padding: 14,
                                    borderRadius: 12,
                                    background: opt.isCorrect ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-hover)',
                                    border: opt.isCorrect ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(128,128,128,0.15)'
                                }}
                            >
                                <div className={styles.optionRow}>
                                    <div
                                        className={`${styles.radioBtn} ${opt.isCorrect ? styles.selected : ''}`}
                                        onClick={() => handleSetCorrect(opt.id)}
                                        title="Click to mark as correct answer"
                                    />
                                    <span style={{ fontWeight: 700, fontSize: 13, color: opt.isCorrect ? '#10b981' : '#888', width: 22 }}>
                                        {String.fromCharCode(65 + idx)}.
                                    </span>
                                    <input
                                        type="text"
                                        className={styles.optionInput}
                                        placeholder={`Option ${String.fromCharCode(65 + idx)} text`}
                                        value={opt.text}
                                        onChange={e => handleOptionChange(opt.id, 'text', e.target.value)}
                                        required
                                    />
                                    {options.length > 2 && (
                                        <button type="button" className={styles.removeBtn} onClick={() => handleRemoveOption(opt.id)}>✕</button>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    className={styles.optionInput}
                                    style={{ marginLeft: 54, fontSize: 12.5, padding: '9px 12px' }}
                                    placeholder={opt.isCorrect ? 'Why is this option correct? (Rationale / step-by-step explanation)' : 'Why is this distractor incorrect? (Common misconception rationale)'}
                                    value={opt.rationale}
                                    onChange={e => handleOptionChange(opt.id, 'rationale', e.target.value)}
                                />
                            </div>
                        ))}
                    </div>

                    <button type="button" className={styles.addOptionBtn} onClick={handleAddOption}>
                        + Add Another Option
                    </button>

                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                        {loading ? 'Saving...' : (editingQuestion ? 'Save Question Changes' : 'Add Placement Question')}
                    </button>
                </form>
            </div>
        </div>
    );
}
