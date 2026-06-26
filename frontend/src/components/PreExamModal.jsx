import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { patientApi } from '../api';

const QUESTIONS = [
  '어지럽거나 평소보다 컨디션이 좋지않나요?',
  '손이 평소보다 부어 있거나 붉게 변해 있나요?',
];

export function getBlockedKey(token) {
  try {
    const sub = JSON.parse(atob(token.split('.')[1])).sub;
    return `exercise_blocked_date_${sub}`;
  } catch {
    return 'exercise_blocked_date_unknown';
  }
}

export default function PreExamModal({ onConfirm, onClose, onBlocked }) {
  const { token } = useAuth();
  const [answers, setAnswers] = useState([null, null]);
  const [submitted, setSubmitted] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const allAnswered = answers.every((a) => a !== null);

  const handleConfirm = () => {
    setSubmitted(true);
    if (!allAnswered) return;
    if (answers.some((a) => a === 'yes')) {
      setBlocked(true);
      patientApi.reportExerciseBlocked().catch(() => {});
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      localStorage.setItem(getBlockedKey(token), today);
      onBlocked?.();
    } else {
      onConfirm();
    }
  };

  const setAnswer = (idx, val) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!blocked ? onClose : undefined} />
      <div className="relative bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5">

        {!blocked ? (
          <>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>health_and_safety</span>
              <div>
                <h2 className="text-title-md font-bold text-on-surface">운동 전 사전 문진</h2>
                <p className="text-label-sm text-on-surface-variant">안전한 운동을 위해 현재 상태를 확인해주세요</p>
              </div>
            </div>

            <div className="space-y-4">
              {QUESTIONS.map((q, idx) => (
                <div key={idx} className="bg-surface-container p-4 rounded-xl space-y-3">
                  <p className="text-body-md text-on-surface font-medium">
                    <span className="text-primary font-bold mr-1">Q{idx + 1}.</span>{q}
                  </p>
                  <div className="flex gap-3">
                    {[{ val: 'yes', label: '예' }, { val: 'no', label: '아니오' }].map(({ val, label }) => {
                      const selected = answers[idx] === val;
                      return (
                        <button
                          key={val}
                          onClick={() => setAnswer(idx, val)}
                          className={`flex-1 h-10 rounded-lg text-label-md font-semibold border-2 transition-all
                            ${selected
                              ? val === 'yes'
                                ? 'bg-error border-error text-white'
                                : 'bg-primary border-primary text-white'
                              : 'border-outline-variant text-on-surface-variant hover:border-outline'
                            }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {submitted && !allAnswered && (
              <p className="text-label-sm text-error flex items-center gap-1">
                <span className="material-symbols-outlined text-base">error</span>
                모든 항목에 답변해 주세요
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 h-11 rounded-xl border border-outline-variant text-on-surface-variant text-label-md font-semibold hover:bg-surface-container transition-all"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 h-11 rounded-xl bg-primary text-white text-label-md font-semibold hover:brightness-110 active:scale-95 transition-all"
              >
                확인
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-error text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>local_hospital</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-title-md font-bold text-on-surface">운동을 진행할 수 없어요</h2>
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                증상이 확인되어 오늘 운동이 제한됩니다.<br />
                빠른 시일 내에 병원을 방문하여<br />
                주치의와 상담하시기 바랍니다.
              </p>
            </div>
            <div className="w-full bg-error/5 border border-error/20 rounded-xl p-4">
              <p className="text-label-sm text-error font-semibold flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                무리한 운동은 증상을 악화시킬 수 있습니다
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-surface-container text-on-surface text-label-md font-semibold hover:bg-surface-container-high transition-all"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
